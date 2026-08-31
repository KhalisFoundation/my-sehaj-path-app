jest.mock('../../utils/crashlytics', () => ({ recordError: jest.fn() }));
jest.mock('../../utils/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('../../db/connection', () => ({ getBani: jest.fn(), resetBani: jest.fn() }));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn() },
}));
jest.mock('../../db/downloadDatabase', () => ({
  downloadDatabase: jest.fn(),
  isDatabaseDownloadBlockedByStorage: jest.fn(() => Promise.resolve(false)),
  isDatabaseDownloadInProgress: jest.fn(() => false),
  isDatabaseInstalled: jest.fn(),
  performDatabaseUpdate: jest.fn(),
}));

import { provisionDatabase, runDatabaseUpdate } from '../../db/provisionDatabase';
import {
  downloadDatabase,
  isDatabaseDownloadBlockedByStorage,
  isDatabaseDownloadInProgress,
  isDatabaseInstalled,
  performDatabaseUpdate,
} from '../../db/downloadDatabase';
import { recordError } from '../../utils/crashlytics';
import { trackEvent } from '../../utils/analytics';
import { store } from '../../store';
import { dbDownloadStarted } from '../../store/slices/dbSlice';
import { setOnline } from '../../store/slices/networkSlice';
import NetInfo from '@react-native-community/netinfo';

const mockedInstalled = isDatabaseInstalled as jest.Mock;
const mockedDownload = downloadDatabase as jest.Mock;
const mockedStorageBlocked = isDatabaseDownloadBlockedByStorage as jest.Mock;
const mockedInProgress = isDatabaseDownloadInProgress as jest.Mock;
const mockedPerformUpdate = performDatabaseUpdate as jest.Mock;
const mockedNetInfoFetch = NetInfo.fetch as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedInstalled.mockResolvedValue(false);
  mockedStorageBlocked.mockResolvedValue(false);
  mockedInProgress.mockReturnValue(false);
  mockedDownload.mockResolvedValue({ status: 'downloaded' });
  mockedPerformUpdate.mockResolvedValue({ status: 'updated' });
  store.dispatch(setOnline(true));
  // Default: the live check agrees with the store.
  mockedNetInfoFetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
});

