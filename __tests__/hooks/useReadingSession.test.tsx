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
jest.mock('../../utils/sharedPathAnalytics', () => ({ trackSharedPathEvent: jest.fn() }));

const useLiveReadingMock = useLiveReading as jest.MockedFunction<typeof useLiveReading>;
type SessionValue = ReturnType<typeof useReadingSession>;

let callbacks!: {
  onReadingEnded?: (event: { readerLabel: string; endAng: number }) => void;
  onTakeoverStarted?: (event: LiveReaderTakeoverStarted) => void;
  onTakeoverCancelled?: (event: { takeoverId: string }) => void;
  onTakeoverCompleted?: (event: LiveReaderTakeoverCompleted) => void;
};
let latest!: SessionValue;
const navigation = { goBack: jest.fn(), popTo: jest.fn(), reset: jest.fn() };

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
