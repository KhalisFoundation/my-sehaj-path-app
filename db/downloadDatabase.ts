import {
  downloadFile,
  exists,
  hash,
  moveFile,
  read,
  stopDownload,
  unlink,
} from '@dr.pogodin/react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
const CONNECTION_TIMEOUT_MS = 15_000;
const READ_TIMEOUT_MS = 60_000;
/**
 * Total budget for one download. A backstop, NOT a speed limit.
 *
 * Removing it entirely is not an option, however tempting. RNFS on iOS calls
 * its `resumable` callback instead of its error callback whenever the OS hands
 * back resume data — and we deliberately pass no `resumable` callback, because
 * answering it is what made RNFS emit from the NSURLSession delegate thread and
 * crash the app. So on a dropped connection iOS calls NEITHER callback and the
 * native promise never settles. This timer is then the only thing that releases
 * `activeDownload`; without it the lock is held for the life of the process,
 * every foreground and reconnect joins a dead promise, and the ~181 MB temp file
 * is never reclaimed.
 *
 * An hour rather than minutes so it can only ever act as that backstop: 181 MB
 * in an hour is ~0.05 MB/s, slower than any connection a reader could actually
 * use, so a slow-but-working download is never cancelled for being slow. It also
 * lines up with RNFS's own iOS `backgroundTimeout` default (one hour, mapped to
 * `timeoutIntervalForResource`) rather than fighting it.
 *
 * An idle timeout would be the better shape, but idleness can only be measured
 * from progress events, and those are exactly what we cannot ask for.
 */
const DOWNLOAD_TIMEOUT_MS = 60 * 60 * 1000;
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
type ReportedFailureKind =
  | DownloadFailureKind
  | 'rejected-by-host'
  | 'invalid-file'
  | 'checksum-mismatch'
  | 'checksum-unavailable';

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

/**
 * Resolves the native download, giving up if it outlives its budget.
 *
 * A WHOLE-TRANSFER budget, not an idle timeout. Idleness can only be measured
 * from progress events, and the `downloadFile` call below deliberately requests
 * none — asking for them is what made RNFS emit from the NSURLSession delegate
 * thread and crash the app. So a genuinely slow connection needing longer than
 * `DOWNLOAD_TIMEOUT_MS` for the whole file is cancelled even though it works.
 *
 * Rejecting the moment the budget expires is what keeps this small: the promise
 * is settled, so a late native result — including a SUCCESS reporting a partial
 * file — is ignored by the promise itself. That matters, because a truncated
 * file still carries a valid SQLite header and would otherwise pass the
 * integrity check.
 */
function awaitDownload<T>(promise: Promise<T>, jobId: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      try {
        stopDownload(jobId);
      } catch {
        // The native job may already have ended.
      }
      reject(new Error('database download timed out'));
    }, DOWNLOAD_TIMEOUT_MS);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

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
 * The published digest for the remote database, or null if it cannot be read.
 *
 * Bounded deliberately. This runs AFTER the transfer watchdog has been cleared
 * but while `activeDownload` is still held, so an unbounded request here wedges
 * the whole feature: `isDatabaseDownloadInProgress()` would stay true forever,
 * every later foreground and reconnect would join the hung promise and return,
 * the screen would sit on "download in progress" until the app is relaunched,
 * and the ~181 MB temp file would never be reclaimed. Losing the connection the
 * moment a long download completes is exactly the case this feature exists for,
 * so it cannot be left unguarded.
 */
const CHECKSUM_FETCH_TIMEOUT_MS = 15_000;

const fetchExpectedChecksum = async (): Promise<string | null> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECKSUM_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(SEHAJ_DB_MD5_URL, { signal: controller.signal });
    if (!response.ok) {
      return null;
    }
    // The file is the bare hex digest with a trailing newline.
    const value = (await response.text()).trim().toLowerCase();
    return /^[0-9a-f]{32}$/.test(value) ? value : null;
  } catch {
    // Includes the abort above; the caller reports it as `checksum-unavailable`.
    return null;
  } finally {
    clearTimeout(timer);
  }
};

type VerifyResult = { ok: true } | { ok: false; kind: ReportedFailureKind; reason: string };

/**
 * Confirms the downloaded file really is the published database.
 *
 * The SQLite header alone cannot do this: a file truncated at 40MB of 181MB
 * still begins with "SQLite format 3", so it passes the magic check, gets
 * installed, and then fails somewhere in the middle of the Guru Granth Sahib
 * instead of at open time. Comparing the whole digest catches truncation and
 * corruption alike.
 *
 * Nothing is installed unless a digest was fetched AND matched. An unreachable
 * checksum is deliberately treated as a failure rather than waved through — it
 * costs a retry, but it is the only way "installed" can mean "verified".
 */
