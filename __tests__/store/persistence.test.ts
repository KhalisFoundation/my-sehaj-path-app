import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeStore } from '../../store';
import {
  createLegacyPersistence,
  hydrateStore,
  recoverPendingJournal,
} from '../../store/persistence';
import { JOURNAL_KEY, META_KEY, parseLegacy, type RawLegacy } from '../../store/legacyFormat';
import { addPath, setScrollPosition, updatePath } from '../../store/slices/pathsSlice';
import { setAnalyticsConsent, setLarivaar } from '../../store/slices/settingsSlice';

jest.mock('../../utils/crashlytics', () => ({
  recordError: jest.fn(),
  logBreadcrumb: jest.fn(),
  allowCrashReporting: jest.fn(),
  testCrash: jest.fn(),
}));

const flushMicrotasks = () => new Promise<void>((resolve) => setImmediate(() => resolve()));

/**
 * The official async-storage mock exposes methods that are ALREADY jest.fn()s.
 * jest.spyOn() on an existing mock returns that same mock and registers no
 * restore, so .mockRestore() degrades to .mockReset() and permanently strips
 * the real implementation for the rest of the file. Capture the implementations
 * once and reinstate them before every test instead.
 */
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

const callsFor = (method: 'multiSet' | 'setItem') =>
  (AsyncStorage as any)[method].mock.calls as unknown[][];

const PATHS_FIXTURE = [
  {
    pathId: 1,
    saveData: { angNumber: 120, verseId: 4501 },
    progress: 8.39,
    startDate: '1-January-2026',
    completionDate: '',
    pathName: 'Morning Path',
  },
  {
    pathId: 2,
    saveData: { angNumber: 1430, verseId: 60403 },
    progress: 100,
    startDate: '2-February-2025',
    completionDate: '9-March-2025',
    pathName: 'Path #2',
  },
];

const DATES_FIXTURE = [
  {
    pathid: 1,
    dates: [{ date: '1-January-2026' }, { date: '2-January-2026' }],
    scrollPosition: 340,
  },
  { pathid: 2, dates: [{ date: '9-March-2025' }], scrollPosition: 0 },
];

const seedFullLegacyUser = async () => {
  await AsyncStorage.multiSet([
    ['pathDetails', JSON.stringify(PATHS_FIXTURE)],
    ['pathDateDetails', JSON.stringify(DATES_FIXTURE)],
    ['fontSize', JSON.stringify({ fontSize: 'Large', number: 30 })],
    ['larivaar', 'true'],
    ['paragraphMode', 'false'],
    ['vishraam', 'true'],
    ['vishraamsSource', JSON.stringify({ source: 'igurbani' })],
    ['angsFormat', JSON.stringify({ format: 'English' })],
    ['consent', 'false'],
  ]);
};

const emptyRaw = (): RawLegacy => ({
  pathDetails: null,
  pathDateDetails: null,
  fontSize: null,
  larivaar: null,
  paragraphMode: null,
  vishraam: null,
  vishraamsSource: null,
  angsFormat: null,
  consent: null,
});

beforeEach(async () => {
  restoreStorageImpls();
  await AsyncStorage.clear();
  jest.clearAllMocks();
  restoreStorageImpls(); // clearAllMocks/restoreMocks can strip impls again
});

// ===========================================================================
// HYDRATION
// ===========================================================================

