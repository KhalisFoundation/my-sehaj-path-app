import type {
  PathOpKind,
  PendingPathOp,
  PersistedSyncState,
  SyncMeta,
  SyncState,
} from './slices/syncSlice';

/**
 * App-private durable key for sync bookkeeping. Older binaries ignore unknown
 * keys, so adding this alongside the nine frozen legacy keys is rollback-safe.
 */
export const SYNC_META_KEY = 'sehajSyncMeta_v1';

/**
 * Where a corrupt `sehajSyncMeta_v1` is preserved before it is repaired. The raw
 * value is never destroyed: it is the only remaining record of which cloud path
 * each local path belonged to.
 */
export const SYNC_META_RECOVERY_KEY = 'sehajSyncMetaRecovery_v1';

/** Outcome of reading and validating `sehajSyncMeta_v1`. */
export type SyncParseResult =
  /** No key on disk — a first install or a pre-sync upgrade. */
  | { status: 'empty' }
  /** Present and fully valid. */
  | { status: 'valid'; value: PersistedSyncState }
  /**
   * Present but malformed. The caller keeps the raw value untouched, hydrates
   * empty runtime metadata, and disables cloud sync until an explicit repair.
   */
  | { status: 'recovery' };

// ---------------------------------------------------------------------------
// primitives
// ---------------------------------------------------------------------------

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNonNegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isNullableTimestamp = (value: unknown): value is number | null =>
  value === null || isFiniteNonNegative(value);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POSITIVE_INT_KEY_RE = /^[1-9][0-9]*$/;
const OP_KINDS: readonly PathOpKind[] = ['create', 'update', 'delete'];

/** Rejects unknown/extra fields (e.g. a leaked token) by requiring an exact key set. */
const hasExactKeys = (value: Record<string, unknown>, allowed: readonly string[]): boolean => {
  const keys = Object.keys(value);
  return keys.length === allowed.length && keys.every((key) => allowed.includes(key));
};

const META_KEYS = [
  'serverPathId',
  'serverUpdatedAt',
  'localUpdatedAt',
  'startDate',
  'deletedAt',
  'onServer',
] as const;
const META_KEYS_WITH_SERVER_CREATED_AT = [...META_KEYS, 'serverCreatedAt'] as const;

const OP_KEYS = ['kind', 'localUpdatedAt'] as const;

const TOP_LEVEL_KEYS = [
  'version',
  'account',
  'lastSyncedAt',
  'meta',
  'pathOps',
  'scrollDirty',
  'settingsUpdatedAt',
  'pendingSettingsUpdatedAt',
] as const;

const isSyncMeta = (value: unknown): value is SyncMeta =>
  isObject(value) &&
  (hasExactKeys(value, META_KEYS) || hasExactKeys(value, META_KEYS_WITH_SERVER_CREATED_AT)) &&
  typeof value.serverPathId === 'string' &&
  UUID_RE.test(value.serverPathId) &&
  isFiniteNonNegative(value.serverUpdatedAt) &&
  isFiniteNonNegative(value.localUpdatedAt) &&
  isFiniteNonNegative(value.startDate) &&
  (value.serverCreatedAt === undefined || isFiniteNonNegative(value.serverCreatedAt)) &&
  isNullableTimestamp(value.deletedAt) &&
  typeof value.onServer === 'boolean';

const isPendingPathOp = (value: unknown): value is PendingPathOp =>
  isObject(value) &&
  hasExactKeys(value, OP_KEYS) &&
  typeof value.kind === 'string' &&
  (OP_KINDS as readonly string[]).includes(value.kind) &&
  isFiniteNonNegative(value.localUpdatedAt);

/** Every key is a canonical positive integer; every value passes `isValue`. */
const isNumericKeyedRecord = (
  value: unknown,
  isValue: (v: unknown) => boolean
): value is Record<string, unknown> => {
  if (!isObject(value)) {
    return false;
  }
  return Object.entries(value).every(
    ([key, entry]) => POSITIVE_INT_KEY_RE.test(key) && isValue(entry)
  );
};

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

export const emptyPersistedSync = (): PersistedSyncState => ({
  version: 1,
  account: null,
  lastSyncedAt: 0,
  meta: {},
  pathOps: {},
  scrollDirty: {},
  settingsUpdatedAt: 0,
  pendingSettingsUpdatedAt: null,
});

