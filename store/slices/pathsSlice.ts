import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { DateData, PathData } from '../../types';

export interface PathsState {
  paths: PathData[];
  dates: DateData[];
  /**
   * False until legacy AsyncStorage has been successfully read into the store.
   * The persistence coordinator MUST refuse to write while this is false,
   * otherwise an empty store would overwrite the user's real data on disk.
   */
  hydrated: boolean;
}

const initialState: PathsState = {
  paths: [],
  dates: [],
  hydrated: false,
};

export interface UpdatePathPayload {
  pathId: number;
  angNumber: number;
  verseId: number;
  /** Caller computes progress so this reducer stays pure. */
  progress: number;
  /** Caller decides completion; '' clears it. */
  completionDate: string;
  /** Caller supplies today's date string in the legacy 'D-Month-YYYY' format. */
  todayDate: string;
  scrollPosition?: number;
  /** Auto-scroll checkpoints sync silently; an explicit save remains visible. */
  silentSync?: boolean;
}

/**
 * Next path id = max(existing) + 1.
 *
 * Never `paths.length + 1` (what the old `handleNewPath` did): once any path is
 * removed, or ids are non-contiguous, length+1 collides with an existing id and
 * progress saves would silently target the wrong path.
 */
export const getNextPathId = (paths: PathData[], reservedIds: Iterable<number> = []): number => {
  let max = paths.reduce((current, path) => Math.max(current, path.pathId), 0);
  for (const id of reservedIds) {
    if (Number.isFinite(id) && id > max) {
      max = id;
    }
  }
  return Math.floor(max) + 1;
};

/**
 * The default label is user-facing, unlike `pathId`, which is a device-local
 * key. A path received from another device can legitimately consume local id
 * 11 while still be named "Path #10". Derive a new label from labels already
 * shown to the user so the next created path is "Path #11", not "Path #12".
 * Renamed paths intentionally do not affect this sequence.
 */
export const getNextDefaultPathNumber = (paths: PathData[]): number => {
  const highest = paths.reduce((current, path) => {
    const match = /^Path #(\d+)$/.exec(path.pathName.trim());
    const number = match ? Number(match[1]) : 0;
    return Number.isSafeInteger(number) ? Math.max(current, number) : current;
  }, 0);
  return highest + 1;
};

/**
 * A path legitimately created by an older build may have no `pathDateDetails`
 * record. The old code threw in that case, making the path permanently
 * unsaveable. Synthesize a safe empty record instead.
 */
const ensureDateRecord = (state: PathsState, pathid: number): DateData => {
  const existing = state.dates.find((date) => date.pathid === pathid);
  if (existing) {
    return existing;
  }
  const created: DateData = { pathid, dates: [], scrollPosition: 0 };
  state.dates.push(created);
  return created;
};

