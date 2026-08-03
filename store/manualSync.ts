import AsyncStorage from '@react-native-async-storage/async-storage';
import { isApiConfigured } from '@api/config';
import { refreshPathsFromServer } from './applyServerResponse';
import { runConfirmedAccountSync } from './confirmedSync';
import type { AppStore } from './index';
import { outbox, persistence } from './instance';
import {
  markPathEdited,
  hydrateEmptySync,
  hydrateSyncRecovery,
  upsertMeta,
} from './slices/syncSlice';
import {
  SYNC_META_KEY,
  SYNC_META_RECOVERY_KEY,
  salvageAccountOwner,
  salvageUuidMappings,
} from './syncFormat';
import { legacyToMs } from './syncDateUtils';
import { getActiveReaderPath } from './syncLifecycle';
import { recordError } from '../utils/crashlytics';

const hasPendingWork = (store: AppStore): boolean => {
  const { sync } = store.getState();
  return Object.keys(sync.pathOps).length > 0 || sync.pendingSettingsUpdatedAt != null;
};

/** Promote dirty reader positions so an explicit Sync now includes them. */
const queueDirtyScroll = (store: AppStore): void => {
  const state = store.getState();
  Object.keys(state.sync.scrollDirty).forEach((key) => {
    const pathId = Number(key);
    const meta = state.sync.meta[pathId];
    if (meta?.onServer && !state.sync.pathOps[pathId]) {
      store.dispatch(markPathEdited({ pathId, at: Date.now() }));
    }
  });
};

/**
 * Explicit user-requested sync. It uploads queued work first, then refreshes
 * paths and settings from the account so another device's changes appear here.
 */
export const runManualSync = async (store: AppStore, email: string): Promise<boolean> => {
  const state = store.getState();
  if (
    !isApiConfigured() || // no server configured in this build
    !email ||
    state.auth.email !== email ||
    !state.network.isOnline ||
    state.sync.recoveryNeeded
  ) {
    return false;
  }

  if (state.sync.account !== email) {
    return runConfirmedAccountSync(store, email);
  }

  queueDirtyScroll(store);
  await outbox.flushNow();
  if (hasPendingWork(store)) {
    return false;
  }
  return refreshPathsFromServer(store, getActiveReaderPath() ?? undefined);
};

/**
 * User-confirmed repair for corrupt sync bookkeeping. Path data is untouched.
 *
 * The corrupt value is backed up (and the copy verified) before anything is
 * replaced, then every still-readable UUID mapping is salvaged from it. Reusing
 * those ids is what keeps the repair attached to the account's existing cloud
 * paths — minting fresh ids would duplicate every path in the cloud.
 *
 * Salvaged entries are marked `onServer: false` on purpose: the create is
 * idempotent by UUID, so a path the server already has answers 200 and is
 * downgraded to an update, while a genuinely missing one is created.
 */
export const resetSyncMetadataAndSync = async (
  store: AppStore,
  email: string
): Promise<boolean> => {
  const initial = store.getState();
  if (!initial.sync.recoveryNeeded) {
    return runManualSync(store, email);
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || initial.auth.email?.trim().toLowerCase() !== normalizedEmail) {
    return false;
  }
  try {
    const raw = await AsyncStorage.getItem(SYNC_META_KEY);

    // Recovery mode intentionally does not hydrate a possibly-corrupt account
    // into Redux. If the raw document still names an owner, however, never use
    // another account's JWT to repair/upload those local paths.
    const owner = salvageAccountOwner(raw);
    if (owner && owner.toLowerCase() !== normalizedEmail) {
      recordError(
        new Error('sync metadata belongs to a different account'),
        'manualSync: recovery account mismatch'
      );
      return false;
    }

    // Never destroy the only record of this account's UUIDs. If the backup can't
    // be written and read back, stop and stay in recovery mode.
    if (raw !== null) {
      await AsyncStorage.setItem(SYNC_META_RECOVERY_KEY, raw);
      if ((await AsyncStorage.getItem(SYNC_META_RECOVERY_KEY)) !== raw) {
        recordError(
          new Error('corrupt sync metadata could not be backed up; repair aborted'),
          'manualSync: recovery backup failed'
        );
        return false;
      }
    }

    const salvaged = salvageUuidMappings(raw);
    store.dispatch(hydrateEmptySync());

    const now = Date.now();
    store.getState().paths.paths.forEach((path, index) => {
      const serverPathId = salvaged[path.pathId];
      if (!serverPathId) {
        return; // no readable id — the confirmed sync mints a fresh one
      }
      store.dispatch(
        upsertMeta({
          pathId: path.pathId,
          meta: {
            serverPathId,
            startDate: legacyToMs(path.startDate) ?? now,
            localUpdatedAt: now + index,
            serverUpdatedAt: 0, // unknown; no baseUpdatedAt until the server replies
            onServer: false,
          },
        })
      );
    });

    if (!(await persistence.flush())) {
      // The rebuilt metadata is not durable, so cloud sync must stay disabled —
      // otherwise an upload could use ids that vanish on the next launch.
      store.dispatch(hydrateSyncRecovery());
      recordError(
        new Error('repaired sync metadata could not be persisted'),
        'manualSync: repair persistence failed'
      );
      return false;
    }
    // Awaited inside the try so a failure here is caught rather than escaping.
    return await runManualSync(store, email);
  } catch {
    return false;
  }
};
