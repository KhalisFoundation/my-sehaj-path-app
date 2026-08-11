import type { SehajPath, SehajPathSyncResult } from '@api/generated/types.gen';
import {
  sehajPathSettingsControllerGet,
  sehajPathsControllerFindAll,
} from '@api/generated/sdk.gen';
import { makeStore } from '../../store';
import {
  applyServerPath,
  applySyncResult,
  captureSyncSnapshot,
  reconcileDeletions,
  refreshPathsFromServer,
} from '../../store/applyServerResponse';
import { addPath, renamePath, setScrollPosition } from '../../store/slices/pathsSlice';
import { setSignedIn } from '../../store/slices/authSlice';
import { setLarivaar } from '../../store/slices/settingsSlice';
import {
  ackServerPath,
  clearSettingsIfUnchanged,
  hydrateEmptySync,
  markSettingsDirty,
  setAccount,
} from '../../store/slices/syncSlice';
import { clearCurrentToken } from '../../auth/tokenUtils';
import type { DateData, PathData } from '../../types';

jest.mock('@api/generated/sdk.gen', () => ({
  sehajPathsControllerFindAll: jest.fn(),
  sehajPathSettingsControllerGet: jest.fn(),
}));
jest.mock('../../auth/tokenUtils', () => ({
  clearCurrentToken: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../utils/crashlytics', () => ({
  recordError: jest.fn(),
  logBreadcrumb: jest.fn(),
  allowCrashReporting: jest.fn(),
  testCrash: jest.fn(),
}));

const mockFindAll = sehajPathsControllerFindAll as jest.Mock;
const mockGetSettings = sehajPathSettingsControllerGet as jest.Mock;
const mockClearToken = clearCurrentToken as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSettings.mockResolvedValue({
    data: { settings: {} },
    error: undefined,
    response: { status: 200 },
  });
});

const OTHER_UUID = '99999999-2222-4333-8444-555555555555';

const makePath = (pathId: number): PathData => ({
  pathId,
  saveData: { angNumber: 0, verseId: 0 },
  progress: 1,
  startDate: '1-January-2026',
  completionDate: '',
  pathName: `Path #${pathId}`,
});
const makeDate = (pathid: number): DateData => ({ pathid, dates: [], scrollPosition: 0 });

const serverPath = (uuid: string, over: Partial<SehajPath> = {}): SehajPath => ({
  angNumber: 50,
  verseId: 200,
  scrollPosition: 999,
  startDate: Date.UTC(2026, 0, 1),
  completionDate: null,
  createdAt: Date.UTC(2026, 0, 1),
  updatedAt: 500,
  pathId: uuid,
  name: 'Server Name',
  progress: 3.5,
  readDates: ['2026-01-01'],
  ...over,
});

/** A store holding one path (id 1) that is already on the server. */
const syncedStore = () => {
  const store = makeStore();
  store.dispatch(hydrateEmptySync());
  store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
  const uuid = store.getState().sync.meta[1].serverPathId;
  const sent = store.getState().sync.pathOps[1].localUpdatedAt;
  store.dispatch(ackServerPath({ pathId: 1, sentLocalUpdatedAt: sent, serverUpdatedAt: 100 }));
  return { store, uuid };
};

