import { store } from '../store';
import {
  dbDownloadProgress,
  dbDownloadStarted,
  dbFailed,
  dbNotConfigured,
  dbReady,
} from '../store/slices/dbSlice';
import { resetBani } from './connection';
import { downloadDatabase, isDatabaseInstalled } from './downloadDatabase';

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
