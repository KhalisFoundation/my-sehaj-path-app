import type { SehajPath, SehajPathSyncResult } from '@api/generated/types.gen';
import { resolveFontSize } from '../constants/FontSize';
import {
  sehajPathSettingsControllerGet,
  sehajPathMembersControllerFindAccessible,
  sehajPathsControllerFindAll,
} from '@api/generated/sdk.gen';
import { clearCurrentToken } from '../auth/tokenUtils';
import type { AngsFormat, DateData, FontSizeData, PathData, VishraamsSource } from '../types';
import { recordError } from '../utils/crashlytics';
import { removePathAndSyncState, type AppStore, type RootState } from './index';
import { getQuarantinedPathIds } from './persistence';
import { setSignedOut } from './slices/authSlice';
import { addServerPath, applyServerPathData, getNextPathId } from './slices/pathsSlice';
import { hydrateSettings, type SettingsState } from './slices/settingsSlice';
import {
  setPathShared,
  ackServerPath,
  clearScrollIfUnchanged,
  clearSettingsIfUnchanged,
  markSettingsDirty,
  setLastSyncedAt,
  setSyncError,
  setPulling,
  setSyncStatus,
  showSessionExpired,
  upsertMeta,
  type SyncMeta,
} from './slices/syncSlice';
import { fromServerPath } from './syncAdapters';
import { clearBlockedWork, hasWorkBlockingPull, setConfirmedSettings } from './syncWork';
import { settingsFingerprint } from './syncRequest';
import { captureSyncSession, isCurrentSyncSession, syncSessionHeaders } from './syncSession';
import { getActiveReaderPath } from './activeReaderPath';

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
  store.dispatch(showSessionExpired());
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
  // Resolved, not normalised: another device may be on the old scale or an older
  // app version, so the value still has to be mapped onto the current one. But
  // if it cannot be mapped at all, the account's document is left unapplied and
  // this device keeps the size its owner chose. Falling back to the default here
  // would quietly reset somebody's setting because another device wrote rubbish.
  const serverFontSize = isFontSize(settings.fontSize)
    ? resolveFontSize(settings.fontSize)
    : undefined;
  if (serverFontSize) {
    patch.fontSize = serverFontSize;
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
        serverCreatedAt: sp.createdAt,
        localUpdatedAt: sp.updatedAt,
        serverUpdatedAt: sp.updatedAt,
        onServer: true,
      },
    })
  );
};

/**
 * Give a path somebody else owns a local row, so it can be seen and read.
 *
 * A joined path never arrives through `GET /sehaj-path/paths` — that endpoint is
 * owner-scoped — and `accessible` deliberately returns `pathId: null` for it,
 * because handing back another device's client-generated id would invite this
 * one to treat the path as its own. The consequence was that a member who
 * joined a path saw nothing at all: the path existed, they had access, and
 * their app had no row to render.
 *
 * The row is marked `shared` from the moment it is created, which is what keeps
 * it out of the bulk `/sync` body — this device must never push a path it does
 * not own. For an owner row, preserve the original client-generated `pathId`
 * as `serverPathId`; for a joined row, the group id is the only stable identity
 * available. Inventing a second identifier for an owner path is what previously
 * caused the same path to be allocated twice after logout and invite login.
 */
const allocateAccessiblePath = (
  store: AppStore,
  row: {
    id: string;
    pathId?: string | null;
    name: string;
    angNumber: number;
    verseId: number;
    progress: number;
    startDate: number;
    memberCount?: number;
  }
): void => {
  const state = store.getState();
  const reserved = [
    ...state.paths.dates.map((entry) => entry.pathid),
    ...getQuarantinedPathIds(store),
  ];
  const pathId = getNextPathId(state.paths.paths, reserved);
  const now = Date.now();

  store.dispatch(
    addServerPath({
      path: {
        pathId,
        saveData: { angNumber: row.angNumber, verseId: row.verseId },
        progress: row.progress,
        startDate: '',
        completionDate: '',
        pathName: row.name,
      },
      date: { pathid: pathId, dates: [], scrollPosition: 0 },
    })
  );
  store.dispatch(
    upsertMeta({
      pathId,
      meta: {
        // Owner rows expose the original client-generated sync id. Keep it so
        // a logout/login through the owner's invite can be matched by the
        // owner-scoped `/paths` response instead of allocating a second row.
        // Joined rows have no pathId and continue to use the group id.
        serverPathId: row.pathId ?? row.id,
        // Keep the app compatible during a staggered rollout where an older
        // API instance may not include this newly-added response field yet.
        startDate: row.startDate ?? now,
        localUpdatedAt: now,
        serverUpdatedAt: now,
        onServer: true,
      },
    })
  );
  store.dispatch(
    setPathShared({
      pathId,
      shared: row.pathId != null ? (row.memberCount ?? 1) > 1 : true,
      groupId: row.id,
    })
  );
};

