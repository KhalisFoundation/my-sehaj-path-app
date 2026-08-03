import { isApiConfigured } from '@api/config';
import { refreshPathsFromServer } from './applyServerResponse';
import { store } from './index';
import { outbox } from './instance';
import { markPathEdited } from './slices/syncSlice';

/**
 * Sync lifecycle triggers (Step 10). App.tsx / screens call these at the right
 * moments; each is a no-op unless the store is hydrated, associated to the
 * signed-in account, out of recovery, and online. The coordinator and
 * `refreshPathsFromServer` also re-check their own guards, so these are just the
 * "should we bother?" gate plus the choice of push vs pull.
 */
export const canSyncNow = (): boolean => {
  const state = store.getState();
  return (
    isApiConfigured() && // no base URL in this build → purely offline
    state.sync.hydrated &&
    !state.sync.recoveryNeeded &&
    !!state.auth.token &&
    !!state.auth.email &&
    state.sync.account === state.auth.email &&
    state.network.isOnline
  );
};

const hasPendingWork = (): boolean => {
  const state = store.getState();
  return (
    Object.keys(state.sync.pathOps).length > 0 ||
    Object.keys(state.sync.scrollDirty).length > 0 ||
    state.sync.pendingSettingsUpdatedAt != null
  );
};

/** Promote every scroll-only checkpoint before a full sync attempt. */
const promoteDirtyScroll = (): void => {
  const state = store.getState();
  Object.keys(state.sync.scrollDirty).forEach((key) => {
    const pathId = Number(key);
    const meta = state.sync.meta[pathId];
    if (meta?.onServer && !state.sync.pathOps[pathId]) {
      store.dispatch(markPathEdited({ pathId, at: Date.now() }));
    }
  });
};

/**
 * The path currently open in the reader, if any. `PathScreen` registers it while
 * focused so a foreground `GET /paths` refresh never overwrites or removes the
 * path being read (the caller may still pass an explicit id to override).
 */
let activeReaderPathId: number | null = null;
export const setActiveReaderPath = (pathId: number | null): void => {
  activeReaderPathId = pathId;
};

/** Used by the drawer's explicit Sync now so its pull also protects the reader. */
export const getActiveReaderPath = (): number | null => activeReaderPathId;

/**
 * App came to the foreground (or a known account just resumed). With pending
 * local work, push it and wait. Only after the queue is empty pull other
 * devices' changes via `GET /paths`; this prevents an old server response from
 * replacing offline progress. `activePathId` protects the open reader.
 */
export const onForeground = async (activePathId?: number): Promise<void> => {
  if (!canSyncNow()) {
    return;
  }
  promoteDirtyScroll();
  if (hasPendingWork()) {
    await outbox.flushNow();
  }
  if (hasPendingWork()) {
    return; // offline/error/permanent rejection: never pull stale server data over it
  }
  // Default to the open reader path so it isn't reconciled mid-read.
  await refreshPathsFromServer(store, activePathId ?? activeReaderPathId ?? undefined);
};

/** A checkpoint (app background): flush pending local work now. */
export const onCheckpoint = async (): Promise<void> => {
  if (canSyncNow()) {
    promoteDirtyScroll();
    await outbox.flushNow();
  }
};

/** Network came back online: flush anything that queued while offline. */
export const onReconnect = async (): Promise<void> => {
  if (canSyncNow()) {
    promoteDirtyScroll();
    await outbox.flushNow();
  }
};

/**
 * Leaving the reader (`PathScreen` blur/background). A scroll change on its own
 * never creates an outbox op, so the final scroll would never be sent. If the
 * path is on the server and has dirty scroll but no pending op, promote it to an
 * `update` (whose PATCH carries the current scroll), then flush.
 */
export const onScreenBlur = async (): Promise<void> => {
  // Promotion is global: every path with dirty scroll and no pending op is
  // queued, so the blurring screen's own id is not needed.
  promoteDirtyScroll();
  await onCheckpoint();
};
