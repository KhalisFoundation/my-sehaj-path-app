import type {
  AngsFormat,
  DateData,
  FontSizeData,
  PathData,
  PathDate,
  VishraamsSource,
} from '../types';
import { SETTINGS_DEFAULTS, type SettingsState } from './slices/settingsSlice';

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

/** App-private keys. Older binaries ignore unknown keys, so these are safe to add. */
export const JOURNAL_KEY = 'reduxWriteJournal_v1';
export const META_KEY = 'reduxLegacyMeta_v1';

export type RawLegacy = Record<LegacyKey, string | null>;

export interface LegacyData {
  settings: Partial<SettingsState>;
  paths: PathData[];
  dates: DateData[];
}

export type ParseResult = { ok: true; value: LegacyData } | { ok: false; issues: string[] };

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
// Validators CHECK required fields; they never rebuild the object. Unknown
// additive fields written by a newer/other build therefore survive untouched.
//
// Documented compatibility upgrades are applied for fields that an older build
// could legitimately have omitted and that have a safe deterministic value.
// Anything else is malformed and fails closed.
//
// NOTE: the exact set of historical shapes must be confirmed by Step 0.0
// (production storage audit). Until then these upgrades are the conservative
// superset of the current TypeScript models.
// ---------------------------------------------------------------------------

