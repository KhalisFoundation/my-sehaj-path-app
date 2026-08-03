import {
  combineReducers,
  configureStore,
  createAction,
  type UnknownAction,
} from '@reduxjs/toolkit';
import { authSlice } from './slices/authSlice';
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
});

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
 * Replaces the active account's durable data in one Redux notification.
 *
 * This is used only for a clean account switch: the old account has no queued
 * paths, scroll, or settings. One root action matters because persistence sees
 * one coherent empty snapshot, never A's paths paired with B's sync metadata.
 */
export const clearActiveAccountData = createAction('app/clearActiveAccountData');

const rootReducer = (
  state: ReturnType<typeof combinedReducer> | undefined,
  action: UnknownAction
) => {
  if (state && restoreDurableState.match(action)) {
    return {
      ...state,
      settings: action.payload.settings,
      paths: action.payload.paths,
      sync: action.payload.sync,
    };
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
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = AppStore['dispatch'];
