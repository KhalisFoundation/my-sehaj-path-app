import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { useReadingSession } from '../../hooks/useReadingSession';
import { useLiveReading } from '../../hooks/useLiveReading';
import type {
  LiveReaderTakeoverCompleted,
  LiveReaderTakeoverStarted,
} from '../../store/liveSession';

jest.mock('../../hooks/useLiveReading', () => ({ useLiveReading: jest.fn() }));
jest.mock('../../store/groupApi', () => ({
  checkpointReading: jest.fn().mockResolvedValue({ ok: true }),
  finishReading: jest.fn(),
}));
jest.mock('../../utils/sharedPathAnalytics', () => ({
  trackSharedPathEvent: jest.fn(),
  trackSharedPathOutcome: jest.fn(),
}));

const useLiveReadingMock = useLiveReading as jest.MockedFunction<typeof useLiveReading>;
type SessionValue = ReturnType<typeof useReadingSession>;

let callbacks!: {
  onReadingEnded?: (event: { readerLabel: string; endAng: number }) => void;
  onTakeoverStarted?: (event: LiveReaderTakeoverStarted) => void;
  onTakeoverCancelled?: (event: { takeoverId: string }) => void;
  onTakeoverCompleted?: (event: LiveReaderTakeoverCompleted) => void;
};
let latest!: SessionValue;
type PreventRemoveCallback = (options: { data: { action: { type: string } } }) => void;
/** What the hook last asked navigation for: whether to prevent removal, and the handler. */
let preventRemove: { enabled: boolean; callback: PreventRemoveCallback } | undefined;
jest.mock('@react-navigation/native', () => ({
  usePreventRemove: (enabled: boolean, callback: PreventRemoveCallback) => {
    preventRemove = { enabled, callback };
  },
}));
const navigation = {
  goBack: jest.fn(),
  popTo: jest.fn(),
  reset: jest.fn(),
  dispatch: jest.fn(),
};

const Probe = ({ live }: { live: Parameters<typeof useReadingSession>[0]['live'] }) => {
  latest = useReadingSession({
    live,
    pathId: 1,
    pathAng: 1,
    centerVerseId: 10,
    scrollOffset: { current: 0 },
    ownLayout: {
      larivaar: false,
      paragraphMode: false,
      vishraam: false,
      vishraamsSource: 'default',
      fontSizeIndex: 0,
    },
    readerLayout: null,
    navigation: navigation as never,
    onRemotePosition: jest.fn(),
    onRemoteSave: jest.fn(),
    onReaderLayout: jest.fn(),
    onLeaveReader: jest.fn(),
    onFinishComplete: jest.fn(),
    onScroll: jest.fn(),
    onError: jest.fn(),
  });
  return null;
};

const mount = async (live: Parameters<typeof useReadingSession>[0]['live']) => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(<Probe live={live} />);
  });
  return tree;
};

const reader = {
  sehajPathId: 'path-1',
  driving: true,
  sessionId: 'session-1',
  startAng: 1,
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  navigation.goBack.mockClear();
  navigation.popTo.mockClear();
  navigation.reset.mockClear();
  navigation.dispatch.mockClear();
  preventRemove = undefined;
  useLiveReadingMock.mockImplementation((options) => {
    callbacks = options;
    return {
      connection: 'connected',
      readerLabel: 'Reader',
      reportNow: jest.fn(),
    } as never;
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useReadingSession swipe-back gesture', () => {
  const swipe = { data: { action: { type: 'POP' } } };

  it('prevents removal while this device holds the turn', async () => {
    await mount(reader);

    expect(preventRemove?.enabled).toBe(true);
  });

  it('asks first: a swipe-back opens Finish instead of leaving', async () => {
    await mount(reader);

    await act(async () => {
      preventRemove?.callback(swipe);
    });

    expect(latest.finishOpen).toBe(true);
    expect(navigation.dispatch).not.toHaveBeenCalled();
  });

  it('treats the header back (GO_BACK) the same as a swipe', async () => {
    await mount(reader);

    await act(async () => {
      preventRemove?.callback({ data: { action: { type: 'GO_BACK' } } });
    });

    expect(latest.finishOpen).toBe(true);
    expect(navigation.dispatch).not.toHaveBeenCalled();
  });

  it('does not prevent anything for a follower, who has no turn to finish', async () => {
    await mount({ ...reader, driving: false });

    expect(preventRemove?.enabled).toBe(false);
  });

  // REPLACE: BaniDB failure sends the reader to Error/Home. RESET: a stack
  // reset such as sign-out. POP_TO: an exit the screen already confirmed.
  it.each(['REPLACE', 'RESET', 'POP_TO'])(
    'lets a %s removal through without asking',
    async (type) => {
      await mount(reader);
      const action = { data: { action: { type } } };

      await act(async () => {
        preventRemove?.callback(action);
      });

      expect(navigation.dispatch).toHaveBeenCalledWith(action.data.action);
      expect(latest.finishOpen).toBe(false);
    }
  );

  it('lets the back through once a takeover has ended the turn', async () => {
    await mount(reader);

    await act(async () => {
      callbacks.onTakeoverCompleted?.({
        takeoverId: 'takeover-1',
        sessionId: 'session-2',
        readerMemberId: 'member-2',
        readerLabel: 'Member',
        currentAng: 1,
        currentVerseId: 10,
        scrollPosition: 0,
        sequence: 2,
      });
      preventRemove?.callback(swipe);
    });

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(navigation.dispatch).toHaveBeenCalledWith(swipe.data.action);
    expect(latest.finishOpen).toBe(false);
  });
});

describe('useReadingSession takeover feedback', () => {
  it('renders the server countdown and clears it when the backend cancels it', async () => {
    await mount(reader);
    const commitAt = new Date(Date.now() + 5000).toISOString();

    await act(async () => {
      callbacks.onTakeoverStarted?.({
        takeoverId: 'takeover-1',
        previousSessionId: 'session-1',
        requesterMemberId: 'member-2',
        commitAt,
      });
    });
    expect(latest.readerNotice).toMatch(/switch in 5 seconds/);

    await act(async () => {
      callbacks.onTakeoverCancelled?.({ takeoverId: 'takeover-1' });
    });
    expect(latest.readerNotice).toBeNull();
  });

  it('returns the previous reader to the follower flow after takeover', async () => {
    await mount(reader);
    await act(async () => {
      callbacks.onTakeoverCompleted?.({
        takeoverId: 'takeover-1',
        sessionId: 'session-2',
        readerMemberId: 'member-2',
        readerLabel: 'Member',
        currentAng: 1,
        currentVerseId: 10,
        scrollPosition: 0,
        sequence: 2,
      });
    });
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('returns a follower to the existing Continue screen after the reader finishes', async () => {
    await mount({ ...reader, driving: false });
    await act(async () => {
      callbacks.onReadingEnded?.({ readerLabel: 'Reader', endAng: 2 });
    });

    await act(async () => {
      latest.leaveAfterReading();
    });

    expect(navigation.popTo).toHaveBeenCalledWith('Continue', {
      pathId: 1,
      initialTab: 'progress',
    });
  });
});
