import { isApiConfigured } from '@api/config';
import { recordError } from '../utils/crashlytics';
import { refreshPathsFromServer } from './applyServerResponse';
import { store } from './index';
import { outbox } from './instance';
import {
  markCatchUpSyncDone,
  markPathEdited,
  requestSyncConfirmation,
  setCatchUpSyncRunning,
} from './slices/syncSlice';
import { hasLocalData, hasWorkBlockingPull, isPathOpBlocked } from './syncWork';
import { getActiveReaderPath } from './activeReaderPath';

export { getActiveReaderPath, setActiveReaderPath } from './activeReaderPath';

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

const hasPendingWork = (): boolean => hasWorkBlockingPull(store);

/**
 * A cheap signature of the reading the user can see, used to tell whether the
 * catch-up actually brought anything down.
 */
const pathSignature = (): string => {
  const { paths } = store.getState();
  return paths.paths
    .map((path) => `${path.pathId}:${path.saveData.angNumber}.${path.saveData.verseId}`)
    .join('|');
};

/**
 * Promote every scroll-only checkpoint before a full sync attempt.
 *
 * A path with a *sendable* op needs nothing: that op reads the latest ang, verse
 * and scroll when it is sent, so the scroll piggybacks on it.
 *
 * A path with a *permanently-blocked* op is the exception, and skipping it
 * deadlocks the device. `markScrollDirty` deliberately leaves `pathOps` alone, so
 * the blocked op keeps the `localUpdatedAt` the server rejected and stays blocked,
 * while its `scrollDirty` entry blocks every pull. Nothing uploads and nothing
 * downloads, forever. Re-stamping the op gives it a version the block no longer
 * matches — the same mechanism that frees a path when the user edits it.
 */
const promoteDirtyScroll = (): boolean => {
  const state = store.getState();
  let promoted = false;
  Object.keys(state.sync.scrollDirty).forEach((key) => {
    const pathId = Number(key);
    const meta = state.sync.meta[pathId];
    if (!meta?.onServer) {
      return; // a pending create already carries the latest scroll
    }
    const op = state.sync.pathOps[pathId];
    if (!op || isPathOpBlocked(store, pathId, op.localUpdatedAt)) {
      store.dispatch(markPathEdited({ pathId, at: Date.now() }));
      promoted = true;
    }
  });
  return promoted;
};

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
  // The first run of a session is the catch-up: it uploads anything read while
  // signed out and pulls what other devices did meanwhile. It covers a cold
  // start too, because hydration resets the flag. That one is worth narrating;
  // the dozens of later focus events are not.
  const isCatchUpSync = !store.getState().sync.catchUpSyncDone;
  if (isCatchUpSync) {
    store.dispatch(setCatchUpSyncRunning(true));
    // Confirm up front only when this device actually HAS reading to reconcile.
    // A brand-new account has nothing on the device and nothing in the cloud, so
    // "Synced" would be announcing something that never happened.
    if (hasLocalData(store)) {
      store.dispatch(requestSyncConfirmation());
    }
  }
  const before = isCatchUpSync ? pathSignature() : '';

  try {
    promoteDirtyScroll();
    if (hasPendingWork()) {
      await outbox.flushNow();
    }
    if (hasPendingWork()) {
      return; // offline/error/permanent rejection: never pull stale server data over it
    }
    // Default to the open reader path so it isn't reconciled mid-read.
    await refreshPathsFromServer(store, activePathId ?? getActiveReaderPath() ?? undefined);
  } catch (error) {
    recordError(error, 'syncLifecycle: foreground sync failed');
  } finally {
    if (isCatchUpSync) {
      // Nothing locally, but another device's reading arrived. That IS worth
      // reporting — it explains a list that just changed on screen. Requested
      // late by necessity: a pull only knows what it fetched once it is done.
      if (pathSignature() !== before) {
        store.dispatch(requestSyncConfirmation());
      }
      store.dispatch(markCatchUpSyncDone());
    }
  }
};

/**
 * A checkpoint (app background, leaving the reader): flush pending local work.
 *
 * Runs promote/flush TWICE on purpose. A path created moments earlier is not on
 * the server yet, so `promoteDirtyScroll` skips it — but the flush creates it,
 * and any scroll recorded around that moment is left dirty with nothing to carry
 * it. A lone dirty scroll never schedules a drain of its own (`hasSendableWork`
 * counts operations, not scroll), so without a second pass the reading position
 * would sit unsent until the next foreground, and the status notice would wait
 * on work that was never going to move.
 */
export const onCheckpoint = async (): Promise<void> => {
  if (!canSyncNow()) {
    return;
  }
  try {
    promoteDirtyScroll();
    await outbox.flushNow();

    // Second pass: paths that only just reached the server can now carry their
    // scroll. Only flush again if that actually produced work, so the ordinary
    // checkpoint stays a single round trip.
    if (promoteDirtyScroll()) {
      await outbox.flushNow();
    }
  } catch (error) {
    // These run from screen callbacks and app lifecycle events. An escaping
    // rejection there is unhandled, and the queued work is already durable, so
    // log it and let the next checkpoint retry.
    recordError(error, 'syncLifecycle: checkpoint flush failed');
  }
};

/**
 * Network came back online: flush anything that queued while offline, then pull.
 *
 * The pull is not optional. An account whose data never downloaded — a switch
 * that raced a dropping connection, or a first login that could not reach the
 * server — shows an empty list, and flushing alone leaves it empty until the user
 * happens to background the app or tap Sync. Reconnect is exactly the moment that
 * should resolve itself.
 *
 * Ordering is the same as `onForeground`: upload first, and never pull while
 * sendable work or a dirty scroll remains.
 */
export const onReconnect = async (): Promise<void> => {
  if (!canSyncNow()) {
    return;
  }
  try {
    promoteDirtyScroll();
    if (hasPendingWork()) {
      await outbox.flushNow();
    }
    if (hasPendingWork()) {
      return;
    }
    await refreshPathsFromServer(store, getActiveReaderPath() ?? undefined);
  } catch (error) {
    recordError(error, 'syncLifecycle: reconnect sync failed');
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
  // Confirm only when leaving actually saved something. Promotion has already
  // run, so a reader the user scrolled has pending work by now; opening a path
  // and backing out without reading has none, and deserves no message.
  if (canSyncNow() && hasPendingWork()) {
    store.dispatch(requestSyncConfirmation());
  }
  await onCheckpoint();
};
