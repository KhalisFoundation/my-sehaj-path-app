import {
  combineReducers,
  configureStore,
  createAction,
  type UnknownAction,
} from '@reduxjs/toolkit';
import { authSlice } from './slices/authSlice';
import { networkSlice } from './slices/networkSlice';
import { pathsSlice, type PathsState } from './slices/pathsSlice';
import { settingsSlice, type SettingsState } from './slices/settingsSlice';

const combinedReducer = combineReducers({
  settings: settingsSlice.reducer,
  paths: pathsSlice.reducer,
  network: networkSlice.reducer,
  auth: authSlice.reducer,
});

/**
 * Restores both durable slices in one Redux notification after a failed write.
 * A pair of ordinary slice dispatches would expose a half-restored snapshot to
 * the persistence subscriber and could start writing the failed value again.
 */
export const restoreDurableState = createAction<{
  settings: SettingsState;
  paths: PathsState;
}>('app/restoreDurableState');

const rootReducer = (
  state: ReturnType<typeof combinedReducer> | undefined,
  action: UnknownAction
) => {
  if (state && restoreDurableState.match(action)) {
    return {
      ...state,
      settings: action.payload.settings,
      paths: action.payload.paths,
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
export const makeStore = () => configureStore({ reducer: rootReducer });

export const store = makeStore();

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = AppStore['dispatch'];
