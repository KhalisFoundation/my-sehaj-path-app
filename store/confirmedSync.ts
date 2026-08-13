import { sehajPathSyncControllerSync } from '@api/generated/sdk.gen';
import { isApiConfigured, SYNC_REQUEST_TIMEOUT_MS } from '@api/config';
import { clearCurrentToken } from '../auth/tokenUtils';
import { generateUuid } from '@utils/pathIdUtils';
import { recordError } from '../utils/crashlytics';
import { applySyncResult, captureSyncSnapshot } from './applyServerResponse';
import {
  readAccountSnapshot,
  removeAccountSnapshot,
  saveAccountSnapshot,
} from './accountSnapshots';
import { clearActiveAccountData, restoreDurableState, type AppStore } from './index';
import { persistence } from './instance';
import type { Snapshot } from './legacyFormat';
import { captureDurableSnapshot, setQuarantinedRecords } from './persistence';
import { clearBlockedWork } from './syncWork';
import { SETTINGS_DEFAULTS } from './slices/settingsSlice';
import { setAccount, upsertMeta } from './slices/syncSlice';
import { setSignedOut } from './slices/authSlice';
import { showSessionExpired } from './slices/syncSlice';
import { emptyPersistedSync } from './syncFormat';
import { legacyToMs } from './syncDateUtils';
import { buildSyncRequest, checkSyncRequestSize } from './syncRequest';
import { captureSyncSession, isCurrentSyncSession, syncSessionHeaders } from './syncSession';

let inFlight = false;

/** True only when the active account has a change that has not reached its cloud. */
export const hasUnsentAccountData = (store: AppStore): boolean => {
  const { sync } = store.getState();
  return (
    Object.keys(sync.pathOps).length > 0 ||
    Object.keys(sync.scrollDirty).length > 0 ||
    sync.pendingSettingsUpdatedAt != null
  );
};

/** A dataset is clearable only when every local path is demonstrably on the server. */
export const isFullySyncedAccountData = (store: AppStore): boolean => {
  const state = store.getState();
  const { sync } = state;
  return (
    !sync.recoveryNeeded &&
    // `lastSyncedAt` is a pull cursor, not proof of backup. Accounts created
    // before that cursor existed can correctly have 0 here.
    state.paths.paths.every((path) => {
      const meta = sync.meta[path.pathId];
      return !!meta && meta.onServer && meta.deletedAt == null;
    })
  );
};

const emptyAccountSnapshot = (email: string): Snapshot => ({
  settings: { ...SETTINGS_DEFAULTS },
  paths: [],
  dates: [],
  sync: { ...emptyPersistedSync(), account: email },
  quarantinedRecords: { paths: [], dates: [] },
});

/** Returns true only when candidate has reached a later point in the same path. */
const isFurtherProgress = (
  candidate: Snapshot['paths'][number],
  current: Snapshot['paths'][number]
) =>
  candidate.saveData.angNumber > current.saveData.angNumber ||
  (candidate.saveData.angNumber === current.saveData.angNumber &&
    candidate.saveData.verseId > current.saveData.verseId);

