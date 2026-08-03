import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeStore } from '../../store';
import { resetSyncMetadataAndSync, runManualSync } from '../../store/manualSync';
import { setSignedIn } from '../../store/slices/authSlice';
import { addPath, setScrollPosition } from '../../store/slices/pathsSlice';
import { setOnline } from '../../store/slices/networkSlice';
import {
  ackServerPath,
  hydrateEmptySync,
  hydrateSyncRecovery,
  setAccount,
} from '../../store/slices/syncSlice';
import { SYNC_META_RECOVERY_KEY } from '../../store/syncFormat';
import { runConfirmedAccountSync } from '../../store/confirmedSync';
import { refreshPathsFromServer } from '../../store/applyServerResponse';
import { outbox, persistence } from '../../store/instance';

// These suites never call configureApiClient(), so treat the build as configured.
jest.mock('@api/config', () => ({ isApiConfigured: () => true }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  removeItem: jest.fn(),
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('../../store/confirmedSync', () => ({ runConfirmedAccountSync: jest.fn() }));
jest.mock('../../store/applyServerResponse', () => ({ refreshPathsFromServer: jest.fn() }));
jest.mock('../../store/instance', () => ({
  outbox: { flushNow: jest.fn() },
  persistence: { flush: jest.fn() },
}));

const mockConfirmed = runConfirmedAccountSync as jest.Mock;
const mockRefresh = refreshPathsFromServer as jest.Mock;
const mockFlush = outbox.flushNow as jest.Mock;
const mockPersist = persistence.flush as jest.Mock;
const mockRemove = AsyncStorage.removeItem as jest.Mock;
const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

/** A corrupt blob whose `meta` still holds a readable UUID for local path 1. */
const SALVAGEABLE_UUID = '11111111-2222-4333-8444-555555555555';
const CORRUPT_RAW = JSON.stringify({
  version: 99, // unsupported version → strict parse fails, but ids are readable
  meta: { 1: { serverPathId: SALVAGEABLE_UUID, garbage: true } },
});

const setup = () => {
  const store = makeStore();
  store.dispatch(hydrateEmptySync());
  store.dispatch(setSignedIn({ token: 'token', email: 'u@e.com', firstname: 'U', lastname: 'E' }));
  store.dispatch(setAccount('u@e.com'));
  return store;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFlush.mockResolvedValue(undefined);
  mockRefresh.mockResolvedValue(true);
  mockConfirmed.mockResolvedValue(true);
  mockPersist.mockResolvedValue(true);
  mockRemove.mockResolvedValue(undefined);
  // Default: the corrupt value reads back, and the backup copy verifies.
  mockGetItem.mockResolvedValue(CORRUPT_RAW);
  mockSetItem.mockResolvedValue(undefined);
});

describe('runManualSync', () => {
  it('flushes local work first, then refreshes paths and settings from the server', async () => {
    const store = setup();

    expect(await runManualSync(store, 'u@e.com')).toBe(true);
    expect(mockFlush).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledWith(store, undefined);
  });

  it('uses the confirmed flow when this device is not associated with the signed-in account', async () => {
    const store = setup();
    store.dispatch(setAccount(null));

    expect(await runManualSync(store, 'u@e.com')).toBe(true);
    expect(mockConfirmed).toHaveBeenCalledWith(store, 'u@e.com');
    expect(mockFlush).not.toHaveBeenCalled();
  });

  it('turns a dirty scroll position into an update before syncing it', async () => {
    const store = setup();
    store.dispatch(
      addPath({
        path: {
          pathId: 1,
          pathName: 'Morning',
          saveData: { angNumber: 1, verseId: 0 },
          progress: 0,
          startDate: '1-January-2026',
          completionDate: '',
        },
        date: { pathid: 1, dates: [], scrollPosition: 0 },
      })
    );
    // Pretend the earlier create was already acknowledged by the server.
    const sent = store.getState().sync.pathOps[1].localUpdatedAt;
    store.dispatch(ackServerPath({ pathId: 1, sentLocalUpdatedAt: sent, serverUpdatedAt: 10 }));
    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 400 }));

    expect(await runManualSync(store, 'u@e.com')).toBe(false);
    expect(store.getState().sync.pathOps[1]?.kind).toBe('update');
    expect(mockFlush).toHaveBeenCalledTimes(1);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('does not make a network call while offline or while metadata is in recovery', async () => {
    const offlineStore = setup();
    offlineStore.dispatch(setOnline(false));
    expect(await runManualSync(offlineStore, 'u@e.com')).toBe(false);

    const recoveryStore = setup();
    recoveryStore.dispatch(hydrateSyncRecovery());
    expect(await runManualSync(recoveryStore, 'u@e.com')).toBe(false);

    expect(mockFlush).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  const recoveringStore = () => {
    const store = setup();
    store.dispatch(
      addPath({
        path: {
          pathId: 1,
          pathName: 'Keep me',
          saveData: { angNumber: 1, verseId: 0 },
          progress: 0,
          startDate: '1-January-2026',
          completionDate: '',
        },
        date: { pathid: 1, dates: [], scrollPosition: 0 },
      })
    );
    store.dispatch(hydrateSyncRecovery());
    store.dispatch(
      setSignedIn({ token: 'token', email: 'u@e.com', firstname: 'U', lastname: 'E' })
    );
    return store;
  };

  it('backs up the corrupt value and reuses its UUIDs so the repair cannot duplicate cloud paths', async () => {
    const store = recoveringStore();

    expect(await resetSyncMetadataAndSync(store, 'u@e.com')).toBe(true);

    // The corrupt blob is preserved, never destroyed.
    expect(mockSetItem).toHaveBeenCalledWith(SYNC_META_RECOVERY_KEY, CORRUPT_RAW);
    // The readable id is re-attached rather than replaced with a fresh one.
    expect(store.getState().sync.meta[1].serverPathId).toBe(SALVAGEABLE_UUID);
    // Unknown server state → idempotent create, which answers 200 if it exists.
    expect(store.getState().sync.meta[1].onServer).toBe(false);
    expect(store.getState().sync.recoveryNeeded).toBe(false);
    expect(mockConfirmed).toHaveBeenCalledWith(store, 'u@e.com');
    expect(store.getState().paths.paths[0]?.pathName).toBe('Keep me');
  });

  it('refuses to repair metadata owned by a different signed-in account', async () => {
    const store = recoveringStore();
    const ownedByAnotherAccount = JSON.stringify({
      version: 99,
      account: 'a@e.com',
      meta: { 1: { serverPathId: SALVAGEABLE_UUID, garbage: true } },
    });
    mockGetItem.mockResolvedValue(ownedByAnotherAccount);

    expect(await resetSyncMetadataAndSync(store, 'u@e.com')).toBe(false);
    expect(store.getState().sync.recoveryNeeded).toBe(true);
    expect(mockSetItem).not.toHaveBeenCalled();
    expect(mockPersist).not.toHaveBeenCalled();
    expect(mockConfirmed).not.toHaveBeenCalled();
  });

  it('allows recovery when the stored owner differs only by email casing', async () => {
    const store = recoveringStore();
    const sameAccount = JSON.stringify({
      version: 99,
      account: ' U@E.COM ',
      meta: { 1: { serverPathId: SALVAGEABLE_UUID, garbage: true } },
    });
    mockGetItem.mockResolvedValue(sameAccount);

    expect(await resetSyncMetadataAndSync(store, 'u@e.com')).toBe(true);
    expect(store.getState().sync.meta[1].serverPathId).toBe(SALVAGEABLE_UUID);
    expect(mockConfirmed).toHaveBeenCalledWith(store, 'u@e.com');
  });

  it('aborts and stays in recovery when the corrupt value cannot be backed up', async () => {
    const store = recoveringStore();
    mockGetItem
      .mockResolvedValueOnce(CORRUPT_RAW) // read the corrupt value
      .mockResolvedValueOnce('truncated'); // backup verification mismatch

    expect(await resetSyncMetadataAndSync(store, 'u@e.com')).toBe(false);
    expect(store.getState().sync.recoveryNeeded).toBe(true);
    expect(mockConfirmed).not.toHaveBeenCalled();
  });

  it('stays in recovery when the repaired metadata cannot be persisted', async () => {
    const store = recoveringStore();
    mockPersist.mockResolvedValueOnce(false);

    expect(await resetSyncMetadataAndSync(store, 'u@e.com')).toBe(false);
    // Cloud sync must remain disabled — the rebuilt ids are not durable.
    expect(store.getState().sync.recoveryNeeded).toBe(true);
    expect(mockConfirmed).not.toHaveBeenCalled();
  });

  it('repairs with fresh ids when nothing is salvageable, leaving paths untouched', async () => {
    const store = recoveringStore();
    mockGetItem.mockResolvedValue('{not json at all');

    expect(await resetSyncMetadataAndSync(store, 'u@e.com')).toBe(true);
    // No mapping recovered → the confirmed sync mints one via backfill.
    expect(store.getState().sync.meta[1]).toBeUndefined();
    expect(store.getState().paths.paths[0]?.pathName).toBe('Keep me');
  });
});