export const pathsSlice = createSlice({
  name: 'paths',
  initialState,
  reducers: {
    /** Boot hydration. Input is assumed already validated by the persistence layer. */
    setAll: (state, action: PayloadAction<{ paths: PathData[]; dates: DateData[] }>) => {
      state.paths = action.payload.paths;
      state.dates = action.payload.dates;
      state.hydrated = true;
    },

    addPath: (state, action: PayloadAction<{ path: PathData; date: DateData }>) => {
      state.paths.push(action.payload.path);
      state.dates.push(action.payload.date);
    },

    updatePath: (state, action: PayloadAction<UpdatePathPayload>) => {
      const { pathId, angNumber, verseId, progress, completionDate, todayDate, scrollPosition } =
        action.payload;

      const path = state.paths.find((candidate) => candidate.pathId === pathId);
      if (!path) {
        return;
      }

      path.saveData = { angNumber, verseId };
      path.progress = progress;
      path.completionDate = completionDate;

      const dateRecord = ensureDateRecord(state, pathId);
      // Dedup today's entry, mirroring the old handleUpdatePath behaviour.
      dateRecord.dates = [
        ...dateRecord.dates.filter((entry) => entry.date !== todayDate),
        { date: todayDate },
      ];
      if (scrollPosition !== undefined) {
        dateRecord.scrollPosition = scrollPosition;
      }
    },

    renamePath: (
      state,
      action: PayloadAction<{ pathId: number; name: string; silentSync?: boolean }>
    ) => {
      // Update the exact match in place. The old implementation used a
      // filter/push pattern that reordered records (and matched with `!==`).
      const path = state.paths.find((candidate) => candidate.pathId === action.payload.pathId);
      if (path) {
        path.pathName = action.payload.name;
      }
    },

    clearPathCompletion: (
      state,
      action: PayloadAction<{ pathId: number; angNumber?: number; scrollPosition?: number }>
    ) => {
      const { pathId, angNumber, scrollPosition } = action.payload;
      const path = state.paths.find((candidate) => candidate.pathId === pathId);
      if (!path) {
        return;
      }

      // Undo completion and clear verse selection, keeping current ang context.
      path.completionDate = '';
      path.saveData = {
        angNumber: angNumber ?? path.saveData.angNumber,
        verseId: 0,
      };

      if (scrollPosition !== undefined) {
        ensureDateRecord(state, pathId).scrollPosition = scrollPosition;
      }
    },

    setScrollPosition: (
      state,
      action: PayloadAction<{ pathId: number; scrollPosition: number }>
    ) => {
      const pathExists = state.paths.some((path) => path.pathId === action.payload.pathId);
      if (!pathExists) {
        return;
      }
      ensureDateRecord(state, action.payload.pathId).scrollPosition = action.payload.scrollPosition;
    },
    /**
     * Physically removes a path row and its date record. Used only once a delete
     * is durable — a never-synced hard delete, or after the server acks a
     * tombstone (the outbox coordinator). The sync slice's `dropMeta` clears the
     * matching metadata separately.
     */
    /**
     * Payload is an OBJECT, like every other path action, so the rollback
     * reducer can find the pathId in it. As a bare number it was invisible to
     * `getActionPathId`, which meant a failed durable write left the removal
     * applied while the command reported failure — the path vanished and the
     * user was told it had not.
     */
    removePathLocal: (state, action: PayloadAction<{ pathId: number }>) => {
      const { pathId } = action.payload;
      state.paths = state.paths.filter((path) => path.pathId !== pathId);
      state.dates = state.dates.filter((date) => date.pathid !== pathId);
    },
    /**
     * Folds a server response into an existing row (Step 8). Deliberately NOT
     * observed by the stamping middleware, so applying server truth never creates
     * a sync op. Never touches `scrollPosition` — that stays device-local.
     */
    applyServerPathData: (
      state,
      action: PayloadAction<{
        pathId: number;
        pathPatch: Partial<PathData>;
        datePatch: Partial<DateData>;
      }>
    ) => {
      const { pathId, pathPatch, datePatch } = action.payload;
      const path = state.paths.find((entry) => entry.pathId === pathId);
      if (path) {
        Object.assign(path, pathPatch);
      }
      if (datePatch.dates) {
        const date = state.dates.find((entry) => entry.pathid === pathId);
        if (date) {
          date.dates = datePatch.dates;
        }
      }
      if (datePatch.scrollPosition !== undefined) {
        ensureDateRecord(state, pathId).scrollPosition = datePatch.scrollPosition;
      }
    },
    /**
     * Adds a row for a path created on another device (Step 8 allocation). Same
     * body as `addPath`, but a distinct action so the stamping middleware does
     * NOT mint a UUID / create op — this path is already on the server.
     */
    addServerPath: (state, action: PayloadAction<{ path: PathData; date: DateData }>) => {
      state.paths.push(action.payload.path);
      state.dates.push(action.payload.date);
    },
  },
});

export const {
  setAll,
  addPath,
  updatePath,
  renamePath,
  clearPathCompletion,
  setScrollPosition,
  removePathLocal,
  applyServerPathData,
  addServerPath,
} = pathsSlice.actions;
