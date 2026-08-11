import type { SehajPath, SehajPathSyncResult } from '@api/generated/types.gen';
import {
  sehajPathSettingsControllerGet,
  sehajPathsControllerFindAll,
} from '@api/generated/sdk.gen';
import { clearCurrentToken } from '../auth/tokenUtils';
import type { AngsFormat, DateData, FontSizeData, PathData, VishraamsSource } from '../types';
import { recordError } from '../utils/crashlytics';
import type { AppStore, RootState } from './index';
import { getQuarantinedPathIds } from './persistence';
import { setSignedOut } from './slices/authSlice';
import {
  addServerPath,
  applyServerPathData,
  getNextPathId,
  removePathLocal,
} from './slices/pathsSlice';
import { hydrateSettings, type SettingsState } from './slices/settingsSlice';
import {
  ackServerPath,
  clearScrollIfUnchanged,
  clearSettingsIfUnchanged,
  dropMeta,
  markSettingsDirty,
  setLastSyncedAt,
  setSyncError,
  setPulling,
  setSyncStatus,
  upsertMeta,
  type SyncMeta,
} from './slices/syncSlice';
import { fromServerPath } from './syncAdapters';
import { clearBlockedWork, hasWorkBlockingPull, setConfirmedSettings } from './syncWork';
import { settingsFingerprint } from './syncRequest';
import { captureSyncSession, isCurrentSyncSession, syncSessionHeaders } from './syncSession';

/** Identifies which local response applies — the operation the client sent. */
export interface SentOp {
  pathId: number;
  sentLocalUpdatedAt: number;
  operation: 'create' | 'update';
}

const findLocalIdByServerPathId = (state: RootState, serverPathId: string): number | null => {
  for (const [key, meta] of Object.entries(state.sync.meta)) {
    if (meta.serverPathId === serverPathId) {
      return Number(key);
    }
  }
  return null;
};

/**
 * A background GET can be the first request to learn that a stored token has
 * expired. Treat that exactly like an outbox 401: stop using the token rather
 * than quietly retrying every foreground refresh with credentials the server
 * has already rejected.
 */
const signOutAfterUnauthorized = async (
  store: AppStore,
  token: string,
  context: string
): Promise<void> => {
  store.dispatch(setSignedOut());
  // The next login may be a different account reusing the same local path ids.
  clearBlockedWork(store);
  if (!(await clearCurrentToken(token))) {
    recordError(new Error('token could not be cleared after 401'), context);
  }
};

// --- settings type guards (server settings are an opaque object) -------------
const isFontSize = (value: unknown): value is FontSizeData =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as FontSizeData).fontSize === 'string' &&
  typeof (value as FontSizeData).number === 'number';

const isVishraamsSource = (value: unknown): value is VishraamsSource => {
  const source = (value as VishraamsSource | null)?.source;
  return source === 'sttm' || source === 'igurbani' || source === 'sttm2';
};

const isAngsFormat = (value: unknown): value is AngsFormat => {
  const format = (value as AngsFormat | null)?.format;
  return format === 'Punjabi' || format === 'English';
};

/** Applies a server settings document, keeping only known, well-typed keys. */
const applyServerSettings = (store: AppStore, settings: Record<string, unknown>): void => {
  const patch: Partial<SettingsState> = {};
  if (isFontSize(settings.fontSize)) {
    patch.fontSize = settings.fontSize;
  }
  if (typeof settings.larivaar === 'boolean') {
    patch.larivaar = settings.larivaar;
  }
  if (typeof settings.paragraphMode === 'boolean') {
    patch.paragraphMode = settings.paragraphMode;
  }
  if (typeof settings.vishraam === 'boolean') {
    patch.vishraam = settings.vishraam;
  }
  if (isVishraamsSource(settings.vishraamsSource)) {
    patch.vishraamsSource = settings.vishraamsSource;
  }
  if (isAngsFormat(settings.angsFormat)) {
    patch.angsFormat = settings.angsFormat;
  }
  if (typeof settings.consent === 'boolean') {
    patch.analyticsConsent = settings.consent;
  }
  if (Object.keys(patch).length > 0) {
    store.dispatch(hydrateSettings(patch));
  }
};

