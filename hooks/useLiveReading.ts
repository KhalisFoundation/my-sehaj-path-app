import { useCallback, useEffect, useRef, useState } from 'react';
import {
  connectLive,
  type LiveHandle,
  type LivePosition,
  type LiveReaderTakeoverCompleted,
  type LiveReaderTakeoverStarted,
} from '../store/liveSession';

type SharedSavedPosition = { angNumber: number; verseId: number; scrollPosition?: number };

/**
 * Reading a shared path with other people watching, or watching somebody else
 * read one.
 *
 * The two roles are deliberately exclusive and decided by the caller rather
 * than inferred here. Whoever opened this screen already knows which they are —
 * they either took the turn or tapped "Follow along" — and guessing from the
 * session would introduce a window where a follower briefly believes it is
 * driving and reports a position that moves the whole group.
 */

export interface LiveReadingRole {
  sehajPathId: string;
  /** True for the one person holding the turn. Exactly one device, ever. */
  driving: boolean;
  /** The turn being driven. Needed to end it. */
  sessionId?: string;
  /** Where the turn began — the server compares it to refuse a rewind. */
  startAng?: number;
}

export interface LiveReadingOptions {
  /** Undefined for a personal path, which never opens a socket at all. */
  live: LiveReadingRole | undefined;
  /** The ang on screen. Reported while driving; ignored while following. */
  pathAng: number;
  /** The verse at the centre of the screen. */
  centerVerseId: number;
  /** Live scroll offset, read at send time rather than depended on. */
  scrollOffset: React.MutableRefObject<number>;
  /** First verse visible at the top of the viewport, used for an automatic save. */
  firstVisibleVerseId?: React.MutableRefObject<number>;
  /** Move this device to where the reader is. Called only while following. */
  onRemotePosition: (position: LivePosition) => void;
  /** Mark the line the group has read to. Called for readers and followers. */
  onSaved?: (saved: SharedSavedPosition) => void;
  /** The turn ended. Only followers are told — the reader ended it themselves. */
  onReadingEnded?: (ended: { readerLabel: string; endAng: number }) => void;
  /** The reader disconnected but may return during the server grace period. */
  onReaderLeft?: () => void;
  /** The original reader resumed the same session during grace. */
  onReaderRejoined?: () => void;
  onTakeoverCompleted?: (takeover: LiveReaderTakeoverCompleted) => void;
  onTakeoverStarted?: (takeover: LiveReaderTakeoverStarted) => void;
  onTakeoverCancelled?: (takeover: { takeoverId: string }) => void;
  /** The reader's text layout, for a follower to match. */
  onSettings?: (settings: {
    larivaar?: boolean;
    paragraphMode?: boolean;
    vishraam?: boolean;
    vishraamsSource?: string;
    fontSizeIndex?: number;
  }) => void;
  /** The reader's own layout, reported to followers whenever it changes. */
  settings?: {
    larivaar: boolean;
    paragraphMode: boolean;
    vishraam: boolean;
    vishraamsSource?: string;
    fontSizeIndex: number;
  };
}

