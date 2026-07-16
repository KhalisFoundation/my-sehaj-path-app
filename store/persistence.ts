import AsyncStorage from '@react-native-async-storage/async-storage';
import { recordError } from '../utils/crashlytics';
import type { AppStore, RootState } from './index';
import {
  JOURNAL_KEY,
  LEGACY_KEYS,
  META_KEY,
  changedKeys,
  parseLegacy,
  serializeKey,
  type LegacyKey,
  type RawLegacy,
  type Snapshot,
} from './legacyFormat';
import { setAll } from './slices/pathsSlice';
import { hydrateSettings } from './slices/settingsSlice';

const READ_ATTEMPTS = 3; // 1 initial + 2 retries, for transient I/O only
const COMMIT_ATTEMPTS = 3; // capped retry for a failed write batch
const RETRY_BASE_MS = 50;

interface Journal {
  revision: number;
  valuesByKey: Partial<Record<LegacyKey, string>>;
}

/** Entries of a journal, typed — `Object.entries` widens keys to `string`. */
const journalEntries = (journal: Journal): Array<[LegacyKey, string]> =>
  LEGACY_KEYS.flatMap((key) => {
    const value = journal.valuesByKey[key];
    return value === undefined ? [] : [[key, value] as [LegacyKey, string]];
  });

const snapshotOf = (state: RootState): Snapshot => ({
  settings: state.settings,
  paths: state.paths.paths,
  dates: state.paths.dates,
});

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(() => resolve(), ms));

/** Confirms every written value is actually readable back at its key. */
const verifyWritten = async (entries: Array<[LegacyKey, string]>): Promise<boolean> => {
  const found = await AsyncStorage.multiGet(entries.map(([key]) => key));
  const byKey = new Map(found.map(([key, value]) => [key, value]));
  return entries.every(([key, value]) => byKey.get(key) === value);
};

// ---------------------------------------------------------------------------
// journal recovery
// ---------------------------------------------------------------------------

const isLegacyKey = (value: string): value is LegacyKey =>
  (LEGACY_KEYS as readonly string[]).includes(value);

const isJournal = (value: unknown): value is Journal => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const { revision, valuesByKey } = value as { revision?: unknown; valuesByKey?: unknown };
  if (typeof revision !== 'number' || !Number.isFinite(revision)) {
    return false;
  }
  if (typeof valuesByKey !== 'object' || valuesByKey === null || Array.isArray(valuesByKey)) {
    return false;
  }
  return Object.entries(valuesByKey).every(
    ([key, entry]) => isLegacyKey(key) && typeof entry === 'string'
  );
};

/**
 * Replays a pending write batch left behind by a process that died mid-commit.
 *
 * Returns false if a journal exists but cannot be trusted or replayed; the
 * caller must then fail closed rather than render the app against a
 * half-committed pathDetails/pathDateDetails pair.
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

  const entries = journalEntries(parsed);
  if (entries.length === 0) {
    await AsyncStorage.removeItem(JOURNAL_KEY);
    return true;
  }

  try {
    await AsyncStorage.multiSet(entries);
    const verified = await verifyWritten(entries);
    if (!verified) {
      return false;
    }
    await AsyncStorage.setItem(META_KEY, JSON.stringify({ revision: parsed.revision }));
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
 * Recover -> read -> validate -> dispatch.
 *
 * Parse-then-commit: nothing is dispatched until every key has been read and
 * validated, so a failure leaves the store (and therefore the disk) untouched.
 * Returns false on failure; the caller must show the fail-closed screen.
 */
export const hydrateStore = async (store: AppStore): Promise<boolean> => {
  try {
    const recovered = await recoverPendingJournal();
    if (!recovered) {
      return false;
    }

    const raw = await readAllLegacy();
    const parsed = parseLegacy(raw);

    if (!parsed.ok) {
      // Present-but-malformed data. Do NOT substitute defaults: the write
      // coordinator would then persist those defaults over the user's bytes.
      recordError(
        new Error(`legacy data is malformed: ${parsed.issues.join('; ')}`),
        'persistence: hydration failed closed'
      );
      return false;
    }

    store.dispatch(hydrateSettings(parsed.value.settings));
    store.dispatch(setAll({ paths: parsed.value.paths, dates: parsed.value.dates }));
    return true;
  } catch (error) {
    recordError(error, 'persistence: hydration failed');
    return false;
  }
};

