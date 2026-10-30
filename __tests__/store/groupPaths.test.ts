import { makeStore, store as appStore } from '../../store';
import { saveGroupPankti } from '../../store/groupPaths';
import { sehajPathSessionsControllerSavePankti } from '../../api/generated/sdk.gen';

jest.mock('../../api/generated/sdk.gen', () => ({
  sehajPathSessionsControllerSavePankti: jest.fn(async () => ({
    data: {
      applied: true,
      angNumber: 3,
      verseId: 78,
      scrollPosition: 421,
      progress: 0.2,
      completionDate: null,
    },
  })),
}));

const savePanktiSpy = sehajPathSessionsControllerSavePankti as jest.Mock;
const UUID_FOR_GROUP = '90fad16b-18b7-4d23-9729-7bec7feca77b';
import { canInvite, isTurnStillLive, opensAsGroup } from '../../store/groupPaths';
import { addPath, updatePath, setScrollPosition } from '../../store/slices/pathsSlice';
import { setPathShared, hydrateSync } from '../../store/slices/syncSlice';
import { buildSyncRequest } from '../../store/syncRequest';
import type { DateData, PathData } from '../../types';

/**
 * The rule these all protect: a shared path is server-owned, so none of the
 * local-first machinery may touch it. Getting this wrong does not fail loudly —
 * it silently overwrites what a group did while this device was away.
 */

const makePath = (pathId: number): PathData => ({
  pathId,
  saveData: { angNumber: 100, verseId: 200 },
  progress: 7,
  startDate: '1-January-2026',
  completionDate: '',
  pathName: `Path #${pathId}`,
});
const makeDate = (pathid: number): DateData => ({ pathid, dates: [], scrollPosition: 0 });

const updateFor = (pathId: number) =>
  updatePath({
    pathId,
    angNumber: 300,
    verseId: 900,
    progress: 21,
    completionDate: '',
    todayDate: '2-January-2026',
    scrollPosition: 55,
  });

describe('shared paths are kept out of the local-first pipeline', () => {
  it('excludes a shared path from the bulk /sync body', () => {
    const store = makeStore();
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
    store.dispatch(addPath({ path: makePath(2), date: makeDate(2) }));

    const before = buildSyncRequest(store.getState());
    expect(before.paths.map((p) => p.pathId)).toHaveLength(2);

    store.dispatch(setPathShared({ pathId: 2, shared: true }));

    // Sending path 2 here would push this device's copy through the
    // owner-scoped merge and overwrite the group's position.
    const after = buildSyncRequest(store.getState());
    const sent = after.paths.map((p) => store.getState().sync.meta[1].serverPathId === p.pathId);
    expect(after.paths).toHaveLength(1);
    expect(sent).toEqual([true]);
  });

  it('does not mark a shared path dirty when it is updated locally', () => {
    const store = makeStore();
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
    store.dispatch(setPathShared({ pathId: 1, shared: true }));

    // The create op `addPath` queued before sharing is dropped by
    // `setPathShared` itself — left in place it could never be acknowledged,
    // because a shared path is filtered out of the sync body.
    expect(store.getState().sync.pathOps[1]).toBeUndefined();

    const localUpdatedAtBefore = store.getState().sync.meta[1].localUpdatedAt;
    store.dispatch(updateFor(1));

    // The op must not advance: a shared path is filtered out of the sync body,
    // so anything queued here would sit pending forever and hold the sync
    // indicator on.
    expect(store.getState().sync.meta[1].localUpdatedAt).toBe(localUpdatedAtBefore);
  });

  it('still marks an ordinary path dirty', () => {
    const store = makeStore();
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));

    const before = store.getState().sync.meta[1].localUpdatedAt;
    store.dispatch(updateFor(1));

    expect(store.getState().sync.meta[1].localUpdatedAt).toBeGreaterThan(before);
  });

  it('applies the local position even for a shared path', () => {
    const store = makeStore();
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
    store.dispatch(setPathShared({ pathId: 1, shared: true }));

    store.dispatch(updateFor(1));

    // Undirtied is not the same as unapplied — the optimistic save still has to
    // show up on screen.
    const path = store.getState().paths.paths.find((p) => p.pathId === 1);
    expect(path?.saveData).toMatchObject({ angNumber: 300, verseId: 900 });
  });

  it('setPathShared is a no-op for a path with no metadata', () => {
    const store = makeStore();
    store.dispatch(setPathShared({ pathId: 99, shared: true }));
    expect(store.getState().sync.meta[99]).toBeUndefined();
  });
});

