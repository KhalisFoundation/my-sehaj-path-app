import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeStore } from '../../store';
import { createLegacyPersistence, hydrateStore } from '../../store/persistence';
import { SYNC_META_KEY, serializeSyncMeta } from '../../store/syncFormat';
import type { PersistedSyncState } from '../../store/slices/syncSlice';
import { renamePath, setAll } from '../../store/slices/pathsSlice';
import { upsertMeta } from '../../store/slices/syncSlice';

jest.mock('../../utils/crashlytics', () => ({
  recordError: jest.fn(),
  logBreadcrumb: jest.fn(),
  allowCrashReporting: jest.fn(),
  testCrash: jest.fn(),
}));

const flushMicrotasks = () => new Promise<void>((resolve) => setImmediate(() => resolve()));

const MOCKED_METHODS = [
  'getItem',
  'setItem',
  'removeItem',
  'multiGet',
  'multiSet',
  'multiRemove',
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

const writtenKeys = () =>
  ((AsyncStorage.multiSet as jest.Mock).mock.calls as unknown[][]).flatMap((call) =>
    (call[0] as [string, string][]).map(([key]) => key)
  );

const PATHS_FIXTURE = [
  {
    pathId: 1,
    saveData: { angNumber: 120, verseId: 4501 },
    progress: 8.39,
    startDate: '1-January-2026',
    completionDate: '',
    pathName: 'Morning Path',
  },
];
const DATES_FIXTURE = [{ pathid: 1, dates: [{ date: '1-January-2026' }], scrollPosition: 0 }];

const UUID = '11111111-2222-4333-8444-555555555555';
const validSync = (): PersistedSyncState => ({
  version: 1,
  account: 'user@example.com',
  lastSyncedAt: 1700000000000,
  meta: {
    1: {
      serverPathId: UUID,
      serverUpdatedAt: 1699999999000,
      localUpdatedAt: 1700000000001,
      startDate: 1690000000000,
      deletedAt: null,
      onServer: true,
    },
  },
  pathOps: {},
  scrollDirty: {},
  settingsUpdatedAt: 0,
  pendingSettingsUpdatedAt: null,
});

const seedLegacyPaths = async () => {
  await AsyncStorage.multiSet([
    ['pathDetails', JSON.stringify(PATHS_FIXTURE)],
    ['pathDateDetails', JSON.stringify(DATES_FIXTURE)],
  ]);
};

beforeEach(async () => {
  restoreStorageImpls();
  await AsyncStorage.clear();
  jest.clearAllMocks();
  restoreStorageImpls();
});

describe('sync hydration (boot)', () => {
  it('no sync key -> hydrated empty, no recovery', async () => {
    await seedLegacyPaths();
    const store = makeStore();

    expect(await hydrateStore(store)).toBe(true);
    expect(store.getState().sync.hydrated).toBe(true);
    expect(store.getState().sync.recoveryNeeded).toBe(false);
    expect(store.getState().sync.meta).toEqual({});
  });

  it('valid sync key -> hydrated with its data', async () => {
    await seedLegacyPaths();
    await AsyncStorage.setItem(SYNC_META_KEY, serializeSyncMeta(validSync()));
    const store = makeStore();

    expect(await hydrateStore(store)).toBe(true);
    const { sync } = store.getState();
    expect(sync.hydrated).toBe(true);
    expect(sync.recoveryNeeded).toBe(false);
    expect(sync.account).toBe('user@example.com');
    expect(sync.lastSyncedAt).toBe(1700000000000);
    expect(sync.meta[1].serverPathId).toBe(UUID);
  });

  it('malformed sync key -> app still boots, cloud disabled, raw preserved', async () => {
    await seedLegacyPaths();
    await AsyncStorage.setItem(SYNC_META_KEY, '{not json');
    jest.clearAllMocks(); // measure only what hydration writes, not the seeding
    restoreStorageImpls();
    const store = makeStore();

    // Boot succeeds and legacy paths still load.
    expect(await hydrateStore(store)).toBe(true);
    expect(store.getState().paths.paths).toHaveLength(1);

    // Cloud sync is disabled until an explicit repair...
    expect(store.getState().sync.hydrated).toBe(true);
    expect(store.getState().sync.recoveryNeeded).toBe(true);

    // ...and the raw malformed value is preserved, never overwritten during boot.
    expect(await AsyncStorage.getItem(SYNC_META_KEY)).toBe('{not json');
    expect(writtenKeys()).not.toContain(SYNC_META_KEY);
  });
});

describe('sync persistence (atomic path ↔ sync)', () => {
  const hydrated = async () => {
    await seedLegacyPaths();
    const store = makeStore();
    await hydrateStore(store);
    const persistence = createLegacyPersistence(store);
    persistence.start();
    jest.clearAllMocks();
    restoreStorageImpls();
    return { store, persistence };
  };

  it('a path change journals the sync key atomically (triple together)', async () => {
    const { store, persistence } = await hydrated();

    // renamePath flows through the stamping middleware, which stamps sync meta;
    // the path change then pulls the sync key into the same journalled batch.
    store.dispatch(renamePath({ pathId: 1, name: 'Renamed' }));
    expect(await persistence.flush()).toBe(true);

    expect(writtenKeys()).toEqual(
      expect.arrayContaining(['pathDetails', 'pathDateDetails', SYNC_META_KEY])
    );
    const onDisk = await AsyncStorage.getItem(SYNC_META_KEY);
    expect(JSON.parse(onDisk as string).meta[1].serverPathId).toMatch(/^[0-9a-f-]{36}$/i);

    persistence.stop();
  });

  it('a sync-only change writes only the sync key, not path data', async () => {
    const { store, persistence } = await hydrated();

    store.dispatch(
      upsertMeta({ pathId: 1, meta: { serverPathId: UUID, startDate: 1690000000000 } })
    );
    expect(await persistence.flush()).toBe(true);

    expect(writtenKeys()).toContain(SYNC_META_KEY);
    expect(writtenKeys()).not.toContain('pathDetails');

    persistence.stop();
  });

  it('in recovery mode, a later path write preserves the corrupt sync value', async () => {
    await seedLegacyPaths();
    await AsyncStorage.setItem(SYNC_META_KEY, '{not json');
    const store = makeStore();
    await hydrateStore(store);
    expect(store.getState().sync.recoveryNeeded).toBe(true);

    const persistence = createLegacyPersistence(store);
    persistence.start();
    jest.clearAllMocks();
    restoreStorageImpls();

    // Editing a path still persists path data...
    store.dispatch(renamePath({ pathId: 1, name: 'Renamed' }));
    expect(await persistence.flush()).toBe(true);
    expect(writtenKeys()).toEqual(expect.arrayContaining(['pathDetails', 'pathDateDetails']));

    // ...but the malformed sync key is never touched.
    expect(writtenKeys()).not.toContain(SYNC_META_KEY);
    expect(await AsyncStorage.getItem(SYNC_META_KEY)).toBe('{not json');
    persistence.stop();
  });

  it('refuses to write until the sync slice is hydrated', async () => {
    const store = makeStore();
    // Hydrate paths only; sync stays unhydrated.
    store.dispatch(setAll({ paths: PATHS_FIXTURE, dates: DATES_FIXTURE }));
    expect(store.getState().paths.hydrated).toBe(true);
    expect(store.getState().sync.hydrated).toBe(false);

    const persistence = createLegacyPersistence(store);
    persistence.start();
    store.dispatch(upsertMeta({ pathId: 1, meta: { serverPathId: UUID, startDate: 1 } }));
    await flushMicrotasks();

    expect(await persistence.flush()).toBe(false);
    expect(writtenKeys()).toHaveLength(0);
    persistence.stop();
  });
});
