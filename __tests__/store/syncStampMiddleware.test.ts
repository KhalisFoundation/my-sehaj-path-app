import { makeStore } from '../../store';
import {
  addPath,
  clearPathCompletion,
  renamePath,
  setAll,
  setScrollPosition,
  updatePath,
} from '../../store/slices/pathsSlice';
import { setFontSize, setLarivaar } from '../../store/slices/settingsSlice';
import { ackServerPath } from '../../store/slices/syncSlice';
import { isSilentPathOp } from '../../store/syncWork';
import type { DateData, PathData } from '../../types';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const makePath = (pathId: number, startDate = '1-January-2026'): PathData => ({
  pathId,
  saveData: { angNumber: 0, verseId: 0 },
  progress: 1,
  startDate,
  completionDate: '',
  pathName: `Path #${pathId}`,
});
const makeDate = (pathid: number): DateData => ({ pathid, dates: [], scrollPosition: 0 });

const updateFor = (pathId: number) =>
  updatePath({
    pathId,
    angNumber: 120,
    verseId: 4501,
    progress: 8,
    completionDate: '',
    todayDate: '2-January-2026',
    scrollPosition: 10,
  });

describe('syncStampMiddleware', () => {
  it('addPath mints a v4 UUID, marks not-on-server, and pends a create', () => {
    const store = makeStore();
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));

    const { meta, pathOps } = store.getState().sync;
    expect(meta[1].serverPathId).toMatch(UUID_V4_RE);
    expect(meta[1].onServer).toBe(false);
    expect(meta[1].startDate).toBe(Date.UTC(2026, 0, 1));
    expect(pathOps[1].kind).toBe('create');
  });

  it('updatePath/renamePath/clearPathCompletion on an acknowledged path pend an update', () => {
    for (const action of [
      updateFor(1),
      renamePath({ pathId: 1, name: 'New' }),
      clearPathCompletion({ pathId: 1 }),
    ]) {
      const store = makeStore();
      store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
      // Simulate a successful create so the path is now on the server.
      const sent = store.getState().sync.pathOps[1].localUpdatedAt;
      store.dispatch(ackServerPath({ pathId: 1, sentLocalUpdatedAt: sent, serverUpdatedAt: 100 }));

      store.dispatch(action);
      expect(store.getState().sync.pathOps[1].kind).toBe('update');
    }
  });

  it('editing a pre-sync legacy path (no meta) back-fills meta and pends a create', () => {
    const store = makeStore();
    // Legacy hydration path: setAll seeds a path with NO sync meta.
    store.dispatch(setAll({ paths: [makePath(9)], dates: [makeDate(9)] }));
    expect(store.getState().sync.meta[9]).toBeUndefined();

    store.dispatch(renamePath({ pathId: 9, name: 'Renamed' }));

    const { meta, pathOps } = store.getState().sync;
    expect(meta[9].serverPathId).toMatch(UUID_V4_RE);
    expect(meta[9].onServer).toBe(false);
    expect(pathOps[9].kind).toBe('create'); // never dropped
  });

  it('two edits in the same millisecond advance localUpdatedAt monotonically', () => {
    const store = makeStore();
    jest.spyOn(Date, 'now').mockReturnValue(500);
    try {
      store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
      const first = store.getState().sync.pathOps[1].localUpdatedAt;
      store.dispatch(updateFor(1));
      expect(store.getState().sync.pathOps[1].localUpdatedAt).toBeGreaterThan(first);
    } finally {
      (Date.now as jest.Mock).mockRestore();
    }
  });

  it('setScrollPosition sets scrollDirty only — no op, no settings change', () => {
    const store = makeStore();
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
    // Clear the create op so we can see scroll does not create one.
    const sent = store.getState().sync.pathOps[1].localUpdatedAt;
    store.dispatch(ackServerPath({ pathId: 1, sentLocalUpdatedAt: sent, serverUpdatedAt: 100 }));

    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 640 }));

    const { pathOps, scrollDirty } = store.getState().sync;
    expect(scrollDirty[1]).toBeGreaterThan(0);
    expect(pathOps[1]).toBeUndefined();
  });

  it('marks a debounced auto-scroll update as notification-silent', () => {
    const store = makeStore();
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
    const created = store.getState().sync.pathOps[1].localUpdatedAt;
    store.dispatch(ackServerPath({ pathId: 1, sentLocalUpdatedAt: created, serverUpdatedAt: 100 }));

    store.dispatch(
      updatePath({
        ...updateFor(1).payload,
        silentSync: true,
      })
    );

    const op = store.getState().sync.pathOps[1];
    expect(isSilentPathOp(1, op.localUpdatedAt)).toBe(true);
  });

  it('a settings setter marks settings dirty without creating a path op', () => {
    const store = makeStore();
    store.dispatch(setLarivaar(true));
    let { sync } = store.getState();
    expect(sync.settingsUpdatedAt).toBeGreaterThan(0);
    expect(sync.pendingSettingsUpdatedAt).toBe(sync.settingsUpdatedAt);
    expect(Object.keys(sync.pathOps)).toHaveLength(0);

    store.dispatch(setFontSize({ fontSize: 'Large', number: 30 }));
    ({ sync } = store.getState());
    expect(sync.pendingSettingsUpdatedAt).toBe(sync.settingsUpdatedAt);
  });

  it('does not stamp a ghost path when the target does not exist', () => {
    const store = makeStore();
    // The reducer no-ops for an unknown pathId; the middleware must not mint meta.
    store.dispatch(renamePath({ pathId: 999, name: 'Ghost' }));

    const { meta, pathOps } = store.getState().sync;
    expect(meta[999]).toBeUndefined();
    expect(pathOps[999]).toBeUndefined();
  });

  it('preserves an epoch-0 start date instead of falling back to now', () => {
    const store = makeStore();
    store.dispatch(addPath({ path: makePath(1, '1-January-1970'), date: makeDate(1) }));
    expect(store.getState().sync.meta[1].startDate).toBe(0);
  });
});