const upgradePath = (raw: unknown, issues: string[], index: number): PathData | null => {
  const at = `pathDetails[${index}]`;
  if (!isObject(raw)) {
    issues.push(`${at} is not an object`);
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
    issues.push(`${at}.pathId is missing or invalid`);
    return null;
  }

  // Compatibility upgrade for the earliest shape (pre-April-2025), where the
  // progress position was a top-level `angNumber` with no `saveData` and no
  // verseId. Confirmed from git history: commit 8167721 introduced `saveData`
  // with no migration.
  //
  // The fallback fires ONLY when saveData is ABSENT. A transitional record can
  // legitimately carry both fields (the newer writer added saveData without
  // deleting angNumber); if such a record's saveData is present-but-damaged we
  // must fail closed rather than silently restore the stale top-level angNumber
  // (which would drop the newer verseId/progress).
  let saveData = rawSaveData;
  if (saveData === undefined && isFiniteNumber(legacyAngNumber)) {
    saveData = { angNumber: legacyAngNumber, verseId: 0 };
  }
  if (!isSaveData(saveData)) {
    issues.push(`${at}.saveData is missing or invalid`);
    return null;
  }

  // A wrong type is malformed. An absent value gets a deterministic upgrade.
  if (progress !== undefined && !isFiniteNumber(progress)) {
    issues.push(`${at}.progress is invalid`);
    return null;
  }
  if (pathName !== undefined && !isString(pathName)) {
    issues.push(`${at}.pathName is invalid`);
    return null;
  }
  if (startDate !== undefined && !isString(startDate)) {
    issues.push(`${at}.startDate is invalid`);
    return null;
  }
  if (completionDate !== undefined && !isString(completionDate)) {
    issues.push(`${at}.completionDate is invalid`);
    return null;
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

const upgradeDate = (raw: unknown, issues: string[], index: number): DateData | null => {
  const at = `pathDateDetails[${index}]`;
  if (!isObject(raw)) {
    issues.push(`${at} is not an object`);
    return null;
  }

  const { pathid, dates, scrollPosition } = raw;
  if (!isFiniteNumber(pathid) || pathid <= 0) {
    issues.push(`${at}.pathid is missing or invalid`);
    return null;
  }

  let upgradedDates: PathDate[] = [];
  if (dates !== undefined) {
    if (!Array.isArray(dates)) {
      issues.push(`${at}.dates is not an array`);
      return null;
    }
    if (!dates.every(isPathDate)) {
      issues.push(`${at}.dates contains an invalid entry`);
      return null;
    }
    upgradedDates = dates;
  }

  if (scrollPosition !== undefined && !isFiniteNumber(scrollPosition)) {
    issues.push(`${at}.scrollPosition is invalid`);
    return null;
  }

  return {
    ...raw,
    pathid,
    dates: upgradedDates,
    scrollPosition: scrollPosition ?? 0,
  };
};

// ---------------------------------------------------------------------------
// parseLegacy
// ---------------------------------------------------------------------------

/**
 * Pure. Raw disk strings in, validated data out. Never throws.
 *
 * A MISSING key (null) is normal: it yields the legacy default.
 * A PRESENT but malformed value is an error: we fail closed rather than
 * silently substituting a default, because the caller would then persist that
 * default straight over the user's real bytes.
 */
export const parseLegacy = (raw: RawLegacy): ParseResult => {
  const issues: string[] = [];
  const settings: Partial<SettingsState> = {};

  // --- boolean settings (raw 'true'/'false' strings)
  const readBool = (key: LegacyKey, apply: (value: boolean) => void) => {
    const value = raw[key];
    if (value == null) {
      return;
    }
    const parsed = parseBool(value);
    if (parsed === null) {
      issues.push(`${key} is not "true"/"false"`);
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
    key: LegacyKey,
    guard: (value: unknown) => value is T,
    apply: (value: T) => void
  ) => {
    const value = raw[key];
    if (value == null) {
      return;
    }
    const parsed = parseJson(value);
    if (!parsed.ok) {
      issues.push(`${key} is not valid JSON`);
      return;
    }
    if (!guard(parsed.value)) {
      issues.push(`${key} has an invalid shape`);
      return;
    }
    apply(parsed.value);
  };

  readJson('fontSize', isFontSizeData, (value) => (settings.fontSize = value));
  readJson('vishraamsSource', isVishraamsSource, (value) => (settings.vishraamsSource = value));
  readJson('angsFormat', isAngsFormat, (value) => (settings.angsFormat = value));

  // --- pathDetails
  const paths: PathData[] = [];
  if (raw.pathDetails != null) {
    const parsed = parseJson(raw.pathDetails);
    if (!parsed.ok) {
      issues.push('pathDetails is not valid JSON');
    } else if (!Array.isArray(parsed.value)) {
      issues.push('pathDetails is not an array');
    } else {
      parsed.value.forEach((entry, index) => {
        const upgraded = upgradePath(entry, issues, index);
        if (upgraded) {
          paths.push(upgraded);
        }
      });
    }
  }

  // --- pathDateDetails
  const dates: DateData[] = [];
  if (raw.pathDateDetails != null) {
    const parsed = parseJson(raw.pathDateDetails);
    if (!parsed.ok) {
      issues.push('pathDateDetails is not valid JSON');
    } else if (!Array.isArray(parsed.value)) {
      issues.push('pathDateDetails is not an array');
    } else {
      parsed.value.forEach((entry, index) => {
        const upgraded = upgradeDate(entry, issues, index);
        if (upgraded) {
          dates.push(upgraded);
        }
      });
    }
  }

  // --- invariants
  const seen = new Set<number>();
  for (const path of paths) {
    if (seen.has(path.pathId)) {
      issues.push(`duplicate pathId ${path.pathId}`);
    }
    seen.add(path.pathId);
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, value: { settings, paths, dates } };
};

// ---------------------------------------------------------------------------
// serialization (the inverse of parseLegacy)
// ---------------------------------------------------------------------------

export interface Snapshot {
  settings: SettingsState;
  paths: PathData[];
  dates: DateData[];
}

/**
 * Produces the exact legacy on-disk representation for one key.
 * Booleans MUST be raw 'true'/'false', not JSON-quoted, or an older binary
 * reading `larivaar === 'true'` would silently see false.
 */
export const serializeKey = (key: LegacyKey, snapshot: Snapshot): string => {
  switch (key) {
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
      return JSON.stringify(snapshot.paths);
    case 'pathDateDetails':
      return JSON.stringify(snapshot.dates);
  }
};

/** Which legacy keys differ between two snapshots. */
export const changedKeys = (from: Snapshot | null, to: Snapshot): LegacyKey[] => {
  if (!from) {
    return [...LEGACY_KEYS];
  }
  const changed: LegacyKey[] = [];
  for (const key of LEGACY_KEYS) {
    if (serializeKey(key, from) !== serializeKey(key, to)) {
      changed.push(key);
    }
  }
  // Landmine #12: pathDetails and pathDateDetails must commit as a pair so a
  // crash can never leave a path without its date record (or vice versa).
  const pathPair: LegacyKey[] = ['pathDetails', 'pathDateDetails'];
  if (changed.some((key) => pathPair.includes(key))) {
    for (const key of pathPair) {
      if (!changed.includes(key)) {
        changed.push(key);
      }
    }
  }
  return changed;
};

export const defaultsAsSettings = (): SettingsState => ({ ...SETTINGS_DEFAULTS });
