import { sehajPathSessionsControllerSavePankti } from '../api/generated/sdk.gen';
import { isOnlineNow } from '../db/connectivity';
import { PATH_DATA } from '../constants/PathData';
import { updatePath } from './slices/pathsSlice';
import { store, type RootState } from './index';

/**
 * Group paths: shared reading, and the rules that make them different.
 *
 * A personal path is local-first — Redux, then a durable journal, then the
 * outbox insists until the server agrees. That works because one person writes
 * it.
 *
 * A shared path has several writers, so the server owns it and this device
 * renders a view of it. That single difference is where everything below comes
 * from: no outbox, no offline queue, and a save that asks rather than insists.
 */

/** Is this path shared with a group? */
export const isGroupPath = (state: RootState, pathId: number): boolean =>
  state.sync.meta[pathId]?.shared === true;

/**
 * A path with only the signed-in reader is personal from the reader's point
 * of view. Keep this rule in one place so permissions and presentation do not
 * drift when a shared path is reduced back to its owner.
 */
export const isPersonalPath = (members: readonly { isMine?: boolean }[]): boolean =>
  members.length === 1 && members[0]?.isMine === true;

/** The UUID this device syncs a path under. NOT what group endpoints key on. */
export const serverIdOf = (state: RootState, pathId: number): string | null =>
  state.sync.meta[pathId]?.serverPathId ?? null;

/**
 * The server's OWN id for a path, which every group endpoint is keyed on.
 *
 * A path has two identifiers and they are different values — see
 * `SyncMeta.groupId`. Sending the sync id to a group route is answered with a
 * `404 Path not found`, which reads exactly like a path that does not exist.
 */
export const groupIdOf = (state: RootState, pathId: number): string | null =>
  state.sync.meta[pathId]?.groupId ?? null;

export type OpenRefusal = { ok: true } | { ok: false; reason: 'offline' | 'unknown-path' };

/**
 * May this path be opened right now?
 *
 * A group path needs a connection to open at all. The scripture itself is on
 * the device, but the position belongs to the group, and opening without being
 * able to read or write it would show a reader a stale position and let them
 * act on it.
 *
 * Uses the direct probe rather than the cached reachability flag. That flag has
 * been observed reporting a working connection with the radio off, and this is
 * exactly the decision that must not be made on a stale answer — see
 * `db/connectivity.ts`.
 *
 * Personal paths always open: they are local-first and owe the network nothing.
 */
export const canOpenPath = async (pathId: number): Promise<OpenRefusal> => {
  const state = store.getState();

  if (!isGroupPath(state, pathId)) {
    return { ok: true };
  }

  if (!serverIdOf(state, pathId)) {
    return { ok: false, reason: 'unknown-path' };
  }

  return (await isOnlineNow()) ? { ok: true } : { ok: false, reason: 'offline' };
};

const progressFor = (angNumber: number): number => (angNumber / PATH_DATA.LAST_ANG_NUMBER) * 100;

export type GroupSaveResult =
  | { status: 'saved'; angNumber: number; verseId: number }
  /** The group had already read past this line; the server position stands. */
  | { status: 'behind'; angNumber: number; verseId: number }
  | { status: 'offline' }
  | { status: 'failed' };

/**
 * Save a pankti on a shared path.
 *
 * Applied locally first so the highlight appears under the finger, then sent.
 * If the server refuses or is unreachable, the local copy is put back — an
 * optimistic update that is never reconciled is just a lie that looks like a
 * save.
 *
 * There is no retry queue, deliberately. A group path cannot be opened offline,
 * so there is no offline state to queue into; a failure here means the network
 * dropped mid-read, and the honest response is to tell the reader rather than
 * to promise a save that may land minutes later against a position that has
 * since moved.
 */
