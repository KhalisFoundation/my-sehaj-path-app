import {
  sehajPathSettingsControllerUpsert,
  sehajPathSyncControllerSync,
  sehajPathsControllerCreate,
  sehajPathsControllerRemove,
  sehajPathsControllerUpdate,
} from '@api/generated/sdk.gen';
import { isApiConfigured } from '@api/config';
import { clearCurrentToken } from '../auth/tokenUtils';
import { recordError } from '../utils/crashlytics';
import { applyServerPath, applySyncResult, captureSyncSnapshot } from './applyServerResponse';
import type { AppStore, RootState } from './index';
import { setSignedOut } from './slices/authSlice';
import { removePathLocal } from './slices/pathsSlice';
import {
  ackServerPathExists,
  clearOpIfUnchanged,
  clearScrollIfUnchanged,
  clearSettingsIfUnchanged,
  dropMeta,
  setSyncError,
  setSyncStatus,
  type PendingPathOp,
} from './slices/syncSlice';
import { toCreateBody, toPatchBody, type LocalPath } from './syncAdapters';
import { buildSyncRequest, toSettingsBody } from './syncRequest';
import {
  captureSyncSession,
  isCurrentSyncSession,
  syncSessionHeaders,
  type SyncSession,
} from './syncSession';

const DEFAULT_DEBOUNCE_MS = 5000;
const DEFAULT_BACKOFF_MS = [5000, 30000, 120000];

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
   * Ops the server rejected permanently (a 4xx it will always reject), keyed by
   * pathId → the `localUpdatedAt` that failed. The op is KEPT locally (the user's
   * change is never discarded) but skipped, so it can't spin forever. Editing the
   * path changes its `localUpdatedAt`, which no longer matches and is retried.
   */
  const blockedOps = new Map<number, number>();
  let blockedSettingsRev: number | null = null;
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
  const hasPendingWork = (): boolean => {
    const s = state();
    const hasSendableOp = Object.entries(s.sync.pathOps).some(
      ([key, op]) => blockedOps.get(Number(key)) !== op.localUpdatedAt
    );
    const rev = s.sync.pendingSettingsUpdatedAt;
    return hasSendableOp || (rev != null && rev !== blockedSettingsRev);
  };

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
          return classify(res.response?.status);
        }
        // 2xx or 404 → the path is gone on the server; remove it locally.
        store.dispatch(removePathLocal(pathId));
        store.dispatch(dropMeta(pathId));
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
        applyServerPath(store, res.data, { pathId, sentLocalUpdatedAt, operation: 'create' });
        clearScrollOnAck();
        return 'acked';
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
      applyServerPath(store, res.data, { pathId, sentLocalUpdatedAt, operation: 'update' });
      clearScrollOnAck();
      return 'acked';
    } catch (error) {
      recordError(error, `outbox: ${op.kind} failed`);
      return ownsCurrentSession(session) ? 'network' : 'stale';
    }
  };

  const processSettings = async (session: SyncSession): Promise<Outcome> => {
    if (!ownsCurrentSession(session)) {
      return 'stale';
    }
    const rev = state().sync.pendingSettingsUpdatedAt;
    if (rev == null || rev === blockedSettingsRev) {
      return 'acked'; // nothing pending, or this exact revision is permanently rejected
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
          blockedSettingsRev = rev; // keep the local value, stop retrying it
        }
        return outcome;
      }
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
    try {
      const res = await sehajPathSyncControllerSync({
        body: buildSyncRequest(state()),
        headers: syncSessionHeaders(session),
      });
      if (!ownsCurrentSession(session)) {
        return 'stale';
      }
      if (res.error) {
        return classify(res.response?.status);
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
        if (blockedOps.get(pathId) === op.localUpdatedAt) {
          continue;
        }
        const result = await processPathOp(pathId, op, session);
        if (result === 'permanent') {
          // Keep the user's change locally, but never loop on it.
          blockedOps.set(pathId, op.localUpdatedAt);
          outcome = 'permanent';
          continue; // other paths may still sync fine
        }
        // A conflict short-circuits: one bulk /sync reconciles the whole snapshot.
        if (result !== 'acked') {
          outcome = result;
          break;
        }
      }
      if (outcome === 'conflict') {
        outcome = await reconcileViaSync(session);
      }
      // A permanently-rejected path must not stop unrelated settings from syncing.
      if (outcome === 'acked' || outcome === 'permanent') {
        const settingsResult = await processSettings(session);
        if (settingsResult !== 'acked') {
          outcome = settingsResult;
        }
      }
    } finally {
      draining = false;
    }

    if (outcome === 'auth') {
      // A 401 means the token is rejected. Sign out locally — clear the auth
      // slice and the persisted token — so `canDrain()` becomes false and we
      // stop retrying with a bad token. (Local only; no SSO browser redirect.)
      store.dispatch(setSignedOut());
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
      store.dispatch(setSyncError('network')); // also sets status = 'error'
      scheduleBackoff();
      return;
    }
    if (outcome === 'permanent') {
      // The server will reject this identically every time. Flag it, keep the
      // change on the device, and do NOT back off — retrying cannot help. The
      // next local edit to that path clears the block and re-queues it.
      store.dispatch(setSyncError('rejected'));
      backoffStep = 0;
      return;
    }

    // outcome === 'acked' (a conflict was already resolved via reconcileViaSync).
    backoffStep = 0;
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
    if (hasPendingWork() && canDrain()) {
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
      unsubscribe?.();
      unsubscribe = null;
    },

    scheduleFlush,

    flushNow: async () => {
      clearDebounce();
      await drain();
    },

    getStatus: () => ({ draining, backoffStep }),
  };
};
