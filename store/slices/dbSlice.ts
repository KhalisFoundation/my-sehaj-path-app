import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Runtime status of the offline reading database. NOT persisted — it is derived
 * on every launch from whether the DB file is on disk and the download outcome.
 *
 * - `unknown`        — before boot provisioning has run.
 * - `downloading`    — the DB is being fetched (see `progress`).
 * - `ready`          — the DB is installed and the reader can use it offline.
 * - `notConfigured`  — no download URL set yet; the app keeps using the API.
 * - `failed`         — download failed; the app keeps using the API and may retry.
 */
export type DbStatus = 'unknown' | 'downloading' | 'ready' | 'notConfigured' | 'failed';

export interface DbState {
  status: DbStatus;
  /** Download progress 0–100 (only meaningful while `downloading`). */
  progress: number;
}

const initialState: DbState = {
  status: 'unknown',
  progress: 0,
};

export const dbSlice = createSlice({
  name: 'db',
  initialState,
  reducers: {
    dbDownloadStarted: (state) => {
      state.status = 'downloading';
      state.progress = 0;
    },
    dbDownloadProgress: (state, action: PayloadAction<number>) => {
      state.progress = action.payload;
    },
    dbReady: (state) => {
      state.status = 'ready';
      state.progress = 100;
    },
    dbNotConfigured: (state) => {
      state.status = 'notConfigured';
    },
    dbFailed: (state) => {
      state.status = 'failed';
    },
  },
});

export const { dbDownloadStarted, dbDownloadProgress, dbReady, dbNotConfigured, dbFailed } =
  dbSlice.actions;
