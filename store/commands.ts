import type { UnknownAction } from '@reduxjs/toolkit';
import { MonthConstant, PATH_DATA } from '@constants';
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
    // Restore both slices; the untouched one is a no-op. Restoring settings
    // as well keeps this usable for setting commands.
    store.dispatch(setAll({ paths: previousPaths.paths, dates: previousPaths.dates }));
    store.dispatch(hydrateSettings(previousSettings));

    // The rollback must itself be durable: the failed commit left a stale
    // journal on disk, and only a successful flush of the restored state
    // clears it. If even this fails, surface it — a boot-time journal replay
    // could otherwise resurrect the change the UI reported as failed.
    const restored = await persistence.flush();
    if (!restored) {
      recordError(
        new Error('rollback flush failed; on-disk journal may be stale'),
        'commands: rollback not durable'
      );
    }
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

/** Saves reading progress. Mirrors the old handleUpdatePath semantics. */
export const savePathProgress = async (
  pathId: number,
  angNumber: number,
  verseId: number,
  scrollPosition: number
): Promise<boolean> => {
  const completed = isPathCompleted(angNumber, verseId);

  const saved = await commitOrRollback(() =>
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

  if (saved && completed) {
    trackEvent('PathCompleted', 'completed', 'path completed');
  }
  return saved;
};

export const renamePathCommand = (pathId: number, name: string): Promise<boolean> =>
  commitOrRollback(() => renamePath({ pathId, name }));

export const undoPathCompletion = (
  pathId: number,
  angNumber?: number,
  scrollPosition?: number
): Promise<boolean> =>
  commitOrRollback(() => clearPathCompletion({ pathId, angNumber, scrollPosition }));
