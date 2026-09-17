import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type PathOpKind = 'create' | 'update' | 'delete';

export interface PendingPathOp {
  kind: PathOpKind;
  /** Strictly monotonic local change key captured when this op was coalesced. */
  localUpdatedAt: number;
}

export interface SyncMeta {
  /** Client-generated UUID used as the API's pathId. */
  serverPathId: string;
  /** Last server `updatedAt` acknowledged locally; used as baseUpdatedAt. */
  serverUpdatedAt: number;
  /** Server-owned creation time, used only to keep Home's path order consistent. */
  serverCreatedAt?: number;
  /** Client clock required by SyncPathDto.updatedAt. */
  localUpdatedAt: number;
  /** Canonical start date in epoch milliseconds. */
  startDate: number;
  /** Local deletion time while a delete is pending; null for a live path. */
  deletedAt: number | null;
  /** True after the server has acknowledged this UUID. */
  onServer: boolean;
  /**
   * True when this path is shared with a group.
   *
   * A shared path is **server-owned**, not local-first. Several people write to
   * it, so the local-first machinery is actively wrong for it: the outbox is
   * built to insist, retrying until its version wins, and two devices insisting
   * on one row is how a group's position gets corrupted. Optional so metadata
   * persisted before group reading existed still loads — absent means personal.
   *
   * The one behaviour that depends on this: `buildSyncRequest` leaves these
   * paths out of the bulk `/sync` body entirely.
   */
  shared?: boolean;
  /**
   * The SERVER's own id for this path, which is not `serverPathId`.
   *
   * A path has two identifiers. `serverPathId` is the UUID this device minted
   * and syncs under; `groupId` is the row's own primary key. Every group
   * endpoint keys on the latter, because a path shared with other people cannot
   * be addressed by an id one member's device happened to generate — the other
   * members never had it.
   *
   * Learned from `GET /sehaj-path/v2/paths`, which returns both. The app
   * used to read that response for `sharing` alone and discard the id, then call
   * the group endpoints with `serverPathId` — which they answer with a `404
   * Path not found`, because that column is not what they look up.
   */
  groupId?: string;
}

export interface SyncState {
  hydrated: boolean;
  account: string | null;
  lastSyncedAt: number;
  meta: Record<number, SyncMeta>;
  pathOps: Record<number, PendingPathOp>;
  scrollDirty: Record<number, number>;
  settingsUpdatedAt: number;
  pendingSettingsUpdatedAt: number | null;
  // Runtime-only (never persisted):
  status: 'idle' | 'flushing' | 'error';
  lastError: string | null;
  recoveryNeeded: boolean;
  /** Runtime-only recovery choice notice shown by SyncStatusNotice. */
  recoveryRestoreStatus?: 'idle' | 'restoring' | 'restored' | 'paused';
  /**
   * Per-login sync permission (the Step-9 hook). `syncPopupAnswered` gates the
   * welcome/"Sync now?" prompt so it shows once per signed-in session;
   * `syncApprovedForEmail` records the email the user approved this session.
   * Runtime-only: reset on login/logout, never persisted.
   */
  syncPopupAnswered: boolean;
  syncApprovedForEmail: string | null;
  /**
   * Signed-out "log in to save your progress" popup. `signInPopupChecked` gates
   * the prompt until the persisted dismissed flag has been read at boot (so it
   * never flashes); `signInPopupDismissed` mirrors that flag. Runtime-only: the
   * source of truth is AsyncStorage (see store/syncPrefs.ts).
   */
  signInPopupChecked: boolean;
  signInPopupDismissed: boolean;
  /** Runtime-only notice for an unexpected server-rejected session. */
  sessionExpired: boolean;
  /**
   * True when the NEXT successful drain should confirm itself to the user.
   *
   * Success is only worth announcing when the user did something that implies
   * they want to know it landed — tapping Sync now, or leaving a path. The
   * outbox also drains on a debounce while someone is simply reading, and a
   * toast on every one of those is noise. Failures are always shown, requested
   * or not. Runtime-only.
   */
  confirmNextSync: boolean;
  /**
   * The post-login catch-up sync.
   *
   * `loginSyncDone` keeps it to once per signed-in session — `HomeScreen` calls
   * `onForeground` on every focus, so without this the banner would flash each
   * time the user navigates back from the reader. `loginSyncRunning` drives that
   * banner. Both reset on logout so signing in again runs it afresh.
   */
  catchUpSyncDone: boolean;
  catchUpSyncRunning: boolean;
  /**
   * A `GET /paths` refresh is in flight. `status` only covers the push half, so
   * without this the notice would call a sync finished while the download that
   * may change what the user sees is still running.
   */
  pulling: boolean;
}

