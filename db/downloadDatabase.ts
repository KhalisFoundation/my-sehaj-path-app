import { exists, hash, moveFile, read, unlink } from '@dr.pogodin/react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SEHAJ_DB_MD5_URL, SEHAJ_DB_REMOTE_URL } from '@constants';
import { recordError } from '@utils';
import { getBani, resetBani } from './connection';
import { LOCAL_DB_PATH, TEMP_DB_PATH } from './paths';
import { clearResumableDownloadState, downloadFileWithResumeAndRetry } from './resumableDownload';

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
const CONNECTION_TIMEOUT_MS = 15_000;
const READ_TIMEOUT_MS = 60_000;
/**
 * How long the transfer may make NO progress before it is abandoned.
 *
 * Deliberately an IDLE timeout, not a total one. A total budget punishes a slow
 * connection: 190MB in 10 minutes demands a sustained ~2.5 Mbps, so a download
 * that was working perfectly well just slowly got killed and restarted from
 * zero. `readTimeout` already fails a truly dead socket within a minute, so the
 * only job left here is to release the shared temp-file lock when the native
 * job neither finishes nor errors. A download that is still moving is never
 * interrupted, however long it takes.
 */
const DOWNLOAD_IDLE_TIMEOUT_MS = 3 * 60 * 1000;
/** Give the native task time to observe cancellation before a retry may reuse its part file. */
const DOWNLOAD_CANCEL_GRACE_MS = READ_TIMEOUT_MS + 5_000;
const DB_DOWNLOAD_STORAGE_BLOCK_KEY = '@sehaj-path/db-download-blocked-by-storage';

/** Kinds `classifyDownloadFailure` can derive from a thrown error. */
type DownloadFailureKind =
  | 'insufficient-storage'
  | 'network-unavailable'
  | 'network-timeout'
  | 'connection-interrupted'
  | 'other';

/**
 * Every value `db_failure_kind` can take. The two extra kinds come from
 * responses that complete WITHOUT throwing, so the classifier never returns
 * them — but they still need a kind, or those reports would be the only DB
 * download failures with no way to filter them.
 */
type ReportedFailureKind = DownloadFailureKind | 'rejected-by-host' | 'invalid-file';

const failureAttributes = (kind: ReportedFailureKind): Record<string, string> => ({
  db_failure_kind: kind,
});

const DOWNLOAD_FAILURE_CONTEXT: Record<DownloadFailureKind, string> = {
  'insufficient-storage': 'db: database download failed - insufficient storage',
  'network-unavailable': 'db: database download failed - network unavailable',
  'network-timeout': 'db: database download failed - network timeout or stalled',
  'connection-interrupted': 'db: database download failed - connection interrupted',
  other: 'db: database download failed',
};

/**
 * Native filesystem errors are not shaped consistently across platforms.
 * Android RNFS commonly exposes ENOSPC only in the message while Apple may
 * expose an NSError-style code, so inspect both without replacing the original
 * exception that Crashlytics needs for its stack trace.
 */
const classifyDownloadFailure = (error: unknown): DownloadFailureKind => {
  const errorWithCode = error as { code?: unknown; message?: unknown } | null;
  const code =
    typeof errorWithCode?.code === 'string' || typeof errorWithCode?.code === 'number'
      ? String(errorWithCode.code)
      : '';
  const message =
    typeof errorWithCode?.message === 'string' ? errorWithCode.message : String(error ?? '');
  const searchable = `${code} ${message}`.toLowerCase();

  if (
    /\benospc\b|no space left|disk(?: is)? full|not enough (?:free )?(?:disk|storage) space|insufficient (?:disk|storage) space|nsfilewriteoutofspaceerror/.test(
      searchable
    )
  ) {
    return 'insufficient-storage';
  }
  if (
    /\b(?:enetunreach|ehostunreach|enetdown|eai_again)\b|unable to resolve host|unknownhostexception|network is unreachable|no route to host|not connected to (?:the )?internet|internet connection appears to be offline|network request failed|failed to connect|nsurlerrornotconnectedtointernet|-1009/.test(
      searchable
    )
  ) {
    return 'network-unavailable';
  }
  if (
    /\betimedout\b|timed out|timeout|sockettimeoutexception|database download stalled|nsurlerrortimedout|-1001/.test(
      searchable
    )
  ) {
    return 'network-timeout';
  }
  if (
    /software caused connection abort|\beconnreset\b|connection reset|unexpected end of stream|premature eof|ended before expected size|socket closed|connection (?:was )?(?:aborted|lost)|broken pipe|nsurlerrornetworkconnectionlost|-1005/.test(
      searchable
    )
  ) {
    return 'connection-interrupted';
  }
  return 'other';
};

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
  | InsufficientStorageResult
  | { status: 'failed'; reason: string };

export type InsufficientStorageResult = {
  status: 'insufficient-storage';
};

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
  | InsufficientStorageResult
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