const verifyDownloadedDatabase = async (path: string): Promise<VerifyResult> => {
  if (!(await isValidSqliteFile(path))) {
    return {
      ok: false,
      kind: 'invalid-file',
      reason: 'downloaded file is not a valid SQLite database',
    };
  }

  const expected = await fetchExpectedChecksum();
  if (!expected) {
    return {
      ok: false,
      kind: 'checksum-unavailable',
      reason: 'could not fetch the expected database checksum',
    };
  }

  let actual: string;
  try {
    actual = (await hash(path, 'md5')).toLowerCase();
  } catch {
    return {
      ok: false,
      kind: 'checksum-unavailable',
      reason: 'could not compute the downloaded database checksum',
    };
  }

  if (actual !== expected) {
    return {
      ok: false,
      kind: 'checksum-mismatch',
      reason: 'downloaded database is incomplete or corrupted',
    };
  }
  return { ok: true };
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
 */
type ActiveDownload = {
  promise: Promise<DownloadResult>;
  force: boolean;
};

let activeDownload: ActiveDownload | null = null;

/** True while any first-install or manual update download owns the temp file. */
export const isDatabaseDownloadInProgress = (): boolean => activeDownload !== null;

const downloadDatabaseInternal = async (force = false): Promise<DownloadResult> => {
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

  // Never write into whatever a previous attempt left behind. Both platforms
  // happen to truncate rather than append today (Android opens a plain
  // FileOutputStream, iOS replaces the destination from its own temp file), but
  // that is their behaviour, not a guarantee this code should rely on — and a
  // stale partial otherwise strands up to ~181 MB, which matters because the
  // out-of-space path below is triggered by exactly that kind of leftover.
  await safeUnlink(TEMP_DB_PATH);

  try {
    const { jobId, promise } = downloadFile({
      fromUrl: SEHAJ_DB_REMOTE_URL,
      toFile: TEMP_DB_PATH,
      background: false,
      discretionary: false,
      cacheable: false,
      connectionTimeout: CONNECTION_TIMEOUT_MS,
      readTimeout: READ_TIMEOUT_MS,
      // Deliberately NO `progress` callback.
      //
      // Supplying one makes RNFS subscribe to its native download events, and
      // those are emitted from the NSURLSession delegate thread straight into
      // React Native's shared event-emitter map. That map is not thread-safe:
      // `operator[]` inserts and rehashes it off the JS thread, which corrupted
      // it and killed the app (EXC_BAD_ACCESS, and an uncaught overflow_error
      // out of __next_prime once the bucket count was garbage). Omitting the
      // callback sets `hasProgressCallback: false`, so the native side never
      // emits and the crash cannot happen.
      //
      // The only thing lost is the percentage. The Database screen already
      // shows a plain "downloading" message whenever progress is 0.
    });

    const result = await awaitDownload(promise, jobId);
    if (result.statusCode !== 200) {
      await safeUnlink(TEMP_DB_PATH);
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

    const verified = await verifyDownloadedDatabase(TEMP_DB_PATH);
    if (!verified.ok) {
      // Nothing is installed unless the digest matched, so the existing
      // database — if any — is left exactly as it was and the user can retry.
      await safeUnlink(TEMP_DB_PATH);
      recordError(
        new Error(verified.reason),
        `db: downloaded database failed verification - ${verified.kind}`,
        failureAttributes(verified.kind)
      );
      return { status: 'failed', reason: verified.reason };
    }

    resetBani();
    await safeUnlink(LOCAL_DB_PATH);
    await moveFile(TEMP_DB_PATH, LOCAL_DB_PATH);
    await safeUnlink(TEMP_DB_PATH);
    await setDatabaseDownloadStorageBlocked(false);
    return { status: 'downloaded' };
  } catch (error) {
    const failureKind = classifyDownloadFailure(error);
    // There is no resume: the next attempt re-downloads the whole file, so a
    // partial is never read again and would otherwise strand ~181 MB. Freeing it
    // also matters most in the out-of-disk case, where those very bytes are what
    // filled the disk.
    await safeUnlink(TEMP_DB_PATH);
    if (failureKind === 'insufficient-storage') {
      await setDatabaseDownloadStorageBlocked(true);
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
export const downloadDatabase = (force = false): Promise<DownloadResult> => {
  if (activeDownload) {
    if (force && !activeDownload.force) {
      const joined = activeDownload;
      return joined.promise.then((result) => {
        // A completed first-install fetched the same entity, so it satisfies
        // the explicit request. Every other non-forced result must be followed
        // by the attempt the user actually requested (notably a storage-block
        // result or the installed-file fast path).
        return result.status === 'downloaded' ? result : downloadDatabase(true);
      });
    }
    return activeDownload.promise;
  }

  const current: ActiveDownload = {
    promise: Promise.resolve({ status: 'failed', reason: 'download not started' }),
    force,
  };
  const download = downloadDatabaseInternal(force);
  current.promise = download;
  activeDownload = current;
  download
    .finally(() => {
      if (activeDownload === current) {
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

export const performDatabaseUpdate = async (): Promise<DatabaseUpdateResult> => {
  const downloaded = await downloadDatabase(true);
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