/** Copies paths/read history only. The destination account keeps its own settings. */
const addProgressToAccount = (source: Snapshot, destination: Snapshot, email: string): Snapshot => {
  const paths = destination.paths.map((path) => ({ ...path, saveData: { ...path.saveData } }));
  const dates = destination.dates.map((date) => ({
    ...date,
    dates: date.dates.map((entry) => ({ ...entry })),
  }));
  const sync = {
    ...destination.sync,
    account: email,
    meta: { ...destination.sync.meta },
    pathOps: { ...destination.sync.pathOps },
    scrollDirty: { ...destination.sync.scrollDirty },
  };
  const localIdByUuid = new Map(
    Object.entries(sync.meta).map(([pathId, meta]) => [meta.serverPathId, Number(pathId)])
  );
  let nextPathId =
    Math.max(
      0,
      ...paths.map((path) => path.pathId),
      ...dates.map((date) => date.pathid),
      ...Object.keys(sync.meta).map(Number)
    ) + 1;
  let timestamp = Date.now();

  source.paths.forEach((sourcePath) => {
    const sourceMeta = source.sync.meta[sourcePath.pathId];
    const uuid = sourceMeta?.serverPathId ?? generateUuid();
    const existingPathId = localIdByUuid.get(uuid);
    const pathId = existingPathId ?? nextPathId++;
    const sourceDate = source.dates.find((date) => date.pathid === sourcePath.pathId);
    const destinationPathIndex = paths.findIndex((path) => path.pathId === pathId);
    const existingPath = destinationPathIndex >= 0 ? paths[destinationPathIndex] : undefined;
    // The same UUID means B already has this path. Never replace B's newer
    // checkpoint with A's older one; only take A's record when it is further.
    const sourceWins = !existingPath || isFurtherProgress(sourcePath, existingPath);
    const winningPath = sourceWins ? sourcePath : existingPath!;
    const copiedPath = {
      ...winningPath,
      pathId,
      saveData: { ...winningPath.saveData },
    };
    if (destinationPathIndex >= 0) {
      paths[destinationPathIndex] = copiedPath;
    } else {
      paths.push(copiedPath);
      localIdByUuid.set(uuid, pathId);
    }

    const destinationDateIndex = dates.findIndex((date) => date.pathid === pathId);
    const existingDate = destinationDateIndex >= 0 ? dates[destinationDateIndex] : undefined;
    const readDays = new Map(
      [...(existingDate?.dates ?? []), ...(sourceDate?.dates ?? [])].map((entry) => [
        entry.date,
        { ...entry },
      ])
    );
    const copiedDate = {
      pathid: pathId,
      dates: [...readDays.values()],
      scrollPosition: sourceWins
        ? sourceDate?.scrollPosition ?? existingDate?.scrollPosition ?? 0
        : existingDate?.scrollPosition ?? sourceDate?.scrollPosition ?? 0,
    };
    if (destinationDateIndex >= 0) {
      dates[destinationDateIndex] = copiedDate;
    } else {
      dates.push(copiedDate);
    }

    const destinationMeta = sync.meta[pathId];
    timestamp = Math.max(timestamp + 1, sourceMeta?.localUpdatedAt ?? 0);
    sync.meta[pathId] = {
      serverPathId: uuid,
      serverUpdatedAt: destinationMeta?.serverUpdatedAt ?? 0,
      localUpdatedAt: timestamp,
      startDate:
        destinationMeta?.startDate ??
        sourceMeta?.startDate ??
        legacyToMs(winningPath.startDate) ??
        timestamp,
      deletedAt: null,
      onServer: destinationMeta?.onServer ?? false,
    };
    sync.pathOps[pathId] = {
      kind: destinationMeta?.onServer ? 'update' : 'create',
      localUpdatedAt: timestamp,
    };
  });

  return { ...destination, paths, dates, sync };
};

/**
 * Durably stashes A, then activates B in one journaled Redux/disk replacement.
 * `addPreviousProgress` copies A's paths into B but never copies A's settings.
 */
export const switchAccountData = async (
  store: AppStore,
  email: string,
  addPreviousProgress: boolean
): Promise<boolean> => {
  const initial = store.getState();
  const previousAccount = initial.sync.account;
  const initialToken = initial.auth.token;
  if (
    !initial.paths.hydrated ||
    !initial.sync.hydrated ||
    !previousAccount ||
    previousAccount === email ||
    initial.auth.status !== 'signedIn' ||
    initial.auth.email !== email ||
    initial.sync.recoveryNeeded
  ) {
    return false;
  }

  // First prove that the currently visible A snapshot is durable, then keep a
  // second verified account-namespaced copy before replacing anything.
  if (!(await persistence.flush())) {
    return false;
  }
  const source = captureDurableSnapshot(store);
  if (!(await saveAccountSnapshot(previousAccount, source))) {
    return false;
  }

  const savedDestination = await readAccountSnapshot(email);
  if (savedDestination.status === 'recovery') {
    return false;
  }
  const destination =
    savedDestination.status === 'valid' ? savedDestination.snapshot : emptyAccountSnapshot(email);
  const next = addPreviousProgress ? addProgressToAccount(source, destination, email) : destination;

  // Storage reads can yield. Never finish B's handoff after logout, another
  // login, or a different account replacement occurred in the meantime.
  const current = store.getState();
  if (
    current.auth.status !== 'signedIn' ||
    current.auth.email !== email ||
    current.auth.token !== initialToken ||
    current.sync.account !== previousAccount
  ) {
    return false;
  }

  store.dispatch(
    restoreDurableState({
      settings: next.settings,
      paths: { paths: next.paths, dates: next.dates, hydrated: true },
      sync: {
        ...initial.sync,
        ...next.sync,
        hydrated: true,
        status: 'idle',
        lastError: null,
        recoveryNeeded: false,
        syncPopupAnswered: false,
        syncApprovedForEmail: null,
      },
    })
  );
  setQuarantinedRecords(store, next.quarantinedRecords);
  // Blocked markers are keyed by local pathId, which is per-device and reused
  // across accounts. Carrying A's markers into B would silently suppress an
  // unrelated B operation that happens to share an id.
  clearBlockedWork(store);
  if (await persistence.flush()) {
    // B is now the durable active dataset, so its stash is a redundant copy.
    // Dropping it keeps the bag from accumulating a stale duplicate of every
    // account ever used on this device. A's stash stays — it is the only copy.
    await removeAccountSnapshot(email);
    return true;
  }

  // The active replacement did not become durable. Put A back in memory and
  // make the rollback durable; its independent stash remains as a final copy.
  store.dispatch(
    restoreDurableState({
      settings: initial.settings,
      paths: initial.paths,
      sync: initial.sync,
    })
  );
  setQuarantinedRecords(store, source.quarantinedRecords);
  if (!(await persistence.flush())) {
    recordError(
      new Error('account snapshot switch rollback could not be persisted'),
      'confirmedSync: stashed account switch rollback failed'
    );
  }
  return false;
};

