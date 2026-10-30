import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface NetworkState {
  isOnline: boolean;
}

/**
 * Connectivity is runtime-only and is never persisted. A single NetInfo
 * listener at the app root feeds this slice, replacing the per-screen
 * `useInternet` subscriptions.
 */
const initialState: NetworkState = {
  isOnline: true,
};

export const networkSlice = createSlice({
  name: 'network',
  initialState,
  reducers: {
    setOnline: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },
  },
});

export const { setOnline } = networkSlice.actions;

/**
 * Turn a NetInfo reading into online/offline.
 *
 * `isInternetReachable` is THREE-valued: true, false, and null meaning "not
 * determined yet". Folding null in with `&&` made unknown mean offline — and
 * because this slice starts optimistically online, the FIRST NetInfo event then
 * took the app offline and nothing ever brought it back.
 *
 * That is not a simulator curiosity, though the iOS simulator is where it bites
 * hardest: there `isInternetReachable` can stay null indefinitely, so the app
 * sat permanently offline while every request it declined to make would have
 * succeeded. On a device the same null appears briefly at startup.
 *
 * Nothing surfaced it, because the only symptom is silence — `canSyncNow`
 * requires `isOnline`, so sync simply never ran and never said why.
 *
 * So only an explicit `false` is offline. Unknown reachability is treated as
 * usable and the request itself finds out; `db/connectivity.ts` exists for the
 * few decisions that need a real answer rather than a cached flag.
 */
export const isOnlineFrom = (reading: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}): boolean => reading.isConnected === true && reading.isInternetReachable !== false;