describe('applyServerPath (single response)', () => {
  it('acks and applies the body when nothing changed mid-flight', () => {
    const { store, uuid } = syncedStore();
    const sent = store.getState().sync.meta[1].localUpdatedAt;

    applyServerPath(store, serverPath(uuid), {
      pathId: 1,
      sentLocalUpdatedAt: sent,
      operation: 'update',
    });

    const path = store.getState().paths.paths[0];
    expect(path.pathName).toBe('Server Name');
    expect(path.saveData).toEqual({ angNumber: 50, verseId: 200 });
    expect(store.getState().sync.meta[1].serverUpdatedAt).toBe(500);
    expect(store.getState().paths.dates[0].dates).toEqual([{ date: '1-January-2026' }]);
  });

  it('never overwrites the local scrollPosition', () => {
    const { store, uuid } = syncedStore();
    const sent = store.getState().sync.meta[1].localUpdatedAt;

    applyServerPath(store, serverPath(uuid), {
      pathId: 1,
      sentLocalUpdatedAt: sent,
      operation: 'update',
    });

    expect(store.getState().paths.dates[0].scrollPosition).toBe(0); // not the server's 999
  });

  it('applies ang, verse, and scroll together from a refresh for a clean closed path', () => {
    const { store, uuid } = syncedStore();

    applyServerPath(store, serverPath(uuid, { angNumber: 70, verseId: 12, scrollPosition: 777 }));

    expect(store.getState().paths.paths[0].saveData).toEqual({ angNumber: 70, verseId: 12 });
    expect(store.getState().paths.dates[0].scrollPosition).toBe(777);
  });

  it('keeps a dirty local scroll checkpoint instead of applying a stale refresh', () => {
    const { store, uuid } = syncedStore();
    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 444 }));

    applyServerPath(store, serverPath(uuid, { angNumber: 70, verseId: 12, scrollPosition: 777 }));

    expect(store.getState().paths.paths[0].saveData).toEqual({ angNumber: 0, verseId: 0 });
    expect(store.getState().paths.dates[0].scrollPosition).toBe(444);
  });

  it('keeps the server clock but skips the body when a newer local edit landed', () => {
    const { store, uuid } = syncedStore();
    const sent = store.getState().sync.meta[1].localUpdatedAt;
    store.dispatch(renamePath({ pathId: 1, name: 'Local newer' })); // advances localUpdatedAt

    applyServerPath(store, serverPath(uuid), {
      pathId: 1,
      sentLocalUpdatedAt: sent,
      operation: 'update',
    });

    expect(store.getState().paths.paths[0].pathName).toBe('Local newer'); // body skipped
    expect(store.getState().sync.meta[1].serverUpdatedAt).toBe(500); // clock still stored
  });

  it('skips the body of a GET-refresh apply while a local op is pending', () => {
    const { store, uuid } = syncedStore();
    store.dispatch(renamePath({ pathId: 1, name: 'Dirty local' }));

    applyServerPath(store, serverPath(uuid)); // no `sent` → GET/sync style

    expect(store.getState().paths.paths[0].pathName).toBe('Dirty local');
    // The remote clock is deliberately NOT acknowledged without merging its
    // body; the pending PATCH must use the old base and receive a safe 409.
    expect(store.getState().sync.meta[1].serverUpdatedAt).toBe(100);
  });

  it('ignores a refresh response older than the server version already applied', () => {
    const { store, uuid } = syncedStore();
    applyServerPath(store, serverPath(uuid, { name: 'New', updatedAt: 700 }));
    applyServerPath(store, serverPath(uuid, { name: 'Old', updatedAt: 600 }));

    expect(store.getState().paths.paths[0].pathName).toBe('New');
    expect(store.getState().sync.meta[1].serverUpdatedAt).toBe(700);
  });

  it('allocates a new local row for an unknown server path', () => {
    const { store } = syncedStore();

    applyServerPath(store, serverPath(OTHER_UUID, { name: 'From other device' }));

    const allocated = store.getState().paths.paths.find((p) => p.pathName === 'From other device');
    expect(allocated).toBeDefined();
    const meta = store.getState().sync.meta[allocated!.pathId];
    expect(meta.serverPathId).toBe(OTHER_UUID);
    expect(meta.onServer).toBe(true);
  });
});

