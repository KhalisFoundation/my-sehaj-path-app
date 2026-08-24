import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * commands.ts imports the singleton store + persistence coordinator, so we test
 * the real wiring end-to-end against the in-memory AsyncStorage mock.
 */
jest.mock('../../utils/crashlytics', () => ({
  recordError: jest.fn(),
  logBreadcrumb: jest.fn(),
  allowCrashReporting: jest.fn(),
  testCrash: jest.fn(),
}));
jest.mock('../../utils/analytics', () => ({
  trackEvent: jest.fn(),
  trackScreenView: jest.fn(),
  allowTracking: jest.fn(),
}));

import { rollbackDurableMutation, store, makeStore } from '../../store';
import { hydrateStore } from '../../store/persistence';
import { persistence } from '../../store/instance';
import {
  commitSettingChange,
  createPath,
  renamePathCommand,
  savePathScrollPosition,
  savePathProgress,
  undoPathCompletion,
} from '../../store/commands';
import { addServerPath, renamePath, setAll } from '../../store/slices/pathsSlice';
import { setLarivaar } from '../../store/slices/settingsSlice';
import type { DateData, PathData } from '../../types';

const pathWithId = (pathId: number): PathData => ({
  pathId,
  pathName: `Path #${pathId}`,
  progress: 1,
  saveData: { angNumber: 0, verseId: 0 },
  startDate: '1-January-2026',
  completionDate: '',
});

const dateWithId = (pathid: number): DateData => ({ pathid, dates: [], scrollPosition: 0 });

const MOCKED_METHODS = [
  'getItem',
  'setItem',
  'removeItem',
  'multiGet',
  'multiSet',
  'clear',
] as const;
const ORIGINAL_IMPLS = new Map<string, unknown>(
  MOCKED_METHODS.map((name) => [name, (AsyncStorage as any)[name].getMockImplementation?.()])
);
const restoreStorageImpls = () => {
  for (const name of MOCKED_METHODS) {
    const impl = ORIGINAL_IMPLS.get(name);
    if (impl) {
      (AsyncStorage as any)[name].mockImplementation(impl);
    }
  }
};

beforeEach(async () => {
  restoreStorageImpls();
  await AsyncStorage.clear();
  jest.clearAllMocks();
  restoreStorageImpls();
  // Start each test from a clean, hydrated store with the coordinator running.
  store.dispatch(setAll({ paths: [], dates: [] }));
  await hydrateStore(store);
  persistence.start();
});

afterEach(() => {
  persistence.stop();
});

