import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeStore } from '../../store';
import {
  createLegacyPersistence,
  hydrateStore,
  recoverPendingJournal,
} from '../../store/persistence';
import { JOURNAL_KEY, parseLegacy, type RawLegacy } from '../../store/legacyFormat';
import { addPath, renamePath, setScrollPosition, updatePath } from '../../store/slices/pathsSlice';
import {
  SETTINGS_DEFAULTS,
  setAnalyticsConsent,
  setLarivaar,
} from '../../store/slices/settingsSlice';

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
    // Matches dev's fetchConsent(): establish the default eagerly.
    expect(await AsyncStorage.getItem('consent')).toBe('true');
    // Other absent preferences remain absent until the user changes them.
    expect(await AsyncStorage.getItem('fontSize')).toBeNull();
    expect(await AsyncStorage.getItem('pathDetails')).toBeNull();
  });

  it('partial legacy data: only pathDetails -> paths hydrate, settings default', async () => {
    await AsyncStorage.setItem('pathDetails', JSON.stringify(PATHS_FIXTURE));
    const store = makeStore();
    expect(await hydrateStore(store)).toBe(true);

    expect(store.getState().paths.paths).toEqual(PATHS_FIXTURE);
    expect(store.getState().settings.larivaar).toBe(false);
  });

  // --- fail-closed containers vs quarantined individual records -------------

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

  it('invalid path record is quarantined without blocking hydration', async () => {
    await AsyncStorage.multiSet([
      ['pathDetails', JSON.stringify([{ pathId: 1 }])],
      ['consent', 'true'],
    ]);
    jest.clearAllMocks();
    restoreStorageImpls();
    const store = makeStore();

    expect(await hydrateStore(store)).toBe(true);
    expect(store.getState().paths.hydrated).toBe(true);
    expect(store.getState().paths.paths).toEqual([]);
    expect(callsFor('setItem')).toHaveLength(0);
    expect(callsFor('multiSet')).toHaveLength(0);
  });

  it('old partial saveData/progress record is quarantined while valid siblings hydrate', async () => {
    const quarantinedPath = {
      ...PATHS_FIXTURE[0],
      pathId: 3,
      saveData: { verseId: 4501 },
      progress: null,
    };
    const quarantinedDate = { pathid: 3, dates: [], scrollPosition: 10 };
    await AsyncStorage.multiSet([
      ['pathDetails', JSON.stringify([quarantinedPath, PATHS_FIXTURE[1]])],
      ['pathDateDetails', JSON.stringify([quarantinedDate, DATES_FIXTURE[1]])],
      ['consent', 'true'],
    ]);
    jest.clearAllMocks();
    restoreStorageImpls();

    const store = makeStore();
    expect(await hydrateStore(store)).toBe(true);
    expect(store.getState().paths.paths).toEqual([PATHS_FIXTURE[1]]);
    expect(store.getState().paths.dates).toEqual([DATES_FIXTURE[1]]);
    expect(callsFor('setItem')).toHaveLength(0);
    expect(callsFor('multiSet')).toHaveLength(0);
  });

  it('malformed settings use defaults and repair only setting keys', async () => {
    const rawPaths = JSON.stringify(PATHS_FIXTURE);
    const rawDates = JSON.stringify(DATES_FIXTURE);
    await AsyncStorage.multiSet([
      ['pathDetails', rawPaths],
      ['pathDateDetails', rawDates],
      ['fontSize', '{not json'],
      ['larivaar', 'yes'],
      ['paragraphMode', '1'],
      ['vishraam', 'TRUE'],
      ['vishraamsSource', JSON.stringify({ source: 'unknown' })],
      ['angsFormat', JSON.stringify({ format: 'French' })],
      ['consent', 'maybe'],
    ]);
    jest.clearAllMocks();
    restoreStorageImpls();

    const store = makeStore();
    expect(await hydrateStore(store)).toBe(true);
    expect(store.getState().settings).toEqual(SETTINGS_DEFAULTS);
    expect(store.getState().paths.paths).toEqual(PATHS_FIXTURE);
    expect(store.getState().paths.dates).toEqual(DATES_FIXTURE);

    expect(await AsyncStorage.getItem('fontSize')).toBe(JSON.stringify(SETTINGS_DEFAULTS.fontSize));
    expect(await AsyncStorage.getItem('larivaar')).toBe('false');
    expect(await AsyncStorage.getItem('paragraphMode')).toBe('false');
    expect(await AsyncStorage.getItem('vishraam')).toBe('false');
    expect(await AsyncStorage.getItem('vishraamsSource')).toBe(
      JSON.stringify(SETTINGS_DEFAULTS.vishraamsSource)
    );
    expect(await AsyncStorage.getItem('angsFormat')).toBe(
      JSON.stringify(SETTINGS_DEFAULTS.angsFormat)
    );
    expect(await AsyncStorage.getItem('consent')).toBe('true');

    const repairedKeys = callsFor('multiSet').flatMap((call) =>
      (call[0] as Array<[string, string]>).map(([key]) => key)
    );
    expect(repairedKeys).toEqual(
      expect.arrayContaining([
        'fontSize',
        'larivaar',
        'paragraphMode',
        'vishraam',
        'vishraamsSource',
        'angsFormat',
        'consent',
      ])
    );
    expect(repairedKeys).not.toContain('pathDetails');
    expect(repairedKeys).not.toContain('pathDateDetails');
    expect(await AsyncStorage.getItem('pathDetails')).toBe(rawPaths);
    expect(await AsyncStorage.getItem('pathDateDetails')).toBe(rawDates);
  });

  it('a failed settings repair does not block boot or modify path data', async () => {
    const rawPaths = JSON.stringify(PATHS_FIXTURE);
    const rawDates = JSON.stringify(DATES_FIXTURE);
    await AsyncStorage.multiSet([
      ['pathDetails', rawPaths],
      ['pathDateDetails', rawDates],
      ['fontSize', '{not json'],
      ['consent', 'false'],
    ]);
    (AsyncStorage.multiSet as jest.Mock).mockRejectedValueOnce(new Error('settings disk full'));

    const store = makeStore();
    expect(await hydrateStore(store)).toBe(true);
    expect(store.getState().settings.fontSize).toEqual(SETTINGS_DEFAULTS.fontSize);
    expect(store.getState().settings.analyticsConsent).toBe(false);
    expect(await AsyncStorage.getItem('fontSize')).toBe('{not json');
    expect(await AsyncStorage.getItem('pathDetails')).toBe(rawPaths);
    expect(await AsyncStorage.getItem('pathDateDetails')).toBe(rawDates);
  });

  it('read failure past retries -> false, zero dispatches, not hydrated', async () => {
    (AsyncStorage.multiGet as jest.Mock).mockRejectedValue(new Error('disk unavailable'));
    const store = makeStore();

    expect(await hydrateStore(store)).toBe(false);
    expect(store.getState().paths.hydrated).toBe(false);
    expect(store.getState().settings.larivaar).toBe(false); // untouched defaults
  });

  it('malformed data causes zero setItem calls (non-clobber)', async () => {
    await AsyncStorage.multiSet([
      ['pathDetails', '{not json'],
      ['fontSize', '{also not json'],
    ]);
    jest.clearAllMocks();
    restoreStorageImpls();

    const store = makeStore();
    expect(await hydrateStore(store)).toBe(false);

    expect(callsFor('setItem')).toHaveLength(0);
    expect(callsFor('multiSet')).toHaveLength(0);
    expect(await AsyncStorage.getItem('pathDetails')).toBe('{not json');
    expect(await AsyncStorage.getItem('fontSize')).toBe('{also not json');
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

  it('PRESENT-but-invalid saveData quarantines only that record', () => {
    // A transitional record whose saveData is damaged must not silently revert
    // to the older top-level angNumber, and must not block a valid sibling.
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
        PATHS_FIXTURE[1],
      ]),
    };
    const result = parseLegacy(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.paths).toEqual([PATHS_FIXTURE[1]]);
      expect(result.quarantined).toContain('pathDetails[0].saveData is missing or invalid');
    }
  });

  it('quarantines a path when neither saveData nor a top-level angNumber exists', () => {
    const raw = {
      ...emptyRaw(),
      pathDetails: JSON.stringify([{ pathId: 1, progress: 1, pathName: 'x' }, PATHS_FIXTURE[1]]),
    };
    const result = parseLegacy(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.paths).toEqual([PATHS_FIXTURE[1]]);
      expect(result.quarantined).toContain('pathDetails[0].saveData is missing or invalid');
    }
  });

  it('quarantines progress:null written by an old NaN without blocking siblings', () => {
    const raw = {
      ...emptyRaw(),
      pathDetails: JSON.stringify([
        { ...PATHS_FIXTURE[0], pathId: 3, progress: null },
        PATHS_FIXTURE[1],
      ]),
      pathDateDetails: JSON.stringify([
        { pathid: 3, dates: [], scrollPosition: 10 },
        DATES_FIXTURE[1],
      ]),
    };
    const result = parseLegacy(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.paths).toEqual([PATHS_FIXTURE[1]]);
      expect(result.value.dates).toEqual([DATES_FIXTURE[1]]);
      expect(result.quarantinedRecords.paths).toEqual([
        { ...PATHS_FIXTURE[0], pathId: 3, progress: null },
      ]);
      expect(result.quarantinedRecords.dates).toEqual([
        { pathid: 3, dates: [], scrollPosition: 10 },
      ]);
      expect(result.quarantined).toContain('pathDetails[0].progress is invalid');
      expect(result.quarantined).toContain('pathDateDetails[0] belongs to quarantined pathId 3');
    }
  });

  it('quarantines saveData with verseId but no angNumber and its paired date', () => {
    const raw = {
      ...emptyRaw(),
      pathDetails: JSON.stringify([
        {
          ...PATHS_FIXTURE[0],
          pathId: 3,
          saveData: { verseId: 4501 },
          progress: null,
        },
        PATHS_FIXTURE[1],
      ]),
      pathDateDetails: JSON.stringify([
        { pathid: 3, dates: [], scrollPosition: 10 },
        DATES_FIXTURE[1],
      ]),
    };
    const result = parseLegacy(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.paths).toEqual([PATHS_FIXTURE[1]]);
      expect(result.value.dates).toEqual([DATES_FIXTURE[1]]);
      expect(result.quarantined).toContain('pathDetails[0].saveData is missing or invalid');
      expect(result.quarantined).toContain('pathDateDetails[0] belongs to quarantined pathId 3');
    }
  });

  it('quarantines duplicate path and date records instead of failing the parse', () => {
    const raw = {
      ...emptyRaw(),
      pathDetails: JSON.stringify([PATHS_FIXTURE[0], PATHS_FIXTURE[0]]),
      pathDateDetails: JSON.stringify([DATES_FIXTURE[0], DATES_FIXTURE[0]]),
    };
    const result = parseLegacy(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.paths).toEqual([PATHS_FIXTURE[0]]);
      expect(result.value.dates).toEqual([DATES_FIXTURE[0]]);
      expect(result.quarantined).toContain('pathDetails[1] duplicates pathId 1');
      expect(result.quarantined).toContain('pathDateDetails[1] duplicates pathid 1');
    }
  });

  it('quarantines one malformed date record while keeping valid siblings', () => {
    const raw = {
      ...emptyRaw(),
      pathDetails: JSON.stringify(PATHS_FIXTURE),
      pathDateDetails: JSON.stringify([
        { pathid: 1, dates: 'corrupt', scrollPosition: 10 },
        DATES_FIXTURE[1],
      ]),
    };
    const result = parseLegacy(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.paths).toEqual(PATHS_FIXTURE);
      expect(result.value.dates).toEqual([DATES_FIXTURE[1]]);
      expect(result.quarantined).toContain('pathDateDetails[0].dates is invalid');
    }
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

  it('preserves quarantined raw records through later valid path writes and reboots', async () => {
    const quarantinedPath = {
      ...PATHS_FIXTURE[0],
      pathId: 3,
      saveData: { verseId: 4501 },
      progress: null,
    };
    const quarantinedDate = { pathid: 3, dates: [], scrollPosition: 10 };
    await AsyncStorage.multiSet([
      ['pathDetails', JSON.stringify([quarantinedPath, PATHS_FIXTURE[1]])],
      ['pathDateDetails', JSON.stringify([quarantinedDate, DATES_FIXTURE[1]])],
    ]);

    const store = makeStore();
    expect(await hydrateStore(store)).toBe(true);
    const persistence = createLegacyPersistence(store);
    persistence.start();
    store.dispatch(
      updatePath({
        pathId: 2,
        angNumber: 1400,
        verseId: 59000,
        progress: 97.9,
        completionDate: '',
        todayDate: '28-July-2026',
        scrollPosition: 800,
      })
    );
    expect(await persistence.flush()).toBe(true);
    persistence.stop();

    expect(JSON.parse((await AsyncStorage.getItem('pathDetails'))!)).toContainEqual(
      quarantinedPath
    );
    expect(JSON.parse((await AsyncStorage.getItem('pathDateDetails'))!)).toContainEqual(
      quarantinedDate
    );

    // A fresh boot must quarantine the same raw records again and continue to
    // carry them through subsequent writes.
    const fresh = makeStore();
    expect(await hydrateStore(fresh)).toBe(true);
    expect(fresh.getState().paths.paths).toHaveLength(1);
    const freshPersistence = createLegacyPersistence(fresh);
    freshPersistence.start();
    fresh.dispatch(renamePath({ pathId: 2, name: 'Still Valid' }));
    expect(await freshPersistence.flush()).toBe(true);
    freshPersistence.stop();

    expect(JSON.parse((await AsyncStorage.getItem('pathDetails'))!)).toContainEqual(
      quarantinedPath
    );
    expect(JSON.parse((await AsyncStorage.getItem('pathDateDetails'))!)).toContainEqual(
      quarantinedDate
    );
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

  it('a write in flight when stop() is called still reports success (no false failure/divergence)', async () => {
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
        await gate; // hold the write in flight
      }
      await real(entries);
    });

    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 4242 }));
    await flushMicrotasks(); // write now in flight (held)
    const flushPromise = persistence.flush();
    await flushMicrotasks();

    persistence.stop(); // app unmounts while the write is in flight

    release(); // the in-flight write completes SUCCESSFULLY
    const flushResult = await flushPromise;
    await flushMicrotasks();

    // The commit reached disk, so flush must report true — NOT a false failure
    // that would make the caller roll Redux back and diverge from disk.
    expect(flushResult).toBe(true);

    const onDisk = JSON.parse((await AsyncStorage.getItem('pathDateDetails'))!);
    expect(onDisk.find((d: any) => d.pathid === 1).scrollPosition).toBe(4242);
    expect(store.getState().paths.dates.find((d: any) => d.pathid === 1)!.scrollPosition).toBe(
      4242
    );

    restoreStorageImpls();
  });

  it('after stop() nothing more is written, and flush() no-ops (no rollback overwrite)', async () => {
    const { store, persistence } = await hydratedStoreWithPersistence();
    persistence.stop();

    jest.clearAllMocks();
    restoreStorageImpls();

    // A change + flush after stop must not touch disk. This is what prevents a
    // rollback (triggered by a stop()-settled waiter) from overwriting a commit.
    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 555 }));
    expect(await persistence.flush()).toBe(false);
    await flushMicrotasks();

    expect(callsFor('multiSet')).toHaveLength(0);
    expect(callsFor('setItem')).toHaveLength(0);
  });

  it('a commit that FAILS after stop() settles false and does not hang', async () => {
    const { store, persistence } = await hydratedStoreWithPersistence();

    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let first = true;
    (AsyncStorage.multiSet as jest.Mock).mockImplementation(async () => {
      if (first) {
        first = false;
        await gate; // hold in flight
      }
      throw new Error('disk full'); // and then fail (on release + on retry)
    });

    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 333 }));
    await flushMicrotasks(); // write in flight (held)
    const flushPromise = persistence.flush();
    await flushMicrotasks();

    persistence.stop();
    release(); // the in-flight write now genuinely fails

    // A real failure must resolve false (not true, not hang).
    expect(await flushPromise).toBe(false);

    restoreStorageImpls();
  });

  it('stop() then immediate start() while a commit is in flight stays consistent', async () => {
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
        await gate; // hold the first write in flight
      }
      await real(entries);
    });

    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 111 })); // in flight (held)
    await flushMicrotasks();
    const flushInFlight = persistence.flush();
    await flushMicrotasks();

    persistence.stop();
    persistence.start(); // restart while the old commit is still active

    release(); // the held commit completes
    expect(await flushInFlight).toBe(true);
    await flushMicrotasks();

    // The restarted coordinator is live and a NEW write still persists.
    expect(persistence.getStatus().running).toBe(true);
    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 222 }));
    expect(await persistence.flush()).toBe(true);

    const onDisk = JSON.parse((await AsyncStorage.getItem('pathDateDetails'))!);
    expect(onDisk.find((d: any) => d.pathid === 1).scrollPosition).toBe(222);

    restoreStorageImpls();
    persistence.stop();
  });

  it('revert-to-baseline during an in-flight write is NOT dropped (store === disk)', async () => {
    // Landmine: baseline advances only after commit, so a revert to baseline
    // while a batch is in flight computes changedKeys===0 and used to be skipped
    // -> store and disk diverged permanently. The revert must still be enqueued.
    const { store, persistence } = await hydratedStoreWithPersistence();
    const baselineScroll = store
      .getState()
      .paths.dates.find((d: any) => d.pathid === 1)!.scrollPosition;

    const real = ORIGINAL_IMPLS.get('multiSet') as (entries: any) => Promise<void>;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let first = true;
    (AsyncStorage.multiSet as jest.Mock).mockImplementation(async (entries: any) => {
      if (first) {
        first = false;
        await gate; // hold the first (B) write in flight
      }
      await real(entries);
    });

    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 12345 })); // B (held)
    await flushMicrotasks();
    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: baselineScroll })); // revert to A
    await flushMicrotasks();

    release(); // let B commit
    // Let the drain settle on its OWN. Do NOT call flush() here — a flush would
    // re-enqueue the current state and repair the divergence, masking the bug.
    await new Promise<void>((r) => setTimeout(() => r(), 100));

    const onDisk = JSON.parse((await AsyncStorage.getItem('pathDateDetails'))!);
    const diskScroll = onDisk.find((d: any) => d.pathid === 1).scrollPosition;
    const storeScroll = store
      .getState()
      .paths.dates.find((d: any) => d.pathid === 1)!.scrollPosition;

    // The coordinator must have settled with NO pending work but disk matching
    // the store — the revert reached disk on its own.
    expect(persistence.getStatus().dirty).toBe(false);
    expect(storeScroll).toBe(baselineScroll);
    expect(diskScroll).toBe(baselineScroll); // NOT 12345 — the revert reached disk

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

  it('journal is removed after a successful commit', async () => {
    const { store, persistence } = await hydratedStoreWithPersistence();

    store.dispatch(setLarivaar(false));
    expect(await persistence.flush()).toBe(true);

    expect(await AsyncStorage.getItem(JOURNAL_KEY)).toBeNull();
    persistence.stop();
  });

  it('journal `before` is the exact disk bytes at commit time, not the in-memory baseline', async () => {
    // Guards the conflict detector: `before` must reflect what is actually on
    // disk, not a re-serialization of the coordinator's baseline. If a foreign
    // writer changed the bytes since the last commit, `before` must be THOSE
    // bytes — otherwise the next crash-recovery misclassifies an interrupted
    // write as a conflict (or vice versa).
    const { store, persistence } = await hydratedStoreWithPersistence();

    // First write advances the baseline and rewrites disk to the upgraded form.
    store.dispatch(setLarivaar(false));
    expect(await persistence.flush()).toBe(true);

    // A foreign writer replaces pathDetails on disk; the baseline is now stale.
    const foreignRaw = JSON.stringify([{ pathId: 1, angNumber: 5, note: 'foreign build' }]);
    await AsyncStorage.setItem('pathDetails', foreignRaw);

    jest.clearAllMocks();
    restoreStorageImpls();

    // A rename touches pathDetails (and its pair), triggering a fresh journal.
    store.dispatch(renamePath({ pathId: 1, name: 'Renamed' }));
    expect(await persistence.flush()).toBe(true);
    persistence.stop();

    const journalWrite = callsFor('setItem').find(([key]) => key === JOURNAL_KEY);
    expect(journalWrite).toBeDefined();
    const journal = JSON.parse(journalWrite![1] as string);
    expect(journal.before.pathDetails).toBe(foreignRaw); // disk bytes, NOT baseline
  });
});

