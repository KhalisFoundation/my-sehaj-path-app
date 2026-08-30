import {
  sehajPathSettingsControllerUpsert,
  sehajPathSyncControllerSync,
  sehajPathsControllerCreate,
  sehajPathsControllerRemove,
  sehajPathsControllerUpdate,
} from '@api/generated/sdk.gen';
import type { SehajPath } from '@api/generated/types.gen';
import { SYNC_REQUEST_TIMEOUT_MS } from '@api/config';
import { makeStore } from '../../store';
import { createOutboxCoordinator } from '../../store/outboxCoordinator';
import { addPath, renamePath, setScrollPosition } from '../../store/slices/pathsSlice';
import { setSignedIn } from '../../store/slices/authSlice';
import { setOnline } from '../../store/slices/networkSlice';
import { setLarivaar } from '../../store/slices/settingsSlice';
import { hydrateEmptySync, markPathDeleted, setAccount } from '../../store/slices/syncSlice';
import { clearCurrentToken } from '../../auth/tokenUtils';
import { recordError } from '../../utils/crashlytics';
import type { DateData, PathData } from '../../types';

// These suites never call configureApiClient(), so treat the build as configured.
jest.mock('@api/config', () => ({
  isApiConfigured: () => true,
  SYNC_REQUEST_TIMEOUT_MS: 60_000,
}));
jest.mock('@api/generated/sdk.gen', () => ({
  sehajPathsControllerCreate: jest.fn(),
  sehajPathsControllerUpdate: jest.fn(),
  sehajPathsControllerRemove: jest.fn(),
  sehajPathSettingsControllerUpsert: jest.fn(),
  sehajPathSyncControllerSync: jest.fn(),
}));
jest.mock('../../utils/crashlytics', () => ({
  recordError: jest.fn(),
  logBreadcrumb: jest.fn(),
  allowCrashReporting: jest.fn(),
  testCrash: jest.fn(),
}));
jest.mock('../../auth/tokenUtils', () => ({
  clearCurrentToken: jest.fn().mockResolvedValue(true),
}));

const mockClearToken = clearCurrentToken as jest.Mock;
const mockCreate = sehajPathsControllerCreate as jest.Mock;
const mockUpdate = sehajPathsControllerUpdate as jest.Mock;
const mockRemove = sehajPathsControllerRemove as jest.Mock;
const mockSettings = sehajPathSettingsControllerUpsert as jest.Mock;
const mockSync = sehajPathSyncControllerSync as jest.Mock;

/** A full SehajPath so create/update responses feed the applier (fromServerPath). */
const serverSehaj = (over: Partial<SehajPath> = {}): SehajPath => ({
  angNumber: 0,
  verseId: 0,
  scrollPosition: 0,
  startDate: Date.UTC(2026, 0, 1),
  completionDate: null,
  createdAt: 0,
  updatedAt: 500,
  pathId: '00000000-0000-4000-8000-000000000000',
  name: 'Server Name',
  progress: 0,
  readDates: [],
  ...over,
});
const ok = (status: number, data: unknown = serverSehaj({ updatedAt: status * 1000 })) => ({
  data,
  error: undefined,
  // A hey-api/axios SUCCESS result exposes `status` directly; only the error
  // member carries `response`. Both are set so either read path works.
  status,
  response: { status },
});
const fail = (status: number) => ({
  data: undefined,
  error: { message: 'x' },
  response: { status },
});

const makePath = (pathId: number): PathData => ({
  pathId,
  saveData: { angNumber: 0, verseId: 0 },
  progress: 1,
  startDate: '1-January-2026',
  completionDate: '',
  pathName: `Path #${pathId}`,
});
const makeDate = (pathid: number): DateData => ({ pathid, dates: [], scrollPosition: 0 });

