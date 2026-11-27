import AsyncStorage from '@react-native-async-storage/async-storage';
import { recordError } from '../utils/crashlytics';
import type { AppStore, RootState } from './index';
import {
  DURABLE_KEYS,
  JOURNAL_KEY,
  LEGACY_KEYS,
  changedKeys,
  parseLegacy,
  serializeKey,
  type DurableKey,
  type LegacyKey,
  type LegacySettingKey,
  type QuarantinedLegacyRecords,
  type RawLegacy,
  type Snapshot,
} from './legacyFormat';
import { SYNC_META_KEY, parseSyncMeta, toPersisted, type SyncParseResult } from './syncFormat';
import { setAll } from './slices/pathsSlice';
import { hydrateSettings } from './slices/settingsSlice';
import { hydrateEmptySync, hydrateSync, hydrateSyncRecovery } from './slices/syncSlice';

const READ_ATTEMPTS = 3;
const COMMIT_ATTEMPTS = 2;
const RETRY_BASE_MS = 20;

/**
 * Quarantined raw records are deliberately kept outside Redux: screens must not
 * render or mutate invalid data. Associating them with the store still lets the
 * persistence coordinator carry them through every later path write.
 */
const quarantinedRecordsByStore = new WeakMap<AppStore, QuarantinedLegacyRecords>();

/**
 * True when this device is holding damaged path/date records.
 *
 * These are real user data that `legacyFormat` could not parse, kept so one bad
 * record cannot lock the reader out. They are deliberately NOT in Redux (they must
 * never render), so a plain selector cannot see them — which is why "does this
 * device have local data?" has to be asked through the store, not the state.
 */
export const hasQuarantinedRecords = (store: AppStore): boolean => {
  const records = quarantinedRecordsByStore.get(store);
  return (records?.paths.length ?? 0) > 0 || (records?.dates.length ?? 0) > 0;
};

/**
 * Returns identifiable path IDs held outside Redux so createPath cannot reuse
 * an identity belonging to preserved-but-quarantined user data.
 */
export const getQuarantinedPathIds = (store: AppStore): number[] => {
  const records = quarantinedRecordsByStore.get(store);
  if (!records) {
    return [];
  }

  const ids: number[] = [];
  const reserve = (value: unknown, key: 'pathId' | 'pathid') => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return;
    }
    const id = (value as Record<string, unknown>)[key];
    if (typeof id === 'number' && Number.isFinite(id) && id > 0) {
      ids.push(id);
    }
  };

  records.paths.forEach((record) => reserve(record, 'pathId'));
  records.dates.forEach((record) => reserve(record, 'pathid'));
  return ids;
};

/**
 * A pending write batch.
 *
 * `after` is what the write intends to store. `before` is what those keys held
 * just before the write. Recording both lets recovery detect a CONFLICT: if the
 * on-disk value matches neither, a different build changed the data since this
 * journal was written (e.g. a downgrade wrote newer progress), and replaying
 * would clobber it — so recovery preserves the disk instead.
 */
interface Journal {
  before: Partial<Record<DurableKey, string | null>>;
  after: Partial<Record<DurableKey, string>>;
}

export const captureDurableSnapshot = (store: AppStore): Snapshot => {
  const state: RootState = store.getState();
  return {
    settings: state.settings,
    paths: state.paths.paths,
    dates: state.paths.dates,
    sync: toPersisted(state.sync),
    quarantinedRecords: quarantinedRecordsByStore.get(store),
  };
};

/** Restores quarantined rows alongside an account snapshot without exposing them to screens. */
export const setQuarantinedRecords = (
  store: AppStore,
  records: QuarantinedLegacyRecords | undefined
): void => {
  quarantinedRecordsByStore.set(store, records ?? { paths: [], dates: [] });
};

const snapshotOf = captureDurableSnapshot;

/** Both durable slices must be hydrated before any write may touch the disk. */
const isHydrated = (state: RootState): boolean => state.paths.hydrated && state.sync.hydrated;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(() => resolve(), ms));

