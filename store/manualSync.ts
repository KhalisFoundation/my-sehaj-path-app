import AsyncStorage from '@react-native-async-storage/async-storage';
import { isApiConfigured } from '@api/config';
import { refreshPathsFromServer } from './applyServerResponse';
import { runConfirmedAccountSync } from './confirmedSync';
import type { AppStore } from './index';
import { outbox, persistence } from './instance';
import {
  approveSync,
  markPathEdited,
  hydrateEmptySync,
  hydrateSyncRecovery,
  requestSyncConfirmation,
  setSyncError,
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
import { clearBlockedWork, hasWorkBlockingPull } from './syncWork';
import { recordError } from '../utils/crashlytics';

/**
 * Promote dirty reader positions so an explicit Sync now includes them.
 *
 * No blocked-op special case is needed here: `runManualSync` clears the runtime
 * blocks first, so every existing op is sendable again and the scroll piggybacks
 * on it as usual.
 */
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
    // The user pressed a button; a tap that produces no visible result reads as
    // a broken button. Surface it through the normal status notice so every
    // outcome of Sync now arrives in the same place.
    store.dispatch(setSyncError('network'));
    return false;
  }

  if (state.sync.account !== email) {
    return runConfirmedAccountSync(store, email);
  }

  // Manual Sync is the user's escape hatch for work the automatic path has given
  // up on, so it must not consult `hasSendableWork()` to decide whether to run.
  // Clearing the runtime blocks gives every rejected op, the settings revision and
  // any blocked bulk body exactly one fresh attempt. Anything that fails again is
  // simply re-blocked by the drain.
  clearBlockedWork(store);

  // The user tapped Sync now, so confirm the result to them.
  store.dispatch(requestSyncConfirmation());

  queueDirtyScroll(store);
  await outbox.flushNow();
  // Re-blocked work must not stop the pull — rule 9. `hasWorkBlockingPull` ignores
  // ops that will never send while still respecting a genuinely dirty scroll.
  if (hasWorkBlockingPull(store)) {
    return false;
  }
  return refreshPathsFromServer(store, getActiveReaderPath() ?? undefined);
};

/**
 * User-confirmed repair for corrupt sync bookkeeping. Path data is untouched.
 *
 * The corrupt value is backed up (and the copy verified) before anything is
 * replaced, then every still-readable UUID mapping is salvaged from it. This
 * repair is permitted only when every local path has a readable UUID; minting a
 * fresh id would duplicate that path in the cloud.
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

    const salvaged = salvageUuidMappings(raw);
    if (initial.paths.paths.some((path) => !salvaged[path.pathId])) {
      recordError(
        new Error('sync metadata has paths without recoverable UUID mappings'),
        'manualSync: unsafe recovery repair rejected'
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

    store.dispatch(hydrateEmptySync());
    // The user has already explicitly chosen “Reset and sync”. `hydrateEmptySync`
    // clears this runtime flag, which otherwise lets Home briefly show its
    // unowned-account “Discard / Keep safe” choice while the confirmed sync is
    // already associating the same local data.
    store.dispatch(approveSync(normalizedEmail));

    const now = Date.now();
    store.getState().paths.paths.forEach((path, index) => {
      const serverPathId = salvaged[path.pathId];
      if (!serverPathId) {
        return; // checked above; keeps this loop defensive
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
