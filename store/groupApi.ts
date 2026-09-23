import {
  sehajPathInvitesControllerCreate,
  sehajPathInvitesControllerActive,
  sehajPathInvitesControllerResolve,
  sehajPathMembersControllerEnableSharing,
  sehajPathInvitesControllerJoin,
  sehajPathMembersControllerListMembers,
  sehajPathMembersControllerRemove,
  sehajPathMembersControllerSetRole,
  sehajPathMembersControllerSharedReadingDays,
  sehajPathSessionsControllerCurrent,
  sehajPathSessionsControllerCheckpoint,
  sehajPathSessionsControllerFinish,
  sehajPathSessionsControllerStart,
  sehajPathSessionsControllerTakeover,
  sehajPathSlotsControllerCreate,
  sehajPathSlotsControllerCancel,
  sehajPathSlotsControllerFindPlan,
  sehajPathSlotsControllerUpdate,
} from '@api/generated/sdk.gen';
import type {
  SehajPathActiveInvite,
  SehajPathMember,
  SehajPathSession,
  SehajPathSlot,
  SehajPathInviteSummary,
} from '@api/generated/types.gen';
import { SEHAJ_API_BASE_URL } from '../api/config';
import { client } from '../api/generated/client.gen';
import { store } from './index';
import { captureSyncSession, syncSessionHeaders } from './syncSession';
import { recordError } from '../utils/crashlytics';

/**
 * The group endpoints, as the screens need them.
 *
 * Every call here goes through one shape: capture the signed-in session, send
 * it, and turn whatever comes back into a discriminated result the caller must
 * look at. Screens never see an HTTP status, and never have to remember which
 * failures are worth an alert.
 *
 * Deliberately NOT part of the outbox. The outbox exists to make a personal
 * path's writes survive being offline, and group reading does not work offline
 * at all — a queued "book this slot" that lands twenty minutes later would take
 * a time somebody else has since booked.
 */

/** What a screen gets back. Never throws; the caller reads `ok`. */
export type GroupResult<T> =
  | { ok: true; data: T }
  /**
   * The request reached the server and it said no. `message` is the server's
   * own wording, which is written for the reader — "Somebody else has this
   * reading time" rather than a status code.
   */
  | { ok: false; kind: 'refused'; status: number; message: string }
  /** Never reached the server, or the session is gone. Retrying may work. */
  | { ok: false; kind: 'unreachable' | 'signed-out'; message: string };

const SIGNED_OUT: GroupResult<never> = {
  ok: false,
  kind: 'signed-out',
  message: 'Sign in to read together.',
};

const GROUP_ERROR_DEDUPLICATION_MS = 60_000;
const recentGroupFailures = new Map<string, number>();

/**
 * Automatic plan/session refreshes can repeat while a server is unavailable.
 * Report the first unexpected failure, then suppress identical reports for a
 * minute so Crashlytics keeps the signal without being flooded by polling.
 */
const reportUnexpectedGroupFailure = (
  operation: string,
  error: unknown,
  kind: 'network' | 'server',
  status?: number
): void => {
  const key = `${operation}:${kind}:${status ?? 0}`;
  const now = Date.now();
  const last = recentGroupFailures.get(key);
  if (last !== undefined && now - last < GROUP_ERROR_DEDUPLICATION_MS) {
    return;
  }
  recentGroupFailures.set(key, now);
  recordError(error, `sehaj path: ${operation}`, {
    group_failure_kind: kind,
    group_http_status: status === undefined ? '' : String(status),
  });
};

/** A person the current admin has already shared another path with. */
export interface SuggestedMember {
  userId: string;
  displayLabel: string;
  hasAvatar: boolean;
  avatarUpdatedAt: string | null;
}

/**
 * Pull the server's own message out of an error body.
 *
 * The API writes these for the person reading the screen, so showing it beats
 * anything generic this layer could invent. Falls back only when the body is
 * not the shape we expect — an HTML error page from a proxy, say.
 */
const messageFrom = (error: unknown, fallback: string): string => {
  const body = error as { message?: unknown } | null;
  if (typeof body?.message === 'string' && body.message.length > 0) {
    return body.message;
  }
  if (Array.isArray(body?.message) && typeof body.message[0] === 'string') {
    // class-validator returns an array of messages; the first is the specific one.
    return body.message[0];
  }
  return fallback;
};