export const useLiveReading = ({
  live,
  pathAng,
  centerVerseId,
  scrollOffset,
  firstVisibleVerseId,
  onRemotePosition,
  onSaved,
  onReadingEnded,
  onReaderLeft,
  onReaderRejoined,
  onTakeoverCompleted,
  onTakeoverStarted,
  onTakeoverCancelled,
  onSettings,
  settings,
}: LiveReadingOptions) => {
  const [connection, setConnection] = useState<'live' | 'dropped' | 'refused' | null>(null);
  const [readerLabel, setReaderLabel] = useState<string | null>(null);
  const handle = useRef<LiveHandle | null>(null);

  /**
   * The callback is read through a ref so a re-render never tears down the
   * socket. `onRemotePosition` closes over the current ang, so it changes on
   * every page — reconnecting for that would drop the group's position and
   * re-handshake several times a minute.
   */
  const applyRef = useRef(onRemotePosition);
  useEffect(() => {
    applyRef.current = onRemotePosition;
  }, [onRemotePosition]);

  const savedRef = useRef(onSaved);
  useEffect(() => {
    savedRef.current = onSaved;
  }, [onSaved]);

  const endedRef = useRef(onReadingEnded);
  useEffect(() => {
    endedRef.current = onReadingEnded;
  }, [onReadingEnded]);

  const readerLeftRef = useRef(onReaderLeft);
  useEffect(() => {
    readerLeftRef.current = onReaderLeft;
  }, [onReaderLeft]);

  const readerRejoinedRef = useRef(onReaderRejoined);
  useEffect(() => {
    readerRejoinedRef.current = onReaderRejoined;
  }, [onReaderRejoined]);

  const takeoverCompletedRef = useRef(onTakeoverCompleted);
  useEffect(() => {
    takeoverCompletedRef.current = onTakeoverCompleted;
  }, [onTakeoverCompleted]);
  const takeoverStartedRef = useRef(onTakeoverStarted);
  useEffect(() => {
    takeoverStartedRef.current = onTakeoverStarted;
  }, [onTakeoverStarted]);
  const takeoverCancelledRef = useRef(onTakeoverCancelled);
  useEffect(() => {
    takeoverCancelledRef.current = onTakeoverCancelled;
  }, [onTakeoverCancelled]);

  /** The latest layout, readable from inside the connect callback. */
  const layoutRef = useRef(settings);
  layoutRef.current = settings;

  const settingsRef = useRef(onSettings);
  useEffect(() => {
    settingsRef.current = onSettings;
  }, [onSettings]);

  const sehajPathId = live?.sehajPathId;
  const driving = live?.driving ?? false;

  /**
   * The latest position, readable from inside the connect callback.
   *
   * The socket opens asynchronously, so the first report fires before there is
   * anything to send on. Without this the reader's OPENING position is simply
   * lost: followers see nothing until the reader happens to move, which on a
   * long ang can be minutes.
   */
  const positionRef = useRef({ pathAng, centerVerseId, scrollOffset, firstVisibleVerseId });
  positionRef.current = { pathAng, centerVerseId, scrollOffset, firstVisibleVerseId };

  const send = useCallback(() => {
    if (!driving || !handle.current) {
      return;
    }
    const at = positionRef.current;
    handle.current.sendPosition({
      currentAng: at.pathAng,
      currentVerseId: at.centerVerseId,
      // Followers still centre on currentVerseId. This separate value is only
      // for the server to persist when an unsaved reader finishes or drops.
      firstVisibleVerseId: at.firstVisibleVerseId?.current || at.centerVerseId,
      // Rounded because the column is an `Int` — a fractional offset failed the
      // server's write outright, costing the reader their grace period. Floored
      // at zero because an overscroll bounce reports a negative offset.
      scrollPosition: Math.max(0, Math.round(at.scrollOffset.current)),
    });
  }, [driving]);

  useEffect(() => {
    if (!sehajPathId) {
      return;
    }
    let cancelled = false;

    connectLive({
      sehajPathId,
      onJoined: (snapshot) => {
        if (cancelled) {
          return;
        }
        setConnection('live');
        // The server snapshot is authoritative for BOTH roles on entry. A new
        // reader may have an old local mirror of this shared path; opening from
        // that mirror makes them see a pankti another member never saved.
        // Once this initial placement is complete, own socket echoes remain
        // ignored below, so the active reader still controls their page.
        if (snapshot) {
          setReaderLabel(snapshot.readerLabel);
          applyRef.current(snapshot);
        }
      },
      onPosition: (position) => {
        if (!cancelled && !driving) {
          applyRef.current(position);
        }
      },
      onReadingEnded: (ended) => {
        // Not told to the reader: they are the one who ended it, and their own
        // screen has already moved on.
        if (!cancelled && !driving) {
          endedRef.current?.(ended);
        }
      },
      onReaderLeft: () => {
        if (!cancelled && !driving) {
          readerLeftRef.current?.();
        }
      },
      onReaderRejoined: () => {
        if (!cancelled && !driving) {
          readerRejoinedRef.current?.();
        }
      },
      onTakeoverCompleted: (takeover) => {
        if (!cancelled) {
          if (
            !driving &&
            typeof takeover.currentAng === 'number' &&
            typeof takeover.currentVerseId === 'number' &&
            typeof takeover.scrollPosition === 'number' &&
            typeof takeover.sequence === 'number'
          ) {
            // The old session stops producing position packets at the moment
            // ownership changes. Apply the authoritative hand-off snapshot so
            // followers do not remain attached to a dead reader until the next
            // packet arrives from the replacement.
            if (typeof takeover.readerLabel === 'string') {
              setReaderLabel(takeover.readerLabel);
            }
            applyRef.current({
              currentAng: takeover.currentAng,
              currentVerseId: takeover.currentVerseId,
              scrollPosition: takeover.scrollPosition,
              sequence: takeover.sequence,
            });
          }
          takeoverCompletedRef.current?.(takeover);
        }
      },
      onTakeoverStarted: (takeover) => {
        if (!cancelled) {
          takeoverStartedRef.current?.(takeover);
        }
      },
      onTakeoverCancelled: (takeover) => {
        if (!cancelled) {
          takeoverCancelledRef.current?.(takeover);
        }
      },
      onSettings: (incoming) => {
        // Followers only: the reader is the source of these, and applying an
        // echo would fight their own controls.
        if (!cancelled && !driving) {
          settingsRef.current?.(incoming);
        }
      },
      onSaved: (saved) => {
        // Not gated on `driving`: a save can come from a member who is not the
        // reader, so every screen marks it.
        if (!cancelled) {
          savedRef.current?.(saved);
        }
      },
      onEnded: (reason) => {
        if (!cancelled) {
          setConnection(reason);
        }
      },
    })
      .then((opened) => {
        if (cancelled) {
          opened.close();
          return;
        }
        handle.current = opened;
        // The opening position, now that there is something to send it on.
        send();
        // And the layout: a reader who never touches a setting mid-turn would
        // otherwise never send it, leaving followers reading in whatever shape
        // happened to be their own.
        if (driving && layoutRef.current) {
          opened.sendSettings(layoutRef.current);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConnection('refused');
        }
      });

    return () => {
      cancelled = true;
      handle.current?.close();
      handle.current = null;
    };
  }, [sehajPathId, driving, send]);

  /**
   * Report where the reader is.
   *
   * Fires on the position itself rather than on scroll events: `centerVerseId`
   * already settles as the reader moves, and `liveSession` throttles what
   * actually reaches the wire. A follower must never reach this.
   */
  useEffect(() => {
    send();
  }, [send, pathAng, centerVerseId]);

  /**
   * Tell followers how the text is laid out, and again whenever it changes.
   *
   * Driven by the settings themselves rather than a timer: they change when
   * somebody presses a switch. `connection` is a dependency because the socket
   * opens asynchronously — without it, a reader who never touches a setting
   * mid-turn would never send their layout at all, and followers would read in
   * whatever shape happened to be their own.
   */
  useEffect(() => {
    if (!driving || !handle.current || !settings) {
      return;
    }
    handle.current.sendSettings(settings);
  }, [driving, settings, connection]);

  return { connection, readerLabel, reportNow: send };
};