/**
 * A fully-synced account can be safely replaced by another account's dataset.
 * Persist the empty snapshot before any B request, so an app crash cannot make
 * A's old local records look like B's data after the switch.
 */
const clearActiveAccountDataDurably = async (store: AppStore): Promise<boolean> => {
  const before = store.getState();
  // Quarantined raw records live OUTSIDE Redux, so clearing the slices does not
  // remove them — and `pathDetails` is serialized as live paths + quarantined
  // records. Left in place they would be appended to the next account's file on
  // the very next write, carrying one account's data into another's.
  const beforeQuarantined = captureDurableSnapshot(store).quarantinedRecords;
  store.dispatch(clearActiveAccountData());
  setQuarantinedRecords(store, undefined);
  clearBlockedWork(store);
  if (await persistence.flush()) {
    return true;
  }

  // A failed write can be partially on disk. Restore the exact old snapshot;
  // the persistence coordinator's journal makes this a safe retry rather than
  // leaving a half-cleared account in memory.
  store.dispatch(
    restoreDurableState({
      settings: before.settings,
      paths: before.paths,
      sync: before.sync,
    })
  );
  setQuarantinedRecords(store, beforeQuarantined);
  const restored = await persistence.flush();
  if (!restored) {
    recordError(
      new Error('account-switch rollback could not be persisted'),
      'confirmedSync: account switch rollback failed'
    );
  }
  recordError(
    new Error('clean account switch could not be persisted'),
    'confirmedSync: account switch clear failed'
  );
  return false;
};

/**
 * The user explicitly chose the signed-in account's cloud data over unrelated
 * local paths on this device. Clear only after that choice, make the clear
 * durable, then download the account. If download fails, restore the local
 * snapshot so a temporary network problem never turns the choice into data loss.
 */
export const discardLocalDataAndSync = async (store: AppStore, email: string): Promise<boolean> => {
  const before = store.getState();
  const beforeQuarantined = captureDurableSnapshot(store).quarantinedRecords;
  if (
    before.sync.account !== null ||
    !before.auth.token ||
    before.auth.email !== email ||
    !before.network.isOnline ||
    before.sync.recoveryNeeded
  ) {
    return false;
  }

  const session = captureSyncSession(before);
  if (!session) {
    return false;
  }

  // 1. Fetch the replacement BEFORE removing anything.
  //
  // An earlier version cleared the device durably and then fetched. The rollback
  // covered a failed request, but not the app dying mid-request — and the empty
  // state was already on disk, so the reading was gone with nothing left to
  // restore. Fetching first means a crash at any point here leaves the device
  // exactly as the user left it.
  //
  // `paths: []` makes this download-only. The account's full state comes back
  // without uploading the very reading the user asked to discard.
  let result;
  try {
    result = await sehajPathSyncControllerSync({
      body: { paths: [] },
      headers: syncSessionHeaders(session),
      timeout: SYNC_REQUEST_TIMEOUT_MS,
    });
  } catch (error) {
    recordError(error, 'confirmedSync: discard fetch failed');
    return false;
  }

  const afterRequest = store.getState();
  if (
    !isCurrentSyncSession(afterRequest, session) ||
    afterRequest.sync.account !== null ||
    afterRequest.sync.recoveryNeeded
  ) {
    return false; // the session or ownership changed mid-request — touch nothing
  }
  if (result.error || !result.data) {
    if (result.error && result.response?.status === 401) {
      store.dispatch(showSessionExpired());
      store.dispatch(setSignedOut());
      if (!(await clearCurrentToken(session.token))) {
        recordError(
          new Error('token could not be cleared after 401'),
          'confirmedSync: clearing token after 401 failed'
        );
      }
    }
    return false; // nothing was removed
  }

  // 2. Swap old for new. These dispatches are synchronous, so there is no moment
  //    at which an empty dataset could reach disk on its own.
  const snapshot = captureSyncSnapshot(store.getState());
  store.dispatch(clearActiveAccountData());
  setQuarantinedRecords(store, undefined);
  // Blocked markers are keyed by local path id, and those ids are about to be
  // reused by the account's downloaded paths. Carrying them over would silently
  // suppress an unrelated operation on the replacement data.
  clearBlockedWork(store);
  applySyncResult(store, result.data, snapshot, { serverSettingsWin: true });
  store.dispatch(setAccount(email));

  // 3. One durable write for the whole swap.
  if (await persistence.flush()) {
    return true;
  }

  store.dispatch(
    restoreDurableState({
      settings: before.settings,
      paths: before.paths,
      sync: before.sync,
    })
  );
  setQuarantinedRecords(store, beforeQuarantined);
  const restored = await persistence.flush();
  if (!restored) {
    recordError(
      new Error('discarded local-data rollback could not be persisted'),
      'confirmedSync: discard rollback failed'
    );
  }
  return false;
};

