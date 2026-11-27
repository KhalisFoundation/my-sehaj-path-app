import { normalizeFontSize } from '../constants/FontSize';
import type {
  AngsFormat,
  DateData,
  FontSizeData,
  PathData,
  PathDate,
  VishraamsSource,
} from '../types';
import { SETTINGS_DEFAULTS, type SettingsState } from './slices/settingsSlice';
import type { PersistedSyncState } from './slices/syncSlice';
import { SYNC_META_KEY, serializeSyncMeta } from './syncFormat';

/**
 * The nine keys written by every production build to date. Phase 1 freezes
 * these names AND their on-disk value formats so that a previous binary can
 * still read anything this build writes (rollback safety).
 */
export const LEGACY_KEYS = [
  'pathDetails',
  'pathDateDetails',
  'fontSize',
  'larivaar',
  'paragraphMode',
  'vishraam',
  'vishraamsSource',
  'angsFormat',
  'consent',
] as const;

export type LegacyKey = (typeof LEGACY_KEYS)[number];
export type LegacySettingKey = Exclude<LegacyKey, 'pathDetails' | 'pathDateDetails'>;

/**
 * Every key the write coordinator owns: the nine frozen legacy keys plus the
 * app-private sync-bookkeeping key. Path/date data and the sync intent that
 * describes it are committed through one journal so they stay atomic.
 */
export const DURABLE_KEYS = [...LEGACY_KEYS, SYNC_META_KEY] as const;
export type DurableKey = (typeof DURABLE_KEYS)[number];

/** App-private key. Older binaries ignore unknown keys, so this is safe to add. */
export const JOURNAL_KEY = 'reduxWriteJournal_v1';

export type RawLegacy = Record<LegacyKey, string | null>;

export interface LegacyData {
  settings: Partial<SettingsState>;
  paths: PathData[];
  dates: DateData[];
}

/**
 * Raw JSON values excluded from Redux because they could not be validated.
 * These stay app-private but must be written back alongside valid records so a
 * later save cannot permanently erase data that a future repair may recover.
 */
export interface QuarantinedLegacyRecords {
  paths: unknown[];
  dates: unknown[];
}

export type ParseResult =
  | {
      ok: true;
      value: LegacyData;
      quarantined: string[];
      quarantinedRecords: QuarantinedLegacyRecords;
      settingsToRepair: LegacySettingKey[];
    }
  | { ok: false; issues: string[] };

// ---------------------------------------------------------------------------
// primitives
// ---------------------------------------------------------------------------

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isString = (value: unknown): value is string => typeof value === 'string';

// --- type guards for the settings shapes (no casts needed downstream) -------

const isFontSizeData = (value: unknown): value is FontSizeData =>
  isObject(value) && isString(value.fontSize) && isFiniteNumber(value.number);

const isVishraamsSource = (value: unknown): value is VishraamsSource =>
  isObject(value) &&
  (value.source === 'sttm' || value.source === 'igurbani' || value.source === 'sttm2');

const isAngsFormat = (value: unknown): value is AngsFormat =>
  isObject(value) && (value.format === 'Punjabi' || value.format === 'English');

const isPathDate = (value: unknown): value is PathDate => isObject(value) && isString(value.date);

const isSaveData = (value: unknown): value is PathData['saveData'] =>
  isObject(value) && isFiniteNumber(value.angNumber) && isFiniteNumber(value.verseId);

/**
 * Legacy booleans are raw strings written via `.toString()`.
 * NEVER use Boolean(x) here: Boolean('false') === true.
 */
const parseBool = (raw: string): boolean | null => {
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  return null;
};

const parseJson = (raw: string): { ok: true; value: unknown } | { ok: false } => {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
};

// ---------------------------------------------------------------------------
// record validation
//
// Documented compatibility upgrades are applied for fields that an older build
// could legitimately have omitted and that have a safe deterministic value.
// An invalid individual record is quarantined so one damaged path cannot prevent
// every other path from loading. Malformed path containers still fail closed;
// malformed settings fall back independently because they contain no progress.
//
// NOTE: the exact set of historical shapes must be confirmed by Step 0.0
// (production storage audit). Until then these upgrades are the conservative
// superset of the current TypeScript models.
// ---------------------------------------------------------------------------

