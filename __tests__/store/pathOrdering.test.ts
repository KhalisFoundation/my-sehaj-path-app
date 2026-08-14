import { sortPathsForHome } from '../../store/pathOrdering';
import type { PathData } from '../../types';
import type { SyncMeta } from '../../store/slices/syncSlice';

const path = (pathId: number): PathData => ({
  pathId,
  pathName: `Path ${pathId}`,
  progress: 1,
  saveData: { angNumber: 0, verseId: 0 },
  startDate: '1-January-2026',
  completionDate: '',
});

const meta = (serverCreatedAt?: number): SyncMeta => ({
  serverPathId: '11111111-2222-4333-8444-555555555555',
  serverUpdatedAt: 1,
  serverCreatedAt,
  localUpdatedAt: 1,
  startDate: 1,
  deletedAt: null,
  onServer: serverCreatedAt != null,
});

describe('sortPathsForHome', () => {
  it('uses server creation order and puts local-only paths after synced paths', () => {
    const ordered = sortPathsForHome([path(3), path(1), path(2)], {
      1: meta(100),
      2: meta(200),
      3: meta(),
    });

    expect(ordered.map((entry) => entry.pathId)).toEqual([1, 2, 3]);
  });

  it('keeps local-only paths in their current order until they are uploaded', () => {
    const ordered = sortPathsForHome([path(3), path(2)], { 2: meta(), 3: meta() });
    expect(ordered.map((entry) => entry.pathId)).toEqual([3, 2]);
  });
});
