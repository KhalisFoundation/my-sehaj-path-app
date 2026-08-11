const mockFlushNow = jest.fn().mockResolvedValue(undefined);
const mockRefresh = jest.fn().mockResolvedValue(true);
const mockDispatch = jest.fn();
let mockState: {
  sync: {
    hydrated: boolean;
    recoveryNeeded: boolean;
    account: string | null;
    pathOps: Record<number, unknown>;
    scrollDirty: Record<number, number>;
    meta: Record<number, { onServer: boolean }>;
    pendingSettingsUpdatedAt: number | null;
    catchUpSyncDone: boolean;
  };
  paths: { paths: unknown[]; dates: unknown[] };
  auth: { token: string | null; email: string | null };
  network: { isOnline: boolean };
};

// These suites never call configureApiClient(), so treat the build as configured.
jest.mock('@api/config', () => ({ isApiConfigured: () => true }));
jest.mock('../../store/index', () => ({
  store: { getState: () => mockState, dispatch: (action: unknown) => mockDispatch(action) },
}));
jest.mock('../../store/instance', () => ({ outbox: { flushNow: () => mockFlushNow() } }));
jest.mock('../../store/applyServerResponse', () => ({
  refreshPathsFromServer: (...args: unknown[]) => mockRefresh(...args),
}));

import type { AppStore } from '../../store/index';
import {
  markCatchUpSyncDone,
  markPathEdited,
  requestSyncConfirmation,
  setCatchUpSyncRunning,
} from '../../store/slices/syncSlice';
import { blockPathOp, clearBlockedWork } from '../../store/syncWork';
import {
  onCheckpoint,
  onForeground,
  onReconnect,
  onScreenBlur,
  setActiveReaderPath,
} from '../../store/syncLifecycle';

const syncable = () => ({
  sync: {
    hydrated: true,
    recoveryNeeded: false,
    account: 'u@e.com',
    pathOps: {} as Record<number, unknown>,
    scrollDirty: {} as Record<number, number>,
    meta: {} as Record<number, { onServer: boolean }>,
    pendingSettingsUpdatedAt: null,
    // Default to "the login catch-up already ran" so ordinary focus tests are
    // not measuring first-run behaviour.
    catchUpSyncDone: true,
  },
  paths: { paths: [], dates: [] },
  auth: { token: 't', email: 'u@e.com' },
  network: { isOnline: true },
});

/**
 * The exact store object `syncLifecycle` uses. `syncWork` keys its registry by
 * store identity, so a separately-built mock would register against the wrong key.
 */
const lifecycleStore = (): AppStore =>
  (jest.requireMock('../../store/index') as { store: AppStore }).store;

beforeEach(() => {
  jest.clearAllMocks();
  // Promotion is dispatch-driven, and the checkpoint promotes twice (a path that
  // only just reached the server can carry its scroll on the second pass). With
  // an inert dispatch the second pass would re-promote work the first already
  // queued, so reflect the reducer's effect here.
  mockDispatch.mockImplementation((action) => {
    if (action?.type === markPathEdited.type) {
      const { pathId } = action.payload;
      mockState.sync.pathOps[pathId] = { kind: 'update', localUpdatedAt: Date.now() };
    }
  });
  mockState = syncable();
  setActiveReaderPath(null);
  clearBlockedWork(lifecycleStore()); // runtime blocks must not leak between tests
});

describe('onForeground', () => {
  it('pulls (GET /paths) when the outbox is empty', async () => {
    await onForeground();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockFlushNow).not.toHaveBeenCalled();
  });

  it('passes the active reader path through to the refresh', async () => {
    await onForeground(7);
    expect(mockRefresh).toHaveBeenCalledWith(expect.anything(), 7);
  });

  it('defaults to the registered open reader path (protects it from mid-read refresh)', async () => {
    setActiveReaderPath(9);
    await onForeground(); // App.tsx calls this with no argument on foreground
    expect(mockRefresh).toHaveBeenCalledWith(expect.anything(), 9);
  });

  it('pushes (flush) when there are pending path ops instead of pulling', async () => {
    mockState.sync.pathOps = { 1: { kind: 'update', localUpdatedAt: 1 } };
    await onForeground();
    expect(mockFlushNow).toHaveBeenCalledTimes(1);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('pulls only after a successful flush has cleared the pending queue', async () => {
    mockState.sync.pathOps = { 1: { kind: 'update', localUpdatedAt: 1 } };
    mockFlushNow.mockImplementationOnce(async () => {
      mockState.sync.pathOps = {};
    });

    await onForeground();

    expect(mockFlushNow).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('promotes scroll-only work before flushing and never pulls while it remains pending', async () => {
    mockState.sync.meta = { 1: { onServer: true } };
    mockState.sync.scrollDirty = { 1: 123 };

    await onForeground();

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: markPathEdited.type,
        payload: expect.objectContaining({ pathId: 1 }),
      })
    );
    expect(mockFlushNow).toHaveBeenCalledTimes(1);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('does nothing when the data is not associated with the signed-in account', async () => {
    mockState.sync.account = 'other@e.com';
    await onForeground();
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockFlushNow).not.toHaveBeenCalled();
  });

  it.each([
    ['offline', () => (mockState.network.isOnline = false)],
    ['signed out', () => (mockState.auth.token = null)],
    ['unhydrated', () => (mockState.sync.hydrated = false)],
    ['in recovery', () => (mockState.sync.recoveryNeeded = true)],
  ])('does nothing when %s', async (_label, mutate) => {
    mutate();
    await onForeground();
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockFlushNow).not.toHaveBeenCalled();
  });
});

