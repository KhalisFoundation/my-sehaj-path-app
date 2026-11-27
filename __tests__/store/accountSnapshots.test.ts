import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ACCOUNT_SNAPSHOTS_KEY,
  ACCOUNT_SNAPSHOTS_RECOVERY_KEY,
  readAccountSnapshot,
  removeAccountSnapshot,
  saveAccountSnapshot,
} from '../../store/accountSnapshots';
import type { Snapshot } from '../../store/legacyFormat';
import { SETTINGS_DEFAULTS } from '../../store/slices/settingsSlice';

jest.mock('../../utils/crashlytics', () => ({
  recordError: jest.fn(),
  logBreadcrumb: jest.fn(),
  allowCrashReporting: jest.fn(),
  testCrash: jest.fn(),
}));

const UUID = '11111111-2222-4333-8444-555555555555';

const snapshot = (): Snapshot => ({
  settings: { ...SETTINGS_DEFAULTS },
  paths: [
    {
      pathId: 1,
      saveData: { angNumber: 25, verseId: 4 },
      progress: 2,
      startDate: '1-January-2026',
      completionDate: '',
      pathName: 'Offline A',
    },
  ],
  dates: [{ pathid: 1, dates: [{ date: '1-January-2026' }], scrollPosition: 44 }],
  sync: {
    version: 1,
    account: 'a@example.com',
    lastSyncedAt: 10,
    meta: {
      1: {
        serverPathId: UUID,
        serverUpdatedAt: 10,
        localUpdatedAt: 20,
        startDate: 1,
        deletedAt: null,
        onServer: true,
      },
    },
    pathOps: { 1: { kind: 'update', localUpdatedAt: 20 } },
    scrollDirty: {},
    settingsUpdatedAt: 0,
    pendingSettingsUpdatedAt: null,
  },
});

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('account snapshots', () => {
  it('round-trips a verified account snapshot without exposing it as active data', async () => {
    expect(await saveAccountSnapshot('A@Example.com', snapshot())).toBe(true);

    const result = await readAccountSnapshot('a@example.com');
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.snapshot.paths[0].pathName).toBe('Offline A');
      expect(result.snapshot.dates[0].scrollPosition).toBe(44);
      expect(result.snapshot.sync.pathOps[1]?.kind).toBe('update');
    }
  });

  it('archives malformed account storage instead of destroying it or blocking forever', async () => {
    await AsyncStorage.setItem(ACCOUNT_SNAPSHOTS_KEY, '{not json');

    // The corrupt bag must never be silently lost...
    expect(await saveAccountSnapshot('a@example.com', snapshot())).toBe(true);
    expect(await AsyncStorage.getItem(ACCOUNT_SNAPSHOTS_RECOVERY_KEY)).toBe('{not json');

    // ...but the user must not be locked out of switching accounts by it either.
    const result = await readAccountSnapshot('a@example.com');
    expect(result.status).toBe('valid');
  });

  it('refuses to reset malformed storage when the archive cannot be written', async () => {
    await AsyncStorage.setItem(ACCOUNT_SNAPSHOTS_KEY, '{not json');
    // `mockImplementationOnce` self-reverts to the mock's real in-memory
    // implementation. Never `spyOn` async-storage here: its methods are already
    // jest.fn()s, so restoring strips the implementation for the whole file.
    (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(async () => undefined);

    expect(await saveAccountSnapshot('a@example.com', snapshot())).toBe(false);
    expect(await AsyncStorage.getItem(ACCOUNT_SNAPSHOTS_KEY)).toBe('{not json');
  });

  it('evicts an account snapshot once it is no longer the stashed copy', async () => {
    expect(await saveAccountSnapshot('a@example.com', snapshot())).toBe(true);
    expect((await readAccountSnapshot('a@example.com')).status).toBe('valid');

    await removeAccountSnapshot('a@example.com');
    expect(await readAccountSnapshot('a@example.com')).toEqual({ status: 'absent' });
  });
});