/** Persisted subset written to `sehajSyncMeta_v1`. Never contains the token. */
export interface PersistedSyncState {
  version: 1;
  account: string | null;
  lastSyncedAt: number;
  meta: Record<number, SyncMeta>;
  pathOps: Record<number, PendingPathOp>;
  scrollDirty: Record<number, number>;
  settingsUpdatedAt: number;
  pendingSettingsUpdatedAt: number | null;
}

export const initialSyncState: SyncState = {
  hydrated: false,
  account: null,
  lastSyncedAt: 0,
  meta: {},
  pathOps: {},
  scrollDirty: {},
  settingsUpdatedAt: 0,
  pendingSettingsUpdatedAt: null,
  status: 'idle',
  lastError: null,
  recoveryNeeded: false,
  recoveryRestoreStatus: 'idle',
  syncPopupAnswered: false,
  confirmNextSync: false,
  catchUpSyncDone: false,
  catchUpSyncRunning: false,
  pulling: false,
  syncApprovedForEmail: null,
  signInPopupChecked: false,
  signInPopupDismissed: false,
  sessionExpired: false,
};

/** Strictly monotonic: two changes in the same ms still advance. */
const advance = (proposed: number, previous: number): number => Math.max(proposed, previous + 1);

const resetRuntime = (state: SyncState) => {
  state.status = 'idle';
  state.lastError = null;
  state.recoveryNeeded = false;
  state.recoveryRestoreStatus = 'idle';
  state.syncPopupAnswered = false;
  state.syncApprovedForEmail = null;
  state.catchUpSyncDone = false;
  state.catchUpSyncRunning = false;
  state.pulling = false;
};

