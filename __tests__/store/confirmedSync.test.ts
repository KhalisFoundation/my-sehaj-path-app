import { sehajPathSyncControllerSync } from '@api/generated/sdk.gen';
import { clearCurrentToken } from '../../auth/tokenUtils';
import type { SehajPath } from '@api/generated/types.gen';
import { makeStore } from '../../store';
import {
  discardLocalDataAndSync,
  runConfirmedAccountSync,
  switchAccountData,
} from '../../store/confirmedSync';
import { readAccountSnapshot, saveAccountSnapshot } from '../../store/accountSnapshots';
import { captureDurableSnapshot, setQuarantinedRecords } from '../../store/persistence';
import { serializeKey } from '../../store/legacyFormat';
import { setSignedIn } from '../../store/slices/authSlice';
import { setOnline } from '../../store/slices/networkSlice';
import { setAll } from '../../store/slices/pathsSlice';
import { setLarivaar } from '../../store/slices/settingsSlice';
import {
  hydrateEmptySync,
  hydrateSyncRecovery,
  markPathEdited,
  setAccount,
  setLastSyncedAt,
  upsertMeta,
} from '../../store/slices/syncSlice';
import type { DateData, PathData } from '../../types';

const mockFlush = jest.fn();

// These suites never call configureApiClient(), so treat the build as configured.
jest.mock('@api/config', () => ({ isApiConfigured: () => true }));
jest.mock('@api/generated/sdk.gen', () => ({ sehajPathSyncControllerSync: jest.fn() }));
jest.mock('../../auth/tokenUtils', () => ({
  clearCurrentToken: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../store/instance', () => ({
  persistence: { flush: () => mockFlush() },
}));
jest.mock('../../store/accountSnapshots', () => ({
  saveAccountSnapshot: jest.fn(),
  readAccountSnapshot: jest.fn(),
  removeAccountSnapshot: jest.fn(),
}));
jest.mock('../../utils/crashlytics', () => ({
  recordError: jest.fn(),
  logBreadcrumb: jest.fn(),
  allowCrashReporting: jest.fn(),
  testCrash: jest.fn(),
}));

const mockSync = sehajPathSyncControllerSync as jest.Mock;
const mockClearToken = clearCurrentToken as jest.Mock;
const mockSaveAccount = saveAccountSnapshot as jest.Mock;
const mockReadAccount = readAccountSnapshot as jest.Mock;
const OTHER_UUID = '99999999-2222-4333-8444-555555555555';

const serverSehaj = (over: Partial<SehajPath>): SehajPath => ({
  angNumber: 0,
  verseId: 0,
  scrollPosition: 0,
  startDate: Date.UTC(2026, 0, 1),
  completionDate: null,
  createdAt: 0,
  updatedAt: 500,
  pathId: OTHER_UUID,
  name: 'Server',
  progress: 0,
  readDates: [],
  ...over,
});

const makePath = (pathId: number, pathName = `Path #${pathId}`): PathData => ({
  pathId,
  saveData: { angNumber: 0, verseId: 0 },
  progress: 1,
  startDate: '1-January-2026',
  completionDate: '',
  pathName,
});
const makeDate = (pathid: number): DateData => ({ pathid, dates: [], scrollPosition: 0 });

const setup = (paths: PathData[] = [], opts: { email?: string; account?: string | null } = {}) => {
  const { email = 'u@e.com', account = null } = opts;
  const store = makeStore();
  store.dispatch(hydrateEmptySync());
  store.dispatch(setAll({ paths, dates: paths.map((p) => makeDate(p.pathId)) }));
  store.dispatch(setSignedIn({ token: 't', email, firstname: 'U', lastname: 'X' }));
  if (account !== null) {
    store.dispatch(setAccount(account));
  }
  return store;
};

const syncOk = (paths: SehajPath[], settings: Record<string, unknown> | null = null) => ({
  data: {
    paths,
    deletedPathIds: [],
    settings: settings === null ? null : { settings },
    syncedAt: 999,
  },
  error: undefined,
  response: { status: 200 },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSync.mockResolvedValue(syncOk([]));
  mockFlush.mockResolvedValue(true);
  mockSaveAccount.mockResolvedValue(true);
  mockReadAccount.mockResolvedValue({ status: 'absent' });
});