describe('hydrateStore', () => {
  it('hydrates a full legacy user exactly', async () => {
    await seedFullLegacyUser();
    const store = makeStore();

    expect(await hydrateStore(store)).toBe(true);

    const state = store.getState();
    expect(state.paths.paths).toEqual(PATHS_FIXTURE);
    expect(state.paths.dates).toEqual(DATES_FIXTURE);
    expect(state.paths.hydrated).toBe(true);
    expect(state.settings).toEqual({
      fontSize: { fontSize: 'Large', number: 30 },
      larivaar: true,
      paragraphMode: false,
      vishraam: true,
      vishraamsSource: { source: 'igurbani' },
      angsFormat: { format: 'English' },
      analyticsConsent: false,
    });
  });

  it('parses "false" strings as false, never Boolean("false")===true', async () => {
    await AsyncStorage.multiSet([
      ['larivaar', 'false'],
      ['vishraam', 'false'],
      ['consent', 'false'],
      ['paragraphMode', 'false'],
    ]);
    const store = makeStore();
    expect(await hydrateStore(store)).toBe(true);

    const { settings } = store.getState();
    expect(settings.larivaar).toBe(false);
    expect(settings.vishraam).toBe(false);
    expect(settings.paragraphMode).toBe(false);
    expect(settings.analyticsConsent).toBe(false);
  });

  it('maps the legacy "consent" key onto analyticsConsent', async () => {
    await AsyncStorage.setItem('consent', 'false');
    const store = makeStore();
    await hydrateStore(store);
    expect(store.getState().settings.analyticsConsent).toBe(false);
  });

  it('fresh install: no keys -> defaults, hydrated, success', async () => {
    const store = makeStore();
    expect(await hydrateStore(store)).toBe(true);

    const state = store.getState();
    expect(state.paths.paths).toEqual([]);
    expect(state.paths.dates).toEqual([]);
    expect(state.paths.hydrated).toBe(true);
    expect(state.settings.vishraamsSource).toEqual({ source: 'sttm' });
    expect(state.settings.analyticsConsent).toBe(true);
  });

  it('partial legacy data: only pathDetails -> paths hydrate, settings default', async () => {
    await AsyncStorage.setItem('pathDetails', JSON.stringify(PATHS_FIXTURE));
    const store = makeStore();
    expect(await hydrateStore(store)).toBe(true);

    expect(store.getState().paths.paths).toEqual(PATHS_FIXTURE);
    expect(store.getState().settings.larivaar).toBe(false);
  });

  // --- fail-closed cases: malformed must never become a default -------------

  it('corrupt pathDetails JSON -> fails closed, no dispatch, bytes untouched', async () => {
    await AsyncStorage.setItem('pathDetails', '{not json');
    const store = makeStore();

    expect(await hydrateStore(store)).toBe(false);
    expect(store.getState().paths.hydrated).toBe(false);
    expect(store.getState().paths.paths).toEqual([]);
    // original bytes preserved
    expect(await AsyncStorage.getItem('pathDetails')).toBe('{not json');
  });

  it('non-array pathDetails -> fails closed, bytes untouched', async () => {
    await AsyncStorage.setItem('pathDetails', '{}');
    const store = makeStore();

    expect(await hydrateStore(store)).toBe(false);
    expect(store.getState().paths.hydrated).toBe(false);
    expect(await AsyncStorage.getItem('pathDetails')).toBe('{}');
  });

  it('invalid record shape (missing required saveData) -> fails closed', async () => {
    await AsyncStorage.setItem('pathDetails', JSON.stringify([{ pathId: 1 }]));
    const store = makeStore();

    expect(await hydrateStore(store)).toBe(false);
    expect(store.getState().paths.hydrated).toBe(false);
  });

  it('malformed boolean -> fails closed rather than silently defaulting to false', async () => {
    await AsyncStorage.setItem('larivaar', 'yes');
    const store = makeStore();
    expect(await hydrateStore(store)).toBe(false);
  });

  it('read failure past retries -> false, zero dispatches, not hydrated', async () => {
    (AsyncStorage.multiGet as jest.Mock).mockRejectedValue(new Error('disk unavailable'));
    const store = makeStore();

    expect(await hydrateStore(store)).toBe(false);
    expect(store.getState().paths.hydrated).toBe(false);
    expect(store.getState().settings.larivaar).toBe(false); // untouched defaults
  });

  it('malformed data causes zero setItem calls (non-clobber)', async () => {
    await AsyncStorage.setItem('pathDetails', '{not json');
    jest.clearAllMocks();
    restoreStorageImpls();

    const store = makeStore();
    await hydrateStore(store);

    expect(callsFor('setItem')).toHaveLength(0);
    expect(callsFor('multiSet')).toHaveLength(0);
  });
});

// ===========================================================================
// parseLegacy (pure)
// ===========================================================================