/**
 * Run one call with the current session attached.
 *
 * `fallback` is the wording used when the server could not explain itself. It
 * is per-call rather than generic because "could not load the plan" and "could
 * not book that time" need different words in front of a user.
 */
const call = async <T>(
  fallback: string,
  run: (headers: Record<string, string>) => Promise<{
    data?: T;
    error?: unknown;
    response?: { status: number };
  }>
): Promise<GroupResult<T>> => {
  const session = captureSyncSession(store.getState());
  if (!session) {
    return SIGNED_OUT;
  }

  try {
    const result = await run(syncSessionHeaders(session));
    const status = 'response' in result ? result.response?.status ?? 0 : 0;

    if (result.error !== undefined || result.data === undefined) {
      // A 401 is not "the server refused this action" — the session itself is
      // over, and every screen wants to react to that differently from a 409.
      if (status === 401) {
        return SIGNED_OUT;
      }
      if (status === 0) {
        reportUnexpectedGroupFailure(fallback, result.error, 'network');
        return {
          ok: false,
          kind: 'unreachable',
          message: 'No connection. Reading together needs one.',
        };
      }
      if (status >= 500) {
        reportUnexpectedGroupFailure(fallback, result.error, 'server', status);
      }
      return {
        ok: false,
        kind: 'refused',
        status,
        message: messageFrom(result.error, fallback),
      };
    }

    return { ok: true, data: result.data };
  } catch (error) {
    // The generated client throws only for transport failures; a refusal comes
    // back as `error`. So anything landing here never reached the server.
    reportUnexpectedGroupFailure(fallback, error, 'network');
    return {
      ok: false,
      kind: 'unreachable',
      message: 'No connection. Reading together needs one.',
    };
  }
};

// ---------------------------------------------------------------------------
// Sharing and joining
// ---------------------------------------------------------------------------

const personalDatesForGroup = (sehajPathId: string): string[] => {
  const meta = Object.entries(store.getState().sync.meta).find(
    ([, entry]) => entry.groupId === sehajPathId
  );
  if (!meta) {
    return [];
  }
  const pathId = Number(meta[0]);
  return (
    store
      .getState()
      .paths.dates.find((entry) => entry.pathid === pathId)
      ?.dates.map((date) => date.date) ?? []
  );
};

export const enableSharing = (sehajPathId: string) =>
  call('Could not turn on group reading.', (headers) =>
    sehajPathMembersControllerEnableSharing({
      path: { sehajPathId },
      body: { dates: personalDatesForGroup(sehajPathId) },
      headers,
    })
  );

/**
 * Mint an invite link.
 *
 * The raw token comes back here and is also available to active admins through
 * the active-invites endpoint. The server keeps only an encrypted copy for
 * that administrative reuse; public link resolution still uses its hash.
 */
export const createInvite = (sehajPathId: string, expiresInHours?: number | null) =>
  call('Could not create an invite link.', (headers) =>
    sehajPathInvitesControllerCreate({
      path: { sehajPathId },
      body: expiresInHours === undefined ? {} : { expiresInHours },
      headers,
    })
  );

/** Active invite links for admins, including recoverable tokens for new invites. */
export const listActiveInvites = (
  sehajPathId: string
): Promise<GroupResult<SehajPathActiveInvite[]>> =>
  call('Could not load active invite links.', (headers) =>
    sehajPathInvitesControllerActive({ path: { sehajPathId }, headers })
  );

/** What a link leads to, before somebody commits to asking. */
export const resolveInvite = (token: string) =>
  call('That link is no longer valid.', (headers) =>
    sehajPathInvitesControllerResolve({ path: { token }, headers })
  );

/**
 * Public invite preview used before sign-in. The token itself is the
 * capability, while the response intentionally contains only the path name
 * and active member count. Joining remains authenticated and uses
 * `joinInvite` below.
 */
export const resolveInvitePreview = async (
  token: string
): Promise<GroupResult<SehajPathInviteSummary>> => {
  try {
    const result = await sehajPathInvitesControllerResolve({
      path: { token },
      security: [],
    });
    const status = 'response' in result ? result.response?.status ?? 0 : 0;

    if (result.error !== undefined || result.data === undefined) {
      if (status === 0) {
        reportUnexpectedGroupFailure('Could not preview invite.', result.error, 'network');
        return {
          ok: false,
          kind: 'unreachable',
          message: 'No connection. Reading together needs one.',
        };
      }
      if (status >= 500) {
        reportUnexpectedGroupFailure('Could not preview invite.', result.error, 'server', status);
      }
      return {
        ok: false,
        kind: 'refused',
        status,
        message: messageFrom(result.error, 'That link is no longer valid.'),
      };
    }

    return { ok: true, data: result.data };
  } catch (error) {
    reportUnexpectedGroupFailure('Could not preview invite.', error, 'network');
    return {
      ok: false,
      kind: 'unreachable',
      message: 'No connection. Reading together needs one.',
    };
  }
};

