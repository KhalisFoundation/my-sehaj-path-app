import type { PathData } from '../types';
import type { SyncMeta } from './slices/syncSlice';

/**
 * Home-only display order. Once a path is on the server, its server creation
 * time gives every device the same stable order. Local-only paths remain after
 * those paths and retain their current local order until they are uploaded.
 */
export const sortPathsForHome = (paths: PathData[], meta: Record<number, SyncMeta>): PathData[] =>
  [...paths].sort((left, right) => {
    const leftCreatedAt = meta[left.pathId]?.onServer
      ? meta[left.pathId].serverCreatedAt
      : undefined;
    const rightCreatedAt = meta[right.pathId]?.onServer
      ? meta[right.pathId].serverCreatedAt
      : undefined;

    if (leftCreatedAt != null && rightCreatedAt != null) {
      return leftCreatedAt - rightCreatedAt || left.pathId - right.pathId;
    }
    if (leftCreatedAt != null) {
      return -1;
    }
    if (rightCreatedAt != null) {
      return 1;
    }
    return 0;
  });
