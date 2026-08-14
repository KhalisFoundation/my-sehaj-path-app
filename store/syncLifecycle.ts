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
import {
  hasLocalData,
  hasSendablePathOps,
  hasWorkBlockingPull,
  isPathOpBlocked,
  isSilentPathOp,
  markSilentPathOp,
} from './syncWork';
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
    isApiConfigured() &&
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

const promoteDirtyScroll = (announce = false): boolean => {
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
      // This op exists only to carry the latest scroll position at a lifecycle
      // checkpoint. It normally stays silent, but reconnecting is an explicit
      // recovery moment: acknowledge that offline reading reached the cloud.
      const promotedOp = store.getState().sync.pathOps[pathId];
      if (promotedOp && !announce) {
        markSilentPathOp(pathId, promotedOp.localUpdatedAt);
      }
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
// `undefined` means an app foreground event, so protect whichever reader is
// currently open. `null` is Home's explicit signal that the reader was left and
// its path is now safe to apply even if React Navigation has not yet run the
// reader cleanup.
export const onForeground = async (activePathId?: number | null): Promise<void> => {
  if (!canSyncNow()) {
    return;
  }
  const isCatchUpSync = !store.getState().sync.catchUpSyncDone;
  if (isCatchUpSync) {
    store.dispatch(setCatchUpSyncRunning(true));
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
      return;
    }
    const pathToProtect =
      activePathId === undefined ? getActiveReaderPath() ?? undefined : activePathId ?? undefined;
    await refreshPathsFromServer(store, pathToProtect);
  } catch (error) {
    recordError(error, 'syncLifecycle: foreground sync failed');
  } finally {
    if (isCatchUpSync) {
      if (pathSignature() !== before) {
        store.dispatch(requestSyncConfirmation());
      }
      store.dispatch(markCatchUpSyncDone());
    }
  }
};

export const onCheckpoint = async (): Promise<void> => {
  if (!canSyncNow()) {
    return;
  }
  try {
    promoteDirtyScroll();
    await outbox.flushNow();
    if (promoteDirtyScroll()) {
      await outbox.flushNow();
    }
  } catch (error) {
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
    if (promoteDirtyScroll(true)) {
      store.dispatch(requestSyncConfirmation());
    }
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

export const onScreenBlur = async (): Promise<void> => {
  const hadRealEdit =
    canSyncNow() &&
    hasSendablePathOps(store) &&
    Object.entries(store.getState().sync.pathOps).some(
      ([pathId, op]) => !isSilentPathOp(Number(pathId), op.localUpdatedAt)
    );

  /**
   * The user moved their reading position without saving a line.
   *
   * This must be read BEFORE promotion, and it is what makes the confirmation
   * deterministic. Leaving the reader used to announce only when the explicit
   * leave-save happened to create an op — and it only does that when the
   * debounced scroll checkpoint had NOT already written the same position
   * (`unchangedSinceOpen` in PathScreen returns early otherwise). So pausing
   * before pressing Home silently swallowed the message while tapping straight
   * away showed it: the same action reported differently depending on timing,
   * and paragraph mode (where pauses are more likely) almost never announced.
   *
   * A dirty scroll is real reading progress that this checkpoint uploads, so it
   * deserves the same confirmation as an explicit save.
   */
  const movedReadingPosition =
    canSyncNow() && Object.keys(store.getState().sync.scrollDirty).length > 0;

  promoteDirtyScroll();

  if (hadRealEdit || movedReadingPosition) {
    store.dispatch(requestSyncConfirmation());
  }
  await onCheckpoint();
};
