import { store } from '../store';
import {
  dbDownloadProgress,
  dbDownloadStarted,
  dbFailed,
  dbNotConfigured,
  dbReady,
} from '../store/slices/dbSlice';
import { resetBani } from './connection';
import {
  downloadDatabase,
  isDatabaseInstalled,
  performDatabaseUpdate,
  type DatabaseUpdateResult,
  type DownloadProgress,
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
    if (await isDatabaseInstalled()) {
      store.dispatch(dbReady());
      return;
    }

    store.dispatch(dbDownloadStarted());
    const result = await downloadDatabase((progress) => {
      store.dispatch(dbDownloadProgress(progress.percent));
    });

    switch (result.status) {
      case 'downloaded':
        // A new file was swapped in — drop any open handle so the next read
        // opens the fresh DB.
        resetBani();
        store.dispatch(dbReady());
        break;
      case 'already-present':
        store.dispatch(dbReady());
        break;
      case 'not-configured':
        store.dispatch(dbNotConfigured());
        break;
      default:
        store.dispatch(dbFailed());
    }
  } catch {
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
export const runDatabaseUpdate = async (
  onProgress?: (progress: DownloadProgress) => void
): Promise<DatabaseUpdateResult> => {
  store.dispatch(dbDownloadStarted());
  try {
    const result = await performDatabaseUpdate((progress) => {
      store.dispatch(dbDownloadProgress(progress.percent));
      onProgress?.(progress);
    });

    if (result.status === 'updated') {
      resetBani();
      store.dispatch(dbReady());
    } else if (result.status === 'not-configured') {
      store.dispatch(dbNotConfigured());
    } else if (await isDatabaseInstalled()) {
      // The update failed, but the swap only happens after a verified download,
      // so the previous database is untouched and still usable.
      store.dispatch(dbReady());
    } else {
      store.dispatch(dbFailed());
    }
    return result;
  } catch (error) {
    store.dispatch((await isDatabaseInstalled()) ? dbReady() : dbFailed());
    return {
      status: 'failed',
      reason: error instanceof Error ? error.message : 'unknown error',
    };
  }
};
