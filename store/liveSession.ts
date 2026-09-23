import { io, type Socket } from 'socket.io-client';
import { SEHAJ_API_BASE_URL } from '../api/config';
import { getCurrentToken } from '../auth/tokenUtils';
import { recordError } from '../utils/crashlytics';

/**
 * Following, or driving, a live reading.
 *
 * The one part of a group path that is not request/response. While somebody
 * reads, their position moves several times a second, and everybody else's
 * screen follows it — far too often to poll and far too transient to persist.
 * So it rides a socket, and NOTHING here is written to the database by this
 * device: the reader's socket is the only writer, and even that writes once, on
 * disconnect. What arrives here is a view.
 *
 * The transport is injected rather than imported at the call site so the
 * behaviour below — ordering, throttling, what a drop means — is testable
 * without a server. That mirrors the seam the API keeps on its own side
 * (`LiveChannel`), and for the same reason: this logic is the risky part, not
 * the socket.
 */

/** Where the group is, as the server describes it. */
export interface LivePosition {
  currentAng: number;
  currentVerseId: number;
  scrollPosition: number;
  /** Sent by the reader for automatic fallback saves; never used for following. */
  firstVisibleVerseId?: number;
  /** Monotonic per session. The ONLY safe way to order these — see `onPosition`. */
  sequence: number;
}

/** The reading in progress when we connected, or null if nobody is reading. */
export interface LiveSnapshot extends LivePosition {
  sessionId: string;
  readerLabel: string | null;
  /** The durable group checkpoint, separate from the reader's transient position. */
  saved?: LiveSaved | null;
}

/**
 * Where the group has read to.
 *
 * Distinct from a position: a position is where the reader's screen happens to
 * be a few times a second, a save is a decision. Treating every position as a
 * save moved a follower's highlight with the reader's scrolling instead of
 * holding it on the saved line.
 */
export interface LiveSaved {
  angNumber: number;
  verseId: number;
  /** Older server instances may omit this until they are deployed. */
  scrollPosition?: number;
}

/**
 * A turn has finished.
 *
 * A follower cannot work this out for itself: positions simply stop arriving,
 * which looks exactly like a reader who paused or dropped. Left to guess, a
 * follower watches a still page waiting for a reading that already ended.
 */
export interface LiveReadingEnded {
  sessionId: string;
  readerLabel: string;
  endAng: number;
  endVerseId: number;
}

/** The reader's socket dropped, but the server is holding their turn during grace. */
export interface LiveReaderLeft {
  sessionId: string;
}

export interface LiveReaderRejoined {
  sessionId: string;
}

export interface LiveReaderTakeoverStarted {
  takeoverId: string;
  previousSessionId: string | null;
  requesterMemberId: string;
  commitAt: string;
}

export interface LiveReaderTakeoverCompleted {
  takeoverId: string;
  sessionId: string;
  readerMemberId: string | null;
  readerLabel: string;
  currentAng: number;
  currentVerseId: number;
  scrollPosition: number;
  sequence: number;
}

/**
 * How the reader has the scripture laid out.
 *
 * Everything that changes how the page READS, so a follower sees what the
 * reader sees. It lasts the session only — none of it is written to the
 * follower's own settings, which are theirs.
 *
 * Size travels as an INDEX into the app's typography table rather than a pixel
 * value: the same number is a different size on a different screen, and each
 * device resolves the index through its own table.
 */
export interface LiveReadingSettings {
  larivaar?: boolean;
  paragraphMode?: boolean;
  vishraam?: boolean;
  vishraamsSource?: string;
  fontSizeIndex?: number;
}

/** Why the connection ended, in the terms the screen has to react to. */
export type LiveEnd =
  /** Refused at the handshake: not signed in, or not a member of this path. */
  | 'refused'
  /** The network went away. The reader keeps their turn — see below. */
  | 'dropped';

export interface LiveOptions {
  sehajPathId: string;
  /** Someone is reading, or nobody is. Fires once, on connect. */
  onJoined: (live: LiveSnapshot | null) => void;
  /** The group moved. Never fires for a position this device sent. */
  onPosition: (position: LivePosition) => void;
  /** Somebody marked the line the group has reached. */
  onSaved?: (saved: LiveSaved) => void;
  /** The turn is over. Distinct from `onEnded`, which is about the socket. */
  onReadingEnded?: (ended: LiveReadingEnded) => void;
  /** The reader disconnected; their turn remains recoverable during grace. */
  onReaderLeft?: (left: LiveReaderLeft) => void;
  onReaderRejoined?: (rejoined: LiveReaderRejoined) => void;
  onTakeoverStarted?: (takeover: LiveReaderTakeoverStarted) => void;
  onTakeoverCancelled?: (takeover: { takeoverId: string }) => void;
  onTakeoverCompleted?: (takeover: LiveReaderTakeoverCompleted) => void;
  /** The reader changed how the text is laid out. Followers only. */
  onSettings?: (settings: LiveReadingSettings) => void;
  onEnded: (reason: LiveEnd) => void;
  /** Injected in tests. Defaults to a real socket.io connection. */
  connect?: (url: string, auth: Record<string, string>) => Socket;
}