/** Confirms every written value is actually readable back at its key. */
const verifyWritten = async (entries: Array<[DurableKey, string]>): Promise<boolean> => {
  const found = await AsyncStorage.multiGet(entries.map(([key]) => key));
  const byKey = new Map(found.map(([key, value]) => [key, value]));
  return entries.every(([key, value]) => byKey.get(key) === value);
};

// ---------------------------------------------------------------------------
// journal recovery
// ---------------------------------------------------------------------------

const isDurableKey = (value: string): value is DurableKey =>
  (DURABLE_KEYS as readonly string[]).includes(value);

const isKeyMap = (value: unknown, allowNull: boolean): boolean => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.entries(value).every(
    ([key, entry]) =>
      isDurableKey(key) && (typeof entry === 'string' || (allowNull && entry === null))
  );
};

const isJournal = (value: unknown): value is Journal => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const { before, after } = value as { before?: unknown; after?: unknown };
  // `before` may hold nulls (a key that did not exist yet); `after` never does.
  if (!isKeyMap(before, true) || !isKeyMap(after, false)) {
    return false;
  }
  // Every touched key must appear in BOTH maps. A `before` entry missing for an
  // `after` key would otherwise be read as `null` and silently misclassify the
  // recovery, so reject the journal as malformed instead.
  const beforeKeys = Object.keys(before as object);
  const afterKeys = Object.keys(after as object);
  const sameKeys =
    beforeKeys.length === afterKeys.length && afterKeys.every((key) => key in (before as object));
  if (!sameKeys) {
    return false;
  }

  // Path data is one logical record split across two legacy keys. A trustworthy
  // journal must contain both halves or neither; accepting only one would let
  // recovery boot a path/date combination that was never committed together.
  const hasPathDetails = afterKeys.includes('pathDetails');
  const hasPathDateDetails = afterKeys.includes('pathDateDetails');
  return hasPathDetails === hasPathDateDetails;
};

/**
 * Resolves a pending write batch left behind by a process that died mid-commit.
 *
 * The journal records both the `before` and the `after` value of every key it
 * touched, so recovery can tell three cases apart per key:
 *   - disk === after   -> the write already landed; nothing to do.
 *   - disk === before  -> the write was interrupted; complete it.
 *   - disk === neither  -> FOREIGN: a different build changed this key since the
 *                          journal was written (e.g. the app was downgraded to
 *                          an older build that saved newer progress, then
 *                          upgraded again).
 *
 * Foreign keys are never replayed (that would clobber the newer data):
 *   - A single-key journal has no cross-key atomicity to prove. Preserve the
 *     foreign value, remove the stale journal, and continue to hydration.
 *   - A multi-key journal is ambiguous even when every key is foreign. Older
 *     builds write pathDetails/pathDateDetails sequentially, so those values
 *     cannot be proven to belong to one snapshot. Preserve EVERYTHING (including
 *     the journal), write nothing, and fail hydration closed.
 *
 * Returns false when a journal exists but cannot be read/parsed, a genuine
 * completion write cannot be verified, or a multi-key conflict is detected; the
 * caller then fails closed.
 */