/** Creates a fresh local row for a path another device created. */
const allocateFromServer = (store: AppStore, sp: SehajPath): void => {
  const state = store.getState();
  const reserved = [
    ...state.paths.dates.map((entry) => entry.pathid),
    ...getQuarantinedPathIds(store),
  ];
  const pathId = getNextPathId(state.paths.paths, reserved);
  const applied = fromServerPath(sp);
  const path: PathData = {
    pathId,
    saveData: applied.pathPatch.saveData ?? { angNumber: sp.angNumber, verseId: sp.verseId },
    progress: applied.pathPatch.progress ?? sp.progress,
    startDate: applied.pathPatch.startDate ?? '',
    completionDate: applied.pathPatch.completionDate ?? '',
    pathName: applied.pathPatch.pathName ?? sp.name,
  };
  const date: DateData = {
    pathid: pathId,
    dates: applied.datePatch.dates ?? [],
    scrollPosition: sp.scrollPosition ?? 0,
  };
  store.dispatch(addServerPath({ path, date }));
  store.dispatch(
    upsertMeta({
      pathId,
      meta: {
        serverPathId: sp.pathId,
        startDate: sp.startDate,
        localUpdatedAt: sp.updatedAt,
        serverUpdatedAt: sp.updatedAt,
        onServer: true,
      },
    })
  );
};

/**
 * Folds one `SehajPath` back into local state, timestamp-guarded so a concurrent
 * local edit is never lost. A clean closed path receives the server's whole
 * checkpoint (ang, verse, and scroll together); a direct write response keeps
 * the reader's local scroll so it cannot jump while the user is reading.
 *
 * `serverUpdatedAt` is ALWAYS stored (so the next PATCH has the right
 * `baseUpdatedAt`); the body is applied only when it isn't superseded — for a
 * `sent` create/update, when the local change key still matches; for a
 * GET/`/sync` apply, when no local op is pending.
 */
export const applyServerPath = (store: AppStore, sp: SehajPath, sent?: SentOp): void => {
  const pathId = sent?.pathId ?? findLocalIdByServerPathId(store.getState(), sp.pathId);
  if (pathId == null) {
    allocateFromServer(store, sp);
    return;
  }

  const knownServerClock = store.getState().sync.meta[pathId]?.serverUpdatedAt ?? 0;
  const sentStillCurrent = sent
    ? store.getState().sync.meta[pathId]?.localUpdatedAt === sent.sentLocalUpdatedAt
    : false;
  const applied = fromServerPath(sp);
  if (sent) {
    store.dispatch(
      ackServerPath({
        pathId,
        sentLocalUpdatedAt: sent.sentLocalUpdatedAt,
        serverUpdatedAt: sp.updatedAt,
      })
    );
    if (!sentStillCurrent) {
      return; // a newer local edit landed mid-flight → keep the server clock, skip the body
    }
    if (sp.updatedAt < knownServerClock) {
      return; // another response already applied a newer server version
    }
    // The caller just sent this device's checkpoint. Do not make its reader
    // jump to a server-normalised/stale offset from the response body.
    delete applied.datePatch.scrollPosition;
  } else {
    if (sp.updatedAt < knownServerClock) {
      return; // overlapping refreshes must never move progress/server clocks backwards
    }
    if (
      store.getState().sync.pathOps[pathId] ||
      store.getState().sync.scrollDirty[pathId] != null
    ) {
      // Do not acknowledge this remote clock without applying/merging its body.
      // Keeping the old baseUpdatedAt makes the pending PATCH receive 409 and
      // take the safe bulk-merge path instead of overwriting the remote edit.
      //
      // This also covers a PERMANENTLY-BLOCKED op, which stays in `pathOps`:
      // `/sync` returns every server path, including ones excluded from the
      // request, so without this the server's older copy would silently
      // overwrite the very local change the block exists to preserve.
      return;
    }
    store.dispatch(
      upsertMeta({
        pathId,
        meta: {
          serverPathId: sp.pathId,
          startDate: sp.startDate,
          localUpdatedAt: Math.max(
            store.getState().sync.meta[pathId]?.localUpdatedAt ?? 0,
            sp.updatedAt
          ),
          serverUpdatedAt: sp.updatedAt,
          onServer: true,
        },
      })
    );
  }
  store.dispatch(
    applyServerPathData({ pathId, pathPatch: applied.pathPatch, datePatch: applied.datePatch })
  );
};

