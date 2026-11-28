import type { RootStackParamList } from '../App';

type ReaderParams = RootStackParamList['Path'];

/** Where Continue's back button leads, and the reader to reopen if any. */
export type ContinueBackTarget =
  | { kind: 'back-to-reader' }
  | { kind: 'reopen-reader'; reader: ReaderParams }
  | { kind: 'home' };

/**
 * Decide what Continue's back button does.
 *
 * - The reader is still underneath (Continue was pushed over it): go back to it.
 * - The reader was closed to show Progress or Streaks from its menu: reopen it
 *   the way it was opened. It saved its position on the way out, so it resumes
 *   there.
 * - Otherwise: Home.
 *
 * A follower is reopened only while that same reading is still live; reopening
 * a finished session would show a page that never moves. A turn this device was
 * driving is never reopened from here.
 */
export const continueBackTarget = ({
  isFromPath,
  returnToReader,
  pathId,
  liveSessionId,
}: {
  isFromPath: boolean;
  returnToReader: { live?: ReaderParams['live'] } | undefined;
  pathId: number;
  liveSessionId: string | undefined;
}): ContinueBackTarget => {
  if (isFromPath) {
    return { kind: 'back-to-reader' };
  }
  if (returnToReader === undefined) {
    return { kind: 'home' };
  }
  const { live } = returnToReader;
  if (live === undefined) {
    return { kind: 'reopen-reader', reader: { pathId } };
  }
  if (live.driving || live.sessionId === undefined || live.sessionId !== liveSessionId) {
    return { kind: 'home' };
  }
  return { kind: 'reopen-reader', reader: { pathId, live } };
};
