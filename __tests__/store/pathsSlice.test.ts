import {
  getNextPathId,
  pathsSlice,
  addPath,
  clearPathCompletion,
  renamePath,
  setAll,
  setScrollPosition,
  updatePath,
  type PathsState,
} from '../../store/slices/pathsSlice';
import { networkSlice, setOnline } from '../../store/slices/networkSlice';
import type { DateData, PathData } from '../../types';

const { reducer } = pathsSlice;
const initial = (): PathsState => reducer(undefined, { type: '@@INIT' });

const makePath = (over: Partial<PathData> = {}): PathData => ({
  pathId: 1,
  saveData: { angNumber: 0, verseId: 0 },
  progress: 1,
  startDate: '1-January-2026',
  completionDate: '',
  pathName: 'Path #1',
  ...over,
});

const makeDate = (over: Partial<DateData> = {}): DateData => ({
  pathid: 1,
  dates: [],
  scrollPosition: 0,
  ...over,
});

/** A store already hydrated with the given paths/dates. */
const hydrated = (paths: PathData[], dates: DateData[]): PathsState =>
  reducer(initial(), setAll({ paths, dates }));

describe('pathsSlice initial state', () => {
  it('starts empty and NOT hydrated', () => {
    // Landmine #2: the write coordinator keys off this flag. If it ever
    // started true, a blank store could overwrite real data on disk.
    expect(initial()).toEqual({ paths: [], dates: [], hydrated: false });
  });
});

describe('pathsSlice setAll', () => {
  it('replaces both arrays and marks hydrated', () => {
    const paths = [makePath()];
    const dates = [makeDate()];
    const after = reducer(initial(), setAll({ paths, dates }));

    expect(after.paths).toEqual(paths);
    expect(after.dates).toEqual(dates);
    expect(after.hydrated).toBe(true);
  });

  it('hydrating empty legacy data is still valid and marks hydrated', () => {
    const after = reducer(initial(), setAll({ paths: [], dates: [] }));
    expect(after.hydrated).toBe(true);
  });
});

describe('getNextPathId', () => {
  it('returns 1 for empty data', () => {
    expect(getNextPathId([])).toBe(1);
  });

  it('is max+1, not length+1, for non-contiguous ids', () => {
    // length+1 would return 3 here and collide with the existing id 3.
    const paths = [makePath({ pathId: 1 }), makePath({ pathId: 3 })];
    expect(getNextPathId(paths)).toBe(4);
  });

  it('is stable when the array is reordered', () => {
    const paths = [makePath({ pathId: 5 }), makePath({ pathId: 2 })];
    const reordered = [...paths].reverse();
    expect(getNextPathId(paths)).toBe(6);
    expect(getNextPathId(reordered)).toBe(6);
  });

  it('never collides with an existing id', () => {
    const paths = [makePath({ pathId: 2 }), makePath({ pathId: 7 }), makePath({ pathId: 4 })];
    const next = getNextPathId(paths);
    expect(paths.some((path) => path.pathId === next)).toBe(false);
  });
});

describe('pathsSlice addPath', () => {
  it('appends the path and its date record', () => {
    const start = hydrated([makePath({ pathId: 1 })], [makeDate({ pathid: 1 })]);
    const after = reducer(
      start,
      addPath({ path: makePath({ pathId: 2, pathName: 'Path #2' }), date: makeDate({ pathid: 2 }) })
    );

    expect(after.paths).toHaveLength(2);
    expect(after.dates).toHaveLength(2);
    expect(after.paths[1].pathId).toBe(2);
    expect(after.dates[1].pathid).toBe(2);
  });
});

