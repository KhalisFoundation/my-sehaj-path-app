import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Runtime status of the offline reading database. NOT persisted — it is derived
 * on every launch from whether the DB file is on disk and the download outcome.
 *
 * - `unknown`        — before boot provisioning has run.
 * - `downloading`    — the DB is being fetched.
 * - `ready`          — the DB is installed and the reader can use it offline.
 * - `notConfigured`  — no download URL set yet; the app keeps using the API.
 * - `failed`         — download failed; the app keeps using the API and may retry.
 */
export type DbStatus = 'unknown' | 'downloading' | 'ready' | 'notConfigured' | 'failed';

/**
 * What just finished, for the one-off confirmation the user sees.
 *
 * Status alone cannot express this. A failed update also ends at `ready` —
 * correctly, because the previous database is untouched and still usable — so a
 * notice driven off the `downloading -> ready` transition congratulated the user
 * on a download that never happened, right next to "Unable to update database".
 */
export type DbCompletion = 'installed' | 'updated';

export interface DbState {
  status: DbStatus;
  /** Set only by a genuine success; cleared once the notice has been shown. */
  completed: DbCompletion | null;
}

const initialState: DbState = {
  status: 'unknown',
  completed: null,
};

export const dbSlice = createSlice({
  name: 'db',
  initialState,
  reducers: {
    dbDownloadStarted: (state) => {
      state.status = 'downloading';
    },
    /** Ready, with nothing to announce — boot, or recovery after a failure. */
    dbReady: (state) => {
      state.status = 'ready';
    },
    /** Ready BECAUSE a download just succeeded. Only this shows the notice. */
    dbInstalled: (state, action: PayloadAction<DbCompletion>) => {
      state.status = 'ready';
      state.completed = action.payload;
    },
    dbNoticeShown: (state) => {
      state.completed = null;
    },
    dbNotConfigured: (state) => {
      state.status = 'notConfigured';
    },
    dbFailed: (state) => {
      state.status = 'failed';
    },
  },
});

export const { dbDownloadStarted, dbReady, dbInstalled, dbNoticeShown, dbNotConfigured, dbFailed } =
  dbSlice.actions;
