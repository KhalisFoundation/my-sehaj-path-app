import {
  sehajPathSettingsControllerUpsert,
  sehajPathSyncControllerSync,
  sehajPathsControllerCreate,
  sehajPathsControllerRemove,
  sehajPathsControllerUpdate,
} from '@api/generated/sdk.gen';
import { isApiConfigured, SYNC_REQUEST_TIMEOUT_MS } from '@api/config';
import { clearCurrentToken } from '../auth/tokenUtils';
import { recordError } from '../utils/crashlytics';
import { applyServerPath, applySyncResult, captureSyncSnapshot } from './applyServerResponse';
import { removePathAndSyncState, type AppStore, type RootState } from './index';
import { setSignedOut } from './slices/authSlice';
import {
  ackServerPathExists,
  clearOpIfUnchanged,
  clearScrollIfUnchanged,
  clearSettingsIfUnchanged,
  setSyncError,
  setSyncStatus,
  showSessionExpired,
  type PendingPathOp,
} from './slices/syncSlice';
import { toCreateBody, toPatchBody, type LocalPath } from './syncAdapters';
import {
  buildSyncRequest,
  checkSyncRequestSize,
  settingsFingerprint,
  syncRequestFingerprint,
  toSettingsBody,
} from './syncRequest';
import {
  blockPathOp,
  blockSettings,
  blockSyncBody,
  clearBlockedWork,
  hasSendableWork,
  isPathOpBlocked,
  isSettingsBlocked,
  isSyncBodyBlocked,
  setConfirmedSettings,
  settingsAlreadyConfirmed,
} from './syncWork';
import {
  captureSyncSession,
  isCurrentSyncSession,
  syncSessionHeaders,
  type SyncSession,
} from './syncSession';

const DEFAULT_DEBOUNCE_MS = 5000;
const DEFAULT_BACKOFF_MS = __DEV__ ? [2000, 2000, 2000] : [5000, 30000, 120000];

export interface OutboxCoordinator {
  start: () => void;
  stop: () => void;
  /** Debounced drain — the everyday path (an edit landed). */
  scheduleFlush: () => void;
  /** Immediate drain — a checkpoint (screen blur, background, reconnect). */
  flushNow: () => Promise<void>;
  getStatus: () => { draining: boolean; backoffStep: number };
}

interface Options {
  debounceMs?: number;
  backoffMs?: number[];
}

/** Per-op result that drives the drain's control flow. */
type Outcome = 'acked' | 'conflict' | 'auth' | 'network' | 'permanent' | 'stale';

const classify = (status: number | undefined): Outcome => {
  // 304 Not Modified means the server has nothing new — the request succeeded.
  // Axios counts only 2xx as success, so without this a conditional response
  // (Express sends ETags by default, and proxies add them) falls through to the
  // catch-all below and reports a transport failure for a sync that worked.
  if (status === 304) {
    return 'acked';
  }
  if (status === 401) {
    return 'auth';
  }
  if (status === 409) {
    return 'conflict';
  }
  // These 4xx responses are temporary: the same request can succeed after a
  // timeout, an early-data retry, or the server's rate-limit window expires.
  if (status === 408 || status === 425 || status === 429) {
    return 'network';
  }
  // A 4xx the server will reject identically every time (validation, forbidden…).
  // Retrying can never succeed, so it must not loop — the caller parks the op.
  if (status !== undefined && status >= 400 && status < 500) {
    return 'permanent';
  }
  // 5xx and any transient/unknown status (no response = offline) → retry.
  return 'network';
};

/**
 * Drains the coalesced outbox (`sync.pathOps` + pending settings) to the
 * dedicated endpoints, with the same discipline as the persistence coordinator:
 * single-flight, debounce, backoff, and timestamp-guarded op clearing.
 *
 * Guards: it pushes only when the store is hydrated, online, signed in, and the
 * loaded dataset belongs to the signed-in account (`sync.account === auth.email`,
 * set by the Step 9 confirmed-sync flow) — so nothing uploads until the user has
 * associated their data. Recovery mode blocks all cloud calls.
 *
 * Response-body writeback (`fromServerPath` → pathsSlice) and the 409 → `/sync`
 * reconcile are Step 8; here a create/update success acks via Step 3's
 * `ackServerPath`, and a conflict parks the op with an error until Step 8 wires
 * the reconcile.
 */