/**
 * Upgrades one path record, or returns null to quarantine only that record.
 *
 * Production binaries could write partial records such as
 * `saveData: { verseId: N }` or `progress: null`. Those values cannot be repaired
 * without guessing the user's position, so the record is quarantined while valid
 * sibling records continue to hydrate.
 */
const upgradePath = (
  raw: unknown,
  index: number,
  quarantined: string[],
  invalidPathIds: Set<number>
): PathData | null => {
  const at = `pathDetails[${index}]`;
  if (!isObject(raw)) {
    quarantined.push(`${at} is not an object`);
    return null;
  }

  // `angNumber` (the legacy top-level field) and `saveData` are pulled out of
  // `...rest` so neither the legacy field nor a stale saveData lingers on the
  // upgraded object.
  const {
    pathId,
    angNumber: legacyAngNumber,
    saveData: rawSaveData,
    progress,
    startDate,
    completionDate,
    pathName,
    ...rest
  } = raw;
  if (!isFiniteNumber(pathId) || pathId <= 0) {
    quarantined.push(`${at}.pathId is missing or invalid`);
    return null;
  }

  const quarantine = (reason: string): null => {
    quarantined.push(`${at}.${reason}`);
    invalidPathIds.add(pathId);
    return null;
  };

  // Resolve the resume position. Prefer a present `saveData` (the newer,
  // authoritative field); only fall back to a legacy top-level `angNumber` when
  // saveData is entirely ABSENT, so a transitional record never loses its newer
  // verseId to a stale angNumber.
  let saveData = rawSaveData;
  if (saveData === undefined && isFiniteNumber(legacyAngNumber)) {
    saveData = { angNumber: legacyAngNumber, verseId: 0 };
  }
  if (!isSaveData(saveData)) {
    return quarantine('saveData is missing or invalid');
  }

  if (progress !== undefined && !isFiniteNumber(progress)) {
    return quarantine('progress is invalid');
  }
  if (startDate !== undefined && !isString(startDate)) {
    return quarantine('startDate is invalid');
  }
  if (completionDate !== undefined && !isString(completionDate)) {
    return quarantine('completionDate is invalid');
  }
  if (pathName !== undefined && !isString(pathName)) {
    return quarantine('pathName is invalid');
  }

  // `...rest` preserves unknown additive fields written by a newer/other build;
  // the validated fields then overwrite them.
  return {
    ...rest,
    pathId,
    saveData: { ...saveData, angNumber: saveData.angNumber, verseId: saveData.verseId },
    progress: progress ?? 0,
    startDate: startDate ?? '',
    completionDate: completionDate ?? '',
    pathName: pathName ?? `Path #${pathId}`,
  };
};

/**
 * Upgrades one date record, or returns null to quarantine only that record.
 */
const upgradeDate = (raw: unknown, index: number, quarantined: string[]): DateData | null => {
  const at = `pathDateDetails[${index}]`;
  if (!isObject(raw)) {
    quarantined.push(`${at} is not an object`);
    return null;
  }

  const { pathid, dates, scrollPosition } = raw;
  if (!isFiniteNumber(pathid) || pathid <= 0) {
    quarantined.push(`${at}.pathid is missing or invalid`);
    return null;
  }

  if (dates !== undefined && (!Array.isArray(dates) || !dates.every(isPathDate))) {
    quarantined.push(`${at}.dates is invalid`);
    return null;
  }
  if (scrollPosition !== undefined && !isFiniteNumber(scrollPosition)) {
    quarantined.push(`${at}.scrollPosition is invalid`);
    return null;
  }

  return {
    ...raw,
    pathid,
    dates: dates ?? [],
    scrollPosition: scrollPosition ?? 0,
  };
};

// ---------------------------------------------------------------------------
// parseLegacy
// ---------------------------------------------------------------------------

