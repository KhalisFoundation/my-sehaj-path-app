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
import {
  downloadDatabase,
  checkForDatabaseUpdate,
  performDatabaseUpdate,
} from '../../db/downloadDatabase';
import { getBani } from '../../db/connection';

const exists = RNFS.exists as jest.Mock;
const read = RNFS.read as jest.Mock;
const moveFile = RNFS.moveFile as jest.Mock;
const downloadFile = RNFS.downloadFile as jest.Mock;
const hash = RNFS.hash as jest.Mock;
const mockedGetBani = getBani as jest.Mock;
const mockedCheckForUpdate = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  exists.mockResolvedValue(false);
  read.mockResolvedValue('SQLite format 3'); // valid SQLite magic header
  (RNFS.unlink as jest.Mock).mockResolvedValue(undefined);
  moveFile.mockResolvedValue(undefined);
  hash.mockResolvedValue('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  downloadFile.mockReturnValue({ jobId: 1, promise: Promise.resolve({ statusCode: 200 }) });
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
    expect(moveFile).toHaveBeenCalledTimes(1); // the temp -> live swap
  });

  it('reports progress percentages during the transfer', async () => {
    downloadFile.mockImplementation((opts: { progress: (p: unknown) => void }) => {
      opts.progress({ bytesWritten: 50, contentLength: 200 });
      return { jobId: 1, promise: Promise.resolve({ statusCode: 200 }) };
    });
    const seen: number[] = [];
    await downloadDatabase((p) => seen.push(p.percent));
    expect(seen).toContain(25);
  });

  it('fails on a non-200 response and does NOT swap', async () => {
    downloadFile.mockReturnValue({ jobId: 1, promise: Promise.resolve({ statusCode: 500 }) });
    const result = await downloadDatabase();
    expect(result.status).toBe('failed');
    expect(moveFile).not.toHaveBeenCalled();
  });

  it('rejects a non-SQLite payload (e.g. an HTML error page) and does NOT swap', async () => {
    read.mockResolvedValue('<!DOCTYPE html>');
    const result = await downloadDatabase();
    expect(result.status).toBe('failed');
    expect(moveFile).not.toHaveBeenCalled();
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
    downloadFile.mockReturnValue({
      jobId: 1,
      promise: new Promise((resolve) => {
        finishDownload = resolve;
      }),
    });

    const first = downloadDatabase();
    const second = downloadDatabase();
    finishDownload?.({ statusCode: 200 });

    await expect(first).resolves.toEqual({ status: 'downloaded' });
    await expect(second).resolves.toEqual({ status: 'downloaded' });
    expect(downloadFile).toHaveBeenCalledTimes(1);
  });

  it('times out a stalled native download, cancels its job, and releases the lock for retry', async () => {
    jest.useFakeTimers();
    downloadFile.mockReturnValue({ jobId: 42, promise: new Promise(() => undefined) });

    const stalled = downloadDatabase();
    await jest.advanceTimersByTimeAsync(10 * 60 * 1000);

    await expect(stalled).resolves.toEqual({
      status: 'failed',
      reason: 'database download timed out',
    });
    downloadFile.mockReturnValue({ jobId: 43, promise: Promise.resolve({ statusCode: 200 }) });
    await expect(downloadDatabase()).resolves.toEqual({ status: 'downloaded' });
    jest.useRealTimers();
  });
});