export const createOutboxCoordinator = (
  store: AppStore,
  options: Options = {}
): OutboxCoordinator => {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS;

  let started = false;
  let draining = false;
  let activeDrain: Promise<void> | null = null;
  let backoffStep = 0;
  /**
   * A transport failure owns retry timing. While true, store updates such as
   * `setSyncError` must not also schedule the ordinary five-second debounce —
   * otherwise that debounce bypasses the retry cap and retries forever.
   */
  let retryScheduledOrPaused = false;
  /**
   * Ops the server rejected permanently live in `syncWork.ts`, keyed by
   * pathId → the `localUpdatedAt` that failed. The op is KEPT locally (the user's
   * change is never discarded) but skipped, so it can't spin forever. Editing the
   * path changes its `localUpdatedAt`, which no longer matches and is retried.
   *
   * That registry is shared so `applyServerResponse` can consult it without
   * importing this module, which would create a cycle.
   */
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let backoffTimer: ReturnType<typeof setTimeout> | null = null;
  let unsubscribe: (() => void) | null = null;

  const state = (): RootState => store.getState();

  const canDrain = (): boolean => {
    const s = state();
    return (
      isApiConfigured() && // no base URL in this build → purely offline
      s.sync.hydrated &&
      !s.sync.recoveryNeeded &&
      s.network.isOnline &&
      !!s.auth.token &&
      !!s.auth.email &&
      s.sync.account === s.auth.email
    );
  };

  const ownsCurrentSession = (session: SyncSession): boolean => {
    const s = state();
    return (
      isCurrentSyncSession(s, session) && s.sync.account === session.email && !s.sync.recoveryNeeded
    );
  };

  /**
   * Work that is actually sendable. Permanently-rejected ops stay in the outbox
   * (the user's change is preserved) but are NOT counted here — otherwise the
   * post-drain reschedule would spin on work the server will never accept.
   */
  const hasPendingWork = (): boolean => hasSendableWork(store, state());

  const clearDebounce = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  const runDrain = () => {
    // Mutual recursion (timer → drain → schedule*): drain is a hoisted function
    // below, so referencing it here is safe.
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    drain().catch((error) => recordError(error, 'outbox: drain failed'));
  };

  // Function declarations so the mutual recursion (timer → drain → schedule*)
  // needs no forward references.
  function scheduleFlush() {
    if (!started || debounceTimer) {
      return;
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      runDrain();
    }, debounceMs);
  }

  function scheduleBackoff() {
    if (!started) {
      return;
    }
    retryScheduledOrPaused = true;
    clearDebounce();
    // After the planned retries, wait for a useful lifecycle event (foreground,
    // reconnect, or an explicit Sync now) instead of waking every two minutes
    // forever while the server is unavailable.
    if (backoffStep >= backoffMs.length) {
      return;
    }
    const delay = backoffMs[Math.min(backoffStep, backoffMs.length - 1)];
    backoffStep += 1;
    if (backoffTimer) {
      clearTimeout(backoffTimer);
    }
    backoffTimer = setTimeout(() => {
      backoffTimer = null;
      retryScheduledOrPaused = false;
      runDrain();
    }, delay);
  }

  const localPathFor = (pathId: number): LocalPath | null => {
    const s = state();
    const meta = s.sync.meta[pathId];
    const path = s.paths.paths.find((entry) => entry.pathId === pathId);
    if (!meta || !path) {
      return null;
    }
    return { path, date: s.paths.dates.find((entry) => entry.pathid === pathId), meta };
  };

  /**
   * Fold a successful write's response into local state.
   *
   * Deliberately swallows its own failure. By the time this runs the server has
   * already accepted and stored the change, so a throw here — an unexpected
   * shape, a bad field — must NOT be reported as a network error: that shows the
   * user "unable to sync" for work that is safely saved, and sends them looking
   * for a problem that does not exist. A PATCH cannot simply be replayed: its
   * baseUpdatedAt is now stale and the server correctly returns 409. Signal a
   * bulk reconciliation instead, which safely reads/merges the accepted write.
   */
  const applyWriteResponse = (apply: () => void, context: string): boolean => {
    try {
      apply();
      return true;
    } catch (error) {
      recordError(error, `outbox: applying ${context} response failed`);
      return false;
    }
  };

  const processPathOp = async (
    pathId: number,
    op: PendingPathOp,
    session: SyncSession
  ): Promise<Outcome> => {
    if (!ownsCurrentSession(session)) {
      return 'stale';
    }
    const local = localPathFor(pathId);
    if (!local) {
      // The path/meta was dropped (e.g. a never-synced delete) — clear the stale op.
      store.dispatch(clearOpIfUnchanged({ pathId, sentLocalUpdatedAt: op.localUpdatedAt }));
      return 'acked';
    }
    const sentLocalUpdatedAt = op.localUpdatedAt;
    const { serverPathId } = local.meta;
    // The create/update body carries the current scrollPosition, so a successful
    // ack also clears the scroll-dirty flag — unless a newer scroll landed since.
    const sentScroll = state().sync.scrollDirty[pathId];
    const clearScrollOnAck = () => {
      if (sentScroll != null) {
        store.dispatch(clearScrollIfUnchanged({ pathId, sentLocalUpdatedAt: sentScroll }));
      }
    };

    try {
      if (op.kind === 'delete') {
        const res = await sehajPathsControllerRemove({
          path: { pathId: serverPathId },
          headers: syncSessionHeaders(session),
        });
        if (!ownsCurrentSession(session)) {
          return 'stale';
        }
        if (res.error && res.response?.status !== 404) {
          const outcome = classify(res.response?.status);
          if (outcome === 'permanent') {
            recordError(
              new Error(`Path delete rejected (HTTP ${res.response?.status})`),
              'outbox: delete permanently rejected',
              { pathId: String(pathId), status: String(res.response?.status) }
            );
          }
          return outcome;
        }
        // 2xx or 404 means the path is gone on the server; remove it locally.
        store.dispatch(removePathAndSyncState({ pathId }));
        return 'acked';
      }

      if (op.kind === 'create') {
        const res = await sehajPathsControllerCreate({
          body: toCreateBody(local),
          headers: syncSessionHeaders(session),
        });
        if (!ownsCurrentSession(session)) {
          return 'stale';
        }
        if (res.error) {
          return classify(res.response?.status);
        }
        if (res.status === 200) {
          // Idempotent replay: this UUID already existed (our first POST landed but
          // its reply was lost). The body is the server's OLD row, not what we just
          // sent — applying it would wipe any newer local progress. Take only the
          // identity + clock; the op becomes an `update` so the latest local state
          // is PATCHed on the next drain.
          store.dispatch(ackServerPathExists({ pathId, serverUpdatedAt: res.data.updatedAt }));
          return 'acked';
        }
        return applyWriteResponse(() => {
          applyServerPath(store, res.data, { pathId, sentLocalUpdatedAt, operation: 'create' });
          clearScrollOnAck();
        }, 'create')
          ? 'acked'
          : 'conflict';
      }

      // update
      const res = await sehajPathsControllerUpdate({
        path: { pathId: serverPathId },
        body: toPatchBody(local),
        headers: syncSessionHeaders(session),
      });
      if (!ownsCurrentSession(session)) {
        return 'stale';
      }
      if (res.error) {
        // 409 (another device advanced it) or 404 (deleted on server) → reconcile.
        if (res.response?.status === 409 || res.response?.status === 404) {
          return 'conflict';
        }
        return classify(res.response?.status);
      }
      return applyWriteResponse(() => {
        applyServerPath(store, res.data, { pathId, sentLocalUpdatedAt, operation: 'update' });
        clearScrollOnAck();
      }, 'update')
        ? 'acked'
        : 'conflict';
    } catch (error) {
      // Only a genuine transport failure reaches here now — the response
      // appliers above handle their own errors, so an accepted write is never
      // reported as unreachable.
      recordError(error, `outbox: ${op.kind} failed`);
      return ownsCurrentSession(session) ? 'network' : 'stale';
    }
  };

  const processSettings = async (session: SyncSession): Promise<Outcome> => {
    if (!ownsCurrentSession(session)) {
      return 'stale';
    }
    const rev = state().sync.pendingSettingsUpdatedAt;
    if (rev == null || isSettingsBlocked(store, rev)) {
      return 'acked'; // nothing pending, or this exact revision is permanently rejected
    }

    // Toggled and toggled back before the debounce fired: the document is
    // already what the server holds, so the PUT would be a no-op round trip.
    // Clearing the marker is not optional — leaving it set keeps
    // `hasSendableWork()` true and the coordinator reschedules for ever.
    const fingerprint = settingsFingerprint(state().settings);
    if (settingsAlreadyConfirmed(store, fingerprint)) {
      store.dispatch(clearSettingsIfUnchanged(rev));
      return 'acked';
    }

    try {
      const res = await sehajPathSettingsControllerUpsert({
        body: toSettingsBody(state().settings),
        headers: syncSessionHeaders(session),
      });
      if (!ownsCurrentSession(session)) {
        return 'stale';
      }
      if (res.error) {
        const outcome = classify(res.response?.status);
        if (outcome === 'permanent') {
          recordError(
            new Error(`settings rejected (HTTP ${res.response?.status})`),
            'outbox: settings permanently rejected'
          );
          blockSettings(store, rev); // keep the local value, stop retrying it
        }
        return outcome;
      }
      // The server now holds exactly this document, so an identical upload can
      // be skipped until something actually changes.
      setConfirmedSettings(store, fingerprint);
      store.dispatch(clearSettingsIfUnchanged(rev));
      return 'acked';
    } catch (error) {
      recordError(error, 'outbox: settings upsert failed');
      return ownsCurrentSession(session) ? 'network' : 'stale';
    }
  };

  /**
   * One bulk `/sync` reconciles a PATCH 409: capture the dirty markers being
   * sent, POST the full snapshot, then apply the authoritative result guarded by
   * that snapshot — the merged server truth is written, ops/scroll/settings are
   * cleared only where the change key still matches, and any edit made during the
   * request stays queued.
   */
  const reconcileViaSync = async (session: SyncSession): Promise<Outcome> => {
    if (!ownsCurrentSession(session)) {
      return 'stale';
    }
    const snapshot = captureSyncSnapshot(state());
    const body = buildSyncRequest(state());
    const fingerprint = syncRequestFingerprint(body);

    // This exact body was already rejected permanently. Re-sending it cannot
    // succeed and would loop; a later edit changes the fingerprint and retries.
    if (isSyncBodyBlocked(store, fingerprint)) {
      return 'permanent';
    }

    // Too large to ever be accepted, so treat it as permanent rather than
    // discovering it as a 413 on every retry.
    const size = checkSyncRequestSize(body);
    if (!size.ok) {
      recordError(
        new Error(`sync body too large: ${size.paths} paths, ${size.bytes} bytes`),
        'outbox: sync body exceeds server limits'
      );
      blockSyncBody(store, fingerprint);
      return 'permanent';
    }

    try {
      const res = await sehajPathSyncControllerSync({
        body,
        headers: syncSessionHeaders(session),
        // A whole-state merge through a serializable transaction legitimately
        // outlasts the ordinary request timeout.
        timeout: SYNC_REQUEST_TIMEOUT_MS,
      });
      if (!ownsCurrentSession(session)) {
        return 'stale';
      }
      if (res.error) {
        const status = res.response?.status;
        // `/sync` IS the reconciliation, so a 409 from it cannot escalate to
        // another `/sync` — that recurses against an actively-writing second
        // device. Back off and retry with fresher state instead.
        if (status === 409) {
          return 'network';
        }
        const outcome = classify(status);
        if (outcome === 'permanent') {
          recordError(
            new Error(`sync rejected (HTTP ${status})`),
            'outbox: bulk sync permanently rejected'
          );
          blockSyncBody(store, fingerprint);
        }
        return outcome;
      }
      applySyncResult(store, res.data, snapshot);
      return 'acked';
    } catch (error) {
      recordError(error, 'outbox: sync reconcile failed');
      return ownsCurrentSession(session) ? 'network' : 'stale';
    }
  };

  async function performDrain(): Promise<void> {
    const session = captureSyncSession(state());
    if (!session || !ownsCurrentSession(session)) {
      return;
    }
    draining = true;
    store.dispatch(setSyncStatus('flushing'));

    let outcome: Outcome = 'acked';
    /** The op whose 409 triggered the bulk reconcile, if any. */
    let conflictSource: { pathId: number; localUpdatedAt: number } | null = null;
    try {
      const ops = { ...state().sync.pathOps };
      for (const [key, op] of Object.entries(ops)) {
        if (!state().network.isOnline) {
          outcome = 'network';
          break;
        }
        if (!ownsCurrentSession(session)) {
          outcome = 'stale';
          break;
        }
        const pathId = Number(key);
        // Skip an op the server already rejected permanently at this exact
        // timestamp; a later edit changes the timestamp and un-blocks it.
        if (isPathOpBlocked(store, pathId, op.localUpdatedAt)) {
          continue;
        }
        const result = await processPathOp(pathId, op, session);
        if (result === 'permanent') {
          // Keep the user's change locally, but never loop on it.
          blockPathOp(store, pathId, op.localUpdatedAt);
          outcome = 'permanent';
          continue; // other paths may still sync fine
        }
        // A conflict short-circuits: one bulk /sync reconciles the whole snapshot.
        if (result !== 'acked') {
          outcome = result;
          if (result === 'conflict') {
            conflictSource = { pathId, localUpdatedAt: op.localUpdatedAt };
          }
          break;
        }
      }
      if (outcome === 'conflict') {
        outcome = await reconcileViaSync(session);
        // The bulk merge is the ONLY way to resolve this path's 409, and the
        // server rejected it permanently. Leaving the op sendable would loop
        // forever: PATCH → 409 → blocked /sync → PATCH → 409 … Park the exact
        // version so the cycle stops and unrelated paths keep syncing. It also
        // lets `hasWorkBlockingPull` fall to false again so this device can
        // resume downloading cloud changes. A later edit re-queues it.
        if (outcome === 'permanent' && conflictSource) {
          blockPathOp(store, conflictSource.pathId, conflictSource.localUpdatedAt);
        }
      }
      // A permanently-rejected path must not stop unrelated settings from syncing.
      if (outcome === 'acked' || outcome === 'permanent') {
        const settingsResult = await processSettings(session);
        if (settingsResult !== 'acked') {
          outcome = settingsResult;
        }
      }
    } catch (error) {
      // Nothing above is allowed to escape. `status` was set to 'flushing' before
      // the try, and every line that resets it lives BELOW this block — so an
      // escaping throw would leave the app permanently "syncing", with no error
      // and no way back, even though the write itself may have succeeded.
      // Treating it as a transient failure keeps the state machine closed: the
      // status resolves, the work stays queued, and the backoff retries it.
      recordError(error, 'outbox: drain failed unexpectedly');
      outcome = 'network';
    } finally {
      draining = false;
    }

    if (outcome === 'auth') {
      // A 401 means the token is rejected. Sign out locally — clear the auth
      // slice and the persisted token — so `canDrain()` becomes false and we
      // stop retrying with a bad token. (Local only; no SSO browser redirect.)
      store.dispatch(showSessionExpired());
      store.dispatch(setSignedOut());
      // The next login may be a different account reusing the same local path ids.
      clearBlockedWork(store);
      // clearCurrentToken never rejects — it returns false on a storage error.
      const cleared = await clearCurrentToken(session.token);
      if (!cleared) {
        recordError(
          new Error('token could not be cleared after 401'),
          'outbox: clearing token after 401 failed'
        );
      }
      store.dispatch(setSyncStatus('idle'));
      return;
    }
    if (outcome === 'stale') {
      // The user logged out or changed accounts while a request was in flight.
      // Leave the old outbox untouched and let the current account decide its own
      // sync flow; no response from the previous account is allowed to apply.
      store.dispatch(setSyncStatus('idle'));
      return;
    }
    if (outcome === 'network') {
      scheduleBackoff();
      store.dispatch(setSyncError('network')); // also sets status = 'error'
      return;
    }
    if (outcome === 'permanent') {
      // The server will reject this identically every time. Flag it, keep the
      // change on the device, and do NOT back off — retrying cannot help. The
      // next local edit to that path clears the block and re-queues it.
      store.dispatch(setSyncError('rejected'));
      backoffStep = 0;
      retryScheduledOrPaused = false;
      return;
    }

    // outcome === 'acked' (a conflict was already resolved via reconcileViaSync).
    backoffStep = 0;
    retryScheduledOrPaused = false;
    store.dispatch(setSyncError(null));
    store.dispatch(setSyncStatus('idle'));
    if (hasPendingWork()) {
      // Leftover work (e.g. an edit landed mid-flight and its op was guarded).
      scheduleFlush();
    }
  }

  function drain(): Promise<void> {
    if (activeDrain) {
      return activeDrain;
    }
    if (!canDrain()) {
      return Promise.resolve();
    }

    activeDrain = (async () => {
      try {
        await performDrain();
      } finally {
        activeDrain = null;
      }
    })();
    return activeDrain;
  }

  const onChange = () => {
    if (!started || draining) {
      return;
    }
    if (hasPendingWork() && canDrain() && !retryScheduledOrPaused) {
      scheduleFlush();
    }
  };

  return {
    start: () => {
      if (started) {
        return;
      }
      started = true;
      backoffStep = 0;
      retryScheduledOrPaused = false;
      unsubscribe = store.subscribe(onChange);
      if (hasPendingWork()) {
        scheduleFlush();
      }
    },

    stop: () => {
      started = false;
      clearDebounce();
      if (backoffTimer) {
        clearTimeout(backoffTimer);
        backoffTimer = null;
      }
      retryScheduledOrPaused = false;
      unsubscribe?.();
      unsubscribe = null;
    },

    scheduleFlush,

    flushNow: async () => {
      clearDebounce();
      if (backoffTimer) {
        clearTimeout(backoffTimer);
        backoffTimer = null;
      }
      // Foreground, reconnect, and explicit Sync now are useful user/lifecycle
      // events, so they deliberately get one fresh attempt after the retry cap.
      retryScheduledOrPaused = false;
      await drain();
    },

    getStatus: () => ({ draining, backoffStep }),
  };
};