describe('provisionDatabase', () => {
  it('marks the DB ready and records the success once a download lands', async () => {
    await provisionDatabase();

    expect(store.getState().db.status).toBe('ready');
    expect(trackEvent).toHaveBeenCalledWith(
      'DatabaseDownload',
      'success',
      'offline database installed'
    );
  });

  it('records a throw in Crashlytics — nothing downstream can report it', async () => {
    // Called fire-and-forget from App.tsx, so a throw here used to vanish
    // entirely and just left the app silently on the API.
    const error = new Error('filesystem unavailable');
    mockedInstalled.mockRejectedValue(error);

    await expect(provisionDatabase()).resolves.toBeUndefined();

    expect(recordError).toHaveBeenCalledWith(error, 'db: provisioning the offline database failed');
    expect(store.getState().db.status).toBe('failed');
  });

  it('does not double-report a failed download — downloadDatabase already did', async () => {
    mockedDownload.mockResolvedValue({ status: 'failed', reason: 'HTTP 403' });

    await provisionDatabase();

    expect(recordError).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
    expect(store.getState().db.status).toBe('failed');
  });

  it('does not automatically retry while the persistent storage block is set', async () => {
    mockedStorageBlocked.mockResolvedValue(true);

    await provisionDatabase();

    expect(mockedDownload).not.toHaveBeenCalled();
    expect(store.getState().db.status).toBe('failed');
  });

  it('does not start a foreground provisioning attempt while offline', async () => {
    store.dispatch(setOnline(false));

    await provisionDatabase();

    expect(mockedDownload).not.toHaveBeenCalled();
    expect(recordError).not.toHaveBeenCalled();
  });

  it('does not mark an installed old DB ready while a manual update is active', async () => {
    let finish!: (result: { status: 'failed'; reason: string }) => void;
    mockedInProgress.mockReturnValue(true);
    mockedInstalled.mockResolvedValue(true);
    mockedDownload.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    store.dispatch(dbDownloadStarted());

    const pending = provisionDatabase();
    await Promise.resolve();
    expect(store.getState().db.status).not.toBe('ready');

    finish({ status: 'failed', reason: 'connection lost' });
    await pending;
    expect(mockedInstalled).toHaveBeenCalledTimes(1);
  });

  it('retries after reconnect when the old active request fails after the online edge', async () => {
    mockedInProgress.mockReturnValueOnce(true).mockReturnValue(false);
    mockedDownload
      .mockResolvedValueOnce({ status: 'failed', reason: 'Unable to resolve host' })
      .mockResolvedValueOnce({ status: 'downloaded' });

    await provisionDatabase();

    expect(mockedDownload).toHaveBeenCalledTimes(2);
    expect(store.getState().db.status).toBe('ready');
  });

  it('does not burn a second attempt when the connection dropped mid-download', async () => {
    // Device report, 2.0.1: two failures logged in the SAME second, every time —
    // "connection interrupted" then "network unavailable". Each line is one
    // attempt, so a single dropped connection was reported to Crashlytics twice.
    //
    // The store's `isOnline` is a cached NetInfo reading, and it is wrong at
    // exactly the moment this decision is made: the connection has just gone,
    // the in-flight download is failing because of it, and the listener has not
    // delivered the false edge yet. The retry then starts against a dead
    // connection and cannot possibly succeed.
    mockedInProgress.mockReturnValueOnce(true).mockReturnValue(false);
    store.dispatch(setOnline(true)); // stale — the drop has not propagated
    mockedNetInfoFetch.mockResolvedValue({ isConnected: false, isInternetReachable: false });
    mockedDownload.mockResolvedValue({
      status: 'failed',
      reason: 'unexpected end of stream',
    });

    await provisionDatabase();

    expect(mockedDownload).toHaveBeenCalledTimes(1);
  });

  it('still retries when reachability is not yet known after a reconnect', async () => {
    // `isInternetReachable` is null while the probe is still running, which is
    // normal in the first moments after reconnecting — exactly when this retry
    // exists to fire. Reading unknown as offline would suppress it.
    mockedInProgress.mockReturnValueOnce(true).mockReturnValue(false);
    mockedNetInfoFetch.mockResolvedValue({ isConnected: true, isInternetReachable: null });
    mockedDownload
      .mockResolvedValueOnce({ status: 'failed', reason: 'Unable to resolve host' })
      .mockResolvedValueOnce({ status: 'downloaded' });

    await provisionDatabase();

    expect(mockedDownload).toHaveBeenCalledTimes(2);
    expect(store.getState().db.status).toBe('ready');
  });

  it('falls back to the store when the live network check throws', async () => {
    // A NetInfo failure must never be able to stop provisioning altogether.
    mockedInProgress.mockReturnValueOnce(true).mockReturnValue(false);
    mockedNetInfoFetch.mockRejectedValue(new Error('netinfo unavailable'));
    mockedDownload
      .mockResolvedValueOnce({ status: 'failed', reason: 'Unable to resolve host' })
      .mockResolvedValueOnce({ status: 'downloaded' });

    await provisionDatabase();

    expect(mockedDownload).toHaveBeenCalledTimes(2);
  });

  it('does not restart a joined request while the device is still offline', async () => {
    store.dispatch(setOnline(false));
    mockedInProgress.mockReturnValue(true);
    mockedDownload.mockResolvedValue({ status: 'failed', reason: 'Unable to resolve host' });

    await provisionDatabase();

    expect(mockedDownload).toHaveBeenCalledTimes(1);
  });
});

describe('runDatabaseUpdate', () => {
  it('records a manual update success separately from a first install', async () => {
    // Without its own event the manual update had no success signal, leaving
    // its Crashlytics failures with no denominator. It must stay distinct from
    // the first-install event so the two rates can be read apart.
    await expect(runDatabaseUpdate()).resolves.toEqual({ status: 'updated' });

    expect(trackEvent).toHaveBeenCalledWith(
      'DatabaseUpdate',
      'success',
      'offline database updated'
    );
    expect(trackEvent).not.toHaveBeenCalledWith(
      'DatabaseDownload',
      'success',
      'offline database installed'
    );
    expect(store.getState().db.status).toBe('ready');
  });

  it('records a throw with its original stack intact', async () => {
    // The screen rebuilds a message-only Error from the returned reason, so the
    // real stack only exists here.
    const error = new Error('native module crashed');
    mockedPerformUpdate.mockRejectedValue(error);

    await expect(runDatabaseUpdate()).resolves.toEqual({
      status: 'failed',
      reason: 'native module crashed',
    });
    expect(recordError).toHaveBeenCalledWith(error, 'db: the update run threw');
  });

  it('keeps the previous DB usable when an update fails', async () => {
    mockedPerformUpdate.mockResolvedValue({ status: 'failed', reason: 'HTTP 500' });
    mockedInstalled.mockResolvedValue(true); // the old file was never swapped out

    await runDatabaseUpdate();

    expect(store.getState().db.status).toBe('ready');
  });
});
