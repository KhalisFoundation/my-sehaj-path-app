import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * What a delete leaves on disk, at each stage.
 *
 * "Deleted" means two different things to the two halves of this app, and the
 * gap between them is deliberate: the screen must forget the path immediately,
 * while storage must remember it until the server has been told. Getting that
 * backwards loses the deletion on every other device, so it is pinned here
 * against the real AsyncStorage keys rather than the store.
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

import { removePathAndSyncState, store } from '../../store';
import { hydrateStore } from '../../store/persistence';
import { persistence } from '../../store/instance';
import { createPath, deletePathCommand } from '../../store/commands';
import { setAll } from '../../store/slices/pathsSlice';
import { dropMeta } from '../../store/slices/syncSlice';
import { selectVisiblePaths } from '../../store/selectors';
import { setSignedIn, setSignedOut } from '../../store/slices/authSlice';

/** The three keys a path occupies, read back as raw bytes. */
const onDisk = async () => {
  const parse = (raw: string | null, fallback: string) => JSON.parse(raw ?? fallback);
  const sync = parse(await AsyncStorage.getItem('sehajSyncMeta_v1'), '{"meta":{}}');
  return {
    paths: parse(await AsyncStorage.getItem('pathDetails'), '[]').map(
      (path: { pathId: number }) => path.pathId
    ),
    dates: parse(await AsyncStorage.getItem('pathDateDetails'), '[]').map(
      (date: { pathid: number }) => date.pathid
    ),
    meta: Object.keys(sync.meta ?? {}).map(Number),
  };
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  store.dispatch(setAll({ paths: [], dates: [] }));
  await hydrateStore(store);
  store.dispatch(
    setSignedIn({ token: 'test-token', email: 'test@example.com', firstname: null, lastname: null })
  );
  persistence.start();
});

afterEach(() => persistence.stop());

describe('deleting a path the server knows about', () => {
  it('keeps the row on disk, tombstoned, until the server has been told', async () => {
    const id = await createPath();
    await persistence.flush();
    expect((await onDisk()).paths).toContain(id);

    expect(await deletePathCommand(id!)).toBe(true);
    await persistence.flush();

    // Still every byte of it. The outbox builds the DELETE request FROM this
    // row — it needs `meta.serverPathId` to name the path to the server — so
    // clearing it here would leave the coordinator with nothing to send, and it
    // would drop the queued delete as stale. The path would vanish from this
    // device and quietly survive on every other one.
    const afterDelete = await onDisk();
    expect(afterDelete.paths).toContain(id);
    expect(afterDelete.dates).toContain(id);
    expect(afterDelete.meta).toContain(id);
    expect(store.getState().sync.meta[id!]?.deletedAt).toBeGreaterThan(0);

    // Invisible everywhere regardless: the user asked for it gone, and offline
    // there is no confirmation coming.
    expect(selectVisiblePaths(store.getState()).some((path) => path.pathId === id)).toBe(false);
  });

  it('survives a restart with the deletion still owed to the server', async () => {
    // The tombstone is the only record that a delete is outstanding. Losing it
    // on a restart means the path returns from the cloud on the next pull.
    const id = await createPath();
    await deletePathCommand(id!);
    await persistence.flush();

    store.dispatch(setAll({ paths: [], dates: [] }));
    expect(await hydrateStore(store)).toBe(true);

    expect(store.getState().sync.meta[id!]?.deletedAt).toBeGreaterThan(0);
    expect(store.getState().sync.pathOps[id!]?.kind).toBe('delete');
    expect(selectVisiblePaths(store.getState()).some((path) => path.pathId === id)).toBe(false);
  });

  it('removes the durable local copy once the server confirms deletion', async () => {
    const id = await createPath();
    await deletePathCommand(id!);
    await persistence.flush();

    // What the outbox does on a 204 — or a 404, which means already gone.
    store.dispatch(removePathAndSyncState({ pathId: id! }));
    await persistence.flush();

    expect(await onDisk()).toEqual({ paths: [], dates: [], meta: [] });
    expect(selectVisiblePaths(store.getState())).toEqual([]);
  });
});

describe('deleting a path the server has never seen', () => {
  it('erases it immediately, because there is nothing to tell anyone', async () => {
    const id = await createPath();
    store.dispatch(dropMeta(id!));
    await persistence.flush();

    expect(await deletePathCommand(id!)).toBe(true);
    await persistence.flush();

    // No `serverPathId`, so no request to build and no reason to keep the row.
    expect(await onDisk()).toEqual({ paths: [], dates: [], meta: [] });
    expect(store.getState().sync.pathOps[id!]).toBeUndefined();
  });
});

describe('deleting while signed out', () => {
  it('permanently removes the path and its sync metadata from disk', async () => {
    store.dispatch(setSignedOut());
    const id = await createPath();
    await persistence.flush();

    expect(await deletePathCommand(id!)).toBe(true);
    await persistence.flush();

    expect(await onDisk()).toEqual({ paths: [], dates: [], meta: [] });
  });
});
