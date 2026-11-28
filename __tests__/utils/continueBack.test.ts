import { continueBackTarget } from '../../utils/continueBack';

const follower = {
  sehajPathId: 'group-1',
  driving: false,
  sessionId: 'session-1',
  startAng: 4,
};

describe("Continue's back button", () => {
  it('goes back to the reader when it is still underneath', () => {
    expect(
      continueBackTarget({
        isFromPath: true,
        returnToReader: { live: undefined },
        pathId: 7,
        liveSessionId: undefined,
      })
    ).toEqual({ kind: 'back-to-reader' });
  });

  it('goes Home when Continue was not opened from the reader', () => {
    expect(
      continueBackTarget({
        isFromPath: false,
        returnToReader: undefined,
        pathId: 7,
        liveSessionId: undefined,
      })
    ).toEqual({ kind: 'home' });
  });

  it('reopens a personal path when the reader was closed to show Progress or Streaks', () => {
    expect(
      continueBackTarget({
        isFromPath: false,
        returnToReader: { live: undefined },
        pathId: 7,
        liveSessionId: undefined,
      })
    ).toEqual({ kind: 'reopen-reader', reader: { pathId: 7 } });
  });

  it('reopens a follower in the same reading while it is still live', () => {
    expect(
      continueBackTarget({
        isFromPath: false,
        returnToReader: { live: follower },
        pathId: 7,
        liveSessionId: 'session-1',
      })
    ).toEqual({ kind: 'reopen-reader', reader: { pathId: 7, live: follower } });
  });

  it('does not reopen a follower once that reading has ended', () => {
    // The page would never move again; the ordinary Home behaviour stays.
    for (const liveSessionId of [undefined, 'a-later-session']) {
      expect(
        continueBackTarget({
          isFromPath: false,
          returnToReader: { live: follower },
          pathId: 7,
          liveSessionId,
        })
      ).toEqual({ kind: 'home' });
    }
  });

  it('never reopens a turn this device was driving', () => {
    expect(
      continueBackTarget({
        isFromPath: false,
        returnToReader: { live: { ...follower, driving: true } },
        pathId: 7,
        liveSessionId: 'session-1',
      })
    ).toEqual({ kind: 'home' });
  });
});