describe('applySyncResult', () => {
  const result = (over: Partial<SehajPathSyncResult>): SehajPathSyncResult => ({
    paths: [],
    deletedPathIds: [],
    settings: null,
    syncedAt: 777,
    ...over,
  });

  it('stores syncedAt verbatim', () => {
    const { store } = syncedStore();
    applySyncResult(store, result({ syncedAt: 777 }), captureSyncSnapshot(store.getState()));
    expect(store.getState().sync.lastSyncedAt).toBe(777);
  });

  it('applies the merged server body for a returned path whose sent op still matches', () => {
    const { store, uuid } = syncedStore();
    store.dispatch(renamePath({ pathId: 1, name: 'A' })); // pending op we are about to send
    const snapshot = captureSyncSnapshot(store.getState());

    applySyncResult(store, result({ paths: [serverPath(uuid, { name: 'Merged' })] }), snapshot);

    // Server truth is applied (not the stale local 'A'), and the op is cleared.
    expect(store.getState().paths.paths[0].pathName).toBe('Merged');
    expect(store.getState().sync.pathOps[1]).toBeUndefined();
  });

  it('keeps a newer local edit made during the /sync request (skips its body)', () => {
    const { store, uuid } = syncedStore();
    store.dispatch(renamePath({ pathId: 1, name: 'A' }));
    const snapshot = captureSyncSnapshot(store.getState());
    store.dispatch(renamePath({ pathId: 1, name: 'B' })); // edit lands during the request

    applySyncResult(store, result({ paths: [serverPath(uuid, { name: 'Merged' })] }), snapshot);

    expect(store.getState().paths.paths[0].pathName).toBe('B'); // newer local edit preserved
    expect(store.getState().sync.pathOps[1]).toBeDefined(); // its op stays queued
  });

  it('removes a server-deleted path that is not locally dirtier', () => {
    const { store, uuid } = syncedStore();
    applySyncResult(
      store,
      result({ deletedPathIds: [uuid] }),
      captureSyncSnapshot(store.getState())
    );
    expect(store.getState().paths.paths.find((p) => p.pathId === 1)).toBeUndefined();
    expect(store.getState().sync.meta[1]).toBeUndefined();
  });

  it('keeps a server-deleted path that has a newer local edit', () => {
    const { store, uuid } = syncedStore();
    const snapshot = captureSyncSnapshot(store.getState());
    store.dispatch(renamePath({ pathId: 1, name: 'edited after delete' }));
    applySyncResult(store, result({ deletedPathIds: [uuid] }), snapshot);
    expect(store.getState().paths.paths.find((p) => p.pathId === 1)).toBeDefined();
  });

  it('removes a path when the sent edit lost to a server tombstone', () => {
    const { store, uuid } = syncedStore();
    store.dispatch(renamePath({ pathId: 1, name: 'stale edit' }));
    const snapshot = captureSyncSnapshot(store.getState());

    applySyncResult(store, result({ deletedPathIds: [uuid] }), snapshot);

    expect(store.getState().paths.paths.find((p) => p.pathId === 1)).toBeUndefined();
    expect(store.getState().sync.pathOps[1]).toBeUndefined();
  });

  it('keeps a server-deleted path that has unsynced scroll progress', () => {
    const { store, uuid } = syncedStore();
    const snapshot = captureSyncSnapshot(store.getState());
    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 500 })); // dirty scroll, no op
    applySyncResult(store, result({ deletedPathIds: [uuid] }), snapshot);
    expect(store.getState().paths.paths.find((p) => p.pathId === 1)).toBeDefined();
  });

  it('clears a sent scrollDirty marker on success', () => {
    const { store, uuid } = syncedStore();
    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 500 }));
    const snapshot = captureSyncSnapshot(store.getState());
    expect(store.getState().sync.scrollDirty[1]).toBeGreaterThan(0);

    applySyncResult(store, result({ paths: [serverPath(uuid)] }), snapshot);

    expect(store.getState().sync.scrollDirty[1]).toBeUndefined();
  });

  it('applies settings only when no local settings edit is pending', () => {
    const { store } = syncedStore();
    const settings = { settings: { larivaar: true }, userId: 'u', updatedAt: 'x' };

    applySyncResult(store, result({ settings }), captureSyncSnapshot(store.getState()));
    expect(store.getState().settings.larivaar).toBe(true);

    // Now with a pending local settings edit, the server value must not clobber it.
    store.dispatch(setLarivaar(false)); // marks settings dirty
    applySyncResult(store, result({ settings }), captureSyncSnapshot(store.getState()));
    expect(store.getState().settings.larivaar).toBe(false);
  });
});