describe('createPath', () => {
  it('creates and persists a path, returning its id', async () => {
    const id = await createPath();
    expect(id).not.toBeNull();

    const { paths } = store.getState().paths;
    expect(paths).toHaveLength(1);
    expect(paths[0].pathId).toBe(id);

    const onDisk = JSON.parse((await AsyncStorage.getItem('pathDetails'))!);
    expect(onDisk).toHaveLength(1);
  });

  it('uses the next visible default name even when local ids have a gap from another device', async () => {
    store.dispatch(
      setAll({
        paths: [
          { ...pathWithId(10), pathName: 'Path #10' },
          { ...pathWithId(11), pathName: 'Path #10' },
        ],
        dates: [dateWithId(10), dateWithId(11)],
      })
    );

    const id = await createPath();

    expect(id).toBe(12);
    expect(store.getState().paths.paths.find((path) => path.pathId === id)?.pathName).toBe(
      'Path #11'
    );
  });

  it('rolls the phantom path out of the store when the write fails', async () => {
    (AsyncStorage.multiSet as jest.Mock).mockRejectedValue(new Error('disk full'));

    const id = await createPath();
    expect(id).toBeNull();

    // No phantom path lingers in Redux (Home renders straight from this).
    expect(store.getState().paths.paths).toHaveLength(0);

    restoreStorageImpls();
    expect(await AsyncStorage.getItem('pathDetails')).toBeNull();
  });

  it('two concurrent creates get distinct ids (no duplicates)', async () => {
    // Fired without awaiting the first. If the id were read outside the lock,
    // both would compute id 1 and hydration would later reject the duplicate.
    const [a, b] = await Promise.all([createPath(), createPath()]);

    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a).not.toBe(b);

    const ids = store.getState().paths.paths.map((p) => p.pathId);
    expect(new Set(ids).size).toBe(ids.length); // all unique
    expect(ids).toEqual([1, 2]);
  });

  it('does not leak ids across a failed then successful create', async () => {
    (AsyncStorage.multiSet as jest.Mock).mockRejectedValueOnce(new Error('one-off'));
    // First attempt: multiSet rejects 3x (capped retry) -> null
    (AsyncStorage.multiSet as jest.Mock).mockRejectedValue(new Error('disk full'));
    const failed = await createPath();
    expect(failed).toBeNull();
    expect(store.getState().paths.paths).toHaveLength(0);

    restoreStorageImpls();
    const ok = await createPath();
    expect(ok).toBe(1); // next id starts fresh, no leaked id from the failure
    expect(store.getState().paths.paths).toHaveLength(1);
  });

  it('reserves ids belonging to orphan dates and quarantined records', async () => {
    persistence.stop();
    await AsyncStorage.clear();

    const validPath = {
      pathId: 2,
      progress: 1,
      saveData: { angNumber: 0, verseId: 0 },
      startDate: '1-January-2026',
      completionDate: '',
      pathName: 'Path #2',
    };
    const quarantinedPath = {
      pathId: 7,
      progress: null,
      saveData: { verseId: 100 },
    };
    await AsyncStorage.multiSet([
      ['pathDetails', JSON.stringify([validPath, quarantinedPath])],
      [
        'pathDateDetails',
        JSON.stringify([
          { pathid: 2, dates: [], scrollPosition: 0 },
          { pathid: 5, dates: [], scrollPosition: 0 },
          { pathid: 7, dates: [], scrollPosition: 10 },
        ]),
      ],
    ]);

    expect(await hydrateStore(store)).toBe(true);
    persistence.start();

    // 5 belongs to a preserved orphan date and 7 to quarantined path data.
    expect(await createPath()).toBe(8);

    const diskPaths = JSON.parse((await AsyncStorage.getItem('pathDetails'))!);
    expect(diskPaths.map((path: { pathId: number }) => path.pathId)).toEqual([2, 8, 7]);
  });
});

describe('atomic rollback', () => {
  it('preserves an unrelated server update that arrives before a failed command rolls back', () => {
    const isolated = makeStore();
    const firstPath = {
      pathId: 1,
      pathName: 'Local path',
      saveData: { angNumber: 1, verseId: 0 },
      progress: 0,
      startDate: '1-January-2026',
      completionDate: '',
    };
    isolated.dispatch(
      setAll({ paths: [firstPath], dates: [{ pathid: 1, dates: [], scrollPosition: 0 }] })
    );
    const before = isolated.getState();
    const failedAction = renamePath({ pathId: 1, name: 'Failed local rename' });
    isolated.dispatch(failedAction);

    // Mirrors a server response landing while persistence.flush() is waiting.
    isolated.dispatch(
      addServerPath({
        path: { ...firstPath, pathId: 2, pathName: 'Server path' },
        date: { pathid: 2, dates: [], scrollPosition: 10 },
      })
    );
    isolated.dispatch(rollbackDurableMutation({ action: failedAction, previous: before }));

    expect(isolated.getState().paths.paths.find((path) => path.pathId === 1)?.pathName).toBe(
      'Local path'
    );
    expect(isolated.getState().paths.paths.find((path) => path.pathId === 2)?.pathName).toBe(
      'Server path'
    );
  });

  it('never starts a successful rollback write with the failed setting value', async () => {
    const realMultiSet = ORIGINAL_IMPLS.get('multiSet') as (
      entries: Array<[string, string]>
    ) => Promise<void>;
    const successfulLarivaarWrites: string[] = [];
    let attempts = 0;

    (AsyncStorage.multiSet as jest.Mock).mockImplementation(
      async (entries: Array<[string, string]>) => {
        attempts += 1;
        if (attempts <= 2) {
          throw new Error('transient write failure');
        }
        const larivaar = entries.find(([key]) => key === 'larivaar')?.[1];
        if (larivaar !== undefined) {
          successfulLarivaarWrites.push(larivaar);
        }
        await realMultiSet(entries);
      }
    );

    expect(await commitSettingChange(setLarivaar(true))).toBe(false);
    expect(await persistence.flush()).toBe(true);

    expect(store.getState().settings.larivaar).toBe(false);
    expect(successfulLarivaarWrites).not.toContain('true');
    expect(successfulLarivaarWrites).toContain('false');
    expect(await AsyncStorage.getItem('larivaar')).toBe('false');
  });
});

