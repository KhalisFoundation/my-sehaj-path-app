import {
  combineReducers,
  configureStore,
  createAction,
  type UnknownAction,
} from '@reduxjs/toolkit';
import { authSlice } from './slices/authSlice';
import { dbSlice } from './slices/dbSlice';
import { networkSlice } from './slices/networkSlice';
import { pathsSlice, type PathsState } from './slices/pathsSlice';
import { SETTINGS_DEFAULTS, settingsSlice, type SettingsState } from './slices/settingsSlice';
import { syncSlice, type SyncState } from './slices/syncSlice';
import { syncStampMiddleware } from './syncStampMiddleware';

const combinedReducer = combineReducers({
  settings: settingsSlice.reducer,
  paths: pathsSlice.reducer,
  network: networkSlice.reducer,
  auth: authSlice.reducer,
  sync: syncSlice.reducer,
  db: dbSlice.reducer,
});
type CombinedState = ReturnType<typeof combinedReducer>;

const getActionPathId = (action: UnknownAction): number | null => {
  if (typeof action.payload !== 'object' || action.payload === null) {
    return null;
  }
  if ('pathId' in action.payload && typeof action.payload.pathId === 'number') {
    return action.payload.pathId;
  }
  if (
    'path' in action.payload &&
    typeof action.payload.path === 'object' &&
    action.payload.path !== null &&
    'pathId' in action.payload.path &&
    typeof action.payload.path.pathId === 'number'
  ) {
    return action.payload.path.pathId;
  }
  return null;
};

/**
 * Restores every durable slice in one Redux notification after a failed write.
 * A pair of ordinary slice dispatches would expose a half-restored snapshot to
 * the persistence subscriber and could start writing the failed value again.
 * Sync is restored alongside paths/settings so a rolled-back path never leaves
 * behind a pending operation describing the value that failed to save.
 */
export const restoreDurableState = createAction<{
  settings: SettingsState;
  paths: PathsState;
  sync: SyncState;
}>('app/restoreDurableState');

/**
 * Reverts only the record touched by a failed local command. Server responses
 * are not serialized with command persistence, so restoring whole slices here
 * could otherwise erase an unrelated cloud update that arrived mid-write.
 */
export const rollbackDurableMutation = createAction<{
  action: UnknownAction;
  previous: CombinedState;
}>('app/rollbackDurableMutation');

/**
 * Replaces the active account's durable data in one Redux notification.
 *
 * This is used only for a clean account switch: the old account has no queued
 * paths, scroll, or settings. One root action matters because persistence sees
 * one coherent empty snapshot, never A's paths paired with B's sync metadata.
 */
export const clearActiveAccountData = createAction('app/clearActiveAccountData');

const rootReducer = (state: CombinedState | undefined, action: UnknownAction): CombinedState => {
  if (state && restoreDurableState.match(action)) {
    return {
      ...state,
      settings: action.payload.settings,
      paths: action.payload.paths,
      sync: action.payload.sync,
    };
  }
  if (state && rollbackDurableMutation.match(action)) {
    const { action: failedAction, previous } = action.payload;
    const pathId = getActionPathId(failedAction);
    if (pathId != null) {
      const previousPath = previous.paths.paths.find((path) => path.pathId === pathId);
      const previousDate = previous.paths.dates.find((date) => date.pathid === pathId);
      const replace = <T extends { pathId?: number; pathid?: number }>(
        entries: T[],
        item: T | undefined,
        idKey: 'pathId' | 'pathid'
      ): T[] => {
        const currentIndex = entries.findIndex((entry) => entry[idKey] === pathId);
        if (!item) {
          return entries.filter((entry) => entry[idKey] !== pathId);
        }
        if (currentIndex < 0) {
          return [...entries, item];
        }
        return entries.map((entry, index) => (index === currentIndex ? item : entry));
      };
      const nextSync = {
        ...state.sync,
        meta: { ...state.sync.meta },
        pathOps: { ...state.sync.pathOps },
        scrollDirty: { ...state.sync.scrollDirty },
      };
      const restoreSyncEntry = <T>(target: Record<number, T>, source: Record<number, T>) => {
        if (source[pathId] === undefined) {
          delete target[pathId];
        } else {
          target[pathId] = source[pathId];
        }
      };
      restoreSyncEntry(nextSync.meta, previous.sync.meta);
      restoreSyncEntry(nextSync.pathOps, previous.sync.pathOps);
      restoreSyncEntry(nextSync.scrollDirty, previous.sync.scrollDirty);
      return {
        ...state,
        paths: {
          ...state.paths,
          paths: replace(state.paths.paths, previousPath, 'pathId'),
          dates: replace(state.paths.dates, previousDate, 'pathid'),
        },
        sync: nextSync,
      };
    }
    const settingKey = failedAction.type.replace(`${settingsSlice.name}/set`, '');
    const normalizedKey = settingKey.charAt(0).toLowerCase() + settingKey.slice(1);
    if (
      failedAction.type.startsWith(`${settingsSlice.name}/set`) &&
      normalizedKey in previous.settings
    ) {
      return {
        ...state,
        settings: {
          ...state.settings,
          [normalizedKey]: previous.settings[normalizedKey as keyof SettingsState],
        },
        sync: {
          ...state.sync,
          pendingSettingsUpdatedAt: previous.sync.pendingSettingsUpdatedAt,
        },
      };
    }
  }
  if (state && clearActiveAccountData.match(action)) {
    const paths: PathsState = { ...state.paths, paths: [], dates: [] };
    const sync: SyncState = {
      ...state.sync,
      account: null,
      lastSyncedAt: 0,
      meta: {},
      pathOps: {},
      scrollDirty: {},
      settingsUpdatedAt: 0,
      pendingSettingsUpdatedAt: null,
      status: 'idle',
      lastError: null,
    };
    return {
      ...state,
      settings: { ...SETTINGS_DEFAULTS },
      paths,
      sync,
    };
  }
  return combinedReducer(state, action);
};

/**
 * Builds an isolated store. Tests use this so each case starts from a clean
 * slate instead of sharing the app singleton.
 *
 * Phase 1 deliberately has no redux-persist: AsyncStorage remains the
 * persistence layer, driven by the write coordinator in `store/persistence.ts`.
 */
export const makeStore = () =>
  configureStore({
    reducer: rootReducer,
    // Stamps sync bookkeeping from path/settings mutations (Step 5). Type-only
    // import of RootState above keeps this free of a runtime import cycle.
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(syncStampMiddleware),
  });

export const store = makeStore();

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = CombinedState;
export type AppDispatch = AppStore['dispatch'];