export const recoverPendingJournal = async (): Promise<boolean> => {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(JOURNAL_KEY);
  } catch (error) {
    recordError(error, 'persistence: failed to read write journal');
    return false;
  }

  if (!raw) {
    return true; // nothing pending — the common path
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    recordError(new Error('write journal is not valid JSON'), 'persistence: journal malformed');
    return false;
  }

  if (!isJournal(parsed)) {
    recordError(new Error('write journal has an invalid shape'), 'persistence: journal malformed');
    return false;
  }

  const keys = (Object.keys(parsed.after) as DurableKey[]).filter(isDurableKey);
  if (keys.length === 0) {
    await AsyncStorage.removeItem(JOURNAL_KEY);
    return true;
  }

  try {
    const found = await AsyncStorage.multiGet(keys);
    const disk = new Map(found.map(([key, value]) => [key, value ?? null]));

    const toComplete: Array<[DurableKey, string]> = [];
    let foreignCount = 0;
    for (const key of keys) {
      const current = disk.get(key) ?? null;
      const after = parsed.after[key] as string;
      const before = parsed.before[key] ?? null;

      if (current === after) {
        continue; // already applied
      }
      if (current === before) {
        toComplete.push([key, after]); // interrupted write — finish it
        continue;
      }
      foreignCount += 1; // a foreign writer moved this key off both known values
    }

    if (foreignCount > 0) {
      if (keys.length === 1) {
        // No paired state is involved. Keep the foreign value and discard the
        // stale intent so future boots do not repeatedly report the conflict.
        recordError(
          new Error('single-key write journal superseded by foreign data; preserving disk'),
          'persistence: journal conflict'
        );
        await AsyncStorage.removeItem(JOURNAL_KEY);
        return true;
      }
      // Multiple keys were intended as one batch, but at least one is foreign.
      // Even all-foreign values may come from interrupted sequential legacy
      // writes, so preserve everything and fail closed rather than guess.
      recordError(
        new Error('multi-key write journal conflicts with on-disk data; failing closed'),
        'persistence: journal multi-key conflict'
      );
      return false;
    }

    if (toComplete.length > 0) {
      await AsyncStorage.multiSet(toComplete);
      if (!(await verifyWritten(toComplete))) {
        return false;
      }
    }
    // Journal is removed only once every value is durable and verified.
    await AsyncStorage.removeItem(JOURNAL_KEY);
    return true;
  } catch (error) {
    recordError(error, 'persistence: failed to replay write journal');
    return false;
  }
};

// ---------------------------------------------------------------------------
// hydration
// ---------------------------------------------------------------------------

const readAllLegacy = async (): Promise<RawLegacy> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= READ_ATTEMPTS; attempt += 1) {
    try {
      const pairs = await AsyncStorage.multiGet([...LEGACY_KEYS]);
      const byKey = new Map(pairs.map(([key, value]) => [key, value]));
      const raw: RawLegacy = {
        pathDetails: byKey.get('pathDetails') ?? null,
        pathDateDetails: byKey.get('pathDateDetails') ?? null,
        fontSize: byKey.get('fontSize') ?? null,
        larivaar: byKey.get('larivaar') ?? null,
        paragraphMode: byKey.get('paragraphMode') ?? null,
        vishraam: byKey.get('vishraam') ?? null,
        vishraamsSource: byKey.get('vishraamsSource') ?? null,
        angsFormat: byKey.get('angsFormat') ?? null,
        consent: byKey.get('consent') ?? null,
      };
      return raw;
    } catch (error) {
      lastError = error;
      if (attempt < READ_ATTEMPTS) {
        await delay(50 * attempt);
      }
    }
  }
  throw lastError;
};

/**
 * Reads and validates `sehajSyncMeta_v1`. A malformed value or a read failure
 * fails SOFT to recovery (keep local data, disable cloud sync until an explicit
 * repair) rather than blocking the whole boot — path data has already been read.
 */
const readSyncMeta = async (): Promise<SyncParseResult> => {
  try {
    return parseSyncMeta(await AsyncStorage.getItem(SYNC_META_KEY));
  } catch (error) {
    recordError(error, 'persistence: failed to read sync metadata');
    return { status: 'recovery' };
  }
};

/**
 * Repairs only settings that were malformed, plus the historically eager
 * consent default. This intentionally cannot accept either path key.
 *
 * Settings are recoverable preferences, so failure is reported but never blocks
 * boot. Path parsing has already succeeded before this runs.
 */
const repairLegacySettings = async (store: AppStore, keys: LegacySettingKey[]): Promise<void> => {
  if (keys.length === 0) {
    return;
  }

  const snapshot = snapshotOf(store);
  const entries: Array<[LegacyKey, string]> = keys.map((key) => [key, serializeKey(key, snapshot)]);

  try {
    await AsyncStorage.multiSet(entries);
    if (!(await verifyWritten(entries))) {
      throw new Error('settings repair verification mismatch');
    }
  } catch (error) {
    recordError(error, 'persistence: settings repair failed');
  }
};

/**
 * Recover -> read -> validate -> dispatch.
 *
 * Parse-then-commit: nothing is dispatched until every key has been read and
 * validated, so a failure leaves the store (and therefore the disk) untouched.
 * Returns false on failure; the caller must show the fail-closed screen.
 */