describe('switchAccountData', () => {
  const setupUnsyncedA = () => {
    const store = setup([makePath(1, 'A progress')], {
      email: 'b@e.com',
      account: 'a@e.com',
    });
    store.dispatch(
      upsertMeta({
        pathId: 1,
        meta: { serverPathId: OTHER_UUID, startDate: 1, onServer: true },
      })
    );
    store.dispatch(markPathEdited({ pathId: 1, at: 100 }));
    return store;
  };

  it('keeps A hidden and safely stored when B chooses Keep for A', async () => {
    const store = setupUnsyncedA();

    expect(await switchAccountData(store, 'b@e.com', false)).toBe(true);

    expect(mockSaveAccount).toHaveBeenCalledWith(
      'a@e.com',
      expect.objectContaining({ paths: [expect.objectContaining({ pathName: 'A progress' })] })
    );
    expect(store.getState().sync.account).toBe('b@e.com');
    expect(store.getState().paths.paths).toEqual([]);
  });

  it('copies A progress into B, queues it, and does not copy A settings', async () => {
    const store = setupUnsyncedA();
    store.dispatch(setLarivaar(true));

    expect(await switchAccountData(store, 'b@e.com', true)).toBe(true);

    const state = store.getState();
    expect(state.sync.account).toBe('b@e.com');
    expect(state.paths.paths.map((path) => path.pathName)).toEqual(['A progress']);
    expect(state.sync.pathOps[1]?.kind).toBe('create');
    expect(state.settings.larivaar).toBe(false);
  });

  it("keeps B's further checkpoint when adding A progress for an existing UUID", async () => {
    const store = setupUnsyncedA();
    const bSnapshot = captureDurableSnapshot(store);
    const bPath = {
      ...makePath(8, 'B progress'),
      saveData: { angNumber: 200, verseId: 20 },
    };
    bSnapshot.paths = [bPath];
    bSnapshot.dates = [{ pathid: 8, dates: [{ date: '2026-01-01' }], scrollPosition: 900 }];
    bSnapshot.sync = {
      ...bSnapshot.sync,
      account: 'b@e.com',
      meta: {
        8: {
          serverPathId: OTHER_UUID,
          serverUpdatedAt: 10,
          localUpdatedAt: 10,
          startDate: 1,
          deletedAt: null,
          onServer: true,
        },
      },
      pathOps: {},
      scrollDirty: {},
    };
    mockReadAccount.mockResolvedValueOnce({ status: 'valid', snapshot: bSnapshot });

    expect(await switchAccountData(store, 'b@e.com', true)).toBe(true);

    const state = store.getState();
    expect(state.paths.paths).toEqual([expect.objectContaining({ pathName: 'B progress' })]);
    expect(state.paths.paths[0].saveData).toEqual({ angNumber: 200, verseId: 20 });
    expect(state.paths.dates[0]).toEqual(
      expect.objectContaining({ scrollPosition: 900, dates: [{ date: '2026-01-01' }] })
    );
    expect(state.sync.pathOps[8]?.kind).toBe('update');
  });

  it('does not change the active data when A cannot be stashed and verified', async () => {
    const store = setupUnsyncedA();
    mockSaveAccount.mockResolvedValueOnce(false);

    expect(await switchAccountData(store, 'b@e.com', false)).toBe(false);
    expect(store.getState().sync.account).toBe('a@e.com');
    expect(store.getState().paths.paths[0].pathName).toBe('A progress');
  });

  it('restores A when the active B snapshot cannot be persisted', async () => {
    const store = setupUnsyncedA();
    mockFlush
      .mockResolvedValueOnce(true) // A active state is durable
      .mockResolvedValueOnce(false) // B replacement fails
      .mockResolvedValueOnce(true); // A rollback is durable

    expect(await switchAccountData(store, 'b@e.com', false)).toBe(false);
    expect(store.getState().sync.account).toBe('a@e.com');
    expect(store.getState().paths.paths[0].pathName).toBe('A progress');
  });

  it('does not activate B if the user changes login while storage is being read', async () => {
    const store = setupUnsyncedA();
    mockReadAccount.mockImplementationOnce(async () => {
      store.dispatch(
        setSignedIn({ token: 'c-token', email: 'c@e.com', firstname: 'C', lastname: 'X' })
      );
      return { status: 'absent' };
    });

    expect(await switchAccountData(store, 'b@e.com', false)).toBe(false);
    expect(store.getState().sync.account).toBe('a@e.com');
    expect(store.getState().paths.paths[0].pathName).toBe('A progress');
  });

  it('restores A progress when A signs in again later', async () => {
    const store = setupUnsyncedA();
    expect(await switchAccountData(store, 'b@e.com', false)).toBe(true);
    const savedA = mockSaveAccount.mock.calls[0][1];

    store.dispatch(
      setSignedIn({ token: 'a-token', email: 'a@e.com', firstname: 'A', lastname: 'X' })
    );
    mockReadAccount.mockResolvedValueOnce({ status: 'valid', snapshot: savedA });

    expect(await switchAccountData(store, 'a@e.com', false)).toBe(true);
    expect(store.getState().sync.account).toBe('a@e.com');
    expect(store.getState().paths.paths[0].pathName).toBe('A progress');
    expect(store.getState().sync.pathOps[1]).toBeDefined();
  });
});