/** Join directly from a valid share link. Reusing it is idempotent. */
export const joinInvite = (token: string): Promise<GroupResult<SehajPathMember>> =>
  call('Could not join this path.', (headers) =>
    sehajPathInvitesControllerJoin({ path: { token }, headers })
  );

export const listMembers = (sehajPathId: string): Promise<GroupResult<SehajPathMember[]>> =>
  call('Could not load the members.', (headers) =>
    sehajPathMembersControllerListMembers({ path: { sehajPathId }, headers })
  );

/** Remove the signed-in member from a shared path. */
export const leavePath = (
  sehajPathId: string,
  memberId: string
): Promise<GroupResult<SehajPathMember>> =>
  call('Could not leave this path.', (headers) =>
    sehajPathMembersControllerRemove({
      path: { sehajPathId, memberId },
      headers,
    })
  );

export const makeMemberAdmin = (
  sehajPathId: string,
  memberId: string
): Promise<GroupResult<SehajPathMember>> =>
  call('Could not make this member an admin.', (headers) =>
    sehajPathMembersControllerSetRole({
      path: { sehajPathId, memberId },
      body: { role: 'ADMIN' },
      headers,
    })
  );

export const setMemberAdmin = (
  sehajPathId: string,
  memberId: string,
  isAdmin: boolean
): Promise<GroupResult<SehajPathMember>> =>
  call('Could not update this member role.', (headers) =>
    sehajPathMembersControllerSetRole({
      path: { sehajPathId, memberId },
      body: { role: isAdmin ? 'ADMIN' : 'MEMBER' },
      headers,
    })
  );

export const removeMember = (
  sehajPathId: string,
  memberId: string
): Promise<GroupResult<SehajPathMember>> =>
  call('Could not remove this member.', (headers) =>
    sehajPathMembersControllerRemove({
      path: { sehajPathId, memberId },
      headers,
    })
  );

/** Distinct UTC calendar days on which anybody participated in this path. */
export const listSharedReadingDays = (
  sehajPathId: string
): Promise<GroupResult<{ dates: string[] }>> =>
  call('Could not load the shared streak.', (headers) =>
    sehajPathMembersControllerSharedReadingDays({
      path: { sehajPathId },
      headers,
    })
  );

/** Previous collaborators, scoped to the current admin and this target path. */
export const listSuggestedMembers = (): Promise<GroupResult<SuggestedMember[]>> =>
  call('Could not load people you have read with.', (headers) =>
    client.get<SuggestedMember[]>({
      url: '/sehaj-path/suggested-members',
      headers,
    })
  );

/** Add one suggested collaborator as an active member, idempotently. */
export const addMember = (
  sehajPathId: string,
  userId: string
): Promise<GroupResult<SehajPathMember>> =>
  call('Could not add this member.', (headers) =>
    client.post<{ response: SehajPathMember }>({
      url: `/sehaj-path/paths/${sehajPathId}/members`,
      body: { userId },
      headers,
    })
  );

/**
 * Where a member's picture lives.
 *
 * Built rather than fetched: `<Image>` takes a URL, and the server serves the
 * bytes with a content type so the platform's own image cache handles it.
 * `avatarUpdatedAt` is in the query string purely to bust that cache — a
 * changed picture is a different URL, so a stale one is never shown.
 *
 * Returns null when there is nothing to fetch, so a caller can fall back to the
 * member's initial without a request that would only 404.
 */
export const avatarUrlFor = (
  sehajPathId: string,
  member: { id: string; hasAvatar?: boolean; avatarUpdatedAt?: string | null }
): string | null => {
  if (!member.hasAvatar || !SEHAJ_API_BASE_URL) {
    return null;
  }
  const version = member.avatarUpdatedAt ? `?v=${encodeURIComponent(member.avatarUpdatedAt)}` : '';
  return `${SEHAJ_API_BASE_URL}/sehaj-path/paths/${sehajPathId}/members/${member.id}/avatar${version}`;
};