describe('opensAsGroup', () => {
  it('sends a synced shared path to the group screen', () => {
    // Somebody else may hold the turn; taking it must be a decision.
    expect(opensAsGroup({ shared: true, groupId: 'srv-2' })).toBe(true);
  });

  it('leaves a personal path alone, even once it has synced', () => {
    expect(opensAsGroup({ shared: false, groupId: 'srv-1' })).toBe(false);
  });

  it('falls back for a shared path whose server id is not known yet', () => {
    // Every group endpoint is keyed on the server id, so the group screen could
    // only fail to load. The personal reading is the honest answer.
    expect(opensAsGroup({ shared: true })).toBe(false);
    expect(opensAsGroup({ shared: true, groupId: null })).toBe(false);
    expect(opensAsGroup({ shared: true, groupId: '' })).toBe(false);
  });

  it('treats a path with no sync record at all as personal', () => {
    // Created offline and never uploaded — the common case for a new path.
    expect(opensAsGroup(undefined)).toBe(false);
  });
});

describe('canInvite', () => {
  it('allows inviting into a path the server knows, even before it is shared', () => {
    // The whole flow depends on this: a path becomes shared BY being invited
    // into, so requiring `shared` here would make the button unreachable.
    expect(canInvite({ onServer: true, groupId: 'srv-1' })).toBe(true);
  });

  it('still allows it once the path is already shared', () => {
    expect(canInvite({ onServer: true, groupId: 'srv-1', shared: true })).toBe(true);
  });

  it('refuses a path the server has never acknowledged', () => {
    // Created offline, or by somebody not signed in. Every group endpoint is
    // keyed on the server id, so there is nothing to invite into yet.
    expect(canInvite({ onServer: false, groupId: 'srv-1' })).toBe(false);
    expect(canInvite({ onServer: true })).toBe(false);
    expect(canInvite({ onServer: true, groupId: '' })).toBe(false);
    expect(canInvite(undefined)).toBe(false);
  });

  it('is weaker than opensAsGroup, which is the point', () => {
    const synced = { onServer: true, groupId: 'srv-1' };
    expect(canInvite(synced)).toBe(true);
    expect(opensAsGroup(synced)).toBe(false);
  });
});

/**
 * Which of a path's two identifiers the group endpoints get.
 *
 * A path has both: `serverPathId`, the UUID this device minted and syncs under,
 * and `groupId`, the row's own primary key. They are different values, and
 * every group endpoint keys on the second — a path shared with other people
 * cannot be addressed by an id one member's device happened to generate,
 * because the other members never had it.
 *
 * Sending the wrong one is answered with `404 Path not found`, which reads
 * exactly like a path that does not exist. It does exist; it was asked for by
 * the wrong name.
 */
describe('the identifier group endpoints are given', () => {
  const synced = {
    onServer: true,
    shared: true,
    serverPathId: '5ae32023-eb29-4682-aee1-d4ab6cc62101',
    groupId: '90fad16b-18b7-4d23-9729-7bec7feca77b',
  };

  it('offers the server’s own id, never the one this device syncs under', () => {
    expect(opensAsGroup(synced)).toBe(true);
    expect(canInvite(synced)).toBe(true);
    // The narrowing is the contract: callers read `groupId`, and it must not be
    // the sync id.
    expect(synced.groupId).not.toBe(synced.serverPathId);
  });

  it('refuses when only the sync id is known', () => {
    // Exactly the state that produced "Path not found" on the invite sheet: the
    // path was synced and real, but the app had never kept the server's id.
    // A fully synced path that simply never learned the server's own id: the
    // sync id is present, `groupId` is not. `serverPathId` is deliberately not
    // part of these predicates' input any more — that is the fix.
    expect(canInvite({ onServer: true, shared: true })).toBe(false);
    expect(opensAsGroup({ shared: true })).toBe(false);
  });
});

