jest.mock('@constants', () => ({
  ...jest.requireActual('@constants'),
  SEHAJ_DB_REMOTE_URL: 'https://example.test/banidb-sehajpath.db',
  SEHAJ_DB_MD5_URL: 'https://example.test/banidb-sehajpath.db.md5',
  DB_FILE_NAME: 'banidb-sehajpath.db',
}));
jest.mock('../../utils/crashlytics', () => ({ recordError: jest.fn() }));
jest.mock('../../db/connection', () => ({
  getBani: jest.fn(),
  resetBani: jest.fn(),
}));

import * as RNFS from '@dr.pogodin/react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  downloadDatabase,
  checkForDatabaseUpdate,
  isDatabaseDownloadInProgress,
  performDatabaseUpdate,
} from '../../db/downloadDatabase';
import { getBani } from '../../db/connection';
import { recordError } from '../../utils/crashlytics';

/** Stubs the published `.md5` endpoint the download verification fetches. */
const mockFetchChecksum = (digest: string | null) => {
  globalThis.fetch = jest.fn(() =>
    digest === null
      ? Promise.reject(new Error('offline'))
      : Promise.resolve({ ok: true, text: () => Promise.resolve(`${digest}\n`) })
  ) as unknown as typeof fetch;
};

const exists = RNFS.exists as jest.Mock;
const read = RNFS.read as jest.Mock;
const moveFile = RNFS.moveFile as jest.Mock;
const downloadFile = RNFS.downloadFile as jest.Mock;
const hash = RNFS.hash as jest.Mock;
const stat = RNFS.stat as jest.Mock;
const mockedGetBani = getBani as jest.Mock;
const mockedCheckForUpdate = jest.fn();

const drainMicrotasks = async () => {
  for (let i = 0; i < 20; i += 1) {
    await Promise.resolve();
  }
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  exists.mockImplementation(
    async (path: string) => path === '/mock/Documents/banidb-sehajpath.db.download'
  );
  stat.mockResolvedValue({ size: 100 });
  read.mockResolvedValue('SQLite format 3'); // valid SQLite magic header
  (RNFS.unlink as jest.Mock).mockResolvedValue(undefined);
  moveFile.mockResolvedValue(undefined);
  hash.mockResolvedValue('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  // The install is gated on the downloaded file's digest matching the published
  // one, so the happy path needs both to agree.
  mockFetchChecksum('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  downloadFile.mockImplementation(
    (opts: {
      begin: (value: {
        statusCode: number;
        contentLength: number;
        headers: Record<string, string>;
      }) => void;
    }) => {
      opts.begin?.({ statusCode: 200, contentLength: 100, headers: { ETag: 'version-1' } });
      return {
        jobId: 1,
        promise: Promise.resolve({ statusCode: 200, bytesWritten: 100 }),
      };
    }
  );
  mockedGetBani.mockResolvedValue({ checkForUpdate: mockedCheckForUpdate });
  mockedCheckForUpdate.mockResolvedValue(false);
});

