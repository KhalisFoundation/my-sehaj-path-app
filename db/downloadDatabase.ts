import {
  downloadFile,
  exists,
  hash,
  moveFile,
  read,
  stopDownload,
  unlink,
} from '@dr.pogodin/react-native-fs';
import { SEHAJ_DB_MD5_URL, SEHAJ_DB_REMOTE_URL } from '@constants';
import { recordError } from '@utils';
import { getBani, resetBani } from './connection';
import { LOCAL_DB_PATH, TEMP_DB_PATH } from './paths';

/**
 * Downloads the offline reading database and saves it for the reader to open.
 *
 * FS approach mirrors sundar-gutka-react (`src/common/rnfs.js` + the download
 * component): download to a temp file with a progress callback, then atomically
 * swap it onto the real path. Added on top: a SQLite-header integrity check, so
 * a truncated download or an HTML error page can never become the live DB.
 */

// Every valid SQLite file begins with these 16 bytes: "SQLite format 3\0".
const SQLITE_MAGIC = 'SQLite format 3';
/** A foreground native transfer must eventually release the shared temp-file lock. */
const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;

export interface DownloadProgress {
  bytesWritten: number;
  totalBytes: number;
  /** 0–100; 0 when the server did not send a Content-Length. */
  percent: number;
}

export type DownloadResult =
  | { status: 'already-present' }
  | { status: 'downloaded' }
  | { status: 'not-configured' }
  | { status: 'failed'; reason: string };

/** Result of a check-only pass — never downloads. */
export type DatabaseCheckResult =
  | { status: 'up-to-date' }
  | { status: 'update-available' }
  | { status: 'not-configured' }
  | { status: 'check-failed'; reason: string };

/** Result of actually performing the update download. */
export type DatabaseUpdateResult =
  | { status: 'updated' }
  | { status: 'not-configured' }
  | { status: 'failed'; reason: string };

/** True once the database file is in place and ready to open. */
export const isDatabaseInstalled = (): Promise<boolean> => exists(LOCAL_DB_PATH);

const safeUnlink = async (path: string): Promise<void> => {
  try {
    if (await exists(path)) {
      await unlink(path);
    }
  } catch {
    // Best-effort cleanup; nothing to do if it fails.
  }
};

/** Confirms `path` is really a SQLite database (not a partial file / error page). */
const isValidSqliteFile = async (path: string): Promise<boolean> => {
  try {
    const header = await read(path, SQLITE_MAGIC.length, 0, 'ascii');
    return header.startsWith(SQLITE_MAGIC);
  } catch {
    return false;
  }
};

/**
 * Downloads the DB if it isn't already present.
 *
 * - `already-present`  → nothing to do; the reader can use it.
 * - `not-configured`   → SEHAJ_DB_REMOTE_URL is blank; keep using the API.
 * - `downloaded`       → new file verified and swapped in; offline reading ready.
 * - `failed`           → left the old state untouched; caller keeps the API and
 *                        can retry on a later launch.
 *
 * `onProgress` fires during the transfer so the UI can show a percentage.
 */
let activeDownload: Promise<DownloadResult> | null = null;

/** True while any first-install or manual update download owns the temp file. */
export const isDatabaseDownloadInProgress = (): boolean => activeDownload !== null;

const awaitDownloadWithTimeout = <T>(promise: Promise<T>, jobId: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try {
        stopDownload(jobId);
      } catch {
        // The native job may already have ended; the timeout still releases JS.
      }
      reject(new Error('database download timed out'));
    }, DOWNLOAD_TIMEOUT_MS);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });

