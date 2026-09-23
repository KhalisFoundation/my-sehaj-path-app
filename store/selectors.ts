import type { RootState } from './index';
import type { PathData } from '../types';

/**
 * The paths a screen should show.
 *
 * A deleted path stays in `paths` until the server confirms the deletion —
 * the outbox builds its request from that row, so removing it early would make
 * the coordinator treat the queued delete as stale and cancel it. Offline, that
 * wait has no end, so the row has to be hidden here rather than waited out.
 *
 * Read paths through this. Reading `state.paths.paths` directly puts a path the
 * user has already deleted back on their screen.
 */
export const selectVisiblePaths = (state: RootState): PathData[] =>
  state.paths.paths.filter((path) => state.sync.meta[path.pathId]?.deletedAt == null);

/** Whether a single path is still visible — false once it has been deleted. */
export const selectPathIsVisible = (state: RootState, pathId: number): boolean =>
  state.paths.paths.some((path) => path.pathId === pathId) &&
  state.sync.meta[pathId]?.deletedAt == null;
