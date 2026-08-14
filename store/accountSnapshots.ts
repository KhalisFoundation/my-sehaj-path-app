import AsyncStorage from '@react-native-async-storage/async-storage';
import { recordError } from '../utils/crashlytics';
import {
  LEGACY_KEYS,
  parseLegacy,
  serializeKey,
  type RawLegacy,
  type Snapshot,
} from './legacyFormat';
import { parseSyncMeta } from './syncFormat';
import { SETTINGS_DEFAULTS } from './slices/settingsSlice';

export const ACCOUNT_SNAPSHOTS_KEY = 'sehajAccountSnapshots_v1';

/**
 * Where a malformed snapshot bag is preserved before a fresh one replaces it.
 * Refusing to write forever would permanently block account switching with no
 * way out, so the corrupt value is archived rather than kept in the way.
 */
export const ACCOUNT_SNAPSHOTS_RECOVERY_KEY = 'sehajAccountSnapshotsRecovery_v1';

interface StoredAccountSnapshot {
  version: 1;
  legacy: RawLegacy;
  syncMeta: string;
}

interface AccountSnapshotEnvelope {
  version: 1;
  accounts: Record<string, StoredAccountSnapshot>;
}

export type AccountSnapshotRead =
  | { status: 'absent' }
  | { status: 'valid'; snapshot: Snapshot }
  | { status: 'recovery' };

const emptyEnvelope = (): AccountSnapshotEnvelope => ({ version: 1, accounts: {} });

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStoredSnapshot = (value: unknown): value is StoredAccountSnapshot => {
  if (!isObject(value) || value.version !== 1 || !isObject(value.legacy)) {
    return false;
  }
  const { legacy } = value;
  return (
    typeof value.syncMeta === 'string' &&
    LEGACY_KEYS.every((key) => legacy[key] === null || typeof legacy[key] === 'string')
  );
};

const parseEnvelope = (raw: string | null): AccountSnapshotEnvelope | null => {
  if (raw === null) {
    return emptyEnvelope();
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed) || parsed.version !== 1 || !isObject(parsed.accounts)) {
      return null;
    }
    if (!Object.values(parsed.accounts).every(isStoredSnapshot)) {
      return null;
    }
    return parsed as unknown as AccountSnapshotEnvelope;
  } catch {
    return null;
  }
};

const accountKey = (email: string): string => email.trim().toLowerCase();

const encodeSnapshot = (snapshot: Snapshot): StoredAccountSnapshot => {
  const legacy = {} as RawLegacy;
  for (const key of LEGACY_KEYS) {
    legacy[key] = serializeKey(key, snapshot);
  }
  return {
    version: 1,
    legacy,
    syncMeta: serializeKey('sehajSyncMeta_v1', snapshot),
  };
};

const decodeSnapshot = (stored: StoredAccountSnapshot, owner: string): AccountSnapshotRead => {
  const legacy = parseLegacy(stored.legacy);
  const sync = parseSyncMeta(stored.syncMeta);
  if (!legacy.ok || sync.status !== 'valid' || accountKey(sync.value.account ?? '') !== owner) {
    return { status: 'recovery' };
  }
  return {
    status: 'valid',
    snapshot: {
      settings: { ...SETTINGS_DEFAULTS, ...legacy.value.settings },
      paths: legacy.value.paths,
      dates: legacy.value.dates,
      sync: sync.value,
      quarantinedRecords: legacy.quarantinedRecords,
    },
  };
};

/**
 * Writes one account copy without touching the active legacy keys. The full bag
 * is verified after writing, so a failed stash can never authorize a switch.
 */
export const saveAccountSnapshot = async (email: string, snapshot: Snapshot): Promise<boolean> => {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNT_SNAPSHOTS_KEY);
    let envelope = parseEnvelope(raw);
    if (!envelope) {
      // Archive the unreadable bag (verified) and continue with a fresh one.
      // Nothing is destroyed, and the user is not locked out of switching
      // accounts forever by one corrupt value.
      if (raw !== null) {
        await AsyncStorage.setItem(ACCOUNT_SNAPSHOTS_RECOVERY_KEY, raw);
        if ((await AsyncStorage.getItem(ACCOUNT_SNAPSHOTS_RECOVERY_KEY)) !== raw) {
          recordError(
            new Error('malformed account snapshot storage could not be archived'),
            'accountSnapshots: refusing to overwrite malformed storage'
          );
          return false;
        }
      }
      recordError(
        new Error('account snapshot storage was malformed; archived and reset'),
        'accountSnapshots: malformed storage archived'
      );
      envelope = emptyEnvelope();
    }
    const key = accountKey(email);
    const next: AccountSnapshotEnvelope = {
      version: 1,
      accounts: { ...envelope.accounts, [key]: encodeSnapshot(snapshot) },
    };
    const encoded = JSON.stringify(next);
    await AsyncStorage.setItem(ACCOUNT_SNAPSHOTS_KEY, encoded);
    return (await AsyncStorage.getItem(ACCOUNT_SNAPSHOTS_KEY)) === encoded;
  } catch (error) {
    recordError(error, 'accountSnapshots: save failed');
    return false;
  }
};

/**
 * Drops one account's stashed copy. Called once that account has been activated
 * and made durable: the live keys are now the authoritative copy, so keeping the
 * stash would just accumulate stale duplicates of every account ever used here.
 * Best-effort — a failure only leaves a redundant copy behind.
 */
export const removeAccountSnapshot = async (email: string): Promise<void> => {
  try {
    const envelope = parseEnvelope(await AsyncStorage.getItem(ACCOUNT_SNAPSHOTS_KEY));
    if (!envelope) {
      return; // malformed: leave it for saveAccountSnapshot's archive path
    }
    const key = accountKey(email);
    if (!(key in envelope.accounts)) {
      return;
    }
    const accounts = { ...envelope.accounts };
    delete accounts[key];
    await AsyncStorage.setItem(
      ACCOUNT_SNAPSHOTS_KEY,
      JSON.stringify({ version: 1, accounts } satisfies AccountSnapshotEnvelope)
    );
  } catch (error) {
    recordError(error, 'accountSnapshots: eviction failed');
  }
};

/** A corrupt saved account is preserved and reported; callers must not replace it. */
export const readAccountSnapshot = async (email: string): Promise<AccountSnapshotRead> => {
  try {
    const envelope = parseEnvelope(await AsyncStorage.getItem(ACCOUNT_SNAPSHOTS_KEY));
    if (!envelope) {
      return { status: 'recovery' };
    }
    const key = accountKey(email);
    const stored = envelope.accounts[key];
    return stored ? decodeSnapshot(stored, key) : { status: 'absent' };
  } catch (error) {
    recordError(error, 'accountSnapshots: read failed');
    return { status: 'recovery' };
  }
};
