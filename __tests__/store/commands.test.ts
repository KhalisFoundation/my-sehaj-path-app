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

import { store, makeStore } from '../../store';
import { hydrateStore } from '../../store/persistence';
import { persistence } from '../../store/instance';
import { createPath, renamePathCommand, savePathProgress } from '../../store/commands';
import { setAll } from '../../store/slices/pathsSlice';

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
});

describe('savePathProgress', () => {
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