describe('pathsSlice updatePath', () => {
  const start = () =>
    hydrated(
      [makePath({ pathId: 1 })],
      [makeDate({ pathid: 1, dates: [{ date: '1-January-2026' }] })]
    );

  it('updates saveData, progress and scrollPosition', () => {
    const after = reducer(
      start(),
      updatePath({
        pathId: 1,
        angNumber: 50,
        verseId: 900,
        progress: 3.57,
        completionDate: '',
        todayDate: '2-January-2026',
        scrollPosition: 420,
      })
    );

    expect(after.paths[0].saveData).toEqual({ angNumber: 50, verseId: 900 });
    expect(after.paths[0].progress).toBe(3.57);
    expect(after.dates[0].scrollPosition).toBe(420);
  });

  it('sets completionDate when the caller says the path is complete', () => {
    const after = reducer(
      start(),
      updatePath({
        pathId: 1,
        angNumber: 1430,
        verseId: 60403,
        progress: 100,
        completionDate: '2-January-2026',
        todayDate: '2-January-2026',
      })
    );
    expect(after.paths[0].completionDate).toBe('2-January-2026');
  });

  it('clears completionDate when the caller says it is not complete', () => {
    const completed = hydrated(
      [makePath({ pathId: 1, completionDate: '1-January-2026' })],
      [makeDate({ pathid: 1 })]
    );
    const after = reducer(
      completed,
      updatePath({
        pathId: 1,
        angNumber: 100,
        verseId: 5,
        progress: 7,
        completionDate: '',
        todayDate: '2-January-2026',
      })
    );
    expect(after.paths[0].completionDate).toBe('');
  });

  it('dedups today, so saving twice in one day keeps a single entry', () => {
    let state = start();
    const payload = {
      pathId: 1,
      angNumber: 10,
      verseId: 1,
      progress: 1,
      completionDate: '',
      todayDate: '2-January-2026',
    };
    state = reducer(state, updatePath(payload));
    state = reducer(state, updatePath({ ...payload, angNumber: 20 }));

    const todays = state.dates[0].dates.filter((entry) => entry.date === '2-January-2026');
    expect(todays).toHaveLength(1);
    // the pre-existing day is preserved
    expect(state.dates[0].dates).toEqual([{ date: '1-January-2026' }, { date: '2-January-2026' }]);
  });

  it('normalizes a historical path that has no date record, and can then save', () => {
    // Old builds could leave a path with no pathDateDetails entry. The previous
    // implementation threw here, making the path permanently unsaveable.
    const noDateRecord = hydrated([makePath({ pathId: 1 })], []);

    const after = reducer(
      noDateRecord,
      updatePath({
        pathId: 1,
        angNumber: 12,
        verseId: 3,
        progress: 0.84,
        completionDate: '',
        todayDate: '2-January-2026',
        scrollPosition: 100,
      })
    );

    expect(after.dates).toHaveLength(1);
    expect(after.dates[0]).toEqual({
      pathid: 1,
      dates: [{ date: '2-January-2026' }],
      scrollPosition: 100,
    });
    expect(after.paths[0].saveData).toEqual({ angNumber: 12, verseId: 3 });
  });

  it('is a no-op for an unknown pathId', () => {
    const before = start();
    const after = reducer(
      before,
      updatePath({
        pathId: 999,
        angNumber: 1,
        verseId: 1,
        progress: 1,
        completionDate: '',
        todayDate: '2-January-2026',
      })
    );
    expect(after).toEqual(before);
  });

  it('does not touch unrelated paths', () => {
    const many = hydrated(
      [makePath({ pathId: 1 }), makePath({ pathId: 2, pathName: 'Path #2' })],
      [makeDate({ pathid: 1 }), makeDate({ pathid: 2 })]
    );
    const after = reducer(
      many,
      updatePath({
        pathId: 1,
        angNumber: 5,
        verseId: 5,
        progress: 1,
        completionDate: '',
        todayDate: '2-January-2026',
      })
    );
    expect(after.paths[1]).toEqual(many.paths[1]);
    expect(after.dates[1]).toEqual(many.dates[1]);
  });
});