/**
 * Removes local rows that are on the server but no longer present in an
 * authoritative listing (deleted on another device). Skips any path that is
 * dirty (pending op or scroll) or the active reader path — those defer until the
 * next safe refresh so a delete never lands under an active reader.
 */
export const reconcileDeletions = (
  store: AppStore,
  presentServerIds: Set<string>,
  activePathId?: number,
  expectedMeta?: Map<number, Pick<SyncMeta, 'serverPathId' | 'serverUpdatedAt' | 'localUpdatedAt'>>
): void => {
  const state = store.getState();
  for (const [key, meta] of Object.entries(state.sync.meta)) {
    const pathId = Number(key);
    if (!meta.onServer || presentServerIds.has(meta.serverPathId)) {
      continue;
    }
    if (expectedMeta) {
      const expected = expectedMeta.get(pathId);
      // Only delete rows that existed, with the same identity and clocks, when
      // this GET began. A path created/updated and acknowledged while the GET
      // was in flight must not be removed by that older listing.
      if (
        !expected ||
        expected.serverPathId !== meta.serverPathId ||
        expected.serverUpdatedAt !== meta.serverUpdatedAt ||
        expected.localUpdatedAt !== meta.localUpdatedAt
      ) {
        continue;
      }
    }
    if (
      state.sync.pathOps[pathId] ||
      state.sync.scrollDirty[pathId] != null ||
      pathId === activePathId
    ) {
      continue;
    }
    store.dispatch(removePathLocal(pathId));
    store.dispatch(dropMeta(pathId));
  }
};

/**
 * The dirty markers included in a `/sync` request, captured BEFORE the call so
 * the response can be applied without clobbering an edit made during it.
 */
export interface SyncSnapshot {
  /** pathId → the pending op's `localUpdatedAt` that was sent. */
  ops: Map<number, number>;
  /** pathId → the `scrollDirty` timestamp that was sent. */
  scroll: Map<number, number>;
  /** The `pendingSettingsUpdatedAt` that was sent, or null. */
  settingsRev: number | null;
}

export interface ApplySyncOptions {
  /**
   * Used only while a user explicitly claims/downloads an account. The account
   * settings win over settings changed before that account was chosen. A setting
   * changed during the request still stays local and pending.
   */
  serverSettingsWin?: boolean;
}

export const captureSyncSnapshot = (state: RootState): SyncSnapshot => ({
  ops: new Map(
    Object.entries(state.sync.pathOps).map(([key, op]) => [Number(key), op.localUpdatedAt])
  ),
  scroll: new Map(Object.entries(state.sync.scrollDirty).map(([key, ts]) => [Number(key), ts])),
  settingsRev: state.sync.pendingSettingsUpdatedAt,
});

/**
 * Applies a bulk `/sync` result (a 409 reconcile, or the Step 9 confirmed sync).
 *
 * Every returned path is applied timestamp-guarded against the `snapshot`: when
 * the pending op we sent still matches, the merged server truth is written and
 * the op cleared (via `ackServerPath`); a newer edit made during the request is
 * preserved and stays queued. Server-deleted paths are removed only when not
 * locally dirtier (pending op OR dirty scroll). Settings/scroll dirty markers are
 * cleared only when still equal to what was sent. `syncedAt` is stored verbatim.
 */