/**
 * Resolve one path immediately after an invite join.
 *
 * Invite joining is an authenticated group operation, not a personal-data
 * sync operation.  In particular, a newly signed-in account may not have
 * completed its `/sync` association yet.  Reusing the guarded owner refresh
 * here therefore creates a race and reports a valid join as a missing path.
 * The accessible-path endpoint is the authoritative source for this flow and
 * is safe to call before the personal sync account is associated.
 */
export const ensureAccessiblePath = async (
  store: AppStore,
  sehajPathId: string
): Promise<number | null> => {
  const session = captureSyncSession(store.getState());
  if (!session) {
    return null;
  }

  const result = await sehajPathMembersControllerFindAccessible({
    headers: syncSessionHeaders(session),
  });
  if (result.error || !result.data) {
    return null;
  }

  const row = result.data.find((candidate) => candidate.id === sehajPathId);
  if (!row) {
    return null;
  }

  const current = store.getState();
  const entries = Object.entries(current.sync.meta);
  // Prefer the owner identity when it is available. If a stale member-style
  // row already exists for the same group, choosing it first would preserve
  // the duplicate instead of reconnecting the canonical owner row.
  const existing =
    (typeof row.pathId === 'string'
      ? entries.find(([, meta]) => meta.serverPathId === row.pathId)
      : undefined) ?? entries.find(([, meta]) => meta.groupId === sehajPathId);
  const localId = existing ? Number(existing[0]) : null;

  if (localId === null) {
    allocateAccessiblePath(store, row);
    const serverIdentity = row.pathId ?? row.id;
    const allocated = Object.entries(store.getState().sync.meta).find(
      ([, meta]) => meta.serverPathId === serverIdentity || meta.groupId === sehajPathId
    );
    return allocated ? Number(allocated[0]) : null;
  }

  // An owner can open their own invite after signing back in.  That does not
  // make a personal path a group path; only an additional active member does.
  store.dispatch(
    setPathShared({
      pathId: localId,
      shared: row.memberCount > 1,
      groupId: sehajPathId,
    })
  );
  if (Number.isFinite(row.startDate)) {
    store.dispatch(
      upsertMeta({
        pathId: localId,
        meta: {
          serverPathId: row.pathId ?? row.id,
          startDate: row.startDate,
        },
      })
    );
  }
  store.dispatch(
    applyServerPathData({
      pathId: localId,
      pathPatch: {
        pathName: row.name,
        progress: row.progress,
        saveData: { angNumber: row.angNumber, verseId: row.verseId },
      },
      datePatch: {},
    })
  );
  return localId;
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
  // Creation time never changes. Keep it even if the body is intentionally
  // skipped because a newer local edit is pending; Home uses it for display
  // order only and it has no effect on conflict handling or API requests.
  if (store.getState().sync.meta[pathId]?.serverCreatedAt !== sp.createdAt) {
    store.dispatch(
      upsertMeta({
        pathId,
        meta: { serverPathId: sp.pathId, startDate: sp.startDate, serverCreatedAt: sp.createdAt },
      })
    );
  }
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
          serverCreatedAt: sp.createdAt,
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
    // A joined path is owned by somebody else, so it is ABSENT from the
    // owner-scoped listing this set is built from — its absence says nothing
    // about whether it still exists. Deleting on that basis would remove the
    // path from every member's device the moment they synced. Losing access is
    // reported separately, by `accessible` no longer returning it.
    if (meta.shared) {
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
    store.dispatch(removePathAndSyncState({ pathId }));
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
  const activePathId = getActiveReaderPath();
  result.paths.forEach((sp) => {
    const pathId = findLocalIdByServerPathId(store.getState(), sp.pathId);
    // A bulk conflict response contains the account's entire list, including
    // clean paths unrelated to the conflicting edit. Never replace data under
    // the open reader: applying its ang/verse/scroll makes the screen jump.
    // Leave its clock and dirty markers intact too, so its next safe sync takes
    // the normal merge path instead of treating unseen server data as a base.
    if (pathId != null && pathId === activePathId) {
      return;
    }
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
    if (pathId === activePathId) {
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
    store.dispatch(removePathAndSyncState({ pathId }));
  });

  snapshot.scroll.forEach((ts, pathId) => {
    if (pathId === activePathId) {
      return;
    }
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
interface ActiveRefresh {
  request: Promise<boolean>;
  /** The reader path this request deliberately leaves untouched, if any. */
  activePathId: number | undefined;
}

const refreshes = new WeakMap<AppStore, ActiveRefresh>();

const performRefreshPathsFromServer = async (
  store: AppStore,
  activePathId?: number,
  showStatus = true
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
    const [pathsResult, settingsResult, accessibleResult] = await Promise.all([
      sehajPathsControllerFindAll({ headers: syncSessionHeaders(session) }),
      sehajPathSettingsControllerGet({ headers: syncSessionHeaders(session) }),
      // Which of those paths are shared with a group.
      //
      // Never allowed to fail the refresh. It answers an extra question about
      // rows the other two calls already fetched, so losing the answer means a
      // shared path is momentarily treated as personal — the server refuses a
      // rewind of a shared path regardless, so this is defence in depth, not
      // the only guard. Failing the whole sync over it would trade a small
      // degradation for a total one.
      sehajPathMembersControllerFindAccessible({
        headers: syncSessionHeaders(session),
      }).catch(() => null),
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
    if (
      (pathsResult.error && !pathsUnchanged) ||
      (!pathsUnchanged && !pathsResult.data) ||
      (settingsResult.error && !settingsMissing)
    ) {
      // A foreground refresh has no caller that can show its false result. Put
      // the failure in sync state so the in-app status notice can tell the user
      // their cloud copy could not be loaded instead of showing an empty/stale UI.
      if (showStatus) {
        store.dispatch(setSyncError('network'));
      }
      return false;
    }
    if (!pathsUnchanged && pathsResult.data) {
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
    }
    // Mark which local paths are actively shared, BEFORE anything else looks
    // at them.
    //
    // This flag is what makes a group path behave as a group path: the bulk
    // `/sync` body leaves it out, the middleware stops marking it dirty, and
    // `isGroupPath` gates the reader. Every one of those was built and tested,
    // and none of them did anything, because nothing set the flag — so a shared
    // path was still being pushed through the owner-scoped merge that can
    // rewind a group's reading.
    //
    // Only OWNED paths matter here. `GET /sehaj-path/paths` is owner-scoped, so
    // a joined path has no local row to mark — and `accessible` returns
    // `pathId: null` for exactly those.
    if (accessibleResult?.data) {
      // Read fresh rather than reusing the `state` captured at entry: the calls
      // above have applied server paths since, so an older snapshot could miss
      // the very meta this match needs.
      const afterPaths = store.getState();
      for (const row of accessibleResult.data) {
        // `pathId: null` means this device does not own the path — it joined
        // it. Those have no local row until one is made here.
        if (!row.pathId) {
          const joinedId = findLocalIdByServerPathId(store.getState(), row.id);
          if (joinedId == null) {
            allocateAccessiblePath(store, row);
          } else {
            // Re-assert it on every refresh rather than only at creation.
            // `setPathShared` is also what drops work queued for a path that
            // can never be pushed, so skipping it here left a joined row
            // retrying a `PATCH` for ever.
            store.dispatch(setPathShared({ pathId: joinedId, shared: true, groupId: row.id }));
            if (Number.isFinite(row.startDate)) {
              store.dispatch(
                upsertMeta({
                  pathId: joinedId,
                  meta: { serverPathId: row.id, startDate: row.startDate },
                })
              );
            }
            // And take the group's position from the same response.
            //
            // A joined path is a VIEW of a row this device does not own: it
            // never appears in `GET /sehaj-path/paths`, so nothing else here
            // ever updates it. Created once and never refreshed, it showed
            // whatever the path stood at when the member joined — so two
            // devices reading the same path disagreed about how far it had got,
            // and the joined one only fell further behind.
            store.dispatch(
              applyServerPathData({
                pathId: joinedId,
                pathPatch: {
                  pathName: row.name,
                  progress: row.progress,
                  saveData: { angNumber: row.angNumber, verseId: row.verseId },
                },
                datePatch: {},
              })
            );
          }
          continue;
        }
        const localId = findLocalIdByServerPathId(afterPaths, row.pathId);
        if (localId == null) {
          continue;
        }
        // `row.id` is the identifier every group endpoint keys on; `row.pathId`
        // is only what this device syncs under. Keeping just the flag and
        // discarding the id is what made every group call 404.
        //
        // PUBLIC means an invite link exists. It does *not* mean that another
        // person has joined yet: the owner is the first active membership
        // created with that link. Treat the path as group-owned only once the
        // server reports another active member; until then it remains a normal
        // personal reading path with an optional share link.
        store.dispatch(
          setPathShared({
            pathId: localId,
            shared: row.memberCount > 1,
            groupId: row.id,
          })
        );
        // This metadata is safe to refresh even while the path is open in the
        // reader. The owner-scoped path body is deliberately skipped for an
        // active reader so its live position cannot jump, but skipping the
        // canonical start date made that device show "0 days ago" while other
        // members correctly showed the real age.
        if (Number.isFinite(row.startDate)) {
          store.dispatch(
            upsertMeta({
              pathId: localId,
              meta: { serverPathId: row.pathId, startDate: row.startDate },
            })
          );
        }
      }

      // Joined paths are represented locally even though they are absent from
      // the owner-scoped paths response. Once membership is removed (or the
      // group is deleted), accessible no longer returns their group id; remove
      // the local view so Home cannot resurrect it as an empty personal path.
      const accessibleGroupIds = new Set(accessibleResult.data.map((row) => row.id));
      const refreshed = store.getState();
      for (const [key, meta] of Object.entries(refreshed.sync.meta)) {
        const localId = Number(key);
        const isJoinedView =
          meta.shared === true && meta.groupId !== undefined && meta.serverPathId === meta.groupId;
        if (
          isJoinedView &&
          meta.groupId !== undefined &&
          !accessibleGroupIds.has(meta.groupId) &&
          localId !== activePathId
        ) {
          store.dispatch(removePathAndSyncState({ pathId: localId }));
        }
      }
    }

    if (!pathsUnchanged && pathsResult.data) {
      reconcileDeletions(
        store,
        new Set(pathsResult.data.map((path) => path.pathId)),
        activePathId,
        expectedMeta
      );
    }
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
    if (showStatus) {
      store.dispatch(setSyncError(null));
      store.dispatch(setSyncStatus('idle'));
    }
    return true;
  } catch (error) {
    recordError(error, 'refresh: GET /paths failed');
    if (showStatus) {
      store.dispatch(setSyncError('network'));
    }
    return false;
  }
};

/**
 * Coalesces overlapping Home/foreground pulls for the same store. Without this,
 * an older request can finish last and temporarily roll paths/settings back.
 */
export const refreshPathsFromServer = (
  store: AppStore,
  activePathId?: number,
  showStatus = true
): Promise<boolean> => {
  const existing = refreshes.get(store);
  if (existing) {
    if (existing.activePathId === activePathId) {
      return existing.request;
    }
    // A refresh that began while a reader was open correctly skips that path.
    // If Home becomes active before it finishes, joining that guarded request
    // would fetch the newer data but never apply it until the next app open.
    // Let it finish, then do exactly one fresh, unguarded refresh for Home.
    return existing.request.then(() => refreshPathsFromServer(store, activePathId, showStatus));
  }
  const request = performRefreshPathsFromServer(store, activePathId, showStatus).finally(() => {
    if (refreshes.get(store)?.request === request) {
      refreshes.delete(store);
    }
    // ALWAYS cleared, even if this request is no longer the tracked one. It is a
    // display flag: clearing it a moment early is invisible, while failing to
    // clear it leaves the status notice spinning for the rest of the session
    // with nothing to resolve it.
    if (showStatus) {
      store.dispatch(setPulling(false));
    }
  });
  refreshes.set(store, { request, activePathId });
  // Dispatched only after the entry is tracked. `dispatch` runs subscribers
  // synchronously, and one of them can call back into this function — before the
  // map was populated that produced a second, untracked request.
  if (showStatus) {
    store.dispatch(setPulling(true));
  }
  return request;
};