/** Gives every local path that predates sync a UUID + metadata (case A claim). */
const backfillMissingMeta = (store: AppStore): void => {
  const state = store.getState();
  const now = Date.now();
  state.paths.paths.forEach((path) => {
    if (state.sync.meta[path.pathId]) {
      return;
    }
    store.dispatch(
      upsertMeta({
        pathId: path.pathId,
        meta: {
          serverPathId: generateUuid(),
          startDate: legacyToMs(path.startDate) ?? now,
          localUpdatedAt: now,
          onServer: false,
          serverUpdatedAt: 0,
        },
      })
    );
  });
};

/**
 * Confirmed account sync (Step 9) — run ONLY after the user taps "Sync now".
 * Single-flight; requires hydrated state, a token, the matching signed-in email,
 * and network. Nothing here runs automatically, so a login never uploads data on
 * its own.
 *
 *  - **C** (`account === email`): already this account → resume normal sync,
 *    nothing to claim.
 *  - **A/B** (`account === null`): claim local paths / download to a fresh device
 *    via one `POST /sync`, apply the result timestamp-guarded, then associate the
 *    account.
 *  - **D** (`account` set and differs): a fully-synced old account is cleared
 *    durably, then the newly signed-in account is handled as a fresh device.
 *    If the old account still has unsynced work, do nothing: it must be backed
 *    up under that old login before an account switch can continue.
 *
 * Returns true only when the account is (or already was) associated. On any
 * failure the dataset and account association are left unchanged.
 */