describe('downloadDatabase', () => {
  it('does nothing when the DB is already present', async () => {
    exists.mockResolvedValue(true);
    expect(await downloadDatabase()).toEqual({ status: 'already-present' });
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it('downloads, verifies the SQLite header, and atomically swaps it in', async () => {
    const result = await downloadDatabase();
    expect(result).toEqual({ status: 'downloaded' });
    expect(downloadFile).toHaveBeenCalledTimes(1);
    expect(downloadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionTimeout: 15_000,
        readTimeout: 60_000,
      })
    );
    expect(moveFile).toHaveBeenCalledTimes(1); // the temp -> live swap
  });

  it('fails on a non-200 response, does NOT swap, and reports it', async () => {
    downloadFile.mockReturnValue({ jobId: 1, promise: Promise.resolve({ statusCode: 500 }) });
    const result = await downloadDatabase();
    expect(result).toEqual({ status: 'failed', reason: 'HTTP 500' });
    expect(moveFile).not.toHaveBeenCalled();
    // The transfer completed without throwing, so the catch never sees this.
    expect(recordError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'HTTP 500' }),
      'db: database download rejected by host',
      { db_failure_kind: 'rejected-by-host' }
    );
  });

  it('rejects a non-SQLite payload (e.g. an HTML error page), does NOT swap, and reports it', async () => {
    read.mockResolvedValue('<!DOCTYPE html>');
    const result = await downloadDatabase();
    expect(result.status).toBe('failed');
    expect(moveFile).not.toHaveBeenCalled();
    expect(recordError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'downloaded file is not a valid SQLite database' }),
      'db: downloaded database failed verification - invalid-file',
      { db_failure_kind: 'invalid-file' }
    );
  });

  it('classifies a timed-out connection in Crashlytics', async () => {
    const error = new Error('network connection timed out');
    downloadFile.mockReturnValue({ jobId: 1, promise: Promise.reject(error) });

    await expect(downloadDatabase()).resolves.toEqual({
      status: 'failed',
      reason: error.message,
    });
    expect(recordError).toHaveBeenCalledWith(
      error,
      'db: database download failed - network timeout or stalled',
      { db_failure_kind: 'network-timeout' }
    );
  });

  it.each([
    new Error('write failed: ENOSPC (No space left on device)'),
    Object.assign(new Error('The file could not be saved'), {
      code: 'NSFileWriteOutOfSpaceError',
    }),
  ])('classifies an insufficient-storage download failure in Crashlytics', async (error) => {
    downloadFile.mockReturnValue({ jobId: 1, promise: Promise.reject(error) });

    await expect(downloadDatabase()).resolves.toEqual({ status: 'insufficient-storage' });
    expect(recordError).toHaveBeenCalledWith(
      error,
      'db: database download failed - insufficient storage',
      { db_failure_kind: 'insufficient-storage' }
    );
  });

  it('starts the first automatic download without a storage preflight', async () => {
    await expect(downloadDatabase()).resolves.toEqual({ status: 'downloaded' });
    expect(downloadFile).toHaveBeenCalledTimes(1);
  });

  it('blocks later automatic retries after native returns a real storage error', async () => {
    downloadFile.mockReturnValueOnce({
      jobId: 1,
      promise: Promise.reject(new Error('write failed: ENOSPC (No space left on device)')),
    });

    await expect(downloadDatabase()).resolves.toEqual({ status: 'insufficient-storage' });
    expect(downloadFile).toHaveBeenCalledTimes(1);

    // Foreground/reconnect provisioning calls do not even recheck storage. Only
    // an explicit user action may bypass the persisted block.
    await expect(downloadDatabase()).resolves.toEqual({ status: 'insufficient-storage' });
    expect(downloadFile).toHaveBeenCalledTimes(1);
  });

  it('tries again on an explicit click and restores the block if native still reports low space', async () => {
    // Establish the persisted block from the one automatic attempt.
    downloadFile.mockReturnValueOnce({
      jobId: 1,
      promise: Promise.reject(new Error('write failed: ENOSPC (No space left on device)')),
    });
    await downloadDatabase();

    downloadFile.mockReturnValueOnce({
      jobId: 2,
      promise: Promise.reject(new Error('write failed: ENOSPC (No space left on device)')),
    });
    await expect(performDatabaseUpdate()).resolves.toEqual({ status: 'insufficient-storage' });
    expect(downloadFile).toHaveBeenCalledTimes(2);

    // The failed explicit attempt restored the persisted block.
    await expect(downloadDatabase()).resolves.toEqual({ status: 'insufficient-storage' });
    expect(downloadFile).toHaveBeenCalledTimes(2);
  });

  it('lets an explicit update retry recheck storage and clears the block when space is sufficient', async () => {
    downloadFile.mockReturnValueOnce({
      jobId: 1,
      promise: Promise.reject(new Error('write failed: ENOSPC (No space left on device)')),
    });
    await downloadDatabase();

    downloadFile.mockImplementation((opts: { begin: (value: unknown) => void }) => {
      opts.begin?.({ statusCode: 200, contentLength: 100, headers: { ETag: 'version-1' } });
      return { jobId: 2, promise: Promise.resolve({ statusCode: 200, bytesWritten: 100 }) };
    });
    await expect(performDatabaseUpdate()).resolves.toEqual({ status: 'updated' });
    expect(downloadFile).toHaveBeenCalledTimes(2);

    // A later automatic attempt is allowed again because the manual retry
    // cleared the persistent block.
    await expect(downloadDatabase()).resolves.toEqual({ status: 'downloaded' });
    expect(downloadFile).toHaveBeenCalledTimes(3);
  });

  it.each([
    {
      error: new Error('Unable to resolve host: No address associated with hostname'),
      context: 'db: database download failed - network unavailable',
      kind: 'network-unavailable',
    },
    {
      error: new Error('Software caused connection abort'),
      context: 'db: database download failed - connection interrupted',
      kind: 'connection-interrupted',
    },
    {
      error: new Error('native downloader failed'),
      context: 'db: database download failed',
      kind: 'other',
    },
  ])('classifies $context in Crashlytics', async ({ error, context, kind }) => {
    downloadFile.mockReturnValue({ jobId: 1, promise: Promise.reject(error) });

    await expect(downloadDatabase()).resolves.toEqual({
      status: 'failed',
      reason: error.message,
    });
    // The context is only a breadcrumb; the custom key is what actually splits
    // these apart when filtering in Crashlytics.
    expect(recordError).toHaveBeenCalledWith(error, context, { db_failure_kind: kind });
  });

  it('a dead transfer releases the lock, and the next attempt downloads it in full again', async () => {
    // The whole point of dropping resume: an interrupted download is discarded
    // and the next attempt fetches the file from scratch.
    let call = 0;
    downloadFile.mockImplementation((opts: { begin?: (v: unknown) => void }) => {
      call += 1;
      opts.begin?.({ statusCode: 200, contentLength: 100, headers: {} });
      if (call === 1) {
        // Native never settles — exactly how iOS behaves on a dropped connection.
        return { jobId: 77, promise: new Promise(() => undefined) };
      }
      return { jobId: 78, promise: Promise.resolve({ statusCode: 200 }) };
    });

    jest.useFakeTimers();
    const interrupted = downloadDatabase();
    // The transfer goes silent; the idle watchdog plus its cancel grace is what
    // ends it, since iOS reports the dropped connection to nobody.
    await jest.runOnlyPendingTimersAsync();
    await jest.runOnlyPendingTimersAsync();

    await expect(interrupted).resolves.toEqual({
      status: 'failed',
      reason: 'database download timed out',
    });
    // The lock must be released, or the reconnect below is ignored.
    expect(isDatabaseDownloadInProgress()).toBe(false);
    // The partial is discarded: there is nothing to resume from.
    expect(RNFS.unlink).toHaveBeenCalledWith('/mock/Documents/banidb-sehajpath.db.download');

    // Back online: a complete, fresh download.
    await expect(downloadDatabase()).resolves.toEqual({ status: 'downloaded' });
    expect(downloadFile).toHaveBeenCalledTimes(2);
    expect(moveFile).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('refuses to install a truncated download whose digest does not match', async () => {
    // A file truncated at 40MB of 181MB still starts with "SQLite format 3", so
    // the header check passes it. Only the digest catches this.
    hash.mockResolvedValue('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');

    await expect(downloadDatabase()).resolves.toEqual({
      status: 'failed',
      reason: 'downloaded database is incomplete or corrupted',
    });
    expect(moveFile).not.toHaveBeenCalled();
    expect(recordError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'downloaded database is incomplete or corrupted' }),
      'db: downloaded database failed verification - checksum-mismatch',
      { db_failure_kind: 'checksum-mismatch' }
    );
  });

  it('refuses to install when the expected digest cannot be fetched', async () => {
    // Unverifiable is treated as failed, not waved through: it costs a retry,
    // but it is the only way "installed" can mean "verified".
    mockFetchChecksum(null);

    const result = await downloadDatabase();

    expect(result.status).toBe('failed');
    expect(moveFile).not.toHaveBeenCalled();
    expect(recordError).toHaveBeenCalledWith(
      expect.anything(),
      'db: downloaded database failed verification - checksum-unavailable',
      { db_failure_kind: 'checksum-unavailable' }
    );
  });

  it('checkForDatabaseUpdate reports up-to-date when local and server MD5 match', async () => {
    exists.mockResolvedValue(true);

    await expect(checkForDatabaseUpdate()).resolves.toEqual({ status: 'up-to-date' });

    expect(hash).toHaveBeenCalledWith('/mock/Documents/banidb-sehajpath.db', 'md5');
    expect(mockedCheckForUpdate).toHaveBeenCalledWith(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'https://example.test/banidb-sehajpath.db.md5'
    );
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it('checkForDatabaseUpdate reports update-available when the MD5 differs — but does NOT download', async () => {
    exists.mockResolvedValue(true);
    hash.mockResolvedValue('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    mockedCheckForUpdate.mockResolvedValue(true);

    await expect(checkForDatabaseUpdate()).resolves.toEqual({ status: 'update-available' });

    // The check must NEVER download — the user confirms first.
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it('checkForDatabaseUpdate reports check-failed when it cannot reach the server', async () => {
    // Offline: the local DB is fine, but fetching the remote hash throws.
    exists.mockResolvedValue(true);
    mockedCheckForUpdate.mockRejectedValue(new Error('Network request failed'));

    const result = await checkForDatabaseUpdate();

    expect(result.status).toBe('check-failed');
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it('checkForDatabaseUpdate reports update-available (repair) when the local MD5 cannot be read', async () => {
    exists.mockResolvedValue(true);
    hash.mockRejectedValue(new Error('corrupt file'));

    await expect(checkForDatabaseUpdate()).resolves.toEqual({ status: 'update-available' });
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it('performDatabaseUpdate downloads and swaps in the new DB', async () => {
    exists.mockResolvedValue(true);

    await expect(performDatabaseUpdate()).resolves.toEqual({ status: 'updated' });

    expect(downloadFile).toHaveBeenCalledTimes(1);
    expect(moveFile).toHaveBeenCalledWith(
      '/mock/Documents/banidb-sehajpath.db.download',
      '/mock/Documents/banidb-sehajpath.db'
    );
  });

  it('joins an in-progress download instead of writing the temp file twice', async () => {
    let finishDownload: ((result: { statusCode: number }) => void) | undefined;
    downloadFile.mockImplementation((opts: { begin: (value: unknown) => void }) => {
      opts.begin?.({ statusCode: 200, contentLength: 100, headers: { ETag: 'version-1' } });
      return {
        jobId: 1,
        promise: new Promise((resolve) => {
          finishDownload = resolve;
        }),
      };
    });

    const first = downloadDatabase();
    const second = downloadDatabase();
    await drainMicrotasks();
    finishDownload?.({ statusCode: 200 });

    await expect(first).resolves.toEqual({ status: 'downloaded' });
    await expect(second).resolves.toEqual({ status: 'downloaded' });
    expect(downloadFile).toHaveBeenCalledTimes(1);
  });

  it('preserves force when an explicit update joins a non-forced fast path', async () => {
    let finishInstalledCheck!: (installed: boolean) => void;
    exists.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (finishInstalledCheck = resolve))
    );

    const automatic = downloadDatabase();
    const explicit = downloadDatabase(true);
    await drainMicrotasks();
    finishInstalledCheck(true);

    await expect(automatic).resolves.toEqual({ status: 'already-present' });
    await expect(explicit).resolves.toEqual({ status: 'downloaded' });
    expect(downloadFile).toHaveBeenCalledTimes(1);
  });

  it('abandons a stalled native download, cancels its job, and releases the lock for retry', async () => {
    jest.useFakeTimers();
    let rejectNative: ((error: Error) => void) | undefined;
    downloadFile.mockReturnValue({
      jobId: 42,
      promise: new Promise((_resolve, reject) => {
        rejectNative = reject;
      }),
    });

    const stalled = downloadDatabase();
    await drainMicrotasks();
    await jest.runOnlyPendingTimersAsync();

    expect(RNFS.stopDownload).toHaveBeenCalledWith(42);

    // A late native rejection is ignored: the promise has already settled.
    rejectNative?.(new Error('Download has been aborted'));

    await expect(stalled).resolves.toEqual({
      status: 'failed',
      reason: 'database download timed out',
    });
    downloadFile.mockImplementation((opts: { begin: (value: unknown) => void }) => {
      opts.begin?.({ statusCode: 200, contentLength: 100, headers: { ETag: 'version-1' } });
      return { jobId: 43, promise: Promise.resolve({ statusCode: 200, bytesWritten: 100 }) };
    });
    await expect(downloadDatabase()).resolves.toEqual({ status: 'downloaded' });
    jest.useRealTimers();
  });

  it('releases the lock when native never settles at all', async () => {
    jest.useFakeTimers();
    downloadFile.mockReturnValue({ jobId: 42, promise: new Promise(() => undefined) });

    const stalled = downloadDatabase();
    await drainMicrotasks();
    await jest.runOnlyPendingTimersAsync();

    await expect(stalled).resolves.toEqual({
      status: 'failed',
      reason: 'database download timed out',
    });
    expect(RNFS.stopDownload).toHaveBeenCalledWith(42);
    jest.useRealTimers();
  });

  it('refuses a cancelled job that still reports success — it would install a truncated DB', async () => {
    // The subtle one. `stopDownload` does not guarantee the native promise
    // rejects; it can still resolve 200 for a partial file. That file begins
    // with a perfectly valid SQLite header, so the integrity check CANNOT catch
    // it — the `stalled` guard is the only thing standing between a cancelled
    // transfer and a truncated database being swapped in as the live one.
    jest.useFakeTimers();
    let finishNative: ((result: { statusCode: number }) => void) | undefined;
    downloadFile.mockReturnValue({
      jobId: 99,
      promise: new Promise((resolve) => {
        finishNative = resolve;
      }),
    });

    const stalled = downloadDatabase();
    await drainMicrotasks();
    await jest.runOnlyPendingTimersAsync();
    expect(RNFS.stopDownload).toHaveBeenCalledWith(99);

    finishNative?.({ statusCode: 200 }); // native says "done" anyway

    await expect(stalled).resolves.toEqual({
      status: 'failed',
      reason: 'database download timed out',
    });
    expect(moveFile).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('still releases the lock when stopDownload itself throws', async () => {
    jest.useFakeTimers();
    (RNFS.stopDownload as jest.Mock).mockImplementation(() => {
      throw new Error('no such job');
    });
    downloadFile.mockReturnValue({ jobId: 13, promise: new Promise(() => undefined) });

    const stalled = downloadDatabase();
    await drainMicrotasks();
    await jest.runOnlyPendingTimersAsync();

    await expect(stalled).resolves.toEqual({
      status: 'failed',
      reason: 'database download timed out',
    });
    (RNFS.stopDownload as jest.Mock).mockReset();
    jest.useRealTimers();
  });

  it('does not abandon a slow download inside the total budget', async () => {
    // The watchdog is a whole-transfer budget now: with no progress events there
    // is nothing to measure idleness from, so a slow-but-working download must
    // simply be allowed to finish.
    jest.useFakeTimers();
    let finish: ((result: { statusCode: number }) => void) | undefined;
    downloadFile.mockImplementation(() => ({
      jobId: 7,
      promise: new Promise((resolve) => {
        finish = resolve;
      }),
    }));

    const slow = downloadDatabase();
    await drainMicrotasks();
    // Well inside the 20-minute budget: nothing may be cancelled.
    await jest.advanceTimersByTimeAsync(60_000);
    expect(RNFS.stopDownload).not.toHaveBeenCalled();
    finish?.({ statusCode: 200 });

    await expect(slow).resolves.toEqual({ status: 'downloaded' });
    jest.useRealTimers();
  });
});