describe('pathsSlice renamePath', () => {
  /**
   * Landmine #5: the old useLocal.renamePath matched with `!==` and used a
   * filter/push pattern. For a single-path account it silently did nothing,
   * and for multi-path accounts it reordered records.
   */
  it('renames the only path (the old !== bug no-oped here)', () => {
    const start = hydrated([makePath({ pathId: 1, pathName: 'Path #1' })], [makeDate()]);
    const after = reducer(start, renamePath({ pathId: 1, name: 'Morning Path' }));
    expect(after.paths[0].pathName).toBe('Morning Path');
  });

  it('renames only the target path and preserves array order', () => {
    const start = hydrated(
      [
        makePath({ pathId: 1, pathName: 'Path #1' }),
        makePath({ pathId: 2, pathName: 'Path #2' }),
        makePath({ pathId: 3, pathName: 'Path #3' }),
      ],
      []
    );
    const after = reducer(start, renamePath({ pathId: 2, name: 'Renamed' }));

    expect(after.paths.map((path) => path.pathName)).toEqual(['Path #1', 'Renamed', 'Path #3']);
    // order preserved — no filter/push reordering
    expect(after.paths.map((path) => path.pathId)).toEqual([1, 2, 3]);
  });

  it('is a no-op for an unknown pathId', () => {
    const start = hydrated([makePath({ pathId: 1 })], []);
    expect(reducer(start, renamePath({ pathId: 99, name: 'X' }))).toEqual(start);
  });
});

describe('pathsSlice clearPathCompletion', () => {
  const completed = () =>
    hydrated(
      [
        makePath({
          pathId: 1,
          completionDate: '1-January-2026',
          saveData: { angNumber: 1430, verseId: 60403 },
        }),
      ],
      [makeDate({ pathid: 1, scrollPosition: 10 })]
    );

  it('clears completionDate and verseId, keeping the current ang by default', () => {
    const after = reducer(completed(), clearPathCompletion({ pathId: 1 }));
    expect(after.paths[0].completionDate).toBe('');
    expect(after.paths[0].saveData).toEqual({ angNumber: 1430, verseId: 0 });
  });

  it('overrides angNumber when provided', () => {
    const after = reducer(completed(), clearPathCompletion({ pathId: 1, angNumber: 1200 }));
    expect(after.paths[0].saveData).toEqual({ angNumber: 1200, verseId: 0 });
  });

  it('sets scrollPosition when provided', () => {
    const after = reducer(completed(), clearPathCompletion({ pathId: 1, scrollPosition: 55 }));
    expect(after.dates[0].scrollPosition).toBe(55);
  });

  it('leaves scrollPosition untouched when omitted', () => {
    const after = reducer(completed(), clearPathCompletion({ pathId: 1 }));
    expect(after.dates[0].scrollPosition).toBe(10);
  });

  it('is a no-op for an unknown pathId', () => {
    const before = completed();
    expect(reducer(before, clearPathCompletion({ pathId: 99 }))).toEqual(before);
  });
});

describe('pathsSlice setScrollPosition', () => {
  it('updates the scroll position', () => {
    const start = hydrated([makePath()], [makeDate({ pathid: 1, scrollPosition: 0 })]);
    const after = reducer(start, setScrollPosition({ pathId: 1, scrollPosition: 999 }));
    expect(after.dates[0].scrollPosition).toBe(999);
  });

  it('creates a date record for a historical path that lacks one', () => {
    const start = hydrated([makePath({ pathId: 1 })], []);
    const after = reducer(start, setScrollPosition({ pathId: 1, scrollPosition: 42 }));
    expect(after.dates).toEqual([{ pathid: 1, dates: [], scrollPosition: 42 }]);
  });
});

describe('networkSlice', () => {
  it('defaults to online', () => {
    expect(networkSlice.reducer(undefined, { type: '@@INIT' })).toEqual({ isOnline: true });
  });

  it('setOnline flips the flag', () => {
    const offline = networkSlice.reducer(undefined, setOnline(false));
    expect(offline.isOnline).toBe(false);
    expect(networkSlice.reducer(offline, setOnline(true)).isOnline).toBe(true);
  });
});