const downloadDatabaseInternal = async (
  onProgress?: (progress: DownloadProgress) => void,
  force = false
): Promise<DownloadResult> => {
  if (!force && (await isDatabaseInstalled())) {
    return { status: 'already-present' };
  }
  if (!SEHAJ_DB_REMOTE_URL) {
    return { status: 'not-configured' };
  }

  // Start each attempt from a clean temp file.
  await safeUnlink(TEMP_DB_PATH);

  // Temporary: log a line each time the download crosses a new 10% mark. The
  // progress callback itself fires far too often to log every tick.
  let lastLoggedDecile = 0;

  try {
    const { jobId, promise } = downloadFile({
      fromUrl: SEHAJ_DB_REMOTE_URL,
      toFile: TEMP_DB_PATH,
      background: false, // foreground-only; avoids iOS background-session native setup
      discretionary: false,
      cacheable: false,
      progressInterval: 250,
      progress: ({ bytesWritten, contentLength }) => {
        const totalBytes = contentLength > 0 ? contentLength : 0;
        const percent =
          totalBytes > 0 ? Math.min(100, Math.floor((bytesWritten / totalBytes) * 100)) : 0;

        const decile = Math.floor(percent / 10) * 10;
        if (decile > lastLoggedDecile) {
          lastLoggedDecile = decile;
          const mb = (bytes: number) => (bytes / 1_000_000).toFixed(1);
          console.log(
            `[db] offline DB download: ${decile}% (${mb(bytesWritten)} / ${mb(totalBytes)} MB)`
          );
        }

        onProgress?.({ bytesWritten, totalBytes, percent });
      },
    });

    const result = await awaitDownloadWithTimeout(promise, jobId);
    if (result.statusCode !== 200) {
      await safeUnlink(TEMP_DB_PATH);
      return { status: 'failed', reason: `HTTP ${result.statusCode}` };
    }

    if (!(await isValidSqliteFile(TEMP_DB_PATH))) {
      await safeUnlink(TEMP_DB_PATH);
      return { status: 'failed', reason: 'downloaded file is not a valid SQLite database' };
    }

    resetBani();
    await safeUnlink(LOCAL_DB_PATH);
    await moveFile(TEMP_DB_PATH, LOCAL_DB_PATH);
    return { status: 'downloaded' };
  } catch (error) {
    await safeUnlink(TEMP_DB_PATH);
    recordError(error, 'db: database download failed');
    return { status: 'failed', reason: error instanceof Error ? error.message : 'unknown error' };
  }
};

/**
 * One download owns the shared temp file at a time. A Settings update pressed
 * while boot provisioning is downloading joins that same work instead of
 * starting a second write to `TEMP_DB_PATH`.
 */
export const downloadDatabase = (
  onProgress?: (progress: DownloadProgress) => void,
  force = false
): Promise<DownloadResult> => {
  if (activeDownload) {
    return activeDownload;
  }

  const download = downloadDatabaseInternal(onProgress, force);
  activeDownload = download;
  download
    .finally(() => {
      if (activeDownload === download) {
        activeDownload = null;
      }
    })
    .catch(() => undefined);
  return download;
};

export const checkForDatabaseUpdate = async (): Promise<DatabaseCheckResult> => {
  if (!SEHAJ_DB_REMOTE_URL || !SEHAJ_DB_MD5_URL) {
    return { status: 'not-configured' };
  }
  // No DB installed yet → a (first) download is needed.
  if (!(await isDatabaseInstalled())) {
    return { status: 'update-available' };
  }

  let localMd5: string | null = null;
  try {
    localMd5 = await hash(LOCAL_DB_PATH, 'md5');
  } catch (error) {
    recordError(error, 'db: local checksum failed; a repair download is needed');
    return { status: 'update-available' };
  }

  let bani: Awaited<ReturnType<typeof getBani>> | null = null;
  try {
    bani = await getBani();
  } catch (error) {
    // A DB that cannot even be opened is corrupt → offer a repair download.
    recordError(error, 'db: could not open local database; a repair download is needed');
    return { status: 'update-available' };
  }

  try {
    const available = await bani.checkForUpdate(localMd5, SEHAJ_DB_MD5_URL);
    return available ? { status: 'update-available' } : { status: 'up-to-date' };
  } catch (error) {
    recordError(error, 'db: update check failed (offline?)');
    return {
      status: 'check-failed',
      reason: error instanceof Error ? error.message : 'unknown error',
    };
  }
};

export const performDatabaseUpdate = async (
  onProgress?: (progress: DownloadProgress) => void
): Promise<DatabaseUpdateResult> => {
  const downloaded = await downloadDatabase(onProgress, true);
  if (downloaded.status === 'downloaded') {
    return { status: 'updated' };
  }
  if (downloaded.status === 'not-configured') {
    return { status: 'not-configured' };
  }
  return {
    status: 'failed',
    reason: downloaded.status === 'failed' ? downloaded.reason : 'database could not be updated',
  };
};