describe('parseLegacy', () => {
  it('missing keys produce defaults, not failures', () => {
    const result = parseLegacy(emptyRaw());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.paths).toEqual([]);
      expect(result.value.settings).toEqual({});
    }
  });

  it('never throws on garbage in any field', () => {
    const garbage = ['', '[', '{', 'null', 'undefined', '0', '[]', '{}', 'NaN', '"str"'];
    for (const value of garbage) {
      for (const key of Object.keys(emptyRaw())) {
        const raw = { ...emptyRaw(), [key]: value } as RawLegacy;
        expect(() => parseLegacy(raw)).not.toThrow();
      }
    }
  });

  it('preserves unknown additive fields for forward compatibility', () => {
    const raw = {
      ...emptyRaw(),
      pathDetails: JSON.stringify([{ ...PATHS_FIXTURE[0], futureField: 'keep-me' }]),
    };
    const result = parseLegacy(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value.paths[0] as any).futureField).toBe('keep-me');
    }
  });

  it('upgrades a historical path missing pathName instead of failing', () => {
    const raw = {
      ...emptyRaw(),
      pathDetails: JSON.stringify([
        {
          pathId: 3,
          saveData: { angNumber: 5, verseId: 1 },
          progress: 0.3,
          startDate: '1-May-2024',
          completionDate: '',
        },
      ]),
    };
    const result = parseLegacy(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.paths[0].pathName).toBe('Path #3');
    }
  });

  it('upgrades the earliest ACCURATE shape (top-level angNumber, no saveData, no pathName)', () => {
    // The real pre-April-2025 writer produced { pathId, angNumber, progress,
    // startDate, completionDate } — no saveData, no verseId, and no pathName.
    const raw = {
      ...emptyRaw(),
      pathDetails: JSON.stringify([
        {
          pathId: 1,
          angNumber: 50,
          progress: 3.5,
          startDate: '1-February-2025',
          completionDate: '',
        },
      ]),
    };
    const result = parseLegacy(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const path = result.value.paths[0];
      expect(path.saveData).toEqual({ angNumber: 50, verseId: 0 });
      expect(path.pathName).toBe('Path #1'); // defaulted, since the old shape had none
      // legacy top-level angNumber must not linger on the upgraded object
      expect((path as unknown as Record<string, unknown>).angNumber).toBeUndefined();
    }
  });

  it('a transitional record with BOTH valid saveData and angNumber keeps saveData', () => {
    // The newer writer added saveData without deleting angNumber. saveData wins.
    const raw = {
      ...emptyRaw(),
      pathDetails: JSON.stringify([
        {
          pathId: 1,
          angNumber: 50, // stale top-level value
          saveData: { angNumber: 120, verseId: 4501 }, // newer, authoritative
          progress: 8.4,
          startDate: '1-May-2025',
          completionDate: '',
          pathName: 'Path #1',
        },
      ]),
    };
    const result = parseLegacy(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.paths[0].saveData).toEqual({ angNumber: 120, verseId: 4501 });
      expect(
        (result.value.paths[0] as unknown as Record<string, unknown>).angNumber
      ).toBeUndefined();
    }
  });

  it('PRESENT-but-invalid saveData fails closed (does NOT fall back to stale angNumber)', () => {
    // A transitional record whose saveData is damaged must not silently lose the
    // newer progress by reverting to the older top-level angNumber.
    const raw = {
      ...emptyRaw(),
      pathDetails: JSON.stringify([
        {
          pathId: 1,
          angNumber: 50,
          saveData: { angNumber: 'corrupt' }, // present but invalid
          progress: 8.4,
          pathName: 'Path #1',
        },
      ]),
    };
    expect(parseLegacy(raw).ok).toBe(false);
  });

  it('still fails closed when neither saveData nor a top-level angNumber exists', () => {
    const raw = {
      ...emptyRaw(),
      pathDetails: JSON.stringify([{ pathId: 1, progress: 1, pathName: 'x' }]),
    };
    expect(parseLegacy(raw).ok).toBe(false);
  });

  it('rejects duplicate pathIds', () => {
    const raw = {
      ...emptyRaw(),
      pathDetails: JSON.stringify([PATHS_FIXTURE[0], PATHS_FIXTURE[0]]),
    };
    expect(parseLegacy(raw).ok).toBe(false);
  });
});

// ===========================================================================
// WRITE-THROUGH
// ===========================================================================

const hydratedStoreWithPersistence = async () => {
  await seedFullLegacyUser();
  const store = makeStore();
  await hydrateStore(store);
  const persistence = createLegacyPersistence(store);
  persistence.start();
  return { store, persistence };
};