describe('post-login catch-up', () => {
  const types = () => mockDispatch.mock.calls.map(([action]) => action.type);

  beforeEach(() => {
    mockState.sync.catchUpSyncDone = false;
  });

  it('announces itself while running and marks itself done', async () => {
    await onForeground();

    expect(types()).toContain(setCatchUpSyncRunning.type);
    expect(types()).toContain(markCatchUpSyncDone.type);
  });

  it('runs only once per login, not on every Home focus', async () => {
    mockDispatch.mockImplementation((action) => {
      if (action.type === markCatchUpSyncDone.type) {
        mockState.sync.catchUpSyncDone = true;
      }
    });

    await onForeground();
    mockDispatch.mockClear();
    await onForeground(); // navigating back to Home

    expect(types()).not.toContain(setCatchUpSyncRunning.type);
  });

  it('says nothing on a brand-new account with nothing anywhere', async () => {
    // Device report: signing in as a new user reported "Synced" — announcing a
    // sync of nothing, on a device with no reading and an account with none.
    await onForeground();

    expect(types()).not.toContain(requestSyncConfirmation.type);
  });

  it('reports when this device has reading to reconcile', async () => {
    mockState.paths.paths = [{ pathId: 1, saveData: { angNumber: 2, verseId: 0 }, pathName: 'P' }];

    await onForeground();

    expect(types()).toContain(requestSyncConfirmation.type);
  });

  it("reports when another device's reading arrives on an empty device", async () => {
    // Nothing locally, so nothing is requested up front — but the pull brings
    // paths down, and that change on screen is worth explaining.
    mockRefresh.mockImplementationOnce(async () => {
      mockState.paths.paths = [
        { pathId: 1, saveData: { angNumber: 9, verseId: 0 }, pathName: 'From cloud' },
      ];
      return true;
    });

    await onForeground();

    expect(types()).toContain(requestSyncConfirmation.type);
  });

  it('requests the confirmation before finishing, not after', async () => {
    // Device report: a reload that downloaded another device's progress showed
    // nothing, because the request arrived after the notice had already decided
    // to stay quiet.
    mockState.paths.paths = [{ pathId: 1, saveData: { angNumber: 2, verseId: 0 }, pathName: 'P' }];

    await onForeground();

    const order = types();
    expect(order.indexOf(requestSyncConfirmation.type)).toBeLessThan(
      order.indexOf(markCatchUpSyncDone.type)
    );
  });

  it('still marks itself done when the sync cannot finish', async () => {
    // Otherwise a device that logs in offline would re-announce the catch-up on
    // every single Home focus.
    mockState.sync.pathOps = { 1: { kind: 'update', localUpdatedAt: 1 } };

    await onForeground();

    expect(mockRefresh).not.toHaveBeenCalled();
    expect(types()).toContain(markCatchUpSyncDone.type);
  });
});

