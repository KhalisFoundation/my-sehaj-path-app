import { connectLive } from '../../store/liveSession';
import { getCurrentToken } from '../../auth/tokenUtils';

jest.mock('../../auth/tokenUtils', () => ({ getCurrentToken: jest.fn() }));
jest.mock('../../api/config', () => ({ SEHAJ_API_BASE_URL: 'http://localhost:3500' }));

const tokenMock = getCurrentToken as jest.MockedFunction<typeof getCurrentToken>;

/** A stand-in socket that records what was sent and lets a test drive events. */
const fakeSocket = () => {
  const handlers: Record<string, (payload: unknown) => void> = {};
  return {
    sent: [] as unknown[],
    disconnected: false,
    on(event: string, handler: (payload: unknown) => void) {
      handlers[event] = handler;
    },
    emit(event: string, payload: unknown) {
      this.sent.push({ event, payload });
    },
    disconnect() {
      this.disconnected = true;
    },
    fire(event: string, payload: unknown) {
      handlers[event]?.(payload);
    },
  };
};

const position = (sequence: number, ang: number) => ({
  type: 'position',
  sehajPathId: 'p1',
  sessionId: 's1',
  currentAng: ang,
  currentVerseId: ang * 10,
  scrollPosition: 0,
  sequence,
});

const start = async (overrides: Record<string, unknown> = {}) => {
  const socket = fakeSocket();
  const onJoined = jest.fn();
  const onPosition = jest.fn();
  const onEnded = jest.fn();
  const handle = await connectLive({
    sehajPathId: 'p1',
    onJoined,
    onPosition,
    onEnded,
    connect: (() => socket) as never,
    ...overrides,
  });
  return { socket, handle, onJoined, onPosition, onEnded };
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  tokenMock.mockResolvedValue('tok');
});