const setup = (signedIn = true, accountMatches = true) => {
  const store = makeStore();
  store.dispatch(hydrateEmptySync());
  if (signedIn) {
    store.dispatch(setSignedIn({ token: 't', email: 'u@e.com', firstname: 'U', lastname: 'X' }));
  }
  if (accountMatches) {
    store.dispatch(setAccount('u@e.com'));
  }
  const coordinator = createOutboxCoordinator(store, { debounceMs: 100000, backoffMs: [100000] });
  // Debounce is huge so scheduled flushes never fire mid-test; we drive with
  // flushNow. start() is needed so backoff scheduling is active.
  coordinator.start();
  return { store, coordinator };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockResolvedValue(ok(201));
  mockUpdate.mockResolvedValue(ok(200));
  mockRemove.mockResolvedValue(ok(204, undefined));
  mockSettings.mockResolvedValue(ok(200, undefined));
  mockSync.mockResolvedValue(
    ok(200, { paths: [], deletedPathIds: [], settings: null, syncedAt: 999 })
  );
});

/** Creates path 1 and acks its create so it is on the server. */
const seedSyncedPath = async (
  store: ReturnType<typeof setup>['store'],
  coordinator: ReturnType<typeof setup>['coordinator']
) => {
  store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
  await coordinator.flushNow();
};