describe('write-through', () => {
  it('THE GUARD: refuses to write while the store is not hydrated', async () => {
    // If this fails, a blank store can wipe real user data on disk.
    await seedFullLegacyUser();
    const store = makeStore(); // deliberately NOT hydrated
    const persistence = createLegacyPersistence(store);
    persistence.start();

    store.dispatch(
      addPath({
        path: {
          pathId: 9,
          saveData: { angNumber: 0, verseId: 0 },
          progress: 1,
          startDate: 'x',
          completionDate: '',
          pathName: 'ghost',
        },
        date: { pathid: 9, dates: [], scrollPosition: 0 },
      })
    );
    await flushMicrotasks();

    expect(await AsyncStorage.getItem('pathDetails')).toBe(JSON.stringify(PATHS_FIXTURE));
    expect(await persistence.flush()).toBe(false);
    persistence.stop();
  });

  it('boot does not rewrite keys (baseline starts at hydrated state)', async () => {
    await seedFullLegacyUser();
    const store = makeStore();
    await hydrateStore(store);

    jest.clearAllMocks();
    restoreStorageImpls();

    const persistence = createLegacyPersistence(store);
    persistence.start();
    await flushMicrotasks();

    expect(callsFor('multiSet')).toHaveLength(0);
    persistence.stop();
  });

  it('format fidelity: booleans are raw true/false, not JSON-quoted', async () => {
    const { store, persistence } = await hydratedStoreWithPersistence();

    store.dispatch(setLarivaar(true));
    expect(await persistence.flush()).toBe(true);
    expect(await AsyncStorage.getItem('larivaar')).toBe('true');

    store.dispatch(setLarivaar(false));
    expect(await persistence.flush()).toBe(true);
    expect(await AsyncStorage.getItem('larivaar')).toBe('false');

    persistence.stop();
  });

  it('key rename out: analyticsConsent writes to the legacy consent key', async () => {
    const { store, persistence } = await hydratedStoreWithPersistence();

    store.dispatch(setAnalyticsConsent(true));
    expect(await persistence.flush()).toBe(true);

    expect(await AsyncStorage.getItem('consent')).toBe('true');
    expect(await AsyncStorage.getItem('analyticsConsent')).toBeNull();
    persistence.stop();
  });

  it('round-trip: hydrate -> mutate -> write -> fresh hydrate is identical', async () => {
    const { store, persistence } = await hydratedStoreWithPersistence();

    store.dispatch(setLarivaar(false));
    store.dispatch(
      updatePath({
        pathId: 1,
        angNumber: 200,
        verseId: 7000,
        progress: 13.99,
        completionDate: '',
        todayDate: '3-January-2026',
        scrollPosition: 512,
      })
    );
    expect(await persistence.flush()).toBe(true);
    persistence.stop();

    const fresh = makeStore();
    expect(await hydrateStore(fresh)).toBe(true);
    expect(fresh.getState().settings).toEqual(store.getState().settings);
    expect(fresh.getState().paths.paths).toEqual(store.getState().paths.paths);
    expect(fresh.getState().paths.dates).toEqual(store.getState().paths.dates);
  });

  it('selective writes: a settings-only change does not rewrite pathDetails', async () => {
    const { store, persistence } = await hydratedStoreWithPersistence();
    jest.clearAllMocks();
    restoreStorageImpls();

    store.dispatch(setLarivaar(false));
    await persistence.flush();

    const writtenKeys = callsFor('multiSet').flatMap((call) =>
      (call[0] as Array<[string, string]>).map(([key]) => key)
    );
    expect(writtenKeys).toContain('larivaar');
    expect(writtenKeys).not.toContain('pathDetails');
    persistence.stop();
  });

  it('path writes always commit pathDetails and pathDateDetails as a pair', async () => {
    const { store, persistence } = await hydratedStoreWithPersistence();
    jest.clearAllMocks();
    restoreStorageImpls();

    // only touches dates
    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 777 }));
    await persistence.flush();

    const writtenKeys = callsFor('multiSet').flatMap((call) =>
      (call[0] as Array<[string, string]>).map(([key]) => key)
    );
    expect(writtenKeys).toContain('pathDateDetails');
    expect(writtenKeys).toContain('pathDetails');
    persistence.stop();
  });

  it('out-of-order: never two writes in flight, and the newest value wins', async () => {
    // Landmine #11. The first native write is made deliberately slower than the
    // second; with concurrent writes the stale value would land last.
    const { store, persistence } = await hydratedStoreWithPersistence();
    const real = ORIGINAL_IMPLS.get('multiSet') as (entries: any) => Promise<void>;

    let inFlight = 0;
    let maxInFlight = 0;
    let call = 0;
    (AsyncStorage.multiSet as jest.Mock).mockImplementation(async (entries: any) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      call += 1;
      await new Promise<void>((resolve) => setTimeout(() => resolve(), call === 1 ? 40 : 1));
      await real(entries);
      inFlight -= 1;
    });

    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 100 })); // A (slow)
    const flushA = persistence.flush();
    await flushMicrotasks();

    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 200 })); // B (fast)
    const flushB = persistence.flush();

    await Promise.all([flushA, flushB]);
    expect(await persistence.flush()).toBe(true); // fully drained

    expect(maxInFlight).toBe(1);

    const onDisk = JSON.parse((await AsyncStorage.getItem('pathDateDetails'))!);
    expect(onDisk.find((d: any) => d.pathid === 1).scrollPosition).toBe(200);

    restoreStorageImpls();
    persistence.stop();
  });

  it('flush resolves true only when THAT snapshot is durable', async () => {
    const { store, persistence } = await hydratedStoreWithPersistence();

    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 321 }));
    expect(await persistence.flush()).toBe(true);

    const onDisk = JSON.parse((await AsyncStorage.getItem('pathDateDetails'))!);
    expect(onDisk.find((d: any) => d.pathid === 1).scrollPosition).toBe(321);
    persistence.stop();
  });

  it('coalescing: rapid updates persist only the newest snapshot', async () => {
    const { store, persistence } = await hydratedStoreWithPersistence();

    for (let i = 1; i <= 20; i += 1) {
      store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: i }));
    }
    expect(await persistence.flush()).toBe(true);

    const onDisk = JSON.parse((await AsyncStorage.getItem('pathDateDetails'))!);
    expect(onDisk.find((d: any) => d.pathid === 1).scrollPosition).toBe(20);
    persistence.stop();
  });

  it('transient write failure is retried automatically and still succeeds', async () => {
    const { store, persistence } = await hydratedStoreWithPersistence();

    // Fails once, then the capped retry inside the coordinator succeeds.
    (AsyncStorage.multiSet as jest.Mock).mockRejectedValueOnce(new Error('disk full'));

    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 111 }));
    expect(await persistence.flush()).toBe(true);

    const onDisk = JSON.parse((await AsyncStorage.getItem('pathDateDetails'))!);
    expect(onDisk.find((d: any) => d.pathid === 1).scrollPosition).toBe(111);
    persistence.stop();
  });

  it('journal write failure is retried (not just multiSet)', async () => {
    // The journal setItem is the FIRST write in a batch; a failure there used to
    // drop the update entirely with no retry.
    const { store, persistence } = await hydratedStoreWithPersistence();
    const realSetItem = ORIGINAL_IMPLS.get('setItem') as (k: string, v: string) => Promise<void>;

    let failed = false;
    (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key: string, value: string) => {
      if (!failed && key === JOURNAL_KEY) {
        failed = true;
        throw new Error('journal write failed');
      }
      return realSetItem(key, value);
    });

    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 222 }));
    expect(await persistence.flush()).toBe(true);

    restoreStorageImpls();
    const onDisk = JSON.parse((await AsyncStorage.getItem('pathDateDetails'))!);
    expect(onDisk.find((d: any) => d.pathid === 1).scrollPosition).toBe(222);
    persistence.stop();
  });

  it('persistent write failure: exhausts retries, flush false, stays dirty, recovers later', async () => {
    const { store, persistence } = await hydratedStoreWithPersistence();

    (AsyncStorage.multiSet as jest.Mock).mockRejectedValue(new Error('disk full'));

    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 111 }));
    expect(await persistence.flush()).toBe(false);
    expect(persistence.getStatus().dirty).toBe(true);

    restoreStorageImpls();

    // the still-dirty newest state is written on the next attempt
    expect(await persistence.flush()).toBe(true);
    const onDisk = JSON.parse((await AsyncStorage.getItem('pathDateDetails'))!);
    expect(onDisk.find((d: any) => d.pathid === 1).scrollPosition).toBe(111);
    persistence.stop();
  });

  it('flush never hangs when its snapshot is superseded by a newer one', async () => {
    // Regression: waiters used to resolve only on exact snapshot equality, so a
    // coalesced-away snapshot's flush() promise never settled. Auto-scroll makes
    // this routine. If this regresses, the test times out.
    const { store, persistence } = await hydratedStoreWithPersistence();
    const real = ORIGINAL_IMPLS.get('multiSet') as (entries: any) => Promise<void>;

    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let first = true;
    (AsyncStorage.multiSet as jest.Mock).mockImplementation(async (entries: any) => {
      if (first) {
        first = false;
        await gate; // hold X in flight so A and B queue behind it
      }
      await real(entries);
    });

    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 1 })); // X (in flight)
    const flushX = persistence.flush();
    await flushMicrotasks();

    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 2 })); // A
    const flushA = persistence.flush();
    await flushMicrotasks();

    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 3 })); // B supersedes A
    const flushB = persistence.flush();
    await flushMicrotasks();

    release();

    // A must settle even though its exact snapshot is never written.
    await expect(Promise.all([flushX, flushA, flushB])).resolves.toEqual([true, true, true]);

    restoreStorageImpls();
    const onDisk = JSON.parse((await AsyncStorage.getItem('pathDateDetails'))!);
    expect(onDisk.find((d: any) => d.pathid === 1).scrollPosition).toBe(3);
    persistence.stop();
  });

  it('stop() settles outstanding waiters instead of leaving them hanging', async () => {
    const { store, persistence } = await hydratedStoreWithPersistence();
    (AsyncStorage.multiSet as jest.Mock).mockRejectedValue(new Error('disk full'));

    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 9 }));
    const pendingFlush = persistence.flush();
    expect(await pendingFlush).toBe(false);

    restoreStorageImpls();
    persistence.stop();
  });

  it('subscription lifecycle: start twice attaches once; stop unsubscribes', async () => {
    await seedFullLegacyUser();
    const store = makeStore();
    await hydrateStore(store);
    const persistence = createLegacyPersistence(store);

    persistence.start();
    persistence.start(); // idempotent
    expect(persistence.getStatus().running).toBe(true);

    persistence.stop();
    expect(persistence.getStatus().running).toBe(false);

    jest.clearAllMocks();
    restoreStorageImpls();
    store.dispatch(setLarivaar(false));
    await flushMicrotasks();
    expect(callsFor('multiSet')).toHaveLength(0);
  });

  it('journal is removed only after values and meta are durable', async () => {
    const { store, persistence } = await hydratedStoreWithPersistence();

    store.dispatch(setLarivaar(false));
    expect(await persistence.flush()).toBe(true);

    expect(await AsyncStorage.getItem(JOURNAL_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(META_KEY)).not.toBeNull();
    persistence.stop();
  });
});