export interface LiveHandle {
  /**
   * Tell followers how the text is laid out. Ignored by the server unless this
   * device holds the turn, so it is safe to call unconditionally.
   *
   * Not throttled: these change when somebody presses a switch, not several
   * times a second.
   */
  sendSettings: (settings: LiveReadingSettings) => void;
  /**
   * Report where this device has scrolled to. Ignored by the server unless this
   * device holds the turn, so it is safe to call unconditionally.
   */
  sendPosition: (position: Omit<LivePosition, 'sequence'>) => void;
  close: () => void;
}

/**
 * How often this device reports its position while reading.
 *
 * Scrolling generates events far faster than anybody can perceive, and every
 * one of them is a packet to every follower. One second keeps following clear
 * without making it look like the reader's exact finger movement, and is far
 * cheaper than sending raw scroll events.
 */
const SEND_INTERVAL_MS = 1000;
const SOCKET_ERROR_DEDUPLICATION_MS = 60_000;
const recentSocketErrors = new Map<string, number>();

const reportSocketFailure = (error: unknown, context: string): void => {
  const key = context;
  const now = Date.now();
  const last = recentSocketErrors.get(key);
  if (last !== undefined && now - last < SOCKET_ERROR_DEDUPLICATION_MS) {
    return;
  }
  recentSocketErrors.set(key, now);
  recordError(error, `sehaj path live: ${context}`, { group_failure_kind: 'socket' });
};

const isSocketRefusal = (error: unknown): boolean =>
  /unauthori[sz]ed|forbidden|not a member/i.test(
    error instanceof Error ? error.message : String(error)
  );

const NAMESPACE = '/sehaj-path/live';

/**
 * Join a path's live reading.
 *
 * Returns immediately; everything arrives through the callbacks. `close()` is
 * safe to call more than once and safe to call before the socket has opened.
 */
