import type { SehajPathMember, SehajPathSession } from '@api/generated/types.gen';
import {
  currentSession,
  listMembers,
  reportUnexpectedGroupRefusal,
  startReading,
  takeoverReading,
} from './groupApi';
import { isTurnStillLive } from './groupPaths';

/** What happened, so the caller can record it. `null` when there is nothing to record. */
export type TakeTurnOutcome = 'TAKEOVER' | 'READING_RESUME' | 'READING_START' | null;

export type TakeTurnResult = { outcome: TakeTurnOutcome; session: SehajPathSession };

/**
 * Take a planned recurring turn that is under way, from the Turns calendar.
 *
 * `occurrenceId` is the calendar entry's id; it tells the server which turn the
 * reading is for, so the entry stops being offered once it is taken.
 *
 * Throws an `Error` whose message is written for the reader when the turn
 * cannot be taken. It is deliberately forgiving in the two places where a
 * refusal is not a failure:
 * - the "who is reading now" lookup answering 404/409 simply means nobody is,
 *   which is the ordinary case for starting a turn;
 * - when the caller is already the reader, recording the turn on their reading
 *   is bookkeeping, so a refusal there must not be shown as an error over a
 *   reading they are in the middle of. They carry on in it, as Continue does.
 */
export const takeRecurringTurn = async (
  sehajPathId: string,
  occurrenceId: string,
  knownMembers: SehajPathMember[]
): Promise<TakeTurnResult> => {
  const current = await currentSession(sehajPathId);
  const nobodyReading =
    !current.ok && current.kind === 'refused' && (current.status === 404 || current.status === 409);
  if (!current.ok && !nobodyReading) {
    throw new Error(current.message);
  }
  reportUnexpectedGroupRefusal('current reading session', current, [404, 409]);

  const live = current.ok && current.data && isTurnStillLive(current.data) ? current.data : null;

  if (live) {
    let members = knownMembers;
    if (members.length === 0) {
      const fetched = await listMembers(sehajPathId);
      members = fetched.ok ? fetched.data : [];
    }
    const alreadyReading = members.find((member) => member.isMine)?.id === live.readerMemberId;

    // Always say which turn this is for. When the caller is already the reader
    // the server records it on their live reading instead of transferring
    // anything; for somebody else's reading it is the usual hand-over.
    const takeover = await takeoverReading(sehajPathId, occurrenceId);
    if (takeover.ok) {
      return { outcome: alreadyReading ? null : 'TAKEOVER', session: takeover.data };
    }
    if (!alreadyReading) {
      throw new Error(takeover.message);
    }
    reportUnexpectedGroupRefusal('attach turn to reading', takeover, [404, 409]);
    return { outcome: 'READING_RESUME', session: live };
  }

  const started = await startReading(sehajPathId, occurrenceId);
  if (!started.ok) {
    throw new Error(started.message);
  }
  return { outcome: 'READING_START', session: started.data };
};