/**
 * Pure. Raw disk strings in, validated data out. Never throws.
 *
 * A missing key is normal. A malformed path/date container fails closed. Invalid
 * individual path/date records are returned in `quarantined` and omitted from
 * the hydrated value so they cannot brick every valid record. Malformed settings
 * are quarantined independently and scheduled for a best-effort default repair.
 */
export const parseLegacy = (raw: RawLegacy): ParseResult => {
  const issues: string[] = [];
  const quarantined: string[] = [];
  const quarantinedRecords: QuarantinedLegacyRecords = { paths: [], dates: [] };
  const settingsToRepair: LegacySettingKey[] = [];
  const invalidPathIds = new Set<number>();
  const settings: Partial<SettingsState> = {};

  const repairSetting = (key: LegacySettingKey, reason?: string) => {
    if (!settingsToRepair.includes(key)) {
      settingsToRepair.push(key);
    }
    if (reason) {
      quarantined.push(reason);
    }
  };

  // --- boolean settings (raw 'true'/'false' strings)
  const readBool = (key: LegacySettingKey, apply: (value: boolean) => void) => {
    const value = raw[key];
    if (value == null) {
      // The old fetchConsent() eagerly established the default on first boot.
      if (key === 'consent') {
        repairSetting(key);
      }
      return;
    }
    const parsed = parseBool(value);
    if (parsed === null) {
      repairSetting(key, `${key} is not "true"/"false"; using default`);
      return;
    }
    apply(parsed);
  };

  readBool('larivaar', (value) => (settings.larivaar = value));
  readBool('paragraphMode', (value) => (settings.paragraphMode = value));
  readBool('vishraam', (value) => (settings.vishraam = value));
  // legacy key 'consent' -> state field 'analyticsConsent'
  readBool('consent', (value) => (settings.analyticsConsent = value));

  // --- JSON settings
  const readJson = <T>(
    key: LegacySettingKey,
    guard: (value: unknown) => value is T,
    apply: (value: T) => void
  ) => {
    const value = raw[key];
    if (value == null) {
      return;
    }
    const parsed = parseJson(value);
    if (!parsed.ok) {
      repairSetting(key, `${key} is not valid JSON; using default`);
      return;
    }
    if (!guard(parsed.value)) {
      repairSetting(key, `${key} has an invalid shape; using default`);
      return;
    }
    apply(parsed.value);
  };

  // Resolved onto the current scale rather than trusted as-is: the sizes moved
  // when they were aligned to the shared scale, so a value saved by an older
  // can name a size that no longer exists. Matching on the number keeps the text
  // exactly the size the reader chose.
  readJson('fontSize', isFontSizeData, (value) => (settings.fontSize = normalizeFontSize(value)));
  readJson('vishraamsSource', isVishraamsSource, (value) => (settings.vishraamsSource = value));
  readJson('angsFormat', isAngsFormat, (value) => (settings.angsFormat = value));

  // --- pathDetails
  const paths: PathData[] = [];
  const seenPathIds = new Set<number>();
  if (raw.pathDetails != null) {
    const parsed = parseJson(raw.pathDetails);
    if (!parsed.ok) {
      issues.push('pathDetails is not valid JSON');
    } else if (!Array.isArray(parsed.value)) {
      issues.push('pathDetails is not an array');
    } else {
      parsed.value.forEach((entry, index) => {
        const upgraded = upgradePath(entry, index, quarantined, invalidPathIds);
        if (!upgraded) {
          quarantinedRecords.paths.push(entry);
          return;
        }
        if (seenPathIds.has(upgraded.pathId)) {
          quarantined.push(`pathDetails[${index}] duplicates pathId ${upgraded.pathId}`);
          quarantinedRecords.paths.push(entry);
          return;
        }
        seenPathIds.add(upgraded.pathId);
        paths.push(upgraded);
      });
    }
  }

  // --- pathDateDetails
  const dates: DateData[] = [];
  const seenDateIds = new Set<number>();
  if (raw.pathDateDetails != null) {
    const parsed = parseJson(raw.pathDateDetails);
    if (!parsed.ok) {
      issues.push('pathDateDetails is not valid JSON');
    } else if (!Array.isArray(parsed.value)) {
      issues.push('pathDateDetails is not an array');
    } else {
      parsed.value.forEach((entry, index) => {
        const upgraded = upgradeDate(entry, index, quarantined);
        if (!upgraded) {
          quarantinedRecords.dates.push(entry);
          return;
        }
        if (invalidPathIds.has(upgraded.pathid) && !seenPathIds.has(upgraded.pathid)) {
          quarantined.push(
            `pathDateDetails[${index}] belongs to quarantined pathId ${upgraded.pathid}`
          );
          quarantinedRecords.dates.push(entry);
          return;
        }
        if (seenDateIds.has(upgraded.pathid)) {
          quarantined.push(`pathDateDetails[${index}] duplicates pathid ${upgraded.pathid}`);
          quarantinedRecords.dates.push(entry);
          return;
        }
        seenDateIds.add(upgraded.pathid);
        dates.push(upgraded);
      });
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return {
    ok: true,
    value: { settings, paths, dates },
    quarantined,
    quarantinedRecords,
    settingsToRepair,
  };
};

// ---------------------------------------------------------------------------
// serialization (the inverse of parseLegacy)
// ---------------------------------------------------------------------------

export interface Snapshot {
  settings: SettingsState;
  paths: PathData[];
  dates: DateData[];
  sync: PersistedSyncState;
  quarantinedRecords?: QuarantinedLegacyRecords;
}

/**
 * Produces the exact on-disk representation for one durable key.
 * Booleans MUST be raw 'true'/'false', not JSON-quoted, or an older binary
 * reading `larivaar === 'true'` would silently see false.
 */
export const serializeKey = (key: DurableKey, snapshot: Snapshot): string => {
  switch (key) {
    case SYNC_META_KEY:
      return serializeSyncMeta(snapshot.sync);
    case 'larivaar':
      return String(snapshot.settings.larivaar);
    case 'paragraphMode':
      return String(snapshot.settings.paragraphMode);
    case 'vishraam':
      return String(snapshot.settings.vishraam);
    case 'consent':
      return String(snapshot.settings.analyticsConsent);
    case 'fontSize':
      return JSON.stringify(snapshot.settings.fontSize);
    case 'vishraamsSource':
      return JSON.stringify(snapshot.settings.vishraamsSource);
    case 'angsFormat':
      return JSON.stringify(snapshot.settings.angsFormat);
    case 'pathDetails':
      return JSON.stringify([...snapshot.paths, ...(snapshot.quarantinedRecords?.paths ?? [])]);
    case 'pathDateDetails':
      return JSON.stringify([...snapshot.dates, ...(snapshot.quarantinedRecords?.dates ?? [])]);
  }
};

/** Which durable keys differ between two snapshots. */
export const changedKeys = (from: Snapshot | null, to: Snapshot): DurableKey[] => {
  if (!from) {
    return [...DURABLE_KEYS];
  }
  const changed: DurableKey[] = [];
  for (const key of DURABLE_KEYS) {
    if (serializeKey(key, from) !== serializeKey(key, to)) {
      changed.push(key);
    }
  }
  // Landmine #12 + sync atomicity (asymmetric): a change to EITHER path key
  // pulls in its pair AND the sync key, so a path mutation and the UUID mapping /
  // pending op describing it are always durable together (and a crash never
  // leaves a path without its date record). A sync-only change — an ack, or a
  // settings-driven stamp — does NOT drag in the path pair, so a settings save
  // never rewrites path data.
  const atomicGroup: DurableKey[] = ['pathDetails', 'pathDateDetails', SYNC_META_KEY];
  const pathChanged = changed.includes('pathDetails') || changed.includes('pathDateDetails');
  if (pathChanged) {
    for (const key of atomicGroup) {
      if (!changed.includes(key)) {
        changed.push(key);
      }
    }
  }
  return changed;
};

export const defaultsAsSettings = (): SettingsState => ({ ...SETTINGS_DEFAULTS });