/** Auth headers for an `<Image>` that points at `avatarUrlFor`. */
export const avatarHeaders = (): Record<string, string> | undefined => {
  const session = captureSyncSession(store.getState());
  return session ? syncSessionHeaders(session) : undefined;
};

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

/**
 * The booked slots in a window.
 *
 * `from`/`to` are required rather than defaulted, because a screen always knows
 * which day it is showing and a server-side default would silently disagree
 * with the date in the header.
 */
export const loadPlan = (
  sehajPathId: string,
  from: Date,
  to: Date
): Promise<GroupResult<{ stateVersion: number; slots: SehajPathSlot[] }>> =>
  call('Could not load the schedule.', (headers) =>
    sehajPathSlotsControllerFindPlan({
      path: { sehajPathId },
      query: { from: from.toISOString(), to: to.toISOString() },
      headers,
    })
  );

/**
 * Book a time for yourself.
 *
 * A `409` here is the normal, expected answer when somebody booked the same
 * minute first — the server refuses it with an exclusion constraint rather than
 * a check, so two people tapping together cannot both succeed. Screens should
 * reload the plan on that, not retry.
 */
export const bookSlot = (
  sehajPathId: string,
  startsAt: Date,
  endsAt: Date
): Promise<GroupResult<SehajPathSlot>> =>
  call('Could not book that time.', (headers) =>
    sehajPathSlotsControllerCreate({
      path: { sehajPathId },
      body: { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() },
      headers,
    })
  );

/** Cancel an upcoming slot owned by the current member. */
export const cancelSlot = (
  sehajPathId: string,
  slotId: string
): Promise<GroupResult<SehajPathSlot>> =>
  call('Could not cancel that turn.', (headers) =>
    sehajPathSlotsControllerCancel({
      path: { sehajPathId, slotId },
      headers,
    })
  );

/** Move an upcoming slot or change its duration. */
export const updateSlot = (
  sehajPathId: string,
  slotId: string,
  startsAt: Date,
  endsAt: Date
): Promise<GroupResult<SehajPathSlot>> =>
  call('Could not update that turn.', (headers) =>
    sehajPathSlotsControllerUpdate({
      path: { sehajPathId, slotId },
      body: { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() },
      headers,
    })
  );

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** Start a live reading; a booked slot is optional and only grants takeover priority. */
export const startReading = (sehajPathId: string): Promise<GroupResult<SehajPathSession>> =>
  call('Could not start reading.', (headers) =>
    sehajPathSessionsControllerStart({
      path: { sehajPathId },
      headers,
    })
  );

/** Request the server-authoritative hand-off for an active booked slot. */
export const takeoverReading = (sehajPathId: string): Promise<GroupResult<SehajPathSession>> =>
  call('Could not take over the reading.', (headers) =>
    sehajPathSessionsControllerTakeover({ path: { sehajPathId }, headers })
  );

/** Whoever is reading right now, or null when nobody is. */
export const currentSession = (
  sehajPathId: string
): Promise<GroupResult<SehajPathSession | null>> =>
  call('Could not check who is reading.', (headers) =>
    sehajPathSessionsControllerCurrent({ path: { sehajPathId }, headers })
  );

/** Persist the reader's latest transient position before a hand-off. */
export const checkpointReading = (
  sehajPathId: string,
  sessionId: string,
  input: { currentAng: number; currentVerseId: number; scrollPosition: number }
): Promise<GroupResult<SehajPathSession>> =>
  call('Could not checkpoint your reading.', (headers) =>
    sehajPathSessionsControllerCheckpoint({
      path: { sehajPathId, sessionId },
      body: input,
      headers,
    })
  );

/**
 * End the turn and move the group.
 *
 * `expectedStartAng` is the position the turn BEGAN from, not where it ended.
 * The server compares it against the session's own start and refuses with a
 * `409` if the path has moved since — which is how a stale device is stopped
 * from rewinding everybody.
 */
export const finishReading = (
  sehajPathId: string,
  sessionId: string,
  input: {
    expectedStartAng: number;
    endAng: number;
    endVerseId: number;
    firstVisibleVerseId: number;
    scrollPosition: number;
  }
): Promise<GroupResult<SehajPathSession>> =>
  call('Could not save your reading.', (headers) =>
    sehajPathSessionsControllerFinish({
      path: { sehajPathId, sessionId },
      body: input,
      headers,
    })
  );