describe('outboxCoordinator', () => {
  it('POSTs a create, acks it (onServer + serverUpdatedAt), and clears the op', async () => {
    const { store, coordinator } = setup();
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));

    await coordinator.flushNow();

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const meta = store.getState().sync.meta[1];
    expect(meta.onServer).toBe(true);
    expect(meta.serverUpdatedAt).toBe(201000);
    expect(store.getState().sync.pathOps[1]).toBeUndefined();
    coordinator.stop();
  });

  it('stops and ignores an in-flight response after the signed-in account changes', async () => {
    const { store, coordinator } = setup();
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
    store.dispatch(addPath({ path: makePath(2), date: makeDate(2) }));
    let resolveCreate: (value: ReturnType<typeof ok>) => void = () => undefined;
    mockCreate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );

    const drain = coordinator.flushNow();
    await Promise.resolve();
    store.dispatch(
      setSignedIn({ token: 'b-token', email: 'b@e.com', firstname: 'B', lastname: 'Y' })
    );
    resolveCreate(ok(201));
    await drain;

    expect(mockCreate).toHaveBeenCalledTimes(1); // never sends path 2 with B's token
    expect(mockCreate.mock.calls[0][0].headers.Authorization).toBe('Bearer t');
    expect(store.getState().sync.pathOps[1]).toBeDefined(); // stale A response was ignored
    expect(store.getState().sync.pathOps[2]).toBeDefined();
    coordinator.stop();
  });

  it('waits for an already-running drain when flushNow is called again', async () => {
    const { store, coordinator } = setup();
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
    let resolveCreate: (value: ReturnType<typeof ok>) => void = () => undefined;
    mockCreate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );

    const firstFlush = coordinator.flushNow();
    await Promise.resolve();
    let secondFinished = false;
    const secondFlush = coordinator.flushNow().then(() => {
      secondFinished = true;
    });
    await Promise.resolve();

    expect(secondFinished).toBe(false);
    expect(mockCreate).toHaveBeenCalledTimes(1);

    resolveCreate(ok(201));
    await Promise.all([firstFlush, secondFlush]);

    expect(secondFinished).toBe(true);
    expect(store.getState().sync.pathOps[1]).toBeUndefined();
    coordinator.stop();
  });

  it('a create answered 200 (already exists) must NOT overwrite newer local progress', async () => {
    const { store, coordinator } = setup();
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
    store.dispatch(renamePath({ pathId: 1, name: 'Newer local name' }));
    // The first POST landed but its reply was lost; the retry gets 200 carrying
    // the server's OLD row.
    mockCreate.mockResolvedValueOnce(
      ok(200, serverSehaj({ name: 'Stale server name', updatedAt: 200000 }))
    );

    await coordinator.flushNow();

    // Local (newer) value survives; identity + clock are still recorded.
    expect(store.getState().paths.paths[0].pathName).toBe('Newer local name');
    expect(store.getState().sync.meta[1].onServer).toBe(true);
    expect(store.getState().sync.meta[1].serverUpdatedAt).toBe(200000);
    // The op is downgraded to an update so the newer state is PATCHed next.
    expect(store.getState().sync.pathOps[1].kind).toBe('update');
    coordinator.stop();
  });

  it('a permanent 400 keeps the change locally but stops retrying it', async () => {
    const { store, coordinator } = setup();
    await seedSyncedPath(store, coordinator);
    store.dispatch(renamePath({ pathId: 1, name: 'bad value' }));
    mockUpdate.mockResolvedValue(fail(400));

    await coordinator.flushNow();

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(store.getState().sync.pathOps[1]).toBeDefined(); // change kept
    expect(store.getState().sync.lastError).toBe('rejected');
    expect(coordinator.getStatus().backoffStep).toBe(0); // no retry timer armed

    // A second flush must not re-send the same rejected op.
    await coordinator.flushNow();
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    // Editing the path again un-blocks it.
    mockUpdate.mockResolvedValue(ok(200));
    store.dispatch(renamePath({ pathId: 1, name: 'fixed' }));
    await coordinator.flushNow();
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    coordinator.stop();
  });

  it('coalesces rapid renames into a single PATCH', async () => {
    const { store, coordinator } = setup();
    await seedSyncedPath(store, coordinator);

    store.dispatch(renamePath({ pathId: 1, name: 'A' }));
    store.dispatch(renamePath({ pathId: 1, name: 'B' }));
    await coordinator.flushNow();

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(store.getState().sync.pathOps[1]).toBeUndefined();
    coordinator.stop();
  });

  it('does not clear an op that was edited during the in-flight request', async () => {
    const { store, coordinator } = setup();
    await seedSyncedPath(store, coordinator);
    store.dispatch(renamePath({ pathId: 1, name: 'A' }));

    // Simulate the user editing again while the PATCH is in flight.
    mockUpdate.mockImplementationOnce(async () => {
      store.dispatch(renamePath({ pathId: 1, name: 'newer' }));
      return ok(200);
    });
    await coordinator.flushNow();

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    // The newer edit's op survives the stale ack and remains pending.
    expect(store.getState().sync.pathOps[1]).toBeDefined();
    coordinator.stop();
  });

  it('applies the server response body on a successful create', async () => {
    const { store, coordinator } = setup();
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
    mockCreate.mockResolvedValueOnce(ok(201, serverSehaj({ name: 'From Server', progress: 42 })));

    await coordinator.flushNow();

    expect(store.getState().paths.paths[0].pathName).toBe('From Server');
    expect(store.getState().paths.paths[0].progress).toBe(42);
    coordinator.stop();
  });

  it('a PATCH 409 fires one /sync, applies the merged body, and clears the op', async () => {
    const { store, coordinator } = setup();
    await seedSyncedPath(store, coordinator);
    const uuid = store.getState().sync.meta[1].serverPathId;
    store.dispatch(renamePath({ pathId: 1, name: 'A' }));
    mockUpdate.mockResolvedValueOnce(fail(409));
    mockSync.mockResolvedValueOnce(
      ok(200, {
        paths: [serverSehaj({ pathId: uuid, name: 'Merged', updatedAt: 300_000 })],
        deletedPathIds: [],
        settings: null,
        syncedAt: 999,
      })
    );

    await coordinator.flushNow();

    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(store.getState().paths.paths[0].pathName).toBe('Merged'); // server truth applied
    expect(store.getState().sync.pathOps[1]).toBeUndefined(); // reconciled + cleared
    expect(store.getState().sync.lastSyncedAt).toBe(999); // server clock stored
    expect(store.getState().sync.lastError).toBeNull();
    coordinator.stop();
  });

  /**
   * The server refuses to revive a tombstone on create, because the create body
   * carries no `updatedAt` to weigh against the deletion time. It answers 409
   * and the decision moves to `/sync`, which has both timestamps.
   *
   * These two cover the whole route end to end, and they are the pair that must
   * not collapse into one another: the same 409 has to be able to end in either
   * outcome, decided by the server rather than by which request went out.
   */
  it('a CREATE 409 fires one /sync, which revives the path when the local edit is newer', async () => {
    const { store, coordinator } = setup();
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
    const uuid = store.getState().sync.meta[1].serverPathId;

    // Deleted on another device; this one edited afterwards, so /sync revives it.
    mockCreate.mockResolvedValueOnce(fail(409));
    mockSync.mockResolvedValueOnce(
      ok(200, {
        paths: [serverSehaj({ pathId: uuid, name: 'Revived', updatedAt: 300_000 })],
        deletedPathIds: [],
        settings: null,
        syncedAt: 999,
      })
    );

    await coordinator.flushNow();

    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(store.getState().paths.paths).toHaveLength(1);
    expect(store.getState().paths.paths[0].pathName).toBe('Revived');
    expect(store.getState().sync.meta[1].deletedAt).toBeFalsy(); // not tombstoned
    expect(store.getState().sync.pathOps[1]).toBeUndefined(); // reconciled, not parked
    expect(store.getState().sync.lastError).toBeNull();
    coordinator.stop();
  });

  it('a CREATE 409 fires one /sync, which removes the stale copy when the deletion wins', async () => {
    const { store, coordinator } = setup();
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
    const uuid = store.getState().sync.meta[1].serverPathId;

    // The other device deleted it and this one never edited after that, so the
    // server sends it back as deleted and this copy goes. Without the create
    // refusing, this path would instead have been resurrected on every device.
    mockCreate.mockResolvedValueOnce(fail(409));
    mockSync.mockResolvedValueOnce(
      ok(200, {
        paths: [],
        deletedPathIds: [uuid],
        settings: null,
        syncedAt: 999,
      })
    );

    await coordinator.flushNow();

    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(store.getState().paths.paths).toHaveLength(0);
    expect(store.getState().sync.pathOps[1]).toBeUndefined();
    expect(store.getState().sync.lastError).toBeNull();
    coordinator.stop();
  });

  it('parks the conflicting op when the reconciling /sync is permanently rejected', async () => {
    // Regression: PATCH 409 → /sync 400 used to leave the op sendable, so the
    // next drain repeated PATCH → 409 → blocked /sync forever, and the path
    // stopped receiving cloud updates because it still counted as pending work.
    const { store, coordinator } = setup();
    await seedSyncedPath(store, coordinator);
    store.dispatch(renamePath({ pathId: 1, name: 'A' }));
    mockUpdate.mockResolvedValueOnce(fail(409));
    mockSync.mockResolvedValueOnce(fail(400));

    await coordinator.flushNow();

    expect(mockSync).toHaveBeenCalledTimes(1);
    // The user's change is kept locally — never discarded.
    expect(store.getState().paths.paths[0].pathName).toBe('A');
    expect(store.getState().sync.pathOps[1]).toBeDefined();
    expect(store.getState().sync.lastError).toBe('rejected');

    // The cycle must not repeat: no further PATCH, and no second /sync.
    mockUpdate.mockClear();
    mockSync.mockClear();
    await coordinator.flushNow();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockSync).not.toHaveBeenCalled();

    // And the path is free to sync again after a genuine local edit.
    store.dispatch(renamePath({ pathId: 1, name: 'B' }));
    mockUpdate.mockResolvedValueOnce(ok(200));
    await coordinator.flushNow();
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    coordinator.stop();
  });

  it('does not re-send an identical /sync body the server already rejected', async () => {
    const { store, coordinator } = setup();
    await seedSyncedPath(store, coordinator);
    store.dispatch(renamePath({ pathId: 1, name: 'A' }));
    mockUpdate.mockResolvedValue(fail(409));
    mockSync.mockResolvedValueOnce(fail(400));

    await coordinator.flushNow();
    mockSync.mockClear();

    // A second conflict on unchanged state must not reissue the same body.
    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 5 }));
    await coordinator.flushNow();

    expect(mockSync).not.toHaveBeenCalled();
    coordinator.stop();
  });

  it('backs off instead of recursing when /sync itself returns 409', async () => {
    // `/sync` IS the reconciliation, so calling it again immediately would
    // recurse against a second device that is actively writing.
    const { store, coordinator } = setup();
    await seedSyncedPath(store, coordinator);
    store.dispatch(renamePath({ pathId: 1, name: 'A' }));
    mockUpdate.mockResolvedValueOnce(fail(409));
    mockSync.mockResolvedValueOnce(fail(409));

    await coordinator.flushNow();

    expect(mockSync).toHaveBeenCalledTimes(1); // not called again from its own failure
    expect(store.getState().sync.lastError).toBe('network'); // transient → retried later
    expect(store.getState().sync.pathOps[1]).toBeDefined();
    coordinator.stop();
  });

  it('sends the reconciling /sync with the long timeout, not the 25s default', async () => {
    const { store, coordinator } = setup();
    await seedSyncedPath(store, coordinator);
    store.dispatch(renamePath({ pathId: 1, name: 'A' }));
    mockUpdate.mockResolvedValueOnce(fail(409));

    await coordinator.flushNow();

    expect(mockSync).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: SYNC_REQUEST_TIMEOUT_MS })
    );
    expect(SYNC_REQUEST_TIMEOUT_MS).toBe(60_000);
    coordinator.stop();
  });

  it('reconciles once instead of replaying a write when its success body cannot be applied', async () => {
    // A write can succeed on the server even when a malformed success body makes
    // local response application throw. Replaying that PATCH/create is unsafe:
    // its clock is now stale. Reconcile once through /sync instead.
    const { store, coordinator } = setup();
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
    const uuid = store.getState().sync.meta[1].serverPathId;
    // A response the applier cannot handle.
    mockCreate.mockResolvedValueOnce(ok(201, null));
    mockSync.mockResolvedValueOnce(
      ok(200, {
        paths: [serverSehaj({ pathId: uuid, updatedAt: 300_000 })],
        deletedPathIds: [],
        settings: null,
        syncedAt: 999,
      })
    );

    await coordinator.flushNow();

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(store.getState().sync.pathOps[1]).toBeUndefined();
    expect(store.getState().sync.lastError).not.toBe('network');
    expect(store.getState().sync.status).not.toBe('error');
    coordinator.stop();
  });

  it('never leaves the status stuck on flushing when something throws mid-drain', async () => {
    // Device report: an endless "Syncing…" with no error, while the path had
    // reached the server. `status` is set to 'flushing' before the try, and
    // everything that resets it lives after — so an escaping throw pinned the app
    // in a syncing state for the rest of the session.
    const { store, coordinator } = setup();
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
    mockCreate.mockImplementationOnce(() => {
      throw new Error('unexpected');
    });

    await coordinator.flushNow();

    expect(store.getState().sync.status).not.toBe('flushing');
    // The work is kept and retried rather than silently dropped.
    expect(store.getState().sync.pathOps[1]).toBeDefined();
    coordinator.stop();
  });

  it('skips a settings PUT when the document already matches the server', async () => {
    const { store, coordinator } = setup();

    store.dispatch(setLarivaar(true));
    await coordinator.flushNow();
    expect(mockSettings).toHaveBeenCalledTimes(1);

    // Toggled and toggled back before the next drain: the document is identical
    // to what the server just confirmed, so there is nothing to send.
    mockSettings.mockClear();
    store.dispatch(setLarivaar(false));
    store.dispatch(setLarivaar(true));
    await coordinator.flushNow();

    expect(mockSettings).not.toHaveBeenCalled();
    // Clearing the marker is what stops the coordinator rescheduling for ever.
    expect(store.getState().sync.pendingSettingsUpdatedAt).toBeNull();
    coordinator.stop();
  });

  it('still sends when the settings genuinely changed', async () => {
    const { store, coordinator } = setup();
    store.dispatch(setLarivaar(true));
    await coordinator.flushNow();

    mockSettings.mockClear();
    store.dispatch(setLarivaar(false));
    await coordinator.flushNow();

    expect(mockSettings).toHaveBeenCalledTimes(1);
    coordinator.stop();
  });

  it('does not skip when the baseline is unknown, as after a restart', async () => {
    // The record is runtime-only, so a fresh launch must upload unconditionally
    // rather than assume the server already agrees.
    const { store, coordinator } = setup();
    store.dispatch(setLarivaar(true));

    await coordinator.flushNow();

    expect(mockSettings).toHaveBeenCalledTimes(1);
    coordinator.stop();
  });

  it('a 401 signs the user out (clears token) and stops further sync attempts', async () => {
    const { store, coordinator } = setup();
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
    mockCreate.mockResolvedValueOnce(fail(401));

    await coordinator.flushNow();

    // Signed out locally: auth slice reset and persisted token cleared.
    expect(store.getState().auth.status).toBe('signedOut');
    expect(store.getState().auth.token).toBeNull();
    expect(mockClearToken).toHaveBeenCalled();
    // The op is kept (not acked), and no more calls go out with the bad token.
    expect(store.getState().sync.pathOps[1]).toBeDefined();

    mockCreate.mockClear();
    await coordinator.flushNow();
    expect(mockCreate).not.toHaveBeenCalled();
    coordinator.stop();
  });

  it('logs when the token could not be cleared after a 401', async () => {
    const { store, coordinator } = setup();
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
    mockCreate.mockResolvedValueOnce(fail(401));
    mockClearToken.mockResolvedValueOnce(false); // storage error, no throw

    await coordinator.flushNow();

    expect(store.getState().auth.status).toBe('signedOut');
    expect(recordError).toHaveBeenCalledWith(
      expect.any(Error),
      'outbox: clearing token after 401 failed'
    );
    coordinator.stop();
  });

  it('a network error keeps the op, flags error, and advances backoff', async () => {
    const { store, coordinator } = setup();
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
    mockCreate.mockRejectedValueOnce(new Error('offline'));

    await coordinator.flushNow();

    expect(store.getState().sync.pathOps[1]).toBeDefined();
    expect(store.getState().sync.lastError).toBe('network');
    expect(coordinator.getStatus().backoffStep).toBe(1);
    coordinator.stop();
  });

  it('makes exactly three automatic retries after a network failure, then pauses', async () => {
    jest.useFakeTimers();
    try {
      const store = makeStore();
      store.dispatch(hydrateEmptySync());
      store.dispatch(setSignedIn({ token: 't', email: 'u@e.com', firstname: 'U', lastname: 'X' }));
      store.dispatch(setAccount('u@e.com'));
      const coordinator = createOutboxCoordinator(store, {
        debounceMs: 1,
        backoffMs: [10, 20, 30],
      });
      coordinator.start();
      store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
      mockCreate.mockRejectedValue(new Error('offline'));

      await coordinator.flushNow(); // initial attempt
      expect(mockCreate).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(10);
      await jest.advanceTimersByTimeAsync(20);
      await jest.advanceTimersByTimeAsync(30);
      expect(mockCreate).toHaveBeenCalledTimes(4); // initial + three retries

      await jest.advanceTimersByTimeAsync(1000);
      expect(mockCreate).toHaveBeenCalledTimes(4);
      coordinator.stop();
    } finally {
      jest.useRealTimers();
    }
  });

  it.each([
    ['a 500 server error', () => mockUpdate.mockResolvedValueOnce(fail(500))],
    ['a 408 request timeout', () => mockUpdate.mockResolvedValueOnce(fail(408))],
    ['a 425 too-early response', () => mockUpdate.mockResolvedValueOnce(fail(425))],
    ['a 429 rate-limit response', () => mockUpdate.mockResolvedValueOnce(fail(429))],
    ['a DNS/timeout rejection', () => mockUpdate.mockRejectedValueOnce(new Error('ENOTFOUND'))],
    [
      'an unreachable server (no response)',
      () =>
        mockUpdate.mockResolvedValueOnce({
          data: undefined,
          error: { message: 'Network Error' },
          response: undefined,
        }),
    ],
  ])('never drops the pending op on %s', async (_label, arrange) => {
    const { store, coordinator } = setup();
    await seedSyncedPath(store, coordinator);
    store.dispatch(renamePath({ pathId: 1, name: 'Keep me' }));
    arrange();

    await coordinator.flushNow();

    // The user's change survives and is queued for a retry.
    expect(store.getState().sync.pathOps[1]).toBeDefined();
    expect(store.getState().paths.paths[0].pathName).toBe('Keep me');
    expect(store.getState().sync.lastError).toBe('network');
    expect(coordinator.getStatus().backoffStep).toBeGreaterThan(0);
    coordinator.stop();
  });

  it('does nothing while offline', async () => {
    const { store, coordinator } = setup();
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
    store.dispatch(setOnline(false));

    await coordinator.flushNow();

    expect(mockCreate).not.toHaveBeenCalled();
    coordinator.stop();
  });

  it('does nothing when the loaded data is not associated with the signed-in account', async () => {
    const { store, coordinator } = setup(true, false); // signed in, but sync.account unset
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));

    await coordinator.flushNow();

    expect(mockCreate).not.toHaveBeenCalled();
    coordinator.stop();
  });

  it('clears the scroll-dirty flag when the PATCH carrying it is acked', async () => {
    const { store, coordinator } = setup();
    await seedSyncedPath(store, coordinator);
    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 640 })); // scrollDirty set
    store.dispatch(renamePath({ pathId: 1, name: 'A' })); // update op carries the scroll
    expect(store.getState().sync.scrollDirty[1]).toBeGreaterThan(0);

    await coordinator.flushNow();

    expect(store.getState().sync.scrollDirty[1]).toBeUndefined();
    coordinator.stop();
  });

  it('PUTs pending settings and clears the pending marker', async () => {
    const { store, coordinator } = setup();
    store.dispatch(setLarivaar(true));

    await coordinator.flushNow();

    expect(mockSettings).toHaveBeenCalledTimes(1);
    expect(store.getState().sync.pendingSettingsUpdatedAt).toBeNull();
    coordinator.stop();
  });

  it('DELETEs a tombstoned path, then removes its local copy', async () => {
    const { store, coordinator } = setup();
    await seedSyncedPath(store, coordinator); // path 1 now on server
    store.dispatch(markPathDeleted({ pathId: 1, at: Date.now() }));

    await coordinator.flushNow();

    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(store.getState().paths.paths.find((p) => p.pathId === 1)).toBeUndefined();
    expect(store.getState().sync.meta[1]).toBeUndefined();
    coordinator.stop();
  });

  it('treats a DELETE 404 as already-gone (success)', async () => {
    const { store, coordinator } = setup();
    await seedSyncedPath(store, coordinator);
    store.dispatch(markPathDeleted({ pathId: 1, at: Date.now() }));
    mockRemove.mockResolvedValueOnce(fail(404));

    await coordinator.flushNow();

    expect(store.getState().paths.paths.find((p) => p.pathId === 1)).toBeUndefined();
    expect(store.getState().sync.meta[1]).toBeUndefined();
    coordinator.stop();
  });
});
