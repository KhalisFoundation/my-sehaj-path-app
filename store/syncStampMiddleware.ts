import { isAction, type Dispatch, type Middleware, type MiddlewareAPI } from '@reduxjs/toolkit';
import { generateUuid } from '@utils/pathIdUtils';
import type { RootState } from './index';
import {
  addPath,
  clearPathCompletion,
  renamePath,
  setScrollPosition,
  updatePath,
} from './slices/pathsSlice';
import { hydrateSettings, settingsSlice } from './slices/settingsSlice';
import { markPathEdited, markScrollDirty, markSettingsDirty, upsertMeta } from './slices/syncSlice';
import { legacyToMs } from './syncDateUtils';
import { clearSilentPathOp, markSilentPathOp } from './syncWork';

/**
 * Turns local path/settings mutations into sync bookkeeping in ONE place, so the
 * ~30 existing dispatch sites need no sync awareness. It only STAMPS intent —
 * no network I/O; the Step 7 coordinator schedules the actual flush.
 *
 * Runs AFTER each action reduces, then dispatches the matching `sync` action.
 * The follow-up dispatches are plain `sync/*` actions, so they never re-trigger
 * this middleware (no loop). Boot hydration (`setAll`, `hydrateSettings`) and
 * rollback (`app/restoreDurableState`) are deliberately not observed.
 */
type Api = MiddlewareAPI<Dispatch, RootState>;

/**
 * Back-fills a full SyncMeta for a legacy path that predates sync bookkeeping,
 * so an edit made before the user chooses "Sync now" is still durable and ready
 * to upload later. Falls back to `now` when the legacy start date is unparseable.
 */
const ensureMeta = (api: Api, pathId: number, now: number): void => {
  const state = api.getState();
  if (state.sync.meta[pathId]) {
    return;
  }
  const path = state.paths.paths.find((entry) => entry.pathId === pathId);
  // `?? now` (not `|| now`): a valid start date can be epoch 0, which `||` would
  // wrongly replace with the current time.
  const startDate = (path ? legacyToMs(path.startDate) : null) ?? now;
  api.dispatch(
    upsertMeta({
      pathId,
      meta: { serverPathId: generateUuid(), startDate, onServer: false, serverUpdatedAt: 0 },
    })
  );
};

const SETTINGS_PREFIX = `${settingsSlice.name}/`;

export const syncStampMiddleware: Middleware<object, RootState> =
  (api: Api) => (next) => (action) => {
    const result = next(action); // reduce first, then observe the settled state
    if (!isAction(action)) {
      return result;
    }
    const now = Date.now();

    if (addPath.match(action)) {
      const { pathId, startDate } = action.payload.path;
      // `?? now` (not `|| now`) so a legitimate epoch-0 start date is preserved.
      const startMs = legacyToMs(startDate) ?? now;
      api.dispatch(
        upsertMeta({
          pathId,
          meta: {
            serverPathId: generateUuid(),
            startDate: startMs,
            onServer: false,
            serverUpdatedAt: 0,
          },
        })
      );
      api.dispatch(markPathEdited({ pathId, at: now }));
    } else if (
      updatePath.match(action) ||
      renamePath.match(action) ||
      clearPathCompletion.match(action)
    ) {
      const { pathId } = action.payload;
      // These reducers no-op when the pathId is unknown. Guard against stamping a
      // "ghost" path — minting meta + a create op for a path that isn't in Redux
      // would later upload a path that doesn't exist locally.
      if (api.getState().paths.paths.some((entry) => entry.pathId === pathId)) {
        // A shared path is server-owned and is deliberately left out of the
        // `/sync` body. Marking it dirty here would queue an op that nothing
        // ever sends, so the path would sit "pending" forever and hold the
        // sync indicator on. Its writes go straight to the group endpoint.
        if (api.getState().sync.meta[pathId]?.shared) {
          return result;
        }
        ensureMeta(api, pathId, now);
        api.dispatch(markPathEdited({ pathId, at: now }));
        const op = api.getState().sync.pathOps[pathId];
        if (
          (updatePath.match(action) || renamePath.match(action)) &&
          action.payload.silentSync === true &&
          op
        ) {
          markSilentPathOp(pathId, op.localUpdatedAt);
        } else {
          // An explicit save supersedes any earlier auto-scroll checkpoint.
          clearSilentPathOp(pathId);
        }
      }
    } else if (setScrollPosition.match(action)) {
      // A shared path is server-owned and is deliberately absent from the
      // `/sync` body, so a dirty flag on one can never be cleared by sending it.
      // The result was a device that reported "syncing your progress" for ever
      // and re-issued a `PATCH` the server answers with 404 — a shared path is
      // addressed by the group id, not the one this device syncs under.
      //
      // Its position travels over the socket instead, and is written by the
      // reader's own session.
      if (api.getState().sync.meta[action.payload.pathId]?.shared) {
        return result;
      }
      // Scroll never drives a call: record the dirty flag and nothing else.
      api.dispatch(markScrollDirty({ pathId: action.payload.pathId, at: now }));
    } else if (action.type.startsWith(SETTINGS_PREFIX) && !hydrateSettings.match(action)) {
      api.dispatch(markSettingsDirty({ at: now }));
    }

    return result;
  };