// ===========================================================================
// JOURNAL RECOVERY
// ===========================================================================

describe('recoverPendingJournal', () => {
  it('no journal -> success', async () => {
    expect(await recoverPendingJournal()).toBe(true);
  });

  it('a journal whose values already match disk is removed WITHOUT rewriting', async () => {
    // Crash after the write but before journal cleanup: disk already holds the
    // journalled values, so recovery just drops the journal (no redundant write).
    await AsyncStorage.setItem('larivaar', 'true'); // disk already = journal `after`
    await AsyncStorage.setItem(
      JOURNAL_KEY,
      JSON.stringify({ before: { larivaar: 'false' }, after: { larivaar: 'true' } })
    );

    jest.clearAllMocks();
    restoreStorageImpls();

    expect(await recoverPendingJournal()).toBe(true);
    expect(await AsyncStorage.getItem(JOURNAL_KEY)).toBeNull();
    expect(callsFor('multiSet')).toHaveLength(0); // no rewrite needed
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
    // pathDetails is at `after`; pathDateDetails is still at `before` (stale) —
    // recovery must complete the interrupted half.
    await AsyncStorage.setItem(
      JOURNAL_KEY,
      JSON.stringify({
        before: {
          pathDetails: JSON.stringify(PATHS_FIXTURE),
          pathDateDetails: JSON.stringify(DATES_FIXTURE),
        },
        after: {
          pathDetails: JSON.stringify(newPaths),
          pathDateDetails: JSON.stringify(newDates),
        },
      })
    );
    await AsyncStorage.setItem('pathDetails', JSON.stringify(newPaths));
    // pathDateDetails deliberately still stale (== before)

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
    await AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify({ before: 5, after: {} }));
    expect(await recoverPendingJournal()).toBe(false);
  });

  it('journal whose before/after key sets differ -> fails closed (not treated as null)', async () => {
    // `after` touches pathDetails but `before` omits it. A missing `before`
    // entry must NOT be read as `null` (which would misclassify recovery) —
    // the journal is malformed and recovery fails closed, preserving the byte.
    await AsyncStorage.setItem('pathDetails', JSON.stringify(PATHS_FIXTURE));
    const rawJournal = JSON.stringify({
      before: { larivaar: 'true' },
      after: { pathDetails: '[]' },
    });
    await AsyncStorage.setItem(JOURNAL_KEY, rawJournal);

    expect(await recoverPendingJournal()).toBe(false);
    expect(await AsyncStorage.getItem(JOURNAL_KEY)).toBe(rawJournal); // not deleted
    expect(await AsyncStorage.getItem('pathDetails')).toBe(JSON.stringify(PATHS_FIXTURE)); // untouched
  });

  it('journal containing only one path key -> fails closed as malformed', async () => {
    const rawJournal = JSON.stringify({
      before: { pathDetails: JSON.stringify(PATHS_FIXTURE) },
      after: { pathDetails: '[]' },
    });
    await AsyncStorage.setItem(JOURNAL_KEY, rawJournal);

    expect(await recoverPendingJournal()).toBe(false);
    expect(await AsyncStorage.getItem(JOURNAL_KEY)).toBe(rawJournal);
  });

  it('MIXED conflict: one key applied, its pair foreign -> fails closed, preserves everything', async () => {
    // Our build wrote pathDetails (== after) then crashed; an older build later
    // changed pathDateDetails to something the journal never knew (foreign).
    // The pair cannot be proven coherent, so recovery must NOT boot a half-mixed
    // snapshot: it preserves BOTH bytes, keeps the journal, and fails closed.
    const beforeDetails = JSON.stringify(PATHS_FIXTURE);
    const afterDetails = JSON.stringify([...PATHS_FIXTURE].reverse());
    const beforeDates = JSON.stringify(DATES_FIXTURE);
    const afterDates = JSON.stringify([...DATES_FIXTURE].reverse());
    const foreignDates = JSON.stringify([{ pathid: 9, dates: [], scrollPosition: 7 }]);

    await AsyncStorage.setItem('pathDetails', afterDetails); // applied by us
    await AsyncStorage.setItem('pathDateDetails', foreignDates); // foreign
    const rawJournal = JSON.stringify({
      before: { pathDetails: beforeDetails, pathDateDetails: beforeDates },
      after: { pathDetails: afterDetails, pathDateDetails: afterDates },
    });
    await AsyncStorage.setItem(JOURNAL_KEY, rawJournal);

    jest.clearAllMocks();
    restoreStorageImpls();

    expect(await recoverPendingJournal()).toBe(false); // fail closed on ambiguity
    expect(await AsyncStorage.getItem('pathDetails')).toBe(afterDetails); // preserved
    expect(await AsyncStorage.getItem('pathDateDetails')).toBe(foreignDates); // preserved
    expect(await AsyncStorage.getItem(JOURNAL_KEY)).toBe(rawJournal); // kept for recovery
    expect(callsFor('multiSet')).toHaveLength(0); // nothing written
  });

  it('SINGLE-KEY foreign: preserves the value and drops the stale journal', async () => {
    const before = JSON.stringify({ fontSize: 'Small', number: 18 });
    const after = JSON.stringify({ fontSize: 'Large', number: 30 });
    const foreign = JSON.stringify({ fontSize: 'Medium', number: 24 });
    await AsyncStorage.setItem('fontSize', foreign);
    await AsyncStorage.setItem(
      JOURNAL_KEY,
      JSON.stringify({ before: { fontSize: before }, after: { fontSize: after } })
    );

    jest.clearAllMocks();
    restoreStorageImpls();

    expect(await recoverPendingJournal()).toBe(true);
    expect(await AsyncStorage.getItem('fontSize')).toBe(foreign);
    expect(await AsyncStorage.getItem(JOURNAL_KEY)).toBeNull(); // stale journal dropped
    expect(callsFor('multiSet')).toHaveLength(0); // never replayed
  });

  it('ALL-FOREIGN multi-key journal -> fails closed because coherence is unprovable', async () => {
    // The old writer saves these keys sequentially. Even though both values are
    // foreign to this journal, they may come from different interrupted saves.
    const foreignDetails = JSON.stringify([{ ...PATHS_FIXTURE[0], progress: 99.9 }]);
    const foreignDates = JSON.stringify([{ pathid: 1, dates: [], scrollPosition: 987 }]);
    const rawJournal = JSON.stringify({
      before: {
        pathDetails: JSON.stringify(PATHS_FIXTURE),
        pathDateDetails: JSON.stringify(DATES_FIXTURE),
      },
      after: {
        pathDetails: JSON.stringify([...PATHS_FIXTURE].reverse()),
        pathDateDetails: JSON.stringify([...DATES_FIXTURE].reverse()),
      },
    });

    await AsyncStorage.setItem('pathDetails', foreignDetails);
    await AsyncStorage.setItem('pathDateDetails', foreignDates);
    await AsyncStorage.setItem(JOURNAL_KEY, rawJournal);

    jest.clearAllMocks();
    restoreStorageImpls();

    expect(await recoverPendingJournal()).toBe(false);
    expect(await AsyncStorage.getItem('pathDetails')).toBe(foreignDetails);
    expect(await AsyncStorage.getItem('pathDateDetails')).toBe(foreignDates);
    expect(await AsyncStorage.getItem(JOURNAL_KEY)).toBe(rawJournal);
    expect(callsFor('multiSet')).toHaveLength(0);
  });

  it('hydration fails closed when journal recovery fails', async () => {
    await seedFullLegacyUser();
    await AsyncStorage.setItem(JOURNAL_KEY, '{not json');

    const store = makeStore();
    expect(await hydrateStore(store)).toBe(false);
    expect(store.getState().paths.hydrated).toBe(false);
  });
});