export const syncSlice = createSlice({
  name: 'sync',
  initialState: initialSyncState,
  reducers: {
    // ---- hydration -------------------------------------------------------
    hydrateSync: (state, action: PayloadAction<PersistedSyncState>) => {
      const p = action.payload;
      state.account = p.account;
      state.lastSyncedAt = p.lastSyncedAt;
      state.meta = p.meta;
      state.pathOps = p.pathOps;
      state.scrollDirty = p.scrollDirty;
      state.settingsUpdatedAt = p.settingsUpdatedAt;
      state.pendingSettingsUpdatedAt = p.pendingSettingsUpdatedAt;

      // Drop work queued for a path that is now shared.
      //
      // Such an op is unsendable — a shared path is left out of the `/sync`
      // body — and it DEADLOCKS the device: pending work blocks the pull, and
      // the pull is the only thing that would otherwise notice the path is
      // shared and clear it. The result is a `PATCH` retried for ever against
      // an id the group endpoints do not answer to, and a sync indicator that
      // never goes out.
      //
      // Doing it here rather than only in `setPathShared` is what repairs a
      // device that already persisted such an op: hydration is the one moment
      // guaranteed to run before anything tries to send.
      for (const key of Object.keys(state.meta)) {
        const pathId = Number(key);
        if (state.meta[pathId]?.shared) {
          delete state.pathOps[pathId];
          delete state.scrollDirty[pathId];
        }
      }

      resetRuntime(state);
      state.hydrated = true;
    },
    hydrateEmptySync: (state) => {
      Object.assign(state, initialSyncState);
      state.hydrated = true;
    },
    /** Malformed metadata: usable app, no cloud calls until an explicit repair. */
    hydrateSyncRecovery: (state) => {
      Object.assign(state, initialSyncState);
      state.hydrated = true;
      state.recoveryNeeded = true;
    },

    // ---- account / clocks ------------------------------------------------
    setAccount: (state, action: PayloadAction<string | null>) => {
      state.account = action.payload;
    },
    setLastSyncedAt: (state, action: PayloadAction<number>) => {
      state.lastSyncedAt = action.payload;
    },

    // ---- per-path metadata ----------------------------------------------
    upsertMeta: (
      state,
      action: PayloadAction<{
        pathId: number;
        meta: Partial<SyncMeta> & { serverPathId: string; startDate: number };
      }>
    ) => {
      const { pathId, meta } = action.payload;
      const base: SyncMeta = state.meta[pathId] ?? {
        serverPathId: meta.serverPathId,
        serverUpdatedAt: 0,
        localUpdatedAt: 0,
        startDate: meta.startDate,
        deletedAt: null,
        onServer: false,
      };
      state.meta[pathId] = { ...base, ...meta };
    },
    /**
     * Record whether a path is shared with a group.
     *
     * Separate from `upsertMeta` because this is the server telling us what a
     * path *is*, not a local edit — and it must never mark the path dirty or
     * schedule a sync. Learning that a path is shared is precisely the moment
     * we should stop syncing it.
     */
    setPathShared: (
      state,
      action: PayloadAction<{ pathId: number; shared: boolean; groupId?: string }>
    ) => {
      const meta = state.meta[action.payload.pathId];
      if (!meta) {
        return;
      }
      meta.shared = action.payload.shared;
      // Recorded even for a personal path: it is the id every group endpoint
      // needs, and sharing a path is exactly when it is too late to go and ask.
      if (action.payload.groupId !== undefined) {
        meta.groupId = action.payload.groupId;
      }
      if (action.payload.shared) {
        // Drop anything already queued for this path. A shared path is left out
        // of the `/sync` body, so a queued op can never be acknowledged — it
        // retries for ever, holding the sync indicator on and re-issuing a
        // `PATCH` the server answers with 404, because a shared path is
        // addressed by its group id and not the one this device syncs under.
        //
        // Clearing here rather than only refusing new work is what repairs a
        // device that queued something before the path became shared.
        delete state.pathOps[action.payload.pathId];
        delete state.scrollDirty[action.payload.pathId];
      }
    },
    dropMeta: (state, action: PayloadAction<number>) => {
      const pathId = action.payload;
      delete state.meta[pathId];
      delete state.pathOps[pathId];
      delete state.scrollDirty[pathId];
    },
    markPathEdited: (state, action: PayloadAction<{ pathId: number; at: number }>) => {
      const { pathId, at } = action.payload;
      const meta = state.meta[pathId];
      if (!meta) {
        return;
      }
      const ts = advance(at, meta.localUpdatedAt);
      meta.localUpdatedAt = ts;
      meta.deletedAt = null; // an edit revives a tombstoned path
      // create when not yet on the server, otherwise update (covers revive too).
      state.pathOps[pathId] = { kind: meta.onServer ? 'update' : 'create', localUpdatedAt: ts };
    },
    markPathDeleted: (state, action: PayloadAction<{ pathId: number; at: number }>) => {
      const { pathId, at } = action.payload;
      const meta = state.meta[pathId];
      if (!meta) {
        return;
      }
      const ts = advance(at, meta.localUpdatedAt);
      meta.localUpdatedAt = ts;
      // Use the monotonic ts (not raw `at`) so two deletes in the same
      // millisecond can't send the server an older deletion time than a prior op.
      meta.deletedAt = ts;
      state.pathOps[pathId] = { kind: 'delete', localUpdatedAt: ts };
    },
    ackServerPath: (
      state,
      action: PayloadAction<{
        pathId: number;
        sentLocalUpdatedAt: number;
        serverUpdatedAt: number;
      }>
    ) => {
      const { pathId, sentLocalUpdatedAt, serverUpdatedAt } = action.payload;
      const meta = state.meta[pathId];
      if (!meta) {
        return;
      }
      meta.serverUpdatedAt = Math.max(meta.serverUpdatedAt, serverUpdatedAt);
      // Later offline edits should start from an observed server clock, not a
      // device clock that may be far behind it.
      meta.localUpdatedAt = Math.max(meta.localUpdatedAt, serverUpdatedAt);
      meta.onServer = true;
      const op = state.pathOps[pathId];
      if (!op) {
        return;
      }
      if (op.localUpdatedAt === sentLocalUpdatedAt) {
        delete state.pathOps[pathId]; // fully acknowledged
      } else if (op.kind === 'create') {
        // Create is done but a newer edit exists → remaining work is update/delete.
        op.kind = meta.deletedAt != null ? 'delete' : 'update';
      }
    },
    /**
     * Records that the server ALREADY had this UUID — an idempotent `POST` replay
     * answered with 200, whose body is the server's existing row, NOT the body we
     * just submitted. So we take the identity and clock but never acknowledge our
     * own send: a pending `create` is downgraded to `update` (or `delete` for a
     * tombstone) so the newest local state is PATCHed next.
     */
    ackServerPathExists: (
      state,
      action: PayloadAction<{ pathId: number; serverUpdatedAt: number }>
    ) => {
      const { pathId, serverUpdatedAt } = action.payload;
      const meta = state.meta[pathId];
      if (!meta) {
        return;
      }
      meta.serverUpdatedAt = Math.max(meta.serverUpdatedAt, serverUpdatedAt);
      meta.localUpdatedAt = Math.max(meta.localUpdatedAt, serverUpdatedAt);
      meta.onServer = true;
      const op = state.pathOps[pathId];
      if (op?.kind === 'create') {
        op.kind = meta.deletedAt != null ? 'delete' : 'update';
      }
    },
    clearOpIfUnchanged: (
      state,
      action: PayloadAction<{ pathId: number; sentLocalUpdatedAt: number }>
    ) => {
      const { pathId, sentLocalUpdatedAt } = action.payload;
      if (state.pathOps[pathId]?.localUpdatedAt === sentLocalUpdatedAt) {
        delete state.pathOps[pathId];
      }
    },

    // ---- scroll (never drives a call) -----------------------------------
    markScrollDirty: (state, action: PayloadAction<{ pathId: number; at: number }>) => {
      const { pathId, at } = action.payload;
      const meta = state.meta[pathId];
      if (!meta) {
        return;
      }
      const ts = advance(at, meta.localUpdatedAt);
      meta.localUpdatedAt = ts;
      state.scrollDirty[pathId] = ts;
      // Intentionally does NOT touch pathOps: a pending op can still ack/clear.
    },
    clearScrollIfUnchanged: (
      state,
      action: PayloadAction<{ pathId: number; sentLocalUpdatedAt: number }>
    ) => {
      const { pathId, sentLocalUpdatedAt } = action.payload;
      if (state.scrollDirty[pathId] === sentLocalUpdatedAt) {
        delete state.scrollDirty[pathId];
      }
    },

    // ---- settings --------------------------------------------------------
    markSettingsDirty: (state, action: PayloadAction<{ at: number }>) => {
      const ts = advance(action.payload.at, state.settingsUpdatedAt);
      state.settingsUpdatedAt = ts;
      state.pendingSettingsUpdatedAt = ts;
    },
    clearSettingsIfUnchanged: (state, action: PayloadAction<number>) => {
      if (state.pendingSettingsUpdatedAt === action.payload) {
        state.pendingSettingsUpdatedAt = null;
      }
    },

    // ---- runtime status --------------------------------------------------
    /** The user asked for this sync, so confirm it when it succeeds. */
    requestSyncConfirmation: (state) => {
      state.confirmNextSync = true;
    },
    clearSyncConfirmation: (state) => {
      state.confirmNextSync = false;
    },
    setCatchUpSyncRunning: (state, action: PayloadAction<boolean>) => {
      state.catchUpSyncRunning = action.payload;
    },
    markCatchUpSyncDone: (state) => {
      state.catchUpSyncDone = true;
      state.catchUpSyncRunning = false;
    },
    setPulling: (state, action: PayloadAction<boolean>) => {
      state.pulling = action.payload;
    },
    setSyncStatus: (state, action: PayloadAction<SyncState['status']>) => {
      state.status = action.payload;
    },
    setSyncError: (state, action: PayloadAction<string | null>) => {
      state.lastError = action.payload;
      state.status = action.payload ? 'error' : state.status;
    },
    setRecoveryRestoreStatus: (
      state,
      action: PayloadAction<'idle' | 'restoring' | 'restored' | 'paused'>
    ) => {
      state.recoveryRestoreStatus = action.payload;
    },

    // ---- per-login sync permission (Step-9 hook; runtime-only) -----------
    resetSyncPopup: (state) => {
      state.syncPopupAnswered = false;
      state.syncApprovedForEmail = null;
      // Logout dispatches this, so the next login catches up again.
      state.catchUpSyncDone = false;
      state.catchUpSyncRunning = false;
    },
    approveSync: (state, action: PayloadAction<string>) => {
      state.syncPopupAnswered = true;
      state.syncApprovedForEmail = action.payload;
    },
    declineSync: (state) => {
      state.syncPopupAnswered = true;
      state.syncApprovedForEmail = null;
    },

    // ---- signed-out sign-in popup (runtime; backed by AsyncStorage) ---------
    hydrateSignInPopup: (state, action: PayloadAction<boolean>) => {
      state.signInPopupDismissed = action.payload;
      state.signInPopupChecked = true;
    },
    dismissSignInPopup: (state) => {
      state.signInPopupDismissed = true;
    },
    /** Re-arm the popup (e.g. after logout) so it shows again. */
    showSignInPopupAgain: (state) => {
      state.signInPopupDismissed = false;
      state.signInPopupChecked = true;
    },
    showSessionExpired: (state) => {
      state.sessionExpired = true;
    },
    dismissSessionExpired: (state) => {
      state.sessionExpired = false;
    },
  },
});

export const {
  hydrateSync,
  hydrateEmptySync,
  hydrateSyncRecovery,
  setAccount,
  setLastSyncedAt,
  upsertMeta,
  setPathShared,
  dropMeta,
  markPathEdited,
  markPathDeleted,
  ackServerPath,
  ackServerPathExists,
  clearOpIfUnchanged,
  markScrollDirty,
  clearScrollIfUnchanged,
  markSettingsDirty,
  clearSettingsIfUnchanged,
  setSyncStatus,
  setSyncError,
  setRecoveryRestoreStatus,
  requestSyncConfirmation,
  clearSyncConfirmation,
  setCatchUpSyncRunning,
  markCatchUpSyncDone,
  setPulling,
  resetSyncPopup,
  approveSync,
  declineSync,
  hydrateSignInPopup,
  dismissSignInPopup,
  showSignInPopupAgain,
  showSessionExpired,
  dismissSessionExpired,
} = syncSlice.actions;