export const applySyncResult = (
  store: AppStore,
  result: SehajPathSyncResult,
  snapshot: SyncSnapshot,
  options: ApplySyncOptions = {}
): void => {
  result.paths.forEach((sp) => {
    const pathId = findLocalIdByServerPathId(store.getState(), sp.pathId);
    const sentLocalUpdatedAt = pathId == null ? undefined : snapshot.ops.get(pathId);
    if (pathId != null && sentLocalUpdatedAt != null) {
      // We sent an op for this path: apply the merged truth, guarded so a newer
      // edit made during the /sync request survives (and its op stays pending).
      applyServerPath(store, sp, { pathId, sentLocalUpdatedAt, operation: 'update' });
    } else {
      applyServerPath(store, sp); // unknown, or no op we sent → plain apply/allocate
    }
  });

  result.deletedPathIds.forEach((serverId) => {
    const pathId = findLocalIdByServerPathId(store.getState(), serverId);
    if (pathId == null) {
      return;
    }
    const { pathOps, scrollDirty } = store.getState().sync;
    const sentOp = snapshot.ops.get(pathId);
    const sentScroll = snapshot.scroll.get(pathId);
    // Keep only work that landed AFTER this /sync began. If the current marker
    // is exactly the one we sent, the server has already compared it with the
    // tombstone and decided deletion wins; retaining it would loop PATCH→404→sync.
    if (
      (pathOps[pathId] && pathOps[pathId].localUpdatedAt !== sentOp) ||
      (scrollDirty[pathId] != null && scrollDirty[pathId] !== sentScroll)
    ) {
      return;
    }
    store.dispatch(removePathLocal(pathId));
    store.dispatch(dropMeta(pathId));
  });

  snapshot.scroll.forEach((ts, pathId) => {
    store.dispatch(clearScrollIfUnchanged({ pathId, sentLocalUpdatedAt: ts }));
  });

  const pendingSettings = store.getState().sync.pendingSettingsUpdatedAt;
  if (
    result.settings &&
    (pendingSettings == null ||
      (options.serverSettingsWin === true && pendingSettings === snapshot.settingsRev))
  ) {
    applyServerSettings(store, result.settings.settings);
  }
  if (snapshot.settingsRev != null) {
    store.dispatch(clearSettingsIfUnchanged(snapshot.settingsRev));
  }

  store.dispatch(setLastSyncedAt(result.syncedAt));
};

/**
 * Pulls the authoritative path list with `GET /paths` and folds it into local
 * state — this is how a device learns about paths created or deleted on another
 * device. Applies each returned path (allocating unknown ones) and removes local
 * on-server paths the server no longer returns.
 *
 * Guarded (Step 8 §3): it refuses to run while the outbox has pending path ops,
 * the loaded data isn't associated with the signed-in account, or recovery is
 * needed — so a refresh can never clobber unsynced local edits or mix accounts.
 * Per-path guards in `applyServerPath`/`reconcileDeletions` still protect the
 * active reader and any dirty scroll. Returns false when it was skipped or failed.
 */
const refreshes = new WeakMap<AppStore, Promise<boolean>>();