describe('onCheckpoint / onReconnect', () => {
  it('flush on a checkpoint when syncable', async () => {
    await onCheckpoint();
    expect(mockFlushNow).toHaveBeenCalledTimes(1);
  });

  it('flushes pending work on reconnect, then pulls', async () => {
    mockState.sync.pathOps = { 1: { kind: 'update', localUpdatedAt: 1 } };
    mockFlushNow.mockImplementationOnce(async () => {
      mockState.sync.pathOps = {};
    });

    await onReconnect();

    expect(mockFlushNow).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('pulls on reconnect even with nothing to upload', async () => {
    // An account that never downloaded — a switch that raced a dropping
    // connection — would otherwise stay empty until a foreground or manual sync.
    await onReconnect();

    expect(mockFlushNow).not.toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not pull on reconnect while work is still pending', async () => {
    mockState.sync.pathOps = { 1: { kind: 'update', localUpdatedAt: 1 } };

    await onReconnect();

    expect(mockFlushNow).toHaveBeenCalledTimes(1);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('does not flush on a checkpoint while offline', async () => {
    mockState.network.isOnline = false;
    await onCheckpoint();
    expect(mockFlushNow).not.toHaveBeenCalled();
  });
});

describe('onScreenBlur (reader scroll checkpoint)', () => {
  it('promotes a scroll-only dirty change to an update op, then flushes', async () => {
    mockState.sync.meta = { 1: { onServer: true } };
    mockState.sync.scrollDirty = { 1: 123 };

    await onScreenBlur();

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: markPathEdited.type,
        payload: expect.objectContaining({ pathId: 1 }),
      })
    );
    expect(mockFlushNow).toHaveBeenCalledTimes(1);
  });

  it('does not promote when an op is already pending (scroll piggybacks)', async () => {
    mockState.sync.meta = { 1: { onServer: true } };
    mockState.sync.scrollDirty = { 1: 123 };
    mockState.sync.pathOps = { 1: { kind: 'update', localUpdatedAt: 1 } };

    await onScreenBlur();

    expect(mockDispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: markPathEdited.type })
    );
    expect(mockFlushNow).toHaveBeenCalledTimes(1); // still a checkpoint flush
  });

  it('does NOT confirm on a scroll-only leave (scroll syncs silently, no toast)', async () => {
    // Device report: just scrolling and leaving popped a "Synced" toast, which
    // is confusing — the user saved nothing. Scroll still syncs via the flush;
    // only the message is suppressed.
    mockState.sync.meta = { 1: { onServer: true } };
    mockState.sync.scrollDirty = { 1: 123 }; // only scrolled — no real edit

    await onScreenBlur();

    expect(mockDispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: requestSyncConfirmation.type })
    );
    expect(mockFlushNow).toHaveBeenCalled(); // but the scroll IS still flushed
  });

  it('confirms when leaving after a real edit (a pending path op)', async () => {
    mockState.sync.meta = { 1: { onServer: true } };
    mockState.sync.pathOps = { 1: { kind: 'update', localUpdatedAt: 5 } }; // a real save

    await onScreenBlur();

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: requestSyncConfirmation.type })
    );
  });

  it('stays silent when a path is opened and closed without reading', async () => {
    // Device report: opening a path, changing nothing and pressing back still
    // produced a "Synced" toast.
    await onScreenBlur();

    expect(mockDispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: requestSyncConfirmation.type })
    );
  });

  it('sends the scroll of a path that only reached the server during this flush', async () => {
    // Device report: create a path, press back instead of Continue, and the
    // spinner never resolved. The first promotion skips the path (not on the
    // server yet), the flush creates it, and the scroll was left with nothing to
    // carry it — a lone dirty scroll never schedules a drain of its own.
    mockState.sync.meta = { 1: { onServer: false } };
    mockState.sync.scrollDirty = { 1: 123 };
    mockFlushNow.mockImplementationOnce(async () => {
      mockState.sync.meta = { 1: { onServer: true } }; // the create landed
    });

    await onScreenBlur();

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: markPathEdited.type,
        payload: expect.objectContaining({ pathId: 1 }),
      })
    );
    expect(mockFlushNow).toHaveBeenCalledTimes(2); // second pass carries the scroll
  });

  it('does not promote a path that is not yet on the server', async () => {
    mockState.sync.meta = { 1: { onServer: false } };
    mockState.sync.scrollDirty = { 1: 123 };

    await onScreenBlur();

    expect(mockDispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: markPathEdited.type })
    );
  });

  it('promotes over a permanently-blocked op so the path can sync again', async () => {
    // Without this the device deadlocks: the blocked op keeps the rejected
    // `localUpdatedAt` so it never sends, and its `scrollDirty` entry blocks every
    // pull — nothing uploads and nothing downloads.
    mockState.sync.meta = { 1: { onServer: true } };
    mockState.sync.scrollDirty = { 1: 123 };
    mockState.sync.pathOps = { 1: { kind: 'update', localUpdatedAt: 7 } };
    blockPathOp(lifecycleStore(), 1, 7);

    await onScreenBlur();

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: markPathEdited.type,
        payload: expect.objectContaining({ pathId: 1 }),
      })
    );
  });
});

describe('pull gating', () => {
  it('still pulls when the only pending op is permanently blocked', async () => {
    mockState.sync.meta = { 1: { onServer: true } };
    mockState.sync.pathOps = { 1: { kind: 'update', localUpdatedAt: 7 } };
    blockPathOp(lifecycleStore(), 1, 7);

    await onForeground();

    // Rule 9: one permanently rejected action must not stop cloud refreshes.
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('does not pull while a scroll is still dirty', async () => {
    mockState.sync.meta = { 1: { onServer: true } };
    mockState.sync.scrollDirty = { 1: 123 };
    // Promotion turns it into a real op, and the flush is mocked so it stays
    // pending — an unsaved reading position must never be pulled over.
    await onForeground();

    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