export const connectLive = async (options: LiveOptions): Promise<LiveHandle> => {
  const {
    sehajPathId,
    onJoined,
    onPosition,
    onSaved,
    onReadingEnded,
    onReaderLeft,
    onReaderRejoined,
    onTakeoverStarted,
    onTakeoverCancelled,
    onTakeoverCompleted,
    onSettings,
    onEnded,
  } = options;

  let token: string | null;
  try {
    token = await getCurrentToken();
  } catch (error) {
    reportSocketFailure(error, 'could not read auth token');
    onEnded('refused');
    return { sendPosition: () => {}, sendSettings: () => {}, close: () => {} };
  }
  if (!token || !SEHAJ_API_BASE_URL) {
    // Nothing to connect with. Reported through the same channel as a refusal
    // so a caller has one path to handle rather than two.
    onEnded('refused');
    return { sendPosition: () => {}, sendSettings: () => {}, close: () => {} };
  }

  const connect =
    options.connect ??
    ((url, auth) =>
      io(url, {
        // The handshake carries both, because the server resolves membership
        // once at connect rather than per event.
        auth,
        transports: ['websocket'],
        // Reconnection is deliberately left ON: a reader who drops keeps their
        // turn for a grace period, so coming back is the expected outcome and
        // the socket should attempt it without the screen doing anything.
        reconnection: true,
      }));

  const socket = connect(`${SEHAJ_API_BASE_URL}${NAMESPACE}`, {
    token: `Bearer ${token}`,
    sehajPathId,
  });

  /**
   * The last sequence handed to the screen.
   *
   * Positions can arrive out of order — they cross a pub/sub channel between
   * replicas — and applying an older one moves the whole group backwards, which
   * a follower sees as the reader jumping. Sequence is monotonic per session,
   * so anything not strictly newer is dropped.
   */
  let lastSequence = -1;

  /** True once this device has sent a position, i.e. it holds the turn. */
  let driving = false;

  let closed = false;
  let pending: Omit<LivePosition, 'sequence'> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  socket.on(
    'joined',
    (payload: { live: LiveSnapshot | null; layout?: LiveReadingSettings | null }) => {
      // The reader's layout as it stands right now. A follower arriving mid-turn
      // missed the broadcast, and the reader has no reason to send it again —
      // they may not touch a switch for the rest of the reading.
      if (payload?.layout) {
        onSettings?.(payload.layout);
      }
      // A follower joining mid-turn starts where the reader is, rather than
      // waiting for the next packet — which could be seconds away if the reader
      // is sitting still on one ang.
      const live = payload?.live ?? null;
      if (live) {
        lastSequence = live.sequence;
        if (
          live.saved &&
          typeof live.saved.angNumber === 'number' &&
          typeof live.saved.verseId === 'number'
        ) {
          onSaved?.({
            ...live.saved,
            scrollPosition:
              typeof live.saved.scrollPosition === 'number' &&
              Number.isFinite(live.saved.scrollPosition)
                ? live.saved.scrollPosition
                : 0,
          });
        }
      }
      onJoined(live);
    }
  );

  socket.on('position', (event: LivePosition & { sessionId: string }) => {
    // The server broadcasts to the whole room, this device included. A reader
    // applying their own echo would fight their own scrolling.
    if (driving) {
      return;
    }
    if (typeof event?.sequence !== 'number' || event.sequence <= lastSequence) {
      return;
    }
    lastSequence = event.sequence;
    onPosition(event);
  });

  socket.on('saved', (event: LiveSaved) => {
    // Applied even while driving: a save can come from a member who is not the
    // reader, and the mark belongs to the path rather than to the turn. It is
    // also not sequence-ordered — there is no session to order it against, and
    // the newest save is simply the current one.
    if (typeof event?.angNumber === 'number' && typeof event.verseId === 'number') {
      onSaved?.({
        ...event,
        scrollPosition:
          typeof event.scrollPosition === 'number' && Number.isFinite(event.scrollPosition)
            ? event.scrollPosition
            : 0,
      });
    }
  });

  socket.on('reading-settings', (event: LiveReadingSettings) => {
    onSettings?.(event ?? {});
  });

  socket.on('reading-ended', (event: LiveReadingEnded) => {
    if (typeof event?.sessionId === 'string') {
      onReadingEnded?.(event);
    }
  });

  socket.on('reader-left', (event: LiveReaderLeft) => {
    if (typeof event?.sessionId === 'string') {
      onReaderLeft?.(event);
    }
  });

  socket.on('reader-rejoined', (event: LiveReaderRejoined) => {
    if (typeof event?.sessionId === 'string') {
      onReaderRejoined?.(event);
    }
  });

  socket.on('reader-takeover-started', (event: LiveReaderTakeoverStarted) => {
    if (typeof event?.takeoverId === 'string') {
      onTakeoverStarted?.(event);
    }
  });

  socket.on('reader-takeover-cancelled', (event: { takeoverId: string }) => {
    if (typeof event?.takeoverId === 'string') {
      onTakeoverCancelled?.(event);
    }
  });

  socket.on('reader-takeover-completed', (event: LiveReaderTakeoverCompleted) => {
    if (typeof event?.takeoverId === 'string' && typeof event?.sessionId === 'string') {
      onTakeoverCompleted?.(event);
    }
  });

  socket.on('disconnect', (reason: string) => {
    if (closed) {
      return;
    }
    // `io server disconnect` is the server hanging up deliberately — the
    // handshake was refused, or membership was revoked mid-session. Anything
    // else is the network, and the reader must NOT be ejected for it: the turn
    // is held server-side through a grace period, and tearing the screen down
    // would take the turn away over a passing tunnel.
    onEnded(reason === 'io server disconnect' ? 'refused' : 'dropped');
  });

  socket.on('connect_error', (error: unknown) => {
    if (closed) {
      return;
    }
    if (isSocketRefusal(error)) {
      onEnded('refused');
      return;
    }
    reportSocketFailure(error, 'connection failed');
    onEnded('dropped');
  });

  const flush = () => {
    timer = null;
    if (closed || !pending) {
      return;
    }
    socket.emit('position', pending);
    pending = null;
  };

  return {
    sendSettings: (settings) => {
      if (!closed) {
        socket.emit('reading-settings', settings);
      }
    },
    sendPosition: (position) => {
      if (closed) {
        return;
      }
      driving = true;
      pending = position;
      // Leading edge, then at most one packet per interval. The trailing send
      // matters more than the leading one: it is what guarantees the followers
      // end up where the reader actually stopped, rather than one second
      // behind it.
      if (timer === null) {
        flush();
        timer = setTimeout(flush, SEND_INTERVAL_MS);
      }
    },
    close: () => {
      if (closed) {
        return;
      }
      closed = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      socket.disconnect();
    },
  };
};