const performRefreshPathsFromServer = async (
  store: AppStore,
  activePathId?: number
): Promise<boolean> => {
  const state = store.getState();
  if (
    !state.sync.hydrated ||
    state.sync.recoveryNeeded ||
    !state.auth.email ||
    state.sync.account !== state.auth.email ||
    // Covers sendable ops AND dirty scroll. A permanently-blocked op must never
    // count here: it stays in `pathOps` forever, so a raw key count would freeze
    // cloud downloads on this device permanently.
    hasWorkBlockingPull(store, state)
  ) {
    return false;
  }
  const session = captureSyncSession(state);
  if (!session) {
    return false;
  }
  const settingsUpdatedAtAtStart = state.sync.settingsUpdatedAt;
  const expectedMeta = new Map(
    Object.entries(state.sync.meta).map(([key, meta]) => [
      Number(key),
      {
        serverPathId: meta.serverPathId,
        serverUpdatedAt: meta.serverUpdatedAt,
        localUpdatedAt: meta.localUpdatedAt,
      },
    ])
  );

  try {
    const [pathsResult, settingsResult] = await Promise.all([
      sehajPathsControllerFindAll({ headers: syncSessionHeaders(session) }),
      sehajPathSettingsControllerGet({ headers: syncSessionHeaders(session) }),
    ]);
    // A logout or a different login may happen while GET is in flight. Never
    // let account A's response populate account B's local dataset.
    const current = store.getState();
    if (
      !isCurrentSyncSession(current, session) ||
      current.sync.account !== session.email ||
      current.sync.recoveryNeeded
    ) {
      return false;
    }
    const pathsUnauthorized = pathsResult.error && pathsResult.response?.status === 401;
    const settingsUnauthorized = settingsResult.error && settingsResult.response?.status === 401;
    if (pathsUnauthorized || settingsUnauthorized) {
      await signOutAfterUnauthorized(
        store,
        session.token,
        'refresh: clearing token after 401 failed'
      );
      return false;
    }
    const settingsMissing = settingsResult.error && settingsResult.response?.status === 404;
    // "Nothing changed" is a successful answer, not a failure. Without this the
    // client reports "unable to sync" for a refresh the server answered fine.
    const pathsUnchanged = pathsResult.error && pathsResult.response?.status === 304;
    if (pathsUnchanged) {
      store.dispatch(setSyncError(null));
      store.dispatch(setSyncStatus('idle'));
      return true;
    }
    if (pathsResult.error || !pathsResult.data || (settingsResult.error && !settingsMissing)) {
      // A foreground refresh has no caller that can show its false result. Put
      // the failure in sync state so the in-app status notice can tell the user
      // their cloud copy could not be loaded instead of showing an empty/stale UI.
      store.dispatch(setSyncError('network'));
      return false;
    }
    pathsResult.data.forEach((sp) => {
      // Leave the path open in the reader completely untouched — don't apply the
      // server's name/progress/readDates under an active reader. It reconciles on
      // the next safe refresh once the reader exits.
      const localId = findLocalIdByServerPathId(store.getState(), sp.pathId);
      if (localId != null && localId === activePathId) {
        return;
      }
      applyServerPath(store, sp);
    });
    reconcileDeletions(
      store,
      new Set(pathsResult.data.map((sp) => sp.pathId)),
      activePathId,
      expectedMeta
    );
    // A local settings edit wins until its own PUT is acknowledged. Otherwise
    // this is the normal place a second device's settings reach this device.
    if (
      !settingsResult.error &&
      settingsResult.data &&
      store.getState().sync.pendingSettingsUpdatedAt == null &&
      store.getState().sync.settingsUpdatedAt === settingsUpdatedAtAtStart
    ) {
      applyServerSettings(store, settingsResult.data.settings);
      // Local settings now mirror the server's, so record that as the confirmed
      // baseline. Without this, a settings change made on ANOTHER device would
      // leave this one comparing against whatever it last uploaded itself —
      // stale forever, and every later toggle-and-undo would upload needlessly.
      // Only safe because nothing was pending: with a pending edit the apply is
      // skipped above and local state does NOT match the server.
      setConfirmedSettings(store, settingsFingerprint(store.getState().settings));
    } else if (settingsMissing && store.getState().sync.pendingSettingsUpdatedAt == null) {
      // The account has NO settings document on the server yet (a plain 404 —
      // fresh account, or settings were never synced). Seed it with THIS
      // device's current settings so the next login restores them instead of
      // starting from defaults every time. Skipped when a local settings edit is
      // already pending — the outbox will push that (newer) value on its own.
      // `markSettingsDirty` stamps the current settings; the outbox's store
      // subscription then uploads them (PUT /settings).
      store.dispatch(markSettingsDirty({ at: Date.now() }));
    }
    // A later successful pull clears any earlier refresh-only network notice.
    // (There may be no outbox operation to clear it for us.)
    store.dispatch(setSyncError(null));
    store.dispatch(setSyncStatus('idle'));
    return true;
  } catch (error) {
    recordError(error, 'refresh: GET /paths failed');
    store.dispatch(setSyncError('network'));
    return false;
  }
};

/**
 * Coalesces overlapping Home/foreground pulls for the same store. Without this,
 * an older request can finish last and temporarily roll paths/settings back.
 */
export const refreshPathsFromServer = (
  store: AppStore,
  activePathId?: number
): Promise<boolean> => {
  const existing = refreshes.get(store);
  if (existing) {
    return existing;
  }
  const request = performRefreshPathsFromServer(store, activePathId).finally(() => {
    if (refreshes.get(store) === request) {
      refreshes.delete(store);
    }
    // ALWAYS cleared, even if this request is no longer the tracked one. It is a
    // display flag: clearing it a moment early is invisible, while failing to
    // clear it leaves the status notice spinning for the rest of the session
    // with nothing to resolve it.
    store.dispatch(setPulling(false));
  });
  refreshes.set(store, request);
  // Dispatched only after the entry is tracked. `dispatch` runs subscribers
  // synchronously, and one of them can call back into this function — before the
  // map was populated that produced a second, untracked request.
  store.dispatch(setPulling(true));
  return request;
};