/**
 * Best-effort `localPathId → serverPathId` rescue from a blob that failed strict
 * validation. Only well-formed, unique UUIDs under canonical integer keys are
 * kept; account, operations, timestamps and tombstones are all discarded because
 * a malformed document cannot be trusted to describe them.
 *
 * Reusing a salvaged UUID is what stops a repair from re-uploading the account's
 * paths under new ids and duplicating every path in the cloud.
 */
export const salvageUuidMappings = (raw: string | null): Record<number, string> => {
  if (raw == null) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!isObject(parsed) || !isObject(parsed.meta)) {
    return {};
  }

  const salvaged: Record<number, string> = {};
  const claimed = new Set<string>();
  Object.entries(parsed.meta).forEach(([key, entry]) => {
    if (!POSITIVE_INT_KEY_RE.test(key) || !isObject(entry)) {
      return;
    }
    const uuid = entry.serverPathId;
    // A duplicated UUID is ambiguous — two local paths cannot own one cloud
    // path — so neither claim is trusted beyond the first.
    if (typeof uuid !== 'string' || !UUID_RE.test(uuid) || claimed.has(uuid)) {
      return;
    }
    claimed.add(uuid);
    salvaged[Number(key)] = uuid;
  });
  return salvaged;
};

/**
 * Best-effort owner recovery from malformed sync metadata. A readable account
 * is still trustworthy enough to prevent one account's local paths from being
 * repaired and uploaded under another account's JWT. Missing/invalid ownership
 * stays unknown so an explicitly confirmed first-account repair can continue.
 */
export const salvageAccountOwner = (raw: string | null): string | null => {
  if (raw == null) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed) || typeof parsed.account !== 'string') {
      return null;
    }
    const account = parsed.account.trim();
    return account === '' ? null : account;
  } catch {
    return null;
  }
};

/** Extracts the persisted subset of the runtime slice; never includes the token. */
export const toPersisted = (sync: SyncState): PersistedSyncState => ({
  version: 1,
  account: sync.account,
  lastSyncedAt: sync.lastSyncedAt,
  meta: sync.meta,
  pathOps: sync.pathOps,
  scrollDirty: sync.scrollDirty,
  settingsUpdatedAt: sync.settingsUpdatedAt,
  pendingSettingsUpdatedAt: sync.pendingSettingsUpdatedAt,
});

export const serializeSyncMeta = (sync: PersistedSyncState): string => JSON.stringify(sync);

/**
 * Pure, never throws. Strictly validates `sehajSyncMeta_v1`:
 * - absent key -> empty (first upgrade);
 * - unknown version, invalid UUID/timestamp/enum, a dangling op or scroll
 *   reference, or any extra field -> recovery (the caller preserves the raw
 *   value and disables cloud sync);
 * - otherwise -> valid.
 */
export const parseSyncMeta = (raw: string | null): SyncParseResult => {
  if (raw == null) {
    return { status: 'empty' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'recovery' };
  }

  if (!isObject(parsed) || !hasExactKeys(parsed, TOP_LEVEL_KEYS)) {
    return { status: 'recovery' };
  }
  if (parsed.version !== 1) {
    return { status: 'recovery' };
  }
  if (parsed.account !== null && typeof parsed.account !== 'string') {
    return { status: 'recovery' };
  }
  if (
    !isFiniteNonNegative(parsed.lastSyncedAt) ||
    !isFiniteNonNegative(parsed.settingsUpdatedAt) ||
    !isNullableTimestamp(parsed.pendingSettingsUpdatedAt)
  ) {
    return { status: 'recovery' };
  }
  if (
    !isNumericKeyedRecord(parsed.meta, isSyncMeta) ||
    !isNumericKeyedRecord(parsed.pathOps, isPendingPathOp) ||
    !isNumericKeyedRecord(parsed.scrollDirty, isFiniteNonNegative)
  ) {
    return { status: 'recovery' };
  }

  // Every pending op and dirty-scroll entry must reference existing metadata,
  // or the outbox could act on a path with no UUID mapping.
  const metaKeys = new Set(Object.keys(parsed.meta));
  const referencesMeta = (record: Record<string, unknown>) =>
    Object.keys(record).every((key) => metaKeys.has(key));
  if (!referencesMeta(parsed.pathOps) || !referencesMeta(parsed.scrollDirty)) {
    return { status: 'recovery' };
  }

  return { status: 'valid', value: parsed as unknown as PersistedSyncState };
};