// ===========================================================================
// JOURNAL RECOVERY
// ===========================================================================

describe('recoverPendingJournal', () => {
  it('no journal -> success', async () => {
    expect(await recoverPendingJournal()).toBe(true);
  });

  it('replays a half-committed path pair, then hydration sees the full snapshot', async () => {
    await seedFullLegacyUser();

    const newPaths = [
      ...PATHS_FIXTURE,
      {
        pathId: 3,
        saveData: { angNumber: 1, verseId: 1 },
        progress: 0.07,
        startDate: '4-January-2026',
        completionDate: '',
        pathName: 'Path #3',
      },
    ];
    const newDates = [...DATES_FIXTURE, { pathid: 3, dates: [], scrollPosition: 0 }];

    // Simulate a crash: journal written, only ONE of the pair landed.
    await AsyncStorage.setItem(
      JOURNAL_KEY,
      JSON.stringify({
        revision: 7,
        valuesByKey: {
          pathDetails: JSON.stringify(newPaths),
          pathDateDetails: JSON.stringify(newDates),
        },
      })
    );
    await AsyncStorage.setItem('pathDetails', JSON.stringify(newPaths));
    // pathDateDetails deliberately still stale

    const store = makeStore();
    expect(await hydrateStore(store)).toBe(true);

    // both keys recovered and consistent
    expect(store.getState().paths.paths).toEqual(newPaths);
    expect(store.getState().paths.dates).toEqual(newDates);
    expect(await AsyncStorage.getItem(JOURNAL_KEY)).toBeNull();
  });

  it('malformed journal -> fails closed and does not delete it', async () => {
    await AsyncStorage.setItem(JOURNAL_KEY, '{not json');
    expect(await recoverPendingJournal()).toBe(false);
    expect(await AsyncStorage.getItem(JOURNAL_KEY)).toBe('{not json');
  });

  it('journal with an invalid shape -> fails closed', async () => {
    await AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify({ revision: 'x', valuesByKey: 5 }));
    expect(await recoverPendingJournal()).toBe(false);
  });

  it('hydration fails closed when journal recovery fails', async () => {
    await seedFullLegacyUser();
    await AsyncStorage.setItem(JOURNAL_KEY, '{not json');

    const store = makeStore();
    expect(await hydrateStore(store)).toBe(false);
    expect(store.getState().paths.hydrated).toBe(false);
  });
});