export async function runConfirmedAccountSync(store: AppStore, email: string): Promise<boolean> {
  if (inFlight) {
    return false;
  }
  const state = store.getState();
  if (
    !isApiConfigured() || // no server configured in this build
    !state.paths.hydrated ||
    !state.sync.hydrated ||
    state.sync.recoveryNeeded ||
    !state.auth.token ||
    !email ||
    state.auth.email !== email ||
    !state.network.isOnline
  ) {
    return false;
  }

  let { account } = state.sync;
  if (account === email) {
    return true; // C: already associated — resume; nothing to send
  }

  // Arm the single-flight guard BEFORE the first await. The account-switch
  // branch below awaits a durable clear, so arming it later would let a second
  // caller (drawer Sync now, a lifecycle trigger) slip past this guard and clear
  // or upload the same account concurrently.
  inFlight = true;
  // Set once the old account's data has been durably cleared. Everything after
  // that point can still fail (flush, network, a session change), and a bare
  // failure would leave the reader looking at an empty app: the old account is
  // gone locally and the new one never arrived. Restored in `finally`.
  let clearedAccountData: Parameters<typeof restoreDurableState>[0] | null = null;
  let clearedQuarantined: Snapshot['quarantinedRecords'];
  let succeeded = false;
  try {
    if (account !== null) {
      if (hasUnsentAccountData(store)) {
        recordError(
          new Error('previous account has unsynced data'),
          'confirmedSync: account switch blocked by unsynced data'
        );
        return false;
      }
      if (!isFullySyncedAccountData(store)) {
        recordError(
          new Error('previous account backup status could not be verified'),
          'confirmedSync: account switch blocked by unknown backup state'
        );
        return false;
      }
      clearedQuarantined = captureDurableSnapshot(store).quarantinedRecords;
      if (!(await clearActiveAccountDataDurably(store))) {
        return false; // it already restored itself
      }
      clearedAccountData = { settings: state.settings, paths: state.paths, sync: state.sync };
      ({ account } = store.getState().sync);
      if (account !== null) {
        return false;
      }
    }

    // A/B: account === null.
    backfillMissingMeta(store); // A: legacy paths gain UUIDs; B: no local paths → no-op

    // The UUIDs must be DURABLE before we upload under them. If the app died
    // after /sync but before this write landed, the next attempt would mint new
    // UUIDs and create duplicate paths on the server.
    if (!(await persistence.flush())) {
      recordError(
        new Error('UUID metadata could not be persisted; /sync skipped'),
        'confirmedSync: pre-sync persistence failed'
      );
      return false;
    }

    // Re-read after the flush, and refuse to upload unless every local path has a
    // usable UUID mapping — a partially-mapped snapshot would upload some paths
    // and silently drop others.
    const flushed = store.getState();
    // Storage can take time. Re-check the live session after awaiting it so a
    // logout or a different login cannot send this account's snapshot with a
    // stale token/email.
    if (
      !flushed.auth.token ||
      flushed.auth.email !== email ||
      !flushed.network.isOnline ||
      flushed.sync.recoveryNeeded ||
      flushed.sync.account !== null
    ) {
      return false;
    }
    const everyPathMapped = flushed.paths.paths.every((path) => {
      const meta = flushed.sync.meta[path.pathId];
      return !!meta && !!meta.serverPathId;
    });
    if (!everyPathMapped) {
      recordError(
        new Error('a local path is missing its UUID mapping; /sync skipped'),
        'confirmedSync: incomplete metadata'
      );
      return false;
    }

    const session = captureSyncSession(flushed);
    if (!session) {
      return false;
    }
    const snapshot = captureSyncSnapshot(flushed);
    // Account settings are downloaded on login. Do not let settings changed
    // before this account was selected overwrite that account's cloud settings.
    const body = buildSyncRequest(flushed, false);

    // A first login carries this device's entire history, so it is the request
    // most likely to exceed the server's limits. Refuse locally instead of
    // discovering it as a 413: the data stays unowned and readable, and the user
    // is told, rather than being stuck in a claim that can never succeed.
    const size = checkSyncRequestSize(body);
    if (!size.ok) {
      recordError(
        new Error(`login sync body too large: ${size.paths} paths, ${size.bytes} bytes`),
        'confirmedSync: sync body exceeds server limits'
      );
      return false;
    }

    const res = await sehajPathSyncControllerSync({
      body,
      headers: syncSessionHeaders(session),
      // Same reasoning as the conflict reconcile: a whole-history merge through a
      // serializable transaction legitimately outlasts the ordinary timeout, and
      // aborting at 25 s would abandon a request the server is still completing.
      timeout: SYNC_REQUEST_TIMEOUT_MS,
    });
    const afterRequest = store.getState();
    if (
      !isCurrentSyncSession(afterRequest, session) ||
      afterRequest.sync.account !== null ||
      afterRequest.sync.recoveryNeeded
    ) {
      return false;
    }
    if (res.error || !res.data) {
      if (res.error && res.response?.status === 401) {
        store.dispatch(setSignedOut());
        if (!(await clearCurrentToken(session.token))) {
          recordError(
            new Error('token could not be cleared after 401'),
            'confirmedSync: clearing token after 401 failed'
          );
        }
      }
      return false;
    }
    applySyncResult(store, res.data, snapshot, { serverSettingsWin: true });
    store.dispatch(setAccount(email));

    // The account association itself must be durable before we report success —
    // otherwise a restart would re-prompt and re-claim already-uploaded data.
    if (!(await persistence.flush())) {
      recordError(
        new Error('account association could not be persisted'),
        'confirmedSync: post-sync persistence failed'
      );
      // Do not leave the UI believing this account is associated when the
      // durable write failed. The already-applied server result stays local and
      // safe; a later explicit Sync now can associate it again.
      store.dispatch(setAccount(null));
      await persistence.flush();
      return false;
    }
    succeeded = true;
    return true;
  } catch (error) {
    recordError(error, 'confirmedSync: /sync failed');
    return false;
  } finally {
    inFlight = false;
    // An account switch that cleared the old data but never completed must put
    // that data back, so a transient failure can never present an empty app.
    // The old account's cloud copy is untouched either way.
    if (!succeeded && clearedAccountData) {
      store.dispatch(restoreDurableState(clearedAccountData));
      setQuarantinedRecords(store, clearedQuarantined);
      if (!(await persistence.flush())) {
        recordError(
          new Error('cleared account data could not be restored after a failed switch'),
          'confirmedSync: account switch rollback failed'
        );
      }
    }
  }
}