const setDatabaseDownloadStorageBlocked = async (blocked: boolean): Promise<void> => {
  try {
    if (blocked) {
      await AsyncStorage.setItem(DB_DOWNLOAD_STORAGE_BLOCK_KEY, 'true');
    } else {
      await AsyncStorage.removeItem(DB_DOWNLOAD_STORAGE_BLOCK_KEY);
    }
  } catch {
    // Do not turn an AsyncStorage problem into a second download failure. The
    // failed partial is removed before a storage block is written, reclaiming
    // as much space as possible for this tiny preference.
  }
};

/** Automatic callers consult this; an explicit user retry deliberately bypasses it. */
export const isDatabaseDownloadBlockedByStorage = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(DB_DOWNLOAD_STORAGE_BLOCK_KEY)) === 'true';
  } catch {
    // Fail open: a broken preference store must not permanently disable the DB.
    return false;
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

  if (!force && (await isDatabaseDownloadBlockedByStorage())) {
    return { status: 'insufficient-storage' };
  }

  if (force) {
    // The explicit click authorizes one real attempt. Do not guess from a free
    // space preflight: clear the block now, then restore it below only if the
    // native write returns an actual out-of-space error.
    await setDatabaseDownloadStorageBlocked(false);
  }

  try {
    const result = await downloadFileWithResumeAndRetry({
      fromUrl: SEHAJ_DB_REMOTE_URL,
      toFile: TEMP_DB_PATH,
      connectionTimeout: CONNECTION_TIMEOUT_MS,
      readTimeout: READ_TIMEOUT_MS,
      idleTimeout: DOWNLOAD_IDLE_TIMEOUT_MS,
      cancelGrace: DOWNLOAD_CANCEL_GRACE_MS,
      onProgress: (bytesWritten, totalBytes) => {
        // A native 100% progress event only means that all response bytes have
        // arrived. RNFS may still be closing the file, and a resumed download
        // still has to append, validate, and atomically install it. Keep the
        // public progress at 99% until `dbReady` marks the completed install as
        // 100%, so the UI never claims completion several seconds too early.
        const percent =
          totalBytes > 0 ? Math.min(99, Math.floor((bytesWritten / totalBytes) * 100)) : 0;

        onProgress?.({ bytesWritten, totalBytes, percent });
      },
    });
    if (result.statusCode !== 200) {
      await clearResumableDownloadState(TEMP_DB_PATH);
      // The transfer completed without throwing, so nothing else reports this.
      // It is the shape a throttling host takes (Drive answers 403 once a large
      // file has been fetched too often), which is exactly what needs to be
      // visible after a change of host.
      const reason = `HTTP ${result.statusCode}`;
      recordError(
        new Error(reason),
        'db: database download rejected by host',
        failureAttributes('rejected-by-host')
      );
      return { status: 'failed', reason };
    }

    if (!(await isValidSqliteFile(TEMP_DB_PATH))) {
      await clearResumableDownloadState(TEMP_DB_PATH);
      // A 200 that is not a database: an HTML interstitial or a truncated file.
      // The integrity check catches it, but silently — worth reporting, since it
      // means the URL is serving something other than the database.
      const reason = 'downloaded file is not a valid SQLite database';
      recordError(
        new Error(reason),
        'db: downloaded file failed the integrity check',
        failureAttributes('invalid-file')
      );
      return { status: 'failed', reason };
    }

    resetBani();
    await safeUnlink(LOCAL_DB_PATH);
    await moveFile(TEMP_DB_PATH, LOCAL_DB_PATH);
    await clearResumableDownloadState(TEMP_DB_PATH);
    await setDatabaseDownloadStorageBlocked(false);
    return { status: 'downloaded' };
  } catch (error) {
    const failureKind = classifyDownloadFailure(error);
    if (failureKind === 'insufficient-storage') {
      // Free the failed partial before persisting the block; otherwise the very
      // bytes that filled the disk would remain stranded.
      await clearResumableDownloadState(TEMP_DB_PATH);
      await setDatabaseDownloadStorageBlocked(true);
    } else if (failureKind === 'other') {
      // Unknown/native logic failures are not safe resume points. Network
      // interruptions deliberately keep the partial and its ETag manifest.
      await clearResumableDownloadState(TEMP_DB_PATH);
    }
    // The context string is only a breadcrumb — Crashlytics groups issues by
    // stack trace, so every kind raised from this same catch would otherwise
    // collapse into one issue. The custom key is what makes "out of disk"
    // filterable apart from "the connection dropped".
    recordError(error, DOWNLOAD_FAILURE_CONTEXT[failureKind], failureAttributes(failureKind));
    if (failureKind === 'insufficient-storage') {
      return { status: 'insufficient-storage' };
    }
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
  if (downloaded.status === 'insufficient-storage') {
    return downloaded;
  }
  return {
    status: 'failed',
    reason: downloaded.status === 'failed' ? downloaded.reason : 'database could not be updated',
  };
};