describe('connectLive', () => {
  it('authenticates the handshake and names the path, which the server resolves once', async () => {
    const connect = jest.fn(() => fakeSocket());
    await start({ connect: connect as never });

    expect(connect).toHaveBeenCalledWith('http://localhost:3500/sehaj-path/live', {
      token: 'Bearer tok',
      sehajPathId: 'p1',
    });
  });

  it('reports a refusal rather than connecting when signed out', async () => {
    tokenMock.mockResolvedValue(null);
    const connect = jest.fn();
    const { onEnded } = await start({ connect: connect as never });

    expect(connect).not.toHaveBeenCalled();
    expect(onEnded).toHaveBeenCalledWith('refused');
  });

  it('starts a follower where the reader already is, not at the next packet', async () => {
    const { socket, onJoined } = await start();
    const live = { readerLabel: 'Harpreet', ...position(7, 42) };
    socket.fire('joined', { live });

    // Without this a follower joining mid-turn stares at ang 1 until the reader
    // happens to move, which can be a long time on a single ang.
    expect(onJoined).toHaveBeenCalledWith(live);
  });

  it('says plainly when nobody is reading', async () => {
    const { socket, onJoined } = await start();
    socket.fire('joined', { live: null });
    expect(onJoined).toHaveBeenCalledWith(null);
  });

  it('applies positions in order', async () => {
    const { socket, onPosition } = await start();
    socket.fire('position', position(1, 10));
    socket.fire('position', position(2, 11));

    expect(onPosition).toHaveBeenCalledTimes(2);
    expect(onPosition.mock.calls[1][0].currentAng).toBe(11);
  });

  it('drops a position that arrives out of order, which would jump the group backwards', async () => {
    const { socket, onPosition } = await start();
    socket.fire('position', position(5, 50));
    onPosition.mockClear();

    // Crosses a pub/sub channel between replicas, so late delivery is normal.
    socket.fire('position', position(4, 40));
    socket.fire('position', position(5, 55));

    expect(onPosition).not.toHaveBeenCalled();
  });

  it('resumes applying once a genuinely newer position arrives', async () => {
    const { socket, onPosition } = await start();
    socket.fire('position', position(5, 50));
    socket.fire('position', position(3, 30));
    onPosition.mockClear();

    socket.fire('position', position(6, 60));
    expect(onPosition).toHaveBeenCalledWith(expect.objectContaining({ currentAng: 60 }));
  });

  it('does not seek behind the snapshot it joined on', async () => {
    const { socket, onPosition } = await start();
    socket.fire('joined', { live: { readerLabel: null, ...position(9, 90) } });

    // In flight when we connected, and older than what we were handed.
    socket.fire('position', position(8, 80));
    expect(onPosition).not.toHaveBeenCalled();
  });

  it('ignores the echo of its own position while reading', async () => {
    const { socket, handle, onPosition } = await start();
    handle.sendPosition({ currentAng: 5, currentVerseId: 50, scrollPosition: 0 });

    // The server broadcasts to the whole room, the reader included. Applying it
    // would fight the reader's own scrolling.
    socket.fire('position', position(1, 5));
    expect(onPosition).not.toHaveBeenCalled();
  });

  it('sends the first position immediately, so following starts without a lag', async () => {
    const { socket, handle } = await start();
    handle.sendPosition({ currentAng: 3, currentVerseId: 30, scrollPosition: 12 });

    expect(socket.sent).toEqual([
      { event: 'position', payload: { currentAng: 3, currentVerseId: 30, scrollPosition: 12 } },
    ]);
  });

  it('throttles a burst of scrolling into one further packet', async () => {
    jest.useFakeTimers();
    const { socket, handle } = await start();

    for (let ang = 1; ang <= 20; ang += 1) {
      handle.sendPosition({ currentAng: ang, currentVerseId: ang * 10, scrollPosition: 0 });
    }
    // One leading packet so far; the other nineteen must not each be a packet
    // to every follower.
    expect(socket.sent).toHaveLength(1);

    jest.advanceTimersByTime(1000);
    expect(socket.sent).toHaveLength(2);
  });

  it('sends where the reader actually stopped, not where they were mid-burst', async () => {
    jest.useFakeTimers();
    const { socket, handle } = await start();

    handle.sendPosition({ currentAng: 1, currentVerseId: 10, scrollPosition: 0 });
    handle.sendPosition({ currentAng: 2, currentVerseId: 20, scrollPosition: 0 });
    handle.sendPosition({ currentAng: 9, currentVerseId: 90, scrollPosition: 0 });

    jest.advanceTimersByTime(1000);
    // The trailing send is the one that matters: followers must end up where
    // the reader is, not one second behind.
    expect(socket.sent[socket.sent.length - 1]).toEqual({
      event: 'position',
      payload: { currentAng: 9, currentVerseId: 90, scrollPosition: 0 },
    });
  });

  it('treats a network drop as recoverable, because the turn is held server-side', async () => {
    const { socket, onEnded } = await start();
    socket.fire('disconnect', 'transport close');

    // Ejecting the reader here would take their turn away over a tunnel.
    expect(onEnded).toHaveBeenCalledWith('dropped');
  });

  it('treats the server hanging up as a refusal, because that is deliberate', async () => {
    const { socket, onEnded } = await start();
    socket.fire('disconnect', 'io server disconnect');

    // Membership revoked, or the handshake refused. Not something to retry.
    expect(onEnded).toHaveBeenCalledWith('refused');
  });

  it('stays quiet about the disconnect it caused itself', async () => {
    const { socket, handle, onEnded } = await start();
    handle.close();
    socket.fire('disconnect', 'io client disconnect');

    expect(onEnded).not.toHaveBeenCalled();
    expect(socket.disconnected).toBe(true);
  });

  it('sends nothing after closing, including a throttled packet already queued', async () => {
    jest.useFakeTimers();
    const { socket, handle } = await start();

    handle.sendPosition({ currentAng: 1, currentVerseId: 10, scrollPosition: 0 });
    handle.sendPosition({ currentAng: 2, currentVerseId: 20, scrollPosition: 0 });
    handle.close();
    jest.advanceTimersByTime(1000);

    // Only the leading packet; the trailing one must not fire after close.
    expect(socket.sent).toHaveLength(1);
  });

  it('can be closed twice without disconnecting twice', async () => {
    const { handle, socket } = await start();
    handle.close();
    socket.disconnected = false;
    handle.close();
    expect(socket.disconnected).toBe(false);
  });
});

