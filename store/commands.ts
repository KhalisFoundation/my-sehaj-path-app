import type { UnknownAction } from '@reduxjs/toolkit';
import { ErrorConstants, MonthConstant, PATH_DATA } from '@constants';
import { isPathCompleted } from '@utils/isPathCompleted';
import { trackEvent } from '@utils/analytics';
import { recordError } from '@utils/crashlytics';
import type { DateData, PathData } from '../types';
import { store } from './index';
import { persistence } from './instance';
import {
  addPath,
  clearPathCompletion,
  getNextPathId,
  renamePath,
  setAll,
  updatePath,
} from './slices/pathsSlice';
import { hydrateSettings, type SettingsState } from './slices/settingsSlice';
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
 * Dispatches, flushes, and restores the previous state (both slices) if the
 * write failed, so the store never keeps a mutation that is not on disk.
 *
 * MUST be called from inside `runExclusive`, so the captured `previous` is the
 * real durable baseline and cannot be corrupted by an overlapping command.
 */
const dispatchDurable = async (action: UnknownAction): Promise<boolean> => {
  const previousPaths = store.getState().paths;
  const previousSettings: SettingsState = store.getState().settings;

  store.dispatch(action);
  const saved = await persistence.flush();

  if (!saved) {
    // Roll the store back in memory immediately so the UI can report failure
    // without waiting. The restored state is persisted in the BACKGROUND (the
    // dispatches invalidate the baseline, so the coordinator rewrites it and
    // clears the stale journal on its own). We do NOT await it — awaiting a
    // second full retry cycle here is what made failures take several seconds.
    store.dispatch(setAll({ paths: previousPaths.paths, dates: previousPaths.dates }));
    store.dispatch(hydrateSettings(previousSettings));

    persistence
      .flush()
      .then((restored) => {
        if (!restored) {
          recordError(
            new Error('rollback flush failed; on-disk journal may be stale'),
            'commands: rollback not durable'
          );
        }
      })
      .catch(() => {
        // flush never rejects, but keep the floating promise safe.
      });
  }
  return saved;
};

/**
 * Builds the action INSIDE the exclusive section and commits it. Building inside
 * the lock is what makes id allocation (createPath) and any other read of store
 * state race-free: no two commands can read the same baseline concurrently.
 */
const commitOrRollback = (build: () => UnknownAction): Promise<boolean> =>
  runExclusive(() => dispatchDurable(build()));

/** Serialized, rolled-back setting change. Used by useSetting. */
export const commitSettingChange = (action: UnknownAction): Promise<boolean> =>
  commitOrRollback(() => action);

/**
 * Like `commitOrRollback`, but for a mutation that targets an existing path.
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
    const pathId = getNextPathId(store.getState().paths.paths);

    const path: PathData = {
      pathId,
      progress: 1,
      saveData: { angNumber: 0, verseId: 0 },
      startDate: todayString(),
      completionDate: '',
      pathName: `Path #${pathId}`,
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
  options: { silent?: boolean } = {}
): Promise<boolean> => {
  const completed = isPathCompleted(angNumber, verseId);

  const saved = await runPathMutation(pathId, () =>
    updatePath({
      pathId,
      angNumber,
      verseId,
      progress: progressFor(angNumber),
      completionDate: completed ? todayString() : '',
      todayDate: todayString(),
      scrollPosition,
    })
  );

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

export const renamePathCommand = async (pathId: number, name: string): Promise<boolean> => {
  const saved = await runPathMutation(pathId, () => renamePath({ pathId, name }));
  if (!saved) {
    showErrorAlert(ErrorConstants.FAILED_TO_RENAME_PATH);
  }
  return saved;
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
