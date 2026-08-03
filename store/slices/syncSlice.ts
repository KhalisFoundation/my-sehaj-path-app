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
  /** Client clock required by SyncPathDto.updatedAt. */
  localUpdatedAt: number;
  /** Canonical start date in epoch milliseconds. */
  startDate: number;
  /** Local deletion time while a delete is pending; null for a live path. */
  deletedAt: number | null;
  /** True after the server has acknowledged this UUID. */
  onServer: boolean;
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
  syncPopupAnswered: false,
  syncApprovedForEmail: null,
  signInPopupChecked: false,
  signInPopupDismissed: false,
};

/** Strictly monotonic: two changes in the same ms still advance. */
const advance = (proposed: number, previous: number): number => Math.max(proposed, previous + 1);

const resetRuntime = (state: SyncState) => {
  state.status = 'idle';
  state.lastError = null;
  state.recoveryNeeded = false;
  state.syncPopupAnswered = false;
  state.syncApprovedForEmail = null;
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
    setSyncStatus: (state, action: PayloadAction<SyncState['status']>) => {
      state.status = action.payload;
    },
    setSyncError: (state, action: PayloadAction<string | null>) => {
      state.lastError = action.payload;
      state.status = action.payload ? 'error' : state.status;
    },

    // ---- per-login sync permission (Step-9 hook; runtime-only) -----------
    resetSyncPopup: (state) => {
      state.syncPopupAnswered = false;
      state.syncApprovedForEmail = null;
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
  },
});

export const {
  hydrateSync,
  hydrateEmptySync,
  hydrateSyncRecovery,
  setAccount,
  setLastSyncedAt,
  upsertMeta,
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
  resetSyncPopup,
  approveSync,
  declineSync,
  hydrateSignInPopup,
  dismissSignInPopup,
  showSignInPopupAgain,
} = syncSlice.actions;
