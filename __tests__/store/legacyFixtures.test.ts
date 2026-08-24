import AsyncStorage from '@react-native-async-storage/async-storage';
import manifest from '../fixtures/legacy/manifest.json';
import { makeStore } from '../../store';
import { hydrateStore, createLegacyPersistence } from '../../store/persistence';
import { setLarivaar } from '../../store/slices/settingsSlice';
import { setScrollPosition } from '../../store/slices/pathsSlice';

jest.mock('../../utils/crashlytics', () => ({
  recordError: jest.fn(),
  logBreadcrumb: jest.fn(),
  allowCrashReporting: jest.fn(),
  testCrash: jest.fn(),
}));

/**
 * Production release gate for legacy-data compatibility.
 *
 * Every required storage shape (see manifest.requiredShapes) must be present,
 * and each fixture must survive the COMPLETE upgrade lifecycle, not just
 * parsing: raw bytes -> hydrateStore -> Redux defaults for absent keys ->
 * mutate + write-through -> fresh hydrate from the written bytes -> the written
 * bytes stay in rollback-readable legacy format.
 */
interface FixtureVersion {
  shapeId: string;
  provenance: 'derived' | 'device-captured';
  origin: string;
  platforms: Array<{ platform: string; appVersion: string; build: number }>;
  source: Record<string, string>;
  expected: {
    paths: unknown[];
    dates: unknown[];
    settings: Record<string, unknown>;
  };
}

const versions = manifest.versions as unknown as FixtureVersion[];
const requiredShapes = manifest.requiredShapes as string[];

// Set in CI (see the `test:release` script) to enforce the production blocker:
// derived fixtures alone must NOT pass the gate.
declare const process: { env: Record<string, string | undefined> };
const requireCaptured = process.env.REQUIRE_LEGACY_FIXTURES === '1';

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

const seed = async (source: Record<string, string>) => {
  await AsyncStorage.multiSet(Object.entries(source));
};

beforeEach(async () => {
  restoreStorageImpls();
  await AsyncStorage.clear();
  jest.clearAllMocks();
  restoreStorageImpls();
});

describe('RELEASE GATE', () => {
  it('every required storage shape is represented by a fixture', () => {
    const present = new Set(versions.map((v) => v.shapeId));
    for (const shape of requiredShapes) {
      expect(present.has(shape)).toBe(true);
    }
  });

  it('every fixture declares its platforms/versions', () => {
    for (const v of versions) {
      expect(v.platforms.length).toBeGreaterThan(0);
      for (const p of v.platforms) {
        expect(p.platform).toMatch(/^(android|ios)$/);
        expect(typeof p.appVersion).toBe('string');
      }
    }
  });

  // Enforced only under REQUIRE_LEGACY_FIXTURES=1 (the `yarn test:release`
  // script / CI). Derived fixtures give regression coverage but do NOT satisfy
  // the production blocker: each required shape needs a byte-for-byte capture
  // from a real installed build. This test fails until those are added.
  (requireCaptured ? it : it.skip)(
    'RELEASE: every required shape has a device-captured fixture',
    () => {
      for (const shape of requiredShapes) {
        const captured = versions.filter(
          (v) => v.shapeId === shape && v.provenance === 'device-captured'
        );
        expect(captured.length).toBeGreaterThan(0);
      }
    }
  );
});

describe.each(versions)('legacy fixture: $shapeId', (fixture) => {
  it('survives the full upgrade lifecycle', async () => {
    // 1. raw legacy bytes on disk
    await seed(fixture.source);

    // 2. hydrate into a fresh store
    const store = makeStore();
    expect(await hydrateStore(store)).toBe(true);

    // 3. exact expected state, INCLUDING Redux defaults for keys this shape
    //    never wrote (the settings block is the full post-hydrate state).
    expect(store.getState().paths.paths).toEqual(fixture.expected.paths);
    expect(store.getState().paths.dates).toEqual(fixture.expected.dates);
    expect(store.getState().settings).toEqual(fixture.expected.settings);

    // The font scale was realigned, so a size saved by an older
    // version can carry a label that now belongs to a different step. The label
    // may move; the SIZE must not — nobody's scripture changes size because we
    // renumbered a scale.
    const seededFontSize = JSON.parse(fixture.source.fontSize as string) as { number: number };
    expect(store.getState().settings.fontSize.number).toBe(seededFontSize.number);

    // 4. mutate and let the coordinator write through to legacy format
    const persistence = createLegacyPersistence(store);
    persistence.start();
    const nextLarivaar = !store.getState().settings.larivaar;
    store.dispatch(setLarivaar(nextLarivaar));
    const firstPathId = store.getState().paths.paths[0]?.pathId;
    if (firstPathId !== undefined) {
      store.dispatch(setScrollPosition({ pathId: firstPathId, scrollPosition: 987 }));
    }
    expect(await persistence.flush()).toBe(true);
    persistence.stop();

    // 5. rollback-readable: booleans stay raw "true"/"false" (an older binary
    //    reads `larivaar === 'true'`), JSON keys stay valid JSON.
    expect(await AsyncStorage.getItem('larivaar')).toBe(String(nextLarivaar));
    // Only the SIZE has to round-trip. The label on disk is deliberately left
    // as the older version wrote it: normalising happens on read, so a downgrade
    // still finds a value its own scale understands. Rewriting the label here
    // would hand an old binary a name that means a different size to it.
    expect(JSON.parse((await AsyncStorage.getItem('fontSize'))!).number).toBe(
      store.getState().settings.fontSize.number
    );

    // 6. a fresh boot from the just-written bytes reproduces the live store
    const fresh = makeStore();
    expect(await hydrateStore(fresh)).toBe(true);
    expect(fresh.getState().settings).toEqual(store.getState().settings);
    expect(fresh.getState().paths.paths).toEqual(store.getState().paths.paths);
    expect(fresh.getState().paths.dates).toEqual(store.getState().paths.dates);
  });
});
