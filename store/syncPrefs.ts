import AsyncStorage from '@react-native-async-storage/async-storage';
import { recordError } from '../utils/crashlytics';

/**
 * A single app-private bag of lightweight UI/sync preference flags, kept in ONE
 * AsyncStorage key so we don't spawn a key per flag. Add new flags to `SyncPrefs`
 * and they reuse this same key.
 *
 * Deliberately separate from `sehajSyncMeta_v1` (the durable, journaled sync
 * bookkeeping): these are non-critical booleans, so they're written directly
 * with a read-merge-write rather than through the atomic write journal.
 */
export const SYNC_PREFS_KEY = 'sehajSyncPrefs_v1';

export interface SyncPrefs {
  /** Signed-out "log in to save your progress" popup has been dismissed. */
  signInPopupDismissed: boolean;
  // Future flags (e.g. skipSync) go here — same key, no new AsyncStorage entry.
}

const DEFAULTS: SyncPrefs = {
  signInPopupDismissed: false,
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readBool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

/**
 * Fail-open: unreadable or corrupt prefs fall back to defaults. These flags only
 * gate popups, so defaulting (e.g. showing a popup once more) is harmless.
 */
export const readSyncPrefs = async (): Promise<SyncPrefs> => {
  try {
    const raw = await AsyncStorage.getItem(SYNC_PREFS_KEY);
    if (!raw) {
      return { ...DEFAULTS };
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed)) {
      return { ...DEFAULTS };
    }
    return {
      signInPopupDismissed: readBool(parsed.signInPopupDismissed, DEFAULTS.signInPopupDismissed),
    };
  } catch {
    return { ...DEFAULTS };
  }
};

/** Best-effort merge-write so updating one flag never clobbers the others. */
export const writeSyncPrefs = async (patch: Partial<SyncPrefs>): Promise<void> => {
  try {
    const current = await readSyncPrefs();
    await AsyncStorage.setItem(SYNC_PREFS_KEY, JSON.stringify({ ...current, ...patch }));
  } catch (error) {
    recordError(error, 'syncPrefs: write failed');
  }
};
