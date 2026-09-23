import type { UnknownAction } from '@reduxjs/toolkit';
import { ErrorConstants, MonthConstant, PATH_DATA } from '@constants';
import { isPathCompleted } from '@utils/isPathCompleted';
import { trackEvent } from '@utils/analytics';
import { recordError } from '@utils/crashlytics';
import type { DateData, PathData } from '../types';
import {
  removePathAndSyncState,
  restoreDurableState,
  rollbackDurableMutation,
  store,
} from './index';
import { persistence } from './instance';
import { getQuarantinedPathIds } from './persistence';
import {
  addPath,
  clearPathCompletion,
  getNextDefaultPathNumber,
  getNextPathId,
  renamePath,
  setScrollPosition,
  updatePath,
} from './slices/pathsSlice';
import { markPathDeleted } from './slices/syncSlice';
import type { SettingsState } from './slices/settingsSlice';
import { showErrorAlert } from '@utils/Error';

/**
 * Acknowledged operations.
 *
 * A Redux dispatch only means "accepted in memory". Anything the user thinks of
 * as *saving* must also be durable before we report success, so each command
 * dispatches, awaits the persistence coordinator, and ROLLS BACK the store if
 * the write failed. Without the rollback a failed create would leave a phantom
 * path on screen that was never written, and a retry would allocate a second id.
 *
 * Keeping this sequencing here (rather than in each screen) is what lets the UI
 * code stay declarative.
 */

const todayString = (): string => {
  const date = new Date();
  return `${date.getDate()}-${MonthConstant[date.getMonth()]}-${date.getFullYear()}`;
};

const progressFor = (angNumber: number): number => (angNumber / PATH_DATA.LAST_ANG_NUMBER) * 100;

/**
 * Serializes acknowledged writes.
 *
 * Commands capture a rollback snapshot, dispatch, and flush. If two ran
 * concurrently, one command's rollback could resurrect the other's failed
 * mutation or clobber a newer change, because both captured overlapping
 * baselines. Running them one at a time makes capture -> dispatch -> flush ->
 * rollback atomic per command, so the captured snapshot is always the true
 * durable baseline.
 */
let commandQueue: Promise<unknown> = Promise.resolve();

const runExclusive = <T>(task: () => Promise<T>): Promise<T> => {
  const run = commandQueue.then(task, task);
  // Keep the chain alive regardless of this task's outcome.
  commandQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
};

/**
 * Report a rollback that could not be made durable — unless the writer was
 * simply shut down.
 *
 * `flush()` answers `false` for two opposite situations: a write that was
 * attempted and failed, and one that was refused outright because `stop()` had
 * already made the coordinator inert. Only the first is a problem.
 *
 * The second is the ordinary shape of teardown. App's effect cleanup calls
 * `persistence.stop()`, and a command already queued behind `runExclusive` —
 * a leave checkpoint from the reader, typically — then lands its flush against
 * a stopped writer. No commit is attempted, so the on-disk journal is exactly as
 * it was, and "may be stale" describes a disk failure that did not happen. The
 * giveaway in a report is the absence of any `persistence: commit attempt N
 * failed` alongside it: nothing ever reached the disk to fail.
 */
const reportRollbackNotDurable = (context: string): void => {
  if (persistence.isRunning()) {
    recordError(new Error('rollback flush failed; on-disk journal may be stale'), context);
  }
};

/**
 * Dispatches, flushes, and restores only the changed record if the write
 * failed, so a concurrent server response for another record survives.
 *
 * MUST be called from inside `runExclusive`, so the captured `previous` is the
 * real durable baseline and cannot be corrupted by an overlapping command.
 */
const dispatchDurable = async (action: UnknownAction): Promise<boolean> => {
  const previous = store.getState();

  store.dispatch(action);
  const saved = await persistence.flush();

  if (!saved) {
    // Roll the store back in memory immediately so the UI can report failure
    // without waiting. The restored state is persisted in the BACKGROUND (the
    // dispatches invalidate the baseline, so the coordinator rewrites it and
    // clears the stale journal on its own). We do NOT await it — awaiting a
    // second full retry cycle here is what made failures take several seconds.
    store.dispatch(rollbackDurableMutation({ action, previous }));

    persistence
      .flush()
      .then((restored) => {
        if (!restored) {
          reportRollbackNotDurable('commands: rollback not durable');
        }
      })
      .catch(() => {});
  }
  return saved;
};