describe('rapid setting toggles', () => {
  it('applies a tap to the UI immediately, even while a slow write is in flight', async () => {
    // Device report: toggling quickly, the switch lagged the finger by hundreds
    // of milliseconds and then appeared to move on its own. Setting controls are
    // driven by the store, so the dispatch must not queue behind disk I/O.
    const realMultiSet = (AsyncStorage.multiSet as jest.Mock).getMockImplementation()!;
    (AsyncStorage.multiSet as jest.Mock).mockImplementation(async (entries: unknown) => {
      await new Promise((resolve) => setTimeout(resolve, 120));
      return realMultiSet(entries);
    });

    expect(store.getState().settings.larivaar).toBe(false); // baseline

    // The tap must be on screen straight away — NOT after the write resolves.
    const first = commitSettingChange(setLarivaar(true));
    expect(store.getState().settings.larivaar).toBe(true);

    // ...and so must a second tap made while the first write is still running.
    const second = commitSettingChange(setLarivaar(false));
    expect(store.getState().settings.larivaar).toBe(false);

    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(store.getState().settings.larivaar).toBe(false);
    expect(await AsyncStorage.getItem('larivaar')).toBe('false');
  });

  it('ends on the LAST requested value, on screen and on disk', async () => {
    // Device report: toggling a setting quickly leaves it in the wrong state —
    // "I turn it on and it goes off".
    const results = await Promise.all([
      commitSettingChange(setLarivaar(true)),
      commitSettingChange(setLarivaar(false)),
      commitSettingChange(setLarivaar(true)),
    ]);

    expect(results.every(Boolean)).toBe(true); // none may report a false failure
    expect(store.getState().settings.larivaar).toBe(true);
    expect(await AsyncStorage.getItem('larivaar')).toBe('true');
  });

  it('a burst of toggles settles consistently between store and disk', async () => {
    const sequence = [true, false, true, false, true, false];
    await Promise.all(sequence.map((value) => commitSettingChange(setLarivaar(value))));

    const last = sequence[sequence.length - 1];
    expect(store.getState().settings.larivaar).toBe(last);
    expect(await AsyncStorage.getItem('larivaar')).toBe(String(last));
  });
});

describe('savePathProgress', () => {
  it('does not create a second local update for an unchanged checkpoint', async () => {
    const id = await createPath();
    expect(id).not.toBeNull();

    await savePathProgress(id!, 42, 100, 240);
    const firstOperation = store.getState().sync.pathOps[id!];

    await savePathProgress(id!, 42, 100, 240);

    // Going Home after a reader save is a successful no-op, not a newer sync
    // operation. This prevents a duplicate upload/notice for the same point.
    expect(store.getState().sync.pathOps[id!]).toEqual(firstOperation);
  });

  it('rolls back progress when the write fails', async () => {
    const id = await createPath();
    expect(id).not.toBeNull();
    const before = store.getState().paths.paths[0].saveData.angNumber;

    (AsyncStorage.multiSet as jest.Mock).mockRejectedValue(new Error('disk full'));
    const saved = await savePathProgress(id!, 42, 100, 0);
    expect(saved).toBe(false);

    // store restored to the last durable value, not the failed 42.
    expect(store.getState().paths.paths[0].saveData.angNumber).toBe(before);
    restoreStorageImpls();
  });
});

describe('savePathScrollPosition', () => {
  it('persists a scroll checkpoint without creating a new path operation', async () => {
    const id = await createPath();
    expect(id).not.toBeNull();
    const existingOp = store.getState().sync.pathOps[id!];

    expect(await savePathScrollPosition(id!, 480)).toBe(true);

    expect(store.getState().paths.dates[0].scrollPosition).toBe(480);
    expect(store.getState().sync.pathOps[id!]).toEqual(existingOp);
    expect(store.getState().sync.scrollDirty[id!]).toBeDefined();
  });

  it('records no reading day, so something else has to claim the day', async () => {
    // This asymmetry is deliberate — a scroll checkpoint fires constantly and
    // must stay cheap — but it is what broke the streak: the reader's leave
    // checkpoint decided "nothing changed" by comparing against durable state
    // that this call had ALREADY moved, so it skipped the save that records the
    // day. A session spent reading inside one ang left no trace on the calendar.
    const id = await createPath();
    expect(await savePathScrollPosition(id!, 480)).toBe(true);

    expect(store.getState().paths.dates[0].dates).toEqual([]);

    // The progress save is the only thing that claims a day, and it still does
    // so when the position it is handed is already the durable one.
    expect(await savePathProgress(id!, 413, 0, 480)).toBe(true);
    expect(store.getState().paths.dates[0].dates).toHaveLength(1);
  });
});

