import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { networkSlice } from './slices/networkSlice';
import { pathsSlice } from './slices/pathsSlice';
import { settingsSlice } from './slices/settingsSlice';

const rootReducer = combineReducers({
  settings: settingsSlice.reducer,
  paths: pathsSlice.reducer,
  network: networkSlice.reducer,
});

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