/**
 * A path somebody else owns.
 *
 * `GET /sehaj-path/paths` is owner-scoped and `accessible` returns
 * `pathId: null` for a joined path, so a member who joined one had nothing to
 * render: the path existed, they had access, and their device had no row for
 * it. Two rules keep such a row alive and harmless.
 */
describe('a joined path', () => {
  // Keeping it out of the `/sync` body is covered above by
  // "excludes a shared path from the bulk /sync body" — the same guard, and the
  // reason a joined row is safe to create at all.

  it('is addressable by the server’s id once shared is recorded', () => {
    expect(opensAsGroup({ shared: true, groupId: 'srv-1' })).toBe(true);
  });
});

describe('a shared path never enters the outbox', () => {
  const sharedStore = () => {
    const store = makeStore();
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
    store.dispatch(setPathShared({ pathId: 1, shared: true, groupId: 'srv-1' }));
    return store;
  };

  it('does not mark scroll dirty, because that flag could never be cleared', () => {
    const store = sharedStore();
    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 420 }));

    // A shared path is left out of the `/sync` body, so a dirty flag on one is
    // permanent: the device reports "syncing your progress" for ever and
    // re-issues a PATCH the server answers with 404.
    expect(store.getState().sync.scrollDirty[1]).toBeUndefined();
  });

  it('still marks scroll dirty for a personal path', () => {
    const store = makeStore();
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 420 }));

    expect(store.getState().sync.scrollDirty[1]).toBeDefined();
  });
});

describe('becoming shared clears work already queued', () => {
  it('drops a pending op, which could otherwise never be acknowledged', () => {
    const store = makeStore();
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
    store.dispatch(updateFor(1));
    expect(store.getState().sync.pathOps[1]).toBeDefined();

    store.dispatch(setPathShared({ pathId: 1, shared: true, groupId: 'srv-1' }));

    // Left in place it retries for ever: the path is excluded from the `/sync`
    // body, so nothing can ever acknowledge it.
    expect(store.getState().sync.pathOps[1]).toBeUndefined();
  });

  it('drops a pending scroll flag too', () => {
    const store = makeStore();
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
    store.dispatch(setScrollPosition({ pathId: 1, scrollPosition: 120 }));
    expect(store.getState().sync.scrollDirty[1]).toBeDefined();

    store.dispatch(setPathShared({ pathId: 1, shared: true, groupId: 'srv-1' }));
    expect(store.getState().sync.scrollDirty[1]).toBeUndefined();
  });

  it('leaves queued work alone when a path is marked NOT shared', () => {
    const store = makeStore();
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
    store.dispatch(updateFor(1));

    store.dispatch(setPathShared({ pathId: 1, shared: false }));
    // A personal path's work must still reach the server.
    expect(store.getState().sync.pathOps[1]).toBeDefined();
  });
});

