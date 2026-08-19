import AsyncStorage from '@react-native-async-storage/async-storage';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { downloadFileWithResumeAndRetry } from '../../db/resumableDownload';

const DESTINATION = '/mock/Documents/database.download';
const RESUME_PART = `${DESTINATION}.resume`;
const URL = 'https://example.test/database.db';

const downloadFile = RNFS.downloadFile as jest.Mock;
const exists = RNFS.exists as jest.Mock;
const stat = RNFS.stat as jest.Mock;
const read = RNFS.read as jest.Mock;
const appendFile = RNFS.appendFile as jest.Mock;
const moveFile = RNFS.moveFile as jest.Mock;
const unlink = RNFS.unlink as jest.Mock;

type DownloadOptions = {
  toFile: string;
  headers: Record<string, string>;
  begin: (value: {
    statusCode: number;
    contentLength: number;
    headers: Record<string, string>;
  }) => void;
  progress: (value: { bytesWritten: number; contentLength: number }) => void;
};

const fakeBase64 = (byteLength: number): string => {
  const completeTriples = Math.floor(byteLength / 3);
  const remainder = byteLength % 3;
  return `${'AAAA'.repeat(completeTriples)}${
    remainder === 1 ? 'AA==' : remainder === 2 ? 'AAA=' : ''
  }`;
};

const decodedLength = (base64: string): number =>
  (base64.length / 4) * 3 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);

const options = (onProgress = jest.fn()) => ({
  fromUrl: URL,
  toFile: DESTINATION,
  connectionTimeout: 15_000,
  readTimeout: 60_000,
  idleTimeout: 180_000,
  cancelGrace: 65_000,
  onProgress,
});

describe('resumable database download', () => {
  const sizes = new Map<string, number>();

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    sizes.clear();
    exists.mockImplementation(async (path: string) => sizes.has(path));
    stat.mockImplementation(async (path: string) => ({ size: sizes.get(path) ?? 0 }));
    unlink.mockImplementation(async (path: string) => {
      sizes.delete(path);
    });
    moveFile.mockImplementation(async (from: string, to: string) => {
      const size = sizes.get(from) ?? 0;
      sizes.delete(from);
      sizes.set(to, size);
    });
    read.mockImplementation(async (_path: string, length: number) => fakeBase64(length));
    appendFile.mockImplementation(async (path: string, base64: string) => {
      sizes.set(path, (sizes.get(path) ?? 0) + decodedLength(base64));
    });
  });

  it('preserves received bytes and resumes each retry from the new offset', async () => {
    jest.useFakeTimers();
    let call = 0;
    downloadFile.mockImplementation((request: DownloadOptions) => {
      call += 1;
      if (call === 1) {
        expect(request.headers).toEqual({});
        request.begin({ statusCode: 200, contentLength: 100, headers: { ETag: 'version-1' } });
        request.progress({ bytesWritten: 60, contentLength: 100 });
        sizes.set(DESTINATION, 60);
        return { jobId: 1, promise: Promise.reject(new Error('Software caused connection abort')) };
      }
      if (call === 2) {
        expect(request.headers).toEqual({ Range: 'bytes=60-', 'If-Range': 'version-1' });
        request.begin({
          statusCode: 206,
          contentLength: 40,
          headers: { ETag: 'version-1', 'Content-Range': 'bytes 60-99/100' },
        });
        request.progress({ bytesWritten: 20, contentLength: 40 });
        sizes.set(RESUME_PART, 20);
        return { jobId: 2, promise: Promise.reject(new Error('connection reset')) };
      }

      expect(request.headers).toEqual({ Range: 'bytes=80-', 'If-Range': 'version-1' });
      request.begin({
        statusCode: 206,
        contentLength: 20,
        headers: { ETag: 'version-1', 'Content-Range': 'bytes 80-99/100' },
      });
      request.progress({ bytesWritten: 20, contentLength: 20 });
      sizes.set(RESUME_PART, 20);
      return {
        jobId: 3,
        promise: Promise.resolve({ statusCode: 206, bytesWritten: 20 }),
      };
    });

    const pending = downloadFileWithResumeAndRetry(options());
    await jest.advanceTimersByTimeAsync(500);
    await jest.advanceTimersByTimeAsync(1500);

    await expect(pending).resolves.toEqual({ statusCode: 200, bytesWritten: 100 });
    expect(downloadFile).toHaveBeenCalledTimes(3);
    expect(sizes.get(DESTINATION)).toBe(100);
    jest.useRealTimers();
  });

  it('restarts with the new full entity when If-Range rejects an old validator', async () => {
    sizes.set(DESTINATION, 60);
    await AsyncStorage.setItem(
      '@sehaj-path/db-download-resume-v1',
      JSON.stringify({ version: 1, url: URL, validator: 'old-version', totalBytes: 100 })
    );
    downloadFile.mockImplementation((request: DownloadOptions) => {
      expect(request.headers).toEqual({ Range: 'bytes=60-', 'If-Range': 'old-version' });
      request.begin({ statusCode: 200, contentLength: 120, headers: { ETag: 'new-version' } });
      sizes.set(RESUME_PART, 120);
      return {
        jobId: 4,
        promise: Promise.resolve({ statusCode: 200, bytesWritten: 120 }),
      };
    });

    await expect(downloadFileWithResumeAndRetry(options())).resolves.toEqual({
      statusCode: 200,
      bytesWritten: 120,
    });
    expect(sizes.get(DESTINATION)).toBe(120);
    expect(appendFile).not.toHaveBeenCalled();
    expect(
      JSON.parse((await AsyncStorage.getItem('@sehaj-path/db-download-resume-v1')) ?? '{}')
    ).toEqual(expect.objectContaining({ validator: 'new-version', totalBytes: 120 }));
  });
});