export const saveGroupPankti = async (
  pathId: number,
  angNumber: number,
  verseId: number,
  scrollPosition: number
): Promise<GroupSaveResult> => {
  const state = store.getState();
  // The GROUP id: `savePankti` is a group route, so the id this device syncs
  // under is not the one it answers to.
  const serverPathId = groupIdOf(state, pathId);

  if (!serverPathId) {
    return { status: 'failed' };
  }

  const previous = state.paths.paths.find((path) => path.pathId === pathId);
  const previousDate = state.paths.dates.find((entry) => entry.pathid === pathId);

  if (!previous) {
    return { status: 'failed' };
  }

  // Captured before the optimistic write so a revert restores what was actually
  // there, not whatever a later action left behind.
  const rollback = {
    angNumber: previous.saveData.angNumber,
    verseId: previous.saveData.verseId,
    scrollPosition: previousDate?.scrollPosition ?? 0,
    completionDate: previous.completionDate,
  };

  const apply = (ang: number, verse: number, scroll: number, completionDate: string): void => {
    // The middleware leaves shared paths undirtied, so this stays local and
    // never queues an outbox op.
    store.dispatch(
      updatePath({
        pathId,
        angNumber: ang,
        verseId: verse,
        progress: progressFor(ang),
        completionDate,
        todayDate: '',
        scrollPosition: scroll,
        silentSync: true,
      })
    );
  };

  apply(angNumber, verseId, scrollPosition, rollback.completionDate);

  try {
    const response = await sehajPathSessionsControllerSavePankti({
      path: { sehajPathId: serverPathId },
      // Rounded and floored HERE rather than at the call site, so no caller can
      // get it wrong. `scrollOffset` is a measured pixel offset and therefore
      // fractional, but the column is an `Int` and the DTO validates it as one:
      // sending `420.667` was refused with a `400`, which looked from the app
      // exactly like a save that silently did nothing. An overscroll bounce
      // also reports a negative offset, which `@Min(0)` refuses the same way.
      body: {
        angNumber,
        verseId,
        scrollPosition: Math.max(0, Math.round(scrollPosition)),
      },
    });

    const position = response.data;
    if (!position) {
      apply(rollback.angNumber, rollback.verseId, rollback.scrollPosition, rollback.completionDate);
      return { status: 'failed' };
    }

    // Adopt the server's position whatever it says. When our save was behind
    // the group this corrects the optimistic write; when it was accepted this
    // is a no-op that also carries back any completion the server derived.
    apply(
      position.angNumber,
      position.verseId,
      position.scrollPosition,
      position.completionDate ?? rollback.completionDate
    );

    return position.applied
      ? { status: 'saved', angNumber: position.angNumber, verseId: position.verseId }
      : { status: 'behind', angNumber: position.angNumber, verseId: position.verseId };
  } catch {
    apply(rollback.angNumber, rollback.verseId, rollback.scrollPosition, rollback.completionDate);
    return (await isOnlineNow()) ? { status: 'failed' } : { status: 'offline' };
  }
};

/**
 * Which screen a path card opens.
 *
 * A personal path goes straight back into the scripture — there is nobody else
 * involved, and the reader was mid-sentence. A shared one must not: somebody
 * else may hold the turn right now, so tapping a card cannot quietly become
 * "take the turn". It opens onto the group instead, where taking a turn is a
 * decision somebody makes on purpose.
 *
 * A path marked shared but never synced has no server id, and every group
 * endpoint is keyed on that id — so it would open a screen that can only fail
 * to load. The personal reading is the honest fallback.
 */
export const opensAsGroup = (
  meta: { shared?: boolean; groupId?: string | null } | undefined
): meta is { shared: true; groupId: string } =>
  meta?.shared === true && typeof meta.groupId === 'string' && meta.groupId.length > 0;

/**
 * May this path be shared with somebody?
 *
 * Deliberately weaker than [[opensAsGroup]], and the difference is the whole
 * invite flow: a path becomes shared BY being invited into, so gating the
 * invite button on `shared` makes it unreachable — a personal path could never
 * become a group one. What is actually required is that the server knows about
 * the path at all, because every group endpoint is keyed on its server id.
 *
 * A path created offline, or by somebody not signed in, has no server id yet.
 * Inviting into it is not refused so much as not yet possible.
 */
export const canInvite = (
  meta: { onServer?: boolean; groupId?: string | null; shared?: boolean } | undefined
): meta is { onServer: true; groupId: string } =>
  meta?.onServer === true && typeof meta.groupId === 'string' && meta.groupId.length > 0;

/**
 * Is somebody actually reading right now?
 *
 * A slot is a booking window, not a hard session deadline. A connected reader
 * may continue past that window until they explicitly finish or an eligible
 * booked reader takes over. The server remains authoritative and will return a
 * non-LIVE status when the session is actually ended.
 */
export const isTurnStillLive = (
  session: { status?: string; slotEndsAt?: string | null } | null | undefined
): boolean => {
  if (session?.status !== 'LIVE') {
    return false;
  }
  return true;
};