describe('reconcileDeletions', () => {
  it('removes an on-server path absent from the listing, but never a dirty or active one', () => {
    const { store } = syncedStore();
    // Present set does NOT include uuid → candidate for removal. But mark it dirty.
    store.dispatch(renamePath({ pathId: 1, name: 'dirty' }));
    reconcileDeletions(store, new Set<string>());
    expect(store.getState().paths.paths.find((p) => p.pathId === 1)).toBeDefined(); // kept (dirty)

    // Clear the op by acking, then reconcile again → now removable.
    const sent = store.getState().sync.pathOps[1].localUpdatedAt;
    store.dispatch(ackServerPath({ pathId: 1, sentLocalUpdatedAt: sent, serverUpdatedAt: 600 }));
    reconcileDeletions(store, new Set<string>(), 1); // but it's the active reader → kept
    expect(store.getState().paths.paths.find((p) => p.pathId === 1)).toBeDefined();

    reconcileDeletions(store, new Set<string>()); // not active, not dirty → removed
    expect(store.getState().paths.paths.find((p) => p.pathId === 1)).toBeUndefined();
    expect(store.getState().sync.meta[1]).toBeUndefined();
  });
});

describe('refreshPathsFromServer', () => {
  const findAllOk = (paths: SehajPath[]) => ({
    data: paths,
    error: undefined,
    response: { status: 200 },
  });

  /** Signed in with the loaded data associated to the account (no pending ops). */
  const signedInStore = () => {
    const store = makeStore();
    store.dispatch(hydrateEmptySync());
    store.dispatch(setSignedIn({ token: 't', email: 'u@e.com', firstname: 'U', lastname: 'X' }));
    store.dispatch(setAccount('u@e.com'));
    return store;
  };

  const addSyncedPath = (store: ReturnType<typeof signedInStore>, pathId: number) => {
    store.dispatch(addPath({ path: makePath(pathId), date: makeDate(pathId) }));
    const uuid = store.getState().sync.meta[pathId].serverPathId;
    const sent = store.getState().sync.pathOps[pathId].localUpdatedAt;
    store.dispatch(ackServerPath({ pathId, sentLocalUpdatedAt: sent, serverUpdatedAt: 100 }));
    return uuid;
  };

  it('allocates a path created on another device', async () => {
    const store = signedInStore();
    mockFindAll.mockResolvedValueOnce(
      findAllOk([serverPath(OTHER_UUID, { name: 'Other device' })])
    );

    expect(await refreshPathsFromServer(store)).toBe(true);
    expect(store.getState().paths.paths.find((p) => p.pathName === 'Other device')).toBeDefined();
  });

  it('removes a local on-server path the server no longer returns', async () => {
    const store = signedInStore();
    addSyncedPath(store, 1);
    mockFindAll.mockResolvedValueOnce(findAllOk([])); // path 1 deleted on another device

    expect(await refreshPathsFromServer(store)).toBe(true);
    expect(store.getState().paths.paths.find((p) => p.pathId === 1)).toBeUndefined();
    expect(store.getState().sync.meta[1]).toBeUndefined();
  });

  it('does not apply server changes to the active reader path', async () => {
    const store = signedInStore();
    const uuid = addSyncedPath(store, 1); // local path 1: name 'Path #1', progress 1
    mockFindAll.mockResolvedValueOnce(
      findAllOk([serverPath(uuid, { name: 'Changed on server', progress: 88 })])
    );

    expect(await refreshPathsFromServer(store, 1)).toBe(true); // path 1 is the active reader
    const path = store.getState().paths.paths.find((p) => p.pathId === 1)!;
    expect(path.pathName).toBe('Path #1'); // untouched
    expect(path.progress).toBe(1);
  });

  it('skips (no network call) while a local path op is pending', async () => {
    const store = signedInStore();
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) })); // pending create op

    expect(await refreshPathsFromServer(store)).toBe(false);
    expect(mockFindAll).not.toHaveBeenCalled();
  });

  it('skips when the loaded data is not associated with the signed-in account', async () => {
    const store = makeStore();
    store.dispatch(hydrateEmptySync());
    store.dispatch(setSignedIn({ token: 't', email: 'u@e.com', firstname: 'U', lastname: 'X' }));
    // no setAccount → sync.account stays null

    expect(await refreshPathsFromServer(store)).toBe(false);
    expect(mockFindAll).not.toHaveBeenCalled();
  });

  it('pulls settings changed on another device when there is no local settings edit', async () => {
    const store = signedInStore();
    mockFindAll.mockResolvedValueOnce(findAllOk([]));
    mockGetSettings.mockResolvedValueOnce({
      data: { settings: { larivaar: true } },
      error: undefined,
      response: { status: 200 },
    });

    await refreshPathsFromServer(store);

    expect(store.getState().settings.larivaar).toBe(true);
  });

  it('keeps a local settings edit instead of overwriting it with a refresh', async () => {
    const store = signedInStore();
    store.dispatch(setLarivaar(true));
    store.dispatch(markSettingsDirty({ at: Date.now() }));
    mockFindAll.mockResolvedValueOnce(findAllOk([]));
    mockGetSettings.mockResolvedValueOnce({
      data: { settings: { larivaar: false } },
      error: undefined,
      response: { status: 200 },
    });

    await refreshPathsFromServer(store);

    expect(store.getState().settings.larivaar).toBe(true);
  });

  it('seeds the server with the device settings when it has none (settings 404)', async () => {
    const store = signedInStore();
    mockFindAll.mockResolvedValueOnce(findAllOk([]));
    mockGetSettings.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'not found' },
      response: { status: 404 },
    });
    // Nothing pending — the user never changed a setting this session.
    expect(store.getState().sync.pendingSettingsUpdatedAt).toBeNull();

    // A 404 is not a failure; the refresh still succeeds.
    expect(await refreshPathsFromServer(store)).toBe(true);

    // The device's current settings are now queued to upload (PUT /settings),
    // so the next login restores them instead of defaults.
    expect(store.getState().sync.pendingSettingsUpdatedAt).not.toBeNull();
  });

  it('does not re-stamp settings on a 404 when a local edit is already pending', async () => {
    const store = signedInStore();
    store.dispatch(setLarivaar(true));
    store.dispatch(markSettingsDirty({ at: 1000 }));
    const pendingBefore = store.getState().sync.pendingSettingsUpdatedAt;
    mockFindAll.mockResolvedValueOnce(findAllOk([]));
    mockGetSettings.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'not found' },
      response: { status: 404 },
    });

    await refreshPathsFromServer(store);

    // The already-pending edit is left as-is; the outbox will push it.
    expect(store.getState().sync.pendingSettingsUpdatedAt).toBe(pendingBefore);
  });

  it('does not report a refresh as successful when settings failed to load', async () => {
    const store = signedInStore();
    mockFindAll.mockResolvedValueOnce(findAllOk([]));
    mockGetSettings.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'server error' },
      response: { status: 500 },
    });

    expect(await refreshPathsFromServer(store)).toBe(false);
    expect(store.getState().sync.status).toBe('error');
    expect(store.getState().sync.lastError).toBe('network');
  });

  it('clears an earlier refresh error after a later successful pull', async () => {
    const store = signedInStore();
    mockFindAll.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'server error' },
      response: { status: 500 },
    });
    expect(await refreshPathsFromServer(store)).toBe(false);

    mockFindAll.mockResolvedValueOnce(findAllOk([]));
    expect(await refreshPathsFromServer(store)).toBe(true);
    expect(store.getState().sync.status).toBe('idle');
    expect(store.getState().sync.lastError).toBeNull();
  });

  it('signs out and clears a token rejected by a background refresh', async () => {
    const store = signedInStore();
    mockFindAll.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'expired' },
      response: { status: 401 },
    });

    expect(await refreshPathsFromServer(store)).toBe(false);
    expect(store.getState().auth.status).toBe('signedOut');
    expect(mockClearToken).toHaveBeenCalledTimes(1);
  });

  it('drops a stale account response after the user changes account', async () => {
    const store = signedInStore();
    let resolvePaths: (value: ReturnType<typeof findAllOk>) => void = () => undefined;
    mockFindAll.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePaths = resolve;
        })
    );
    const refresh = refreshPathsFromServer(store);
    store.dispatch(
      setSignedIn({ token: 'new-token', email: 'b@e.com', firstname: 'B', lastname: 'Y' })
    );
    store.dispatch(setAccount('b@e.com'));
    resolvePaths(findAllOk([serverPath(OTHER_UUID, { name: 'A private path' })]));

    expect(await refresh).toBe(false);
    expect(store.getState().paths.paths).toEqual([]);
  });

  it('treats 304 Not Modified as a successful refresh, not a failure', async () => {
    // Device report: "unable to sync" after an account switch, cleared by a
    // manual Sync. The server had answered 304 (Express adds ETags by default),
    // axios counts only 2xx as success, and the client called it a network
    // failure for a refresh that had worked.
    const store = signedInStore();
    mockFindAll.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Not Modified' },
      response: { status: 304 },
    });

    expect(await refreshPathsFromServer(store)).toBe(true);
    expect(store.getState().sync.lastError).toBeNull();
    expect(store.getState().sync.status).not.toBe('error');
  });

  it('always clears the pulling flag, so the status notice cannot spin forever', async () => {
    // Device report: an infinite "Syncing…" with no error, while the data had in
    // fact reached the server. `pulling` had been left set, so the notice was
    // waiting on a download that had already finished.
    const store = signedInStore();

    await refreshPathsFromServer(store);
    expect(store.getState().sync.pulling).toBe(false);

    // Also on the failure path — a stuck spinner is worse than a wrong result.
    mockFindAll.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'boom' },
      response: { status: 500 },
    });
    await refreshPathsFromServer(store);
    expect(store.getState().sync.pulling).toBe(false);
  });

  it('coalesces overlapping refresh calls into one request', async () => {
    const store = signedInStore();
    let resolvePaths: (value: ReturnType<typeof findAllOk>) => void = () => undefined;
    mockFindAll.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePaths = resolve;
        })
    );

    const first = refreshPathsFromServer(store);
    const second = refreshPathsFromServer(store);
    expect(mockFindAll).toHaveBeenCalledTimes(1);

    resolvePaths(findAllOk([]));
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
  });

  it('does not delete a path acknowledged while an older listing was in flight', async () => {
    const store = signedInStore();
    const uuid = addSyncedPath(store, 1);
    let resolvePaths: (value: ReturnType<typeof findAllOk>) => void = () => undefined;
    mockFindAll.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePaths = resolve;
        })
    );

    const refresh = refreshPathsFromServer(store);
    store.dispatch(renamePath({ pathId: 1, name: 'saved during GET' }));
    const sent = store.getState().sync.pathOps[1].localUpdatedAt;
    store.dispatch(ackServerPath({ pathId: 1, sentLocalUpdatedAt: sent, serverUpdatedAt: 700 }));
    resolvePaths(findAllOk([])); // old listing predates the acknowledged update

    await refresh;
    expect(store.getState().paths.paths.find((path) => path.pathId === 1)).toBeDefined();
    expect(store.getState().sync.meta[1].serverPathId).toBe(uuid);
  });

  it('does not apply old settings after a newer local setting was acknowledged', async () => {
    const store = signedInStore();
    let resolvePaths: (value: ReturnType<typeof findAllOk>) => void = () => undefined;
    let resolveSettings: (value: unknown) => void = () => undefined;
    mockFindAll.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePaths = resolve;
        })
    );
    mockGetSettings.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSettings = resolve;
        })
    );

    const refresh = refreshPathsFromServer(store);
    store.dispatch(setLarivaar(true));
    const revision = store.getState().sync.pendingSettingsUpdatedAt!;
    store.dispatch(clearSettingsIfUnchanged(revision)); // simulate successful PUT
    resolvePaths(findAllOk([]));
    resolveSettings({
      data: { settings: { larivaar: false } },
      error: undefined,
      response: { status: 200 },
    });

    await refresh;
    expect(store.getState().settings.larivaar).toBe(true);
  });
});
