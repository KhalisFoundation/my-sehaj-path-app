import type { AppStore, RootState } from './index';
import { hasQuarantinedRecords } from './persistence';

/**
 * Runtime registry of work the server rejected permanently.
 *
 * This lives in its own module rather than inside the outbox coordinator so that
 * `applyServerResponse` can ask "is there unsent work?" without importing the
 * coordinator — `outboxCoordinator.ts` already imports `applyServerResponse.ts`,
 * and importing back would close a cycle. Under Metro a cycle surfaces as an
 * undefined function at module-init time: an intermittent crash, not a build
 * error.
 *
 * Deliberately runtime-only. The rejected operations themselves stay in Redux and
 * are persisted, so the user's change is never lost — only the "don't retry this"
 * marker is forgotten on restart, which costs one extra attempt per launch and
 * keeps a transient server bug from blocking a path forever.
 */

interface BlockedWork {
  /** pathId → the exact `localUpdatedAt` the server rejected. */
  paths: Map<number, number>;
  /** The exact `pendingSettingsUpdatedAt` the server rejected. */
  settings: number | null;
  /**
   * Fingerprints of bulk `/sync` bodies the server rejected permanently. A bulk
   * request has no single offending operation to blame, so without this the same
   * body is rescheduled forever.
   */
  syncBodies: Set<string>;
  /**
   * Fingerprint of the settings document the server last confirmed — either by
   * accepting a PUT or by returning it from a GET.
   *
   * Lets an upload be skipped when the local document already matches, which is
   * what happens when a setting is toggled and toggled back before the debounce
   * fires. Runtime-only on purpose: after a restart there is no record, so the
   * next change uploads unconditionally. A stale baseline can therefore never
   * survive long enough to suppress a real change.
   */
  confirmedSettings: string | null;
}

const registries = new WeakMap<AppStore, BlockedWork>();
// The app has one Redux store. Unlike blocked work, this UI-only marker must be
// available to the stamping middleware, which receives Redux's middleware API
// object rather than the store instance used as the WeakMap key above.
const silentPathOps = new Map<number, number>();

const registryFor = (store: AppStore): BlockedWork => {
  const existing = registries.get(store);
  if (existing) {
    return existing;
  }
  const created: BlockedWork = {
    paths: new Map(),
    settings: null,
    syncBodies: new Set(),
    confirmedSettings: null,
  };
  registries.set(store, created);
  return created;
};

export const blockPathOp = (store: AppStore, pathId: number, localUpdatedAt: number): void => {
  registryFor(store).paths.set(pathId, localUpdatedAt);
};

export const isPathOpBlocked = (store: AppStore, pathId: number, localUpdatedAt: number): boolean =>
  registryFor(store).paths.get(pathId) === localUpdatedAt;

export const markSilentPathOp = (pathId: number, localUpdatedAt: number): void => {
  silentPathOps.set(pathId, localUpdatedAt);
};

export const clearSilentPathOp = (pathId: number): void => {
  silentPathOps.delete(pathId);
};

export const isSilentPathOp = (pathId: number, localUpdatedAt: number): boolean =>
  silentPathOps.get(pathId) === localUpdatedAt;

export const blockSettings = (store: AppStore, updatedAt: number): void => {
  registryFor(store).settings = updatedAt;
};

export const isSettingsBlocked = (store: AppStore, updatedAt: number): boolean =>
  registryFor(store).settings === updatedAt;

export const blockSyncBody = (store: AppStore, fingerprint: string): void => {
  registryFor(store).syncBodies.add(fingerprint);
};

export const isSyncBodyBlocked = (store: AppStore, fingerprint: string): boolean =>
  registryFor(store).syncBodies.has(fingerprint);

/** Record the settings document the server has, after a PUT or a GET. */
export const setConfirmedSettings = (store: AppStore, fingerprint: string): void => {
  registryFor(store).confirmedSettings = fingerprint;
};

/** True when the server is already known to hold exactly this document. */
export const settingsAlreadyConfirmed = (store: AppStore, fingerprint: string): boolean =>
  registryFor(store).confirmedSettings === fingerprint;

/**
 * Clear every runtime marker. MUST run on logout, owner change, hydration and
 * account snapshot restore: path ids are per-device, so account A's blocked
 * `pathId` 3 would otherwise suppress account B's unrelated `pathId` 3.
 */
export const clearBlockedWork = (store: AppStore): void => {
  registries.delete(store);
  silentPathOps.clear();
};

/**
 * Work the outbox can still usefully send. Permanently-rejected operations stay
 * in Redux — the user's change is preserved — but are not counted here, or the
 * post-drain reschedule would spin on work the server will never accept.
 */
export const hasSendablePathOps = (
  store: AppStore,
  state: RootState = store.getState()
): boolean => {
  const registry = registryFor(store);
  return Object.entries(state.sync.pathOps).some(
    ([key, op]) => registry.paths.get(Number(key)) !== op.localUpdatedAt
  );
};

export const hasSendableWork = (store: AppStore, state: RootState = store.getState()): boolean => {
  const settingsRev = state.sync.pendingSettingsUpdatedAt;
  return (
    hasSendablePathOps(store, state) ||
    (settingsRev != null && registryFor(store).settings !== settingsRev)
  );
};

/**
 * Path work that must land before a cloud pull is allowed.
 *
 * Sendable path ops plus `scrollDirty`. A blocked operation must NOT freeze
 * downloads (it will never send), but a dirty scroll must: it is a real unsaved
 * reading position not yet promoted into an operation, so pulling over it would
 * discard where the user actually is.
 *
 * Pending SETTINGS are deliberately excluded. A settings edit does not conflict
 * with downloading paths, and the settings half of a refresh already refuses to
 * overwrite a still-pending local change. Blocking the whole pull on it would
 * stop another device's paths from ever arriving while a settings write is stuck.
 */
export const hasWorkBlockingPull = (
  store: AppStore,
  state: RootState = store.getState()
): boolean => hasSendablePathOps(store, state) || Object.keys(state.sync.scrollDirty).length > 0;

/**
 * True when this device holds any reading data at all.
 *
 * Deliberately more than `paths.paths.length`:
 *  - `paths.dates` is a separate collection, so a date record can outlive its
 *    path and still be real reading history; and
 *  - quarantined records live outside Redux entirely.
 *
 * Getting this wrong means a device that looks empty is silently associated with
 * an account, taking data with it that the user was never asked about.
 */
export const hasLocalData = (store: AppStore, state: RootState = store.getState()): boolean =>
  state.paths.paths.length > 0 || state.paths.dates.length > 0 || hasQuarantinedRecords(store);

export const hasAnyUnsentWork = (state: RootState): boolean =>
  Object.keys(state.sync.pathOps).length > 0 ||
  Object.keys(state.sync.scrollDirty).length > 0 ||
  state.sync.pendingSettingsUpdatedAt != null;
