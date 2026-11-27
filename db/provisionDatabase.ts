import { recordError, trackEvent } from '@utils';
import { store } from '../store';
import {
  dbDownloadStarted,
  dbFailed,
  dbInstalled,
  dbNotConfigured,
  dbReady,
} from '../store/slices/dbSlice';
import { resetBani } from './connection';
import { isOnlineNow } from './connectivity';
import {
  downloadDatabase,
  isDatabaseDownloadBlockedByStorage,
  isDatabaseDownloadInProgress,
  isDatabaseInstalled,
  performDatabaseUpdate,
  type DatabaseUpdateResult,
} from './downloadDatabase';

/**
 * Boot-time provisioning of the offline DB. Called in the background AFTER
 * hydration (never blocks reading — the API fallback covers the download
 * window). Drives the `db` slice so the UI can show progress and the
 * "you can read offline now" notice.
 *
 * Idempotent and safe to call when no URL is configured (no-ops as
 * `notConfigured`). Never throws.
 */
export const provisionDatabase = async (): Promise<void> => {
  try {
    // A reconnect can arrive just before the old, offline native request
    // finishes failing. Join that request without resetting its UI progress;
    // if it then fails while we are online, immediately start a new attempt
    // from its saved partial. Otherwise the one false→true NetInfo edge would
    // be consumed while the active-download lock was still held.
    if (isDatabaseDownloadInProgress()) {
      const activeResult = await downloadDatabase();
      if (
        activeResult.status !== 'insufficient-storage' &&
        (await isOnlineNow()) &&
        !(await isDatabaseInstalled())
      ) {
        await provisionDatabase();
      }
      return;
    }
    if (await isDatabaseInstalled()) {
      store.dispatch(dbReady());
      return;
    }
    // Prove the connection before starting a ~181 MB transfer.
    //
    // The store's flag is a cached NetInfo reading and it is wrong in both
    // directions. Going offline it stays `true` for a moment; coming back online
    // it turns `true` before the network is usable — the reconnect edge fires,
    // this starts a download immediately, and it dies on DNS with "Unable to
    // resolve host". Measured: switching data back on produced exactly that,
    // followed by "Failed to connect", both from attempts that never had a
    // chance.
    //
    // `isOnlineNow` settles it by actually reaching the network, which costs one
    // small request on a path that only runs at boot, on reconnect, and on
    // foreground — against a download that would otherwise be started, fail, and
    // be reported for nothing.
    if (!(await isOnlineNow())) {
      return;
    }
    if (await isDatabaseDownloadBlockedByStorage()) {
      store.dispatch(dbFailed());
      return;
    }

    store.dispatch(dbDownloadStarted());
    const result = await downloadDatabase();

    switch (result.status) {
      case 'downloaded':
        // Crashlytics records the failures; this records the successes, so the
        // two together still give a rate rather than a bare failure count.
        trackEvent('DatabaseDownload', 'success', 'offline database installed');
        // A new file was swapped in — drop any open handle so the next read
        // opens the fresh DB.
        resetBani();
        store.dispatch(dbInstalled('installed'));
        break;
      case 'already-present':
        store.dispatch(dbReady());
        break;
      case 'not-configured':
        store.dispatch(dbNotConfigured());
        break;
      case 'insufficient-storage':
        store.dispatch(dbFailed());
        break;
      default:
        // Failures are Crashlytics' job — `downloadDatabase` already reports the
        // exact error and its diagnostics there. The console line here only
        // marks where the provisioning run gave up.
        // Every other status is handled above, so this is the `failed` member.
        store.dispatch(dbFailed());
    }
  } catch (error) {
    // Nothing downstream can report this. `provisionDatabase` is called
    // fire-and-forget from three places in App.tsx, so a throw here — a failed
    // `exists` check, a bad `resetBani`, a store dispatch — left no trace at all
    // and simply showed up as the app quietly staying on the API forever.
    recordError(error, 'db: provisioning the offline database failed');
    store.dispatch(dbFailed());
  }
};

/**
 * A user-initiated update, reported through the SAME `db` slice as boot
 * provisioning.
 *
 * The download itself is store-free and survives navigation, but its progress
 * used to live only in the Database screen's local state — so leaving and coming
 * back lost it, the screen re-ran its check, and it offered "Update now" again
 * while the download was still running underneath. Publishing the progress here
 * makes the in-progress state visible to any mount (and to the app-wide notice).
 */
export const runDatabaseUpdate = async (): Promise<DatabaseUpdateResult> => {
  store.dispatch(dbDownloadStarted());
  try {
    const result = await performDatabaseUpdate();

    if (result.status === 'updated') {
      // Boot provisioning records its own success; without this one a manual
      // update had no success signal at all, leaving its Crashlytics failures
      // without a denominator to measure them against.
      trackEvent('DatabaseUpdate', 'success', 'offline database updated');
      resetBani();
      store.dispatch(dbInstalled('updated'));
    } else if (result.status === 'not-configured') {
      store.dispatch(dbNotConfigured());
    } else if (result.status === 'insufficient-storage') {
      store.dispatch((await isDatabaseInstalled()) ? dbReady() : dbFailed());
    } else if (await isDatabaseInstalled()) {
      // The update failed, but the swap only happens after a verified download,
      // so the previous database is untouched and still usable.
      store.dispatch(dbReady());
    } else {
      store.dispatch(dbFailed());
    }
    return result;
  } catch (error) {
    // The screen turns the returned reason back into a message-only Error, which
    // loses the stack. Record the real one here, where it is still intact.
    recordError(error, 'db: the update run threw');
    store.dispatch((await isDatabaseInstalled()) ? dbReady() : dbFailed());
    return {
      status: 'failed',
      reason: error instanceof Error ? error.message : 'unknown error',
    };
  }
};
