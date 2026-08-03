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
  };
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

import { markPathEdited } from '../../store/slices/syncSlice';
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
  },
  auth: { token: 't', email: 'u@e.com' },
  network: { isOnline: true },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockState = syncable();
  setActiveReaderPath(null);
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

describe('onCheckpoint / onReconnect', () => {
  it('flush on a checkpoint when syncable', async () => {
    await onCheckpoint();
    expect(mockFlushNow).toHaveBeenCalledTimes(1);
  });

  it('flush on reconnect when syncable', async () => {
    await onReconnect();
    expect(mockFlushNow).toHaveBeenCalledTimes(1);
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

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockFlushNow).toHaveBeenCalledTimes(1); // still a checkpoint flush
  });

  it('does not promote a path that is not yet on the server', async () => {
    mockState.sync.meta = { 1: { onServer: false } };
    mockState.sync.scrollDirty = { 1: 123 };

    await onScreenBlur();

    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