describe('renamePathCommand', () => {
  it('rolls back the name when the write fails', async () => {
    const id = await createPath();
    const original = store.getState().paths.paths[0].pathName;

    (AsyncStorage.multiSet as jest.Mock).mockRejectedValue(new Error('disk full'));
    const saved = await renamePathCommand(id!, 'New Name');
    expect(saved).toBe(false);

    expect(store.getState().paths.paths[0].pathName).toBe(original);
    restoreStorageImpls();
  });
});

describe('missing target path (honest failure, not phantom "Saved")', () => {
  // Reducers no-op on an unknown pathId; the command must report false rather
  // than let flush() see no change and falsely report success.
  it('savePathProgress returns false for an unknown pathId', async () => {
    expect(await savePathProgress(999, 10, 5, 0)).toBe(false);
  });

  it('renamePathCommand returns false for an unknown pathId', async () => {
    expect(await renamePathCommand(999, 'X')).toBe(false);
  });

  it('undoPathCompletion returns false for an unknown pathId', async () => {
    expect(await undoPathCompletion(999)).toBe(false);
  });

  it('does not write anything to disk when the target path is missing', async () => {
    jest.clearAllMocks();
    restoreStorageImpls();
    const saved = await savePathProgress(999, 10, 5, 0);
    expect(saved).toBe(false);
    expect((AsyncStorage.multiSet as jest.Mock).mock.calls).toHaveLength(0);
  });
});

describe('overlapping commands', () => {
  it('serializes concurrent commands so a rollback cannot clobber a newer change', async () => {
    const id = await createPath();

    // First command's write fails; second succeeds. Fired without awaiting the
    // first, so they overlap. Serialization must ensure the failed rename's
    // rollback does not resurrect it or wipe the successful progress save.
    (AsyncStorage.multiSet as jest.Mock).mockRejectedValueOnce(new Error('one-off'));
    (AsyncStorage.multiSet as jest.Mock).mockRejectedValueOnce(new Error('one-off'));
    (AsyncStorage.multiSet as jest.Mock).mockRejectedValueOnce(new Error('one-off'));

    const renamePromise = renamePathCommand(id!, 'Should Roll Back'); // 3 rejects -> fails
    const savePromise = savePathProgress(id!, 55, 200, 0); // runs after, succeeds

    const [renamed, saved] = await Promise.all([renamePromise, savePromise]);

    expect(renamed).toBe(false);
    expect(saved).toBe(true);

    const path = store.getState().paths.paths[0];
    // rename rolled back (original name kept), progress save preserved
    expect(path.pathName).toBe(`Path #${id}`);
    expect(path.saveData.angNumber).toBe(55);

    // and disk agrees with the store
    const onDisk = JSON.parse((await AsyncStorage.getItem('pathDetails'))!);
    expect(onDisk[0].pathName).toBe(`Path #${id}`);
    expect(onDisk[0].saveData.angNumber).toBe(55);
  });

  it('a failed command clears the stale journal so it cannot replay on reboot', async () => {
    const id = await createPath();

    // A save fails after retries; its rollback must overwrite the journal so a
    // fresh hydrate does not replay the failed value.
    (AsyncStorage.multiSet as jest.Mock).mockRejectedValue(new Error('disk full'));
    const saved = await savePathProgress(id!, 999, 42, 0);
    expect(saved).toBe(false);
    restoreStorageImpls();

    // Let any rollback flush settle, then simulate a reboot: fresh hydrate.
    await new Promise<void>((r) => setImmediate(() => r()));

    const fresh = makeStore();
    await hydrateStore(fresh);
    const path = fresh.getState().paths.paths.find((p) => p.pathId === id);
    expect(path?.saveData.angNumber).not.toBe(999); // the failed value did not replay
  });
});