// ---------------------------------------------------------------------------
// write coordinator
// ---------------------------------------------------------------------------

export interface LegacyPersistence {
  start: () => void;
  stop: () => void;
  /** Resolves true only once the snapshot current at call time is durable. */
  flush: () => Promise<boolean>;
  getStatus: () => { running: boolean; dirty: boolean; lastError: unknown };
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
export const createLegacyPersistence = (store: AppStore): LegacyPersistence => {
  let unsubscribe: (() => void) | null = null;
  let baseline: Snapshot | null = null; // last snapshot verified on disk
  /** Newest un-persisted snapshot, tagged with its sequence number. */
  let pending: { snapshot: Snapshot; seq: number } | null = null;
  let draining = false;
  let revision = 0;
  let seq = 0;
  let lastError: unknown = null;

  /**
   * Waiters are keyed by sequence number, NOT by snapshot identity.
   *
   * Snapshots are full state, so committing sequence N also makes every earlier
   * sequence durable. Matching on snapshot equality instead would hang a waiter
   * forever whenever its snapshot was coalesced away by a newer one — which
   * happens routinely during auto-scroll.
   */
  let waiters: Array<{ seq: number; resolve: (ok: boolean) => void }> = [];

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

  const enqueue = (snapshot: Snapshot): number => {
    seq += 1;
    pending = { snapshot, seq };
    return seq;
  };

  const commitBatch = async (snapshot: Snapshot, keys: LegacyKey[]): Promise<boolean> => {
    const entries: Array<[LegacyKey, string]> = keys.map((key) => [
      key,
      serializeKey(key, snapshot),
    ]);
    revision += 1;

    const valuesByKey: Partial<Record<LegacyKey, string>> = {};
    for (const [key, value] of entries) {
      valuesByKey[key] = value;
    }
    const journal: Journal = { revision, valuesByKey };

    await AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(journal));
    await AsyncStorage.multiSet(entries);

    if (!(await verifyWritten(entries))) {
      throw new Error('post-write verification mismatch');
    }

    await AsyncStorage.setItem(META_KEY, JSON.stringify({ revision }));
    await AsyncStorage.removeItem(JOURNAL_KEY);
    return true;
  };

  const drain = async () => {
    if (draining) {
      return;
    }
    draining = true;
    try {
      while (pending) {
        const target = pending;
        pending = null;

        const keys = changedKeys(baseline, target.snapshot);
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
            lastError = error;
            recordError(error, `persistence: commit attempt ${attempt} failed`);
            if (attempt < COMMIT_ATTEMPTS) {
              await delay(RETRY_BASE_MS * attempt);
            }
          }
        }

        if (committed) {
          baseline = target.snapshot; // advance ONLY on verified success
          lastError = null;
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
    const state = store.getState();
    if (!state.paths.hydrated) {
      return; // landmine #2: never write from a blank/partial store
    }
    const next = snapshotOf(state);
    if (baseline && changedKeys(baseline, next).length === 0) {
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
      const state = store.getState();
      // Baseline starts at the hydrated state so boot does not rewrite all keys.
      baseline = state.paths.hydrated ? snapshotOf(state) : null;
      unsubscribe = store.subscribe(onStateChange);
    },

    stop: () => {
      unsubscribe?.();
      unsubscribe = null;
      // Never leave a caller hanging on a coordinator that will no longer drain.
      settleFailure();
    },

    flush: async () => {
      const state = store.getState();
      if (!state.paths.hydrated) {
        return false;
      }
      const target = snapshotOf(state);
      if (baseline && changedKeys(baseline, target).length === 0 && !pending && !draining) {
        return true; // already durable
      }
      const mySeq = enqueue(target);
      return new Promise<boolean>((resolve) => {
        waiters.push({ seq: mySeq, resolve });
        drain();
      });
    },

    getStatus: () => ({ running: unsubscribe !== null, dirty: pending !== null, lastError }),
  };
};