describe('runConfirmedAccountSync', () => {
  it('case A: claims local paths, marks them on-server, and associates the account', async () => {
    const store = setup([makePath(1, 'Morning')]);
    // The server echoes the claim (first sync creates them, returns the set).
    mockSync.mockImplementationOnce(async ({ body }) =>
      syncOk(body.paths.map((p: { pathId: string; name: string }) => serverSehaj(p)))
    );

    expect(await runConfirmedAccountSync(store, 'u@e.com')).toBe(true);
    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(store.getState().sync.account).toBe('u@e.com');
    const meta = store.getState().sync.meta[1];
    expect(meta.serverPathId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(meta.onServer).toBe(true);
    expect(store.getState().sync.lastSyncedAt).toBe(999);
  });

  it('case B: downloads cloud paths to a fresh device and associates the account', async () => {
    const store = setup([]); // no local paths
    mockSync.mockResolvedValueOnce(
      syncOk([serverSehaj({ pathId: OTHER_UUID, name: 'Cloud path' })])
    );

    expect(await runConfirmedAccountSync(store, 'u@e.com')).toBe(true);
    expect(store.getState().sync.account).toBe('u@e.com');
    expect(store.getState().paths.paths.find((p) => p.pathName === 'Cloud path')).toBeDefined();
  });

  it('uses cloud data only after explicit choice and restores local data if download fails', async () => {
    const store = setup([makePath(1, 'Local only')]);
    setQuarantinedRecords(store, { paths: [{ pathId: 99, junk: true }], dates: [] });
    mockSync.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'offline' },
      response: { status: 500 },
    });

    expect(await discardLocalDataAndSync(store, 'u@e.com')).toBe(false);
    expect(store.getState().paths.paths.map((path) => path.pathName)).toEqual(['Local only']);
    expect(store.getState().sync.account).toBeNull();
    expect(serializeKey('pathDetails', captureDurableSnapshot(store))).toContain('99');
  });

  it('does not upload settings on login, but applies the account settings returned by the server', async () => {
    const store = setup([makePath(1)]);
    mockSync.mockImplementationOnce(async ({ body }) => {
      expect(body.settings).toBeUndefined();
      return syncOk([], { larivaar: true, paragraphMode: true });
    });

    expect(await runConfirmedAccountSync(store, 'u@e.com')).toBe(true);
    expect(store.getState().settings.larivaar).toBe(true);
    expect(store.getState().settings.paragraphMode).toBe(true);
    expect(store.getState().sync.pendingSettingsUpdatedAt).toBeNull();
  });

  it('does not upload pre-login settings and replaces them with the account settings', async () => {
    const store = setup([makePath(1)]);
    store.dispatch(setLarivaar(true));
    mockSync.mockImplementationOnce(async ({ body }) => {
      expect(body.settings).toBeUndefined();
      return syncOk([], { larivaar: false });
    });

    expect(await runConfirmedAccountSync(store, 'u@e.com')).toBe(true);
    expect(store.getState().settings.larivaar).toBe(false);
    expect(store.getState().sync.pendingSettingsUpdatedAt).toBeNull();
  });

  it('ignores a completed sync response after the user changed account', async () => {
    const store = setup([makePath(1)]);
    mockSync.mockImplementationOnce(async () => {
      store.dispatch(
        setSignedIn({ token: 'b-token', email: 'b@e.com', firstname: 'B', lastname: 'Y' })
      );
      return syncOk([serverSehaj({ name: 'A cloud path' })]);
    });

    expect(await runConfirmedAccountSync(store, 'u@e.com')).toBe(false);
    expect(store.getState().sync.account).toBeNull();
    expect(
      store.getState().paths.paths.find((path) => path.pathName === 'A cloud path')
    ).toBeUndefined();
  });

  it('case C: an already-associated account resumes with no /sync call', async () => {
    const store = setup([], { account: 'u@e.com' });
    expect(await runConfirmedAccountSync(store, 'u@e.com')).toBe(true);
    expect(mockSync).not.toHaveBeenCalled();
    expect(store.getState().sync.account).toBe('u@e.com');
  });

  it('case D: replaces a fully-synced old account before downloading the new account', async () => {
    const store = setup([makePath(1, 'A path')], { account: 'other@e.com' });
    // This fixture is fully synced: no pending operation survives.
    store.dispatch(
      upsertMeta({
        pathId: 1,
        meta: {
          serverPathId: OTHER_UUID,
          serverUpdatedAt: 10,
          localUpdatedAt: 10,
          startDate: 1,
          deletedAt: null,
          onServer: true,
        },
      })
    );
    store.dispatch(setLastSyncedAt(10));
    mockSync.mockResolvedValueOnce(syncOk([serverSehaj({ name: 'B cloud path' })]));

    expect(await runConfirmedAccountSync(store, 'u@e.com')).toBe(true);
    expect(store.getState().sync.account).toBe('u@e.com');
    expect(store.getState().paths.paths.map((path) => path.pathName)).toEqual(['B cloud path']);
    expect(mockFlush).toHaveBeenCalled(); // clear A was made durable before B sync
  });

  it('case D: restores the cleared account when the new download fails (never an empty app)', async () => {
    const store = setup([makePath(1, 'A path')], { account: 'other@e.com' });
    store.dispatch(
      upsertMeta({
        pathId: 1,
        meta: {
          serverPathId: OTHER_UUID,
          serverUpdatedAt: 10,
          localUpdatedAt: 10,
          startDate: 1,
          deletedAt: null,
          onServer: true,
        },
      })
    );
    store.dispatch(setLastSyncedAt(10));
    // A is cleared, then the network drops before B's data arrives.
    mockSync.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'offline' },
      response: { status: 500 },
    });

    expect(await runConfirmedAccountSync(store, 'u@e.com')).toBe(false);

    // The reader must not be left staring at an empty app.
    expect(store.getState().paths.paths.map((path) => path.pathName)).toEqual(['A path']);
    expect(store.getState().sync.account).toBe('other@e.com');
  });

  it('case D: does not carry the old account quarantined records into the new one', async () => {
    const store = setup([makePath(1, 'A path')], { account: 'other@e.com' });
    store.dispatch(
      upsertMeta({
        pathId: 1,
        meta: {
          serverPathId: OTHER_UUID,
          serverUpdatedAt: 10,
          localUpdatedAt: 10,
          startDate: 1,
          deletedAt: null,
          onServer: true,
        },
      })
    );
    store.dispatch(setLastSyncedAt(10));
    // A had a malformed legacy record preserved outside Redux. It is appended to
    // `pathDetails` on every write, so it must not survive into B's dataset.
    setQuarantinedRecords(store, { paths: [{ pathId: 99, junk: true }], dates: [] });
    mockSync.mockResolvedValueOnce(syncOk([serverSehaj({ name: 'B cloud path' })]));

    expect(await runConfirmedAccountSync(store, 'u@e.com')).toBe(true);

    const written = serializeKey('pathDetails', captureDurableSnapshot(store));
    expect(written).not.toContain('99');
  });

  it('case D: keeps the old account untouched when it has unsynced work', async () => {
    const store = setup([makePath(1, 'A path')], { account: 'other@e.com' });
    store.dispatch(
      upsertMeta({
        pathId: 1,
        meta: { serverPathId: OTHER_UUID, startDate: 1, onServer: true },
      })
    );
    store.dispatch(markPathEdited({ pathId: 1, at: Date.now() }));

    expect(await runConfirmedAccountSync(store, 'u@e.com')).toBe(false);
    expect(mockSync).not.toHaveBeenCalled();
    expect(store.getState().sync.account).toBe('other@e.com');
    expect(store.getState().paths.paths[0].pathName).toBe('A path');
  });

  it('case D: does not clear data whose backup status cannot be verified', async () => {
    const store = setup([makePath(1, 'A path')], { account: 'other@e.com' });

    expect(await runConfirmedAccountSync(store, 'u@e.com')).toBe(false);
    expect(mockSync).not.toHaveBeenCalled();
    expect(store.getState().sync.account).toBe('other@e.com');
    expect(store.getState().paths.paths[0].pathName).toBe('A path');
  });

  it('does nothing while offline', async () => {
    const store = setup([makePath(1)]);
    store.dispatch(setOnline(false));
    expect(await runConfirmedAccountSync(store, 'u@e.com')).toBe(false);
    expect(mockSync).not.toHaveBeenCalled();
    expect(store.getState().sync.account).toBeNull();
  });

  it('refuses when the requested email is not the signed-in email', async () => {
    const store = setup([makePath(1)], { email: 'u@e.com' });
    expect(await runConfirmedAccountSync(store, 'someone-else@e.com')).toBe(false);
    expect(mockSync).not.toHaveBeenCalled();
  });

  it('refuses while sync metadata is in recovery', async () => {
    const store = setup([makePath(1)]);
    store.dispatch(hydrateSyncRecovery()); // recoveryNeeded = true
    expect(await runConfirmedAccountSync(store, 'u@e.com')).toBe(false);
    expect(mockSync).not.toHaveBeenCalled();
  });

  it('persists the minted UUIDs to disk BEFORE calling /sync', async () => {
    const store = setup([makePath(1)]);
    const order: string[] = [];
    mockFlush.mockImplementation(async () => {
      order.push('flush');
      return true;
    });
    mockSync.mockImplementationOnce(async () => {
      order.push('sync');
      return syncOk([]);
    });

    await runConfirmedAccountSync(store, 'u@e.com');

    // flush (UUIDs durable) → sync → flush (account association durable)
    expect(order).toEqual(['flush', 'sync', 'flush']);
  });

  it('never calls /sync when the UUIDs could not be persisted', async () => {
    const store = setup([makePath(1)]);
    mockFlush.mockResolvedValueOnce(false); // pre-sync flush fails

    expect(await runConfirmedAccountSync(store, 'u@e.com')).toBe(false);
    expect(mockSync).not.toHaveBeenCalled();
    expect(store.getState().sync.account).toBeNull();
  });

  it('does not call /sync when the user logs out while UUID metadata is being persisted', async () => {
    const store = setup([makePath(1)]);
    mockFlush.mockImplementationOnce(async () => {
      store.dispatch(
        setSignedIn({ token: 'new-token', email: 'other@e.com', firstname: 'O', lastname: 'E' })
      );
      return true;
    });

    expect(await runConfirmedAccountSync(store, 'u@e.com')).toBe(false);
    expect(mockSync).not.toHaveBeenCalled();
  });

  it('does not report success when the account association could not be persisted', async () => {
    const store = setup([makePath(1)]);
    mockFlush
      .mockResolvedValueOnce(true) // UUIDs persisted
      .mockResolvedValueOnce(false); // account association failed

    expect(await runConfirmedAccountSync(store, 'u@e.com')).toBe(false);
    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(store.getState().sync.account).toBeNull();
  });

  it('reuses the same UUIDs on a retry (no duplicate server paths)', async () => {
    const store = setup([makePath(1)]);
    mockSync.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'x' },
      response: { status: 500 },
    });
    await runConfirmedAccountSync(store, 'u@e.com'); // fails
    const firstUuid = store.getState().sync.meta[1].serverPathId;

    await runConfirmedAccountSync(store, 'u@e.com'); // retry
    expect(store.getState().sync.meta[1].serverPathId).toBe(firstUuid);
  });

  it('leaves the account unchanged when the /sync call fails', async () => {
    const store = setup([makePath(1)]);
    mockSync.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'x' },
      response: { status: 500 },
    });
    expect(await runConfirmedAccountSync(store, 'u@e.com')).toBe(false);
    expect(store.getState().sync.account).toBeNull();
  });

  it('signs out when the confirmed /sync request receives a 401', async () => {
    const store = setup([makePath(1)]);
    mockSync.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'expired' },
      response: { status: 401 },
    });

    expect(await runConfirmedAccountSync(store, 'u@e.com')).toBe(false);
    expect(store.getState().auth.status).toBe('signedOut');
    expect(mockClearToken).toHaveBeenCalledTimes(1);
  });
});