interface HydrateStoreOptions {
  /** Called once when malformed settings were safely replaced with defaults. */
  onSettingsRecovered?: (keys: LegacySettingKey[]) => void;
}

export const hydrateStore = async (
  store: AppStore,
  options: HydrateStoreOptions = {}
): Promise<boolean> => {
  try {
    const recovered = await recoverPendingJournal();
    if (!recovered) {
      return false;
    }

    const raw = await readAllLegacy();
    const parsed = parseLegacy(raw);

    if (!parsed.ok) {
      // Path containers are user progress. Never replace malformed path data
      // with defaults or attempt settings repairs during a failed path boot.
      recordError(
        new Error(`legacy data is malformed: ${parsed.issues.join('; ')}`),
        'persistence: hydration failed closed'
      );
      return false;
    }

    if (parsed.quarantined.length > 0) {
      recordError(
        new Error(`legacy values quarantined: ${parsed.quarantined.join('; ')}`),
        'persistence: hydrated with quarantined values'
      );
    }

    // Sync metadata is validated independently: a malformed sync key must not
    // block legacy path hydration, and vice versa.
    const syncResult = await readSyncMeta();

    quarantinedRecordsByStore.set(store, parsed.quarantinedRecords);
    store.dispatch(hydrateSettings(parsed.value.settings));
    store.dispatch(setAll({ paths: parsed.value.paths, dates: parsed.value.dates }));
    switch (syncResult.status) {
      case 'valid':
        store.dispatch(hydrateSync(syncResult.value));
        break;
      case 'recovery':
        // Preserve the raw value untouched (we never write it here) and disable
        // cloud sync until the user repairs it from Sync now.
        recordError(
          new Error('sync metadata malformed; cloud sync disabled until repair'),
          'persistence: sync metadata recovery'
        );
        store.dispatch(hydrateSyncRecovery());
        break;
      default:
        // Absent key: a first install or pre-sync upgrade.
        store.dispatch(hydrateEmptySync());
        break;
    }
    await repairLegacySettings(store, parsed.settingsToRepair);

    // A missing consent key is normal on first install and is eagerly
    // initialized for legacy compatibility. Notify only for keys that existed
    // but were malformed and therefore had to be recovered.
    const recoveredSettings = parsed.settingsToRepair.filter((key) => raw[key] !== null);
    if (recoveredSettings.length > 0 && options.onSettingsRecovered) {
      try {
        options.onSettingsRecovered(recoveredSettings);
      } catch (error) {
        // A presentation callback must never turn a successful, data-safe
        // hydration into a fail-closed boot.
        recordError(error, 'persistence: settings recovery notification failed');
      }
    }
    return true;
  } catch (error) {
    recordError(error, 'persistence: hydration failed');
    return false;
  }
};

// ---------------------------------------------------------------------------
// write coordinator
// ---------------------------------------------------------------------------

/** The production surface used by the app. */
export interface LegacyPersistence {
  start: () => void;
  stop: () => void;
  /** Resolves true only once the snapshot current at call time is durable. */
  flush: () => Promise<boolean>;
  /**
   * False once `stop()` has made the coordinator inert.
   *
   * `flush()` answers `false` both when a write was attempted and failed and
   * when it refused to run at all, and those mean opposite things: the first is
   * a disk the app could not write to, the second is a writer that was
   * deliberately shut down with nothing written and nothing at risk. Callers
   * that report or alert on a failed save need to tell them apart.
   */
  isRunning: () => boolean;
}

/**
 * Adds diagnostics used only by tests. Kept off `LegacyPersistence` so the
 * production surface stays minimal and no long-lived state is tracked just for
 * assertions.
 */
export interface LegacyPersistenceInternal extends LegacyPersistence {
  getStatus: () => { running: boolean; dirty: boolean };
}

/**
 * Owns every AsyncStorage write.
 *
 * - Only ONE write is in flight at a time, so an older batch can never land
 *   after a newer one (landmine #11).
 * - Rapid changes coalesce to the newest snapshot rather than queueing.
 * - Every batch is journalled first, verified after, and the journal removed
 *   last, so a crash mid-commit is recoverable (landmine #12).
 * - Refuses to write until `paths.hydrated` is true (landmine #2).
 */