/**
 * A settings change, applied to the UI immediately and persisted behind the lock.
 *
 * Setting controls are fully controlled by the store, so dispatching INSIDE the
 * command lock (as path mutations do) meant a tap could not move the switch
 * until the previous tap's disk write had finished — measured at ~435ms behind
 * the finger on a slow write. Tapping quickly, the control then appeared to
 * change on its own after the user had stopped: "I turn it on and it goes off".
 *
 * So the dispatch happens up front, and only the flush + rollback are
 * serialized. Durability is unchanged: the coordinator already queues the write
 * from the dispatch itself, and `flush()` still reports whether it landed.
 */
export const commitSettingChange = (action: UnknownAction): Promise<boolean> => {
  const previousSettings: SettingsState = store.getState().settings;
  store.dispatch(action);
  // Identity of the settings slice right after OUR change. Immer gives a new
  // object per change, so this doubles as "has anything replaced us since?".
  const appliedSettings = store.getState().settings;

  return runExclusive(async () => {
    const saved = await persistence.flush();
    if (saved) {
      return true;
    }

    // Roll back only while OUR value is still the one on screen. A newer toggle
    // is what the user last asked for and owns the outcome — restoring our
    // snapshot over it would undo a change they made after this one.
    if (store.getState().settings !== appliedSettings) {
      return false;
    }

    const current = store.getState();
    store.dispatch(
      restoreDurableState({
        paths: current.paths,
        settings: previousSettings,
        sync: current.sync,
      })
    );

    persistence
      .flush()
      .then((restored) => {
        if (!restored) {
          reportRollbackNotDurable('commands: settings rollback not durable');
        }
      })
      .catch(() => {
        // flush never rejects, but keep the floating promise safe.
      });
    return false;
  });
};

/**
 * A serialized, rolled-back mutation that targets an existing path.
 *
 * The reducers no-op when the pathId is not found. Without this guard that
 * no-op leaves the store unchanged, so the coordinator sees nothing to write
 * and `flush()` returns true — the UI would report "Saved" for a save that
 * never happened. Checking existence inside the lock turns a missing target
 * into an honest failure that the command then alerts on.
 */
const runPathMutation = (pathId: number, build: () => UnknownAction): Promise<boolean> =>
  runExclusive(async () => {
    const exists = store.getState().paths.paths.some((path) => path.pathId === pathId);
    if (!exists) {
      return false;
    }
    return dispatchDurable(build());
  });

/**
 * Creates a new path. Resolves with its id, or null if it could not be saved.
 *
 * Runs exclusively and allocates the id INSIDE the lock, so two quick taps
 * cannot both read the same `getNextPathId` and mint duplicate ids (which the
 * next boot's hydration would then reject).
 */
export const createPath = (): Promise<number | null> =>
  runExclusive(async () => {
    const { paths, dates } = store.getState().paths;
    const reservedIds = [...dates.map((date) => date.pathid), ...getQuarantinedPathIds(store)];
    const pathId = getNextPathId(paths, reservedIds);
    const defaultPathNumber = getNextDefaultPathNumber(paths);

    const path: PathData = {
      pathId,
      progress: 1,
      saveData: { angNumber: 0, verseId: 0 },
      startDate: todayString(),
      completionDate: '',
      pathName: `Path #${defaultPathNumber}`,
    };
    const date: DateData = { pathid: pathId, dates: [], scrollPosition: 0 };

    const saved = await dispatchDurable(addPath({ path, date }));
    return saved ? pathId : null;
  });

/**
 * Saves reading progress. Mirrors the old handleUpdatePath semantics.
 *
 * On failure it alerts the user (path-not-found vs write-failed) — matching the
 * old code, which threw + alerted. `silent` suppresses the alert for the
 * background scroll auto-save, which fires too often to alert on each attempt.
 */
export const savePathProgress = async (
  pathId: number,
  angNumber: number,
  verseId: number,
  scrollPosition: number,
  options: {
    /** Suppress the failure alert. */
    silent?: boolean;
    /**
     * Keep the sync itself quiet too. Defaults to `silent`, which is right for
     * the background auto-save but NOT for a save the user explicitly asked
     * for: those two were one flag, so choosing "Save" on the way out of the
     * reader saved and uploaded without ever saying so.
     */
    silentSync?: boolean;
  } = {}
): Promise<boolean> => {
  const completed = isPathCompleted(angNumber, verseId);
  const todayDate = todayString();
  const completionDate = completed ? todayDate : '';

  const saved = await runExclusive(async () => {
    const state = store.getState();
    const path = state.paths.paths.find((candidate) => candidate.pathId === pathId);
    if (!path) {
      return false;
    }
    const date = state.paths.dates.find((candidate) => candidate.pathid === pathId);
    const unchanged =
      path.saveData.angNumber === angNumber &&
      path.saveData.verseId === verseId &&
      path.progress === progressFor(angNumber) &&
      path.completionDate === completionDate &&
      (date?.scrollPosition ?? 0) === scrollPosition &&
      !!date?.dates.some((entry) => entry.date === todayDate);

    // Back/navigation checkpoints often save the exact point that was already
    // saved and uploaded from the reader. Treat that as a successful no-op:
    // stamping it again would create a needless PATCH and a second sync notice
    // when Home performs its normal background comparison.
    if (unchanged) {
      return true;
    }

    return dispatchDurable(
      updatePath({
        pathId,
        angNumber,
        verseId,
        progress: progressFor(angNumber),
        completionDate,
        todayDate,
        scrollPosition,
        silentSync: options.silentSync ?? options.silent === true,
      })
    );
  });

  // Same message the old code used. Suppressed for the background scroll
  // auto-save, which fires too often to alert on each transient failure.
  if (!saved && !options.silent) {
    showErrorAlert(ErrorConstants.FAILED_TO_SAVE_PATH_PROGRESS);
  }

  if (saved && completed) {
    trackEvent('PathCompleted', 'completed', 'path completed');
  }
  return saved;
};