describe('hydration repairs a device that queued work for a shared path', () => {
  it('drops the op, which would otherwise deadlock the device', () => {
    const store = makeStore();
    store.dispatch(
      hydrateSync({
        version: 1,
        account: 'a@b.com',
        lastSyncedAt: 1,
        meta: {
          1: {
            serverPathId: '11111111-2222-4333-8444-555555555555',
            serverUpdatedAt: 1,
            localUpdatedAt: 1,
            startDate: 1,
            deletedAt: null,
            onServer: true,
            shared: true,
          },
        },
        // Persisted before the path was known to be shared.
        pathOps: { 1: { kind: 'update', localUpdatedAt: 2 } },
        scrollDirty: { 1: 3 },
        settingsUpdatedAt: 0,
        pendingSettingsUpdatedAt: null,
      })
    );

    // Left in place these block the pull, and the pull is the only thing that
    // would notice the path is shared and clear them.
    expect(store.getState().sync.pathOps[1]).toBeUndefined();
    expect(store.getState().sync.scrollDirty[1]).toBeUndefined();
  });

  it('leaves a personal path’s queued work alone', () => {
    const store = makeStore();
    store.dispatch(
      hydrateSync({
        version: 1,
        account: 'a@b.com',
        lastSyncedAt: 1,
        meta: {
          1: {
            serverPathId: '11111111-2222-4333-8444-555555555555',
            serverUpdatedAt: 1,
            localUpdatedAt: 1,
            startDate: 1,
            deletedAt: null,
            onServer: true,
          },
        },
        pathOps: { 1: { kind: 'update', localUpdatedAt: 2 } },
        scrollDirty: {},
        settingsUpdatedAt: 0,
        pendingSettingsUpdatedAt: null,
      })
    );

    expect(store.getState().sync.pathOps[1]).toBeDefined();
  });
});

describe('saving a pankti on a shared path', () => {
  /**
   * `saveGroupPankti` reads the app's singleton store, not a fresh one — it is
   * called from a screen, not handed a store. So the fixture has to live there.
   */
  const givenSharedPath = () => {
    appStore.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
    appStore.dispatch(setPathShared({ pathId: 1, shared: true, groupId: UUID_FOR_GROUP }));
  };

  beforeEach(() => {
    savePanktiSpy.mockClear();
    givenSharedPath();
  });

  it('sends a whole-number scroll offset', async () => {
    // `scrollOffset` is a measured pixel offset and therefore fractional, but
    // the column is an `Int` and the DTO validates it as one. Sending `420.667`
    // was refused with a `400`, which from the app looked exactly like a save
    // that silently did nothing — and no follower ever saw the highlight.
    await saveGroupPankti(1, 3, 78, 420.6667);

    expect(savePanktiSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ scrollPosition: 421 }),
      })
    );
  });

  it('never sends a negative offset from an overscroll bounce', async () => {
    await saveGroupPankti(1, 3, 78, -40);

    expect(savePanktiSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ scrollPosition: 0 }),
      })
    );
  });

  it('addresses the group id, not the id this device syncs under', async () => {
    await saveGroupPankti(1, 3, 78, 10);

    expect(savePanktiSpy).toHaveBeenCalledWith(
      expect.objectContaining({ path: { sehajPathId: UUID_FOR_GROUP } })
    );
  });
});

describe('whether somebody is actually reading', () => {
  const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

  it('is true for a turn still within its time', () => {
    expect(isTurnStillLive({ status: 'LIVE', slotEndsAt: inMinutes(10) })).toBe(true);
  });

  it('stays true for a live session after its booking window ends', () => {
    // A slot is a booking window, not a hard session deadline. The connected
    // reader keeps reading until they finish or an eligible member takes over.
    expect(isTurnStillLive({ status: 'LIVE', slotEndsAt: inMinutes(-10) })).toBe(true);
  });

  it('is true for a turn with no end to run out', () => {
    // No slot means nothing to expire; it runs until its reader stops.
    expect(isTurnStillLive({ status: 'LIVE', slotEndsAt: null })).toBe(true);
  });

  it('is false when nobody holds the turn', () => {
    expect(isTurnStillLive(null)).toBe(false);
    expect(isTurnStillLive({ status: 'ENDED', slotEndsAt: inMinutes(10) })).toBe(false);
  });

  it('does not treat an unreadable end time as expired', () => {
    // Refusing to follow on a malformed date would take the turn from somebody
    // who genuinely holds it.
    expect(isTurnStillLive({ status: 'LIVE', slotEndsAt: 'not a date' })).toBe(true);
  });
});
