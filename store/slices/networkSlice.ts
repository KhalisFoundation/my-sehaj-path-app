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