export const savePathScrollPosition = (pathId: number, scrollPosition: number): Promise<boolean> =>
  runExclusive(async () => {
    const current = store.getState().paths.dates.find((date) => date.pathid === pathId);
    if ((current?.scrollPosition ?? 0) === scrollPosition) {
      return store.getState().paths.paths.some((path) => path.pathId === pathId);
    }
    const exists = store.getState().paths.paths.some((path) => path.pathId === pathId);
    if (!exists) {
      return false;
    }
    return dispatchDurable(setScrollPosition({ pathId, scrollPosition }));
  });

export const renamePathCommand = async (pathId: number, name: string): Promise<boolean> => {
  // A rename still uses the ordinary outbox/API flow, but it is housekeeping,
  // not reading progress, so it should not show a sync notice.
  const saved = await runPathMutation(pathId, () => renamePath({ pathId, name, silentSync: true }));
  if (!saved) {
    showErrorAlert(ErrorConstants.FAILED_TO_RENAME_PATH);
  }
  return saved;
};

/**
 * Deletes a path.
 *
 * A guest delete is permanent: without an account, there is nowhere to keep a
 * cloud deletion. Signed-in paths are tombstoned only until the outbox has sent
 * the delete. The outbox needs the row to build its request, then removes the
 * local copy after the server acknowledges it.
 *
 * A marked path is still in `paths`, so screens must read through
 * `selectVisiblePaths` rather than the raw slice, or a deleted path keeps
 * showing until the server confirms — which offline means indefinitely.
 */
export const deletePathCommand = async (pathId: number): Promise<boolean> => {
  // Captured inside the lock, so the report describes the state the delete
  // actually ran against rather than whatever it drifted to afterwards.
  let attempted: Record<string, string> = {};
  const deleted = await runExclusive(async () => {
    const state = store.getState();
    const meta = state.sync.meta[pathId];
    const exists = state.paths.paths.some((path) => path.pathId === pathId);
    attempted = {
      pathId: String(pathId),
      pathExists: String(exists),
      hadSyncMeta: String(!!meta),
      onServer: String(meta?.onServer ?? false),
      pendingOp: meta ? String(state.sync.pathOps[pathId]?.kind ?? 'none') : 'none',
      authStatus: state.auth.status,
      pathsHydrated: String(state.paths.hydrated),
      syncHydrated: String(state.sync.hydrated),
      recoveryNeeded: String(state.sync.recoveryNeeded),
    };
    if (!exists) {
      return false;
    }
    // A signed-out device has no account to tell about the deletion, so remove
    // its content AND any local sync intent together.
    if (state.auth.status !== 'signedIn' || !meta) {
      return dispatchDurable(removePathAndSyncState({ pathId }));
    }
    return dispatchDurable(markPathDeleted({ pathId, at: Date.now() }));
  });

  if (!deleted) {
    // Keep the command UI-free. The caller owns the failure dialog; this report
    // still records the state in which the durable write was refused.
    recordError(
      new Error('Path delete was not saved'),
      'commands: deletePathCommand refused',
      attempted
    );
    return false;
  }
  trackEvent('PathDeleted', 'deleted', 'path deleted');
  return true;
};

export const undoPathCompletion = async (
  pathId: number,
  angNumber?: number,
  scrollPosition?: number
): Promise<boolean> => {
  const saved = await runPathMutation(pathId, () =>
    clearPathCompletion({ pathId, angNumber, scrollPosition })
  );
  if (!saved) {
    showErrorAlert(ErrorConstants.FAILED_TO_SAVE_PATH_PROGRESS);
  }
  return saved;
};