export const createLegacyPersistence = (store: AppStore): LegacyPersistenceInternal => {
  let unsubscribe: (() => void) | null = null;
  let baseline: Snapshot | null = null; // last snapshot verified on disk
  /** Newest un-persisted snapshot, tagged with its sequence number. */
  let pending: { snapshot: Snapshot; seq: number } | null = null;
  let draining = false;
  let stopped = false;
  let seq = 0;

  /**
   * Waiters are keyed by sequence number, NOT by snapshot identity.
   *
   * Snapshots are full state, so committing sequence N also makes every earlier
   * sequence durable. Matching on snapshot equality instead would hang a waiter
   * forever whenever its snapshot was coalesced away by a newer one — which
   * happens routinely during auto-scroll.
   */
  // Each waiter also carries the snapshot it is waiting on, so the stop() path
  // can resolve it TRUE when that exact data is already durable on disk (even if
  // its sequence number is newer than the in-flight commit that made it durable).
  let waiters: Array<{ seq: number; target: Snapshot; resolve: (ok: boolean) => void }> = [];

  const settleUpTo = (committedSeq: number) => {
    const remaining: typeof waiters = [];
    for (const waiter of waiters) {
      if (waiter.seq <= committedSeq) {
        waiter.resolve(true);
      } else {
        remaining.push(waiter);
      }
    }
    waiters = remaining;
  };

  const settleFailure = () => {
    const current = waiters;
    waiters = [];
    current.forEach((waiter) => waiter.resolve(false));
  };

  // Used when the coordinator stops. A waiter whose data already matches the
  // durable baseline resolves TRUE (its save DID reach disk); the rest, whose
  // writes will never run now, resolve false. This prevents a save that actually
  // committed just before stop() from being reported as a false failure (which
  // would make the command roll Redux back and diverge from disk).
  const settleStopped = () => {
    const current = waiters;
    waiters = [];
    current.forEach((waiter) => {
      const durable = baseline !== null && changedKeys(baseline, waiter.target).length === 0;
      waiter.resolve(durable);
    });
  };

  const enqueue = (snapshot: Snapshot): number => {
    seq += 1;
    pending = { snapshot, seq };
    return seq;
  };

  const commitBatch = async (snapshot: Snapshot, keys: DurableKey[]): Promise<boolean> => {
    const entries: Array<[DurableKey, string]> = keys.map((key) => [
      key,
      serializeKey(key, snapshot),
    ]);

    const after: Partial<Record<DurableKey, string>> = {};
    for (const [key, value] of entries) {
      after[key] = value;
    }

    // Record what each key held before this write so recovery can distinguish an
    // interrupted write from a conflicting one. `before` MUST be the exact raw
    // bytes currently on disk — NOT a re-serialization of the in-memory
    // baseline. Hydration upgrades old on-disk shapes (adds saveData/pathName/
    // scrollPosition), so the baseline can serialize to something that differs
    // byte-for-byte from the untouched legacy bytes; using it would make the
    // first post-upgrade interrupted write look like a conflict.
    const found = await AsyncStorage.multiGet(keys);
    const before: Partial<Record<DurableKey, string | null>> = {};
    for (const [key, value] of found) {
      before[key as DurableKey] = value ?? null;
    }

    const journal: Journal = { before, after };

    // Journal first, then the keys, then remove the journal — so a crash between
    // the two path keys is recoverable (the journal replays the complete pair).
    await AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(journal));
    await AsyncStorage.multiSet(entries);

    if (!(await verifyWritten(entries))) {
      throw new Error('post-write verification mismatch');
    }

    await AsyncStorage.removeItem(JOURNAL_KEY);
    return true;
  };

  const drain = async () => {
    if (draining || stopped) {
      return;
    }
    draining = true;
    try {
      while (pending) {
        if (stopped) {
          // Stopped mid-drain: do not write anything further. Waiters whose data
          // is already durable resolve true; the rest resolve false so nothing
          // hangs. (A write that just committed above must report success.)
          settleStopped();
          return;
        }
        const target = pending;
        pending = null;

        // In recovery mode the on-disk sehajSyncMeta_v1 is malformed and MUST be
        // preserved untouched until the user explicitly repairs it. Path/settings
        // still persist, but the sync key is never written — otherwise the triple
        // rule would clobber the raw corrupt value with a clean empty one.
        const recovering = store.getState().sync.recoveryNeeded;
        const keys = changedKeys(baseline, target.snapshot).filter(
          (key) => !recovering || key !== SYNC_META_KEY
        );
        if (keys.length === 0) {
          baseline = target.snapshot;
          settleUpTo(target.seq);
          continue;
        }

        // Capped retry with backoff. A transient failure anywhere in the batch
        // (including the journal write itself) must not silently drop the
        // update, so retry here rather than waiting for the next state change.
        let committed = false;
        for (let attempt = 1; attempt <= COMMIT_ATTEMPTS; attempt += 1) {
          try {
            await commitBatch(target.snapshot, keys);
            committed = true;
            break;
          } catch (error) {
            recordError(error, `persistence: commit attempt ${attempt} failed`);
            if (attempt < COMMIT_ATTEMPTS) {
              await delay(RETRY_BASE_MS * attempt);
            }
          }
        }

        if (committed) {
          baseline = target.snapshot; // advance ONLY on verified success
          settleUpTo(target.seq);
          continue;
        }

        // Exhausted retries. The disk is now in an UNKNOWN state: commitBatch
        // writes the journal first, so a partially-applied batch may be on disk
        // with a stale journal that would replay the failed change on next boot.
        // Marking the baseline unknown forces the next write (e.g. a rollback)
        // to rewrite every key and clear that journal, instead of short-circuiting
        // on changedKeys === 0. Keep the newest snapshot dirty so the next state
        // change, flush(), or AppState background flush retries.
        baseline = null;
        if (!pending) {
          pending = target;
        }
        settleFailure();
        return;
      }
    } finally {
      draining = false;
    }
  };

  const onStateChange = () => {
    if (stopped) {
      return;
    }
    const state = store.getState();
    if (!isHydrated(state)) {
      return; // landmine #2: never write from a blank/partial store
    }
    const next = snapshotOf(store);
    // Skip ONLY when truly idle and `next` already matches disk. `baseline` only
    // advances after a commit, so during an in-flight (draining) or pending
    // write a revert back to baseline still differs from what is being written —
    // it must be enqueued, or the store and disk diverge permanently once the
    // in-flight batch commits. This mirrors the guard flush() uses.
    if (baseline && changedKeys(baseline, next).length === 0 && !pending && !draining) {
      return;
    }
    enqueue(next);
    drain();
  };

  return {
    start: () => {
      if (unsubscribe) {
        return; // idempotent: never attach two subscribers
      }
      stopped = false; // re-activate after a previous stop() (e.g. root remount)
      const state = store.getState();
      // Baseline starts at the hydrated state so boot does not rewrite all keys.
      baseline = isHydrated(state) ? snapshotOf(store) : null;
      unsubscribe = store.subscribe(onStateChange);
    },

    stop: () => {
      // Make the coordinator inert: after this, drain() and flush() no-op, so a
      // rollback triggered downstream can never reach disk and overwrite a
      // commit that actually succeeded.
      stopped = true;
      unsubscribe?.();
      unsubscribe = null;
      // If a write is in flight, let the drain loop settle waiters truthfully
      // (a commit that succeeds reports success). Only settle here when nothing
      // is draining, so no waiter is left hanging and a just-committed save is
      // still reported as success.
      if (!draining) {
        settleStopped();
      }
    },

    flush: async () => {
      if (stopped) {
        return false;
      }
      const state = store.getState();
      if (!isHydrated(state)) {
        return false;
      }
      const target = snapshotOf(store);
      if (baseline && changedKeys(baseline, target).length === 0 && !pending && !draining) {
        return true; // already durable
      }
      const mySeq = enqueue(target);
      return new Promise<boolean>((resolve) => {
        waiters.push({ seq: mySeq, target, resolve });
        drain();
      });
    },

    isRunning: () => unsubscribe !== null,

    getStatus: () => ({ running: unsubscribe !== null, dirty: pending !== null }),
  };
};