describe('a save, as distinct from a position', () => {
  it('marks the line the group reached', async () => {
    const onSaved = jest.fn();
    const { socket } = await start({ onSaved });

    socket.fire('saved', { sehajPathId: 'p1', angNumber: 12, verseId: 340 });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ angNumber: 12, verseId: 340 }));
  });

  it('reaches the reader too, because a save can come from anybody', async () => {
    const onSaved = jest.fn();
    const { socket, handle } = await start({ onSaved });
    handle.sendPosition({ currentAng: 1, currentVerseId: 10, scrollPosition: 0 });

    // Positions are suppressed for the driver — a save is not. A member may
    // mark the group's line without holding the turn.
    socket.fire('saved', { sehajPathId: 'p1', angNumber: 12, verseId: 340 });
    expect(onSaved).toHaveBeenCalled();
  });

  it('ignores a malformed save rather than moving the mark nowhere', async () => {
    const onSaved = jest.fn();
    const { socket } = await start({ onSaved });

    socket.fire('saved', { sehajPathId: 'p1' });
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe('the end of a turn', () => {
  it('tells followers the reading is over', async () => {
    // Positions merely stop, which is indistinguishable from a reader pausing
    // or dropping — so a follower left to infer it watches a still page
    // waiting for a reading that already finished.
    const onReadingEnded = jest.fn();
    const { socket } = await start({ onReadingEnded });

    socket.fire('reading-ended', {
      sessionId: 's1',
      readerLabel: 'Harpreet',
      endAng: 12,
      endVerseId: 340,
    });

    expect(onReadingEnded).toHaveBeenCalledWith(
      expect.objectContaining({ readerLabel: 'Harpreet', endAng: 12 })
    );
  });

  it('is not the same thing as the socket closing', async () => {
    const onReadingEnded = jest.fn();
    const onEnded = jest.fn();
    const { socket } = await start({ onReadingEnded, onEnded });

    socket.fire('disconnect', 'transport close');
    // A dropped connection says nothing about whose turn it is; the reader
    // keeps it through a grace period.
    expect(onReadingEnded).not.toHaveBeenCalled();
    expect(onEnded).toHaveBeenCalledWith('dropped');
  });

  it('ignores a malformed end rather than declaring the turn over', async () => {
    const onReadingEnded = jest.fn();
    const { socket } = await start({ onReadingEnded });

    socket.fire('reading-ended', { readerLabel: 'Harpreet' });
    expect(onReadingEnded).not.toHaveBeenCalled();
  });
});

describe('how the reader has the text laid out', () => {
  it('reaches followers so they read the same shape of text', async () => {
    const onSettings = jest.fn();
    const { socket } = await start({ onSettings });

    socket.fire('reading-settings', { larivaar: true, vishraam: false });
    expect(onSettings).toHaveBeenCalledWith(
      expect.objectContaining({ larivaar: true, vishraam: false })
    );
  });

  it('is sent by the reader without waiting for a position', async () => {
    const { socket, handle } = await start();
    handle.sendSettings({ larivaar: true, paragraphMode: false });

    expect(socket.sent).toContainEqual({
      event: 'reading-settings',
      payload: { larivaar: true, paragraphMode: false },
    });
  });

  it('sends nothing after the socket is closed', async () => {
    const { socket, handle } = await start();
    handle.close();
    handle.sendSettings({ larivaar: true });

    expect(socket.sent).toHaveLength(0);
  });
});

describe('a follower who arrives mid-turn', () => {
  it('is given the reader’s layout straight away', async () => {
    // It missed the broadcast, and the reader has no reason to send it again —
    // they may not touch a switch for the rest of the reading.
    const onSettings = jest.fn();
    const { socket } = await start({ onSettings });

    socket.fire('joined', { live: null, layout: { larivaar: true, vishraam: false } });
    expect(onSettings).toHaveBeenCalledWith({ larivaar: true, vishraam: false });
  });

  it('is left with its own layout when the reader has sent none', async () => {
    const onSettings = jest.fn();
    const { socket } = await start({ onSettings });

    socket.fire('joined', { live: null, layout: null });
    // Their own shape is a better answer than a guess.
    expect(onSettings).not.toHaveBeenCalled();
  });

  it('still starts at the reader’s position', async () => {
    const { socket, onJoined } = await start();
    const live = { readerLabel: 'Harpreet', ...position(4, 40) };

    socket.fire('joined', { live, layout: { larivaar: true } });
    expect(onJoined).toHaveBeenCalledWith(live);
  });
});

describe('the reader’s font size', () => {
  it('travels as an index, so each device resolves its own size', async () => {
    // A pixel value does not travel: the same number is a different size on a
    // different screen. The index goes through the receiving device's own
    // typography table.
    const onSettings = jest.fn();
    const { socket } = await start({ onSettings });

    socket.fire('reading-settings', { larivaar: false, fontSizeIndex: 4 });
    expect(onSettings).toHaveBeenCalledWith(expect.objectContaining({ fontSizeIndex: 4 }));
  });

  it('arrives with the layout a follower joins on', async () => {
    const onSettings = jest.fn();
    const { socket } = await start({ onSettings });

    socket.fire('joined', { live: null, layout: { fontSizeIndex: 2, larivaar: true } });
    expect(onSettings).toHaveBeenCalledWith({ fontSizeIndex: 2, larivaar: true });
  });
});
