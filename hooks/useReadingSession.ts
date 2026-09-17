import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Constants, Routes } from '@constants';
import { fontSizeFor } from '@constants/FontSize';
import type { RootStackParamList } from '../App';
import { checkpointReading, finishReading } from '../store/groupApi';
import type { LivePosition, LiveReaderTakeoverStarted } from '../store/liveSession';
import { useLiveReading } from './useLiveReading';
import { trackSharedPathEvent } from '../utils/sharedPathAnalytics';
import { recordError } from '../utils/crashlytics';

type LivePath = RootStackParamList['Path']['live'];
export type ReaderLayout = {
  larivaar?: boolean;
  paragraphMode?: boolean;
  vishraam?: boolean;
  vishraamsSource?: string;
  fontSizeIndex?: number;
};

interface Props {
  live: LivePath;
  pathId: number;
  pathAng: number;
  centerVerseId: number;
  scrollOffset: React.MutableRefObject<number>;
  firstVisibleVerseId?: React.MutableRefObject<number>;
  ownLayout: Required<ReaderLayout>;
  readerLayout: ReaderLayout | null;
  navigation: NativeStackNavigationProp<RootStackParamList, 'Path'>;
  onRemotePosition: (position: LivePosition) => void;
  onRemoteSave: (saved: { angNumber: number; verseId: number; scrollPosition?: number }) => void;
  onReaderLayout: (layout: ReaderLayout) => void;
  onLeaveReader: () => void;
  /** The server accepted Finish; its checkpoint is already authoritative. */
  onFinishComplete: () => void;
  onScroll: () => void;
  /** Save the old reader's first visible panktee during a takeover. */
  onTakeoverSave?: (verseId: number, scrollPosition: number) => void;
  onError: (message: string) => void;
}

/** Owns one shared reading's socket state and all session-specific UI state. */
export const useReadingSession = ({
  live,
  pathId,
  pathAng,
  centerVerseId,
  scrollOffset,
  firstVisibleVerseId,
  ownLayout,
  readerLayout,
  navigation,
  onRemotePosition,
  onRemoteSave,
  onReaderLayout,
  onLeaveReader,
  onFinishComplete,
  onScroll,
  onTakeoverSave,
  onError,
}: Props) => {
  const isFollowing = live !== undefined && !live.driving;
  const fallbackFirstVisibleVerseId = useRef(0);
  const handoffFirstVisibleVerseId = firstVisibleVerseId ?? fallbackFirstVisibleVerseId;
  const [endedBy, setEndedBy] = useState<string | null>(null);
  const [endedAt, setEndedAt] = useState<{ startAng: number; endAng: number } | null>(null);
  const [endedNoticeOpen, setEndedNoticeOpen] = useState(false);
  const [readerLeftNoticeOpen, setReaderLeftNoticeOpen] = useState(false);
  const [readerRejoined, setReaderRejoined] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [takeoverUntil, setTakeoverUntil] = useState<number | null>(null);
  const [takeoverSeconds, setTakeoverSeconds] = useState<number | null>(null);

  const onReadingEnded = useCallback(
    (ended: { readerLabel: string; endAng: number }) => {
      setReaderLeftNoticeOpen(false);
      setReaderRejoined(false);
      setEndedBy(ended.readerLabel);
      setEndedAt({ startAng: live?.startAng ?? ended.endAng, endAng: ended.endAng });
      setEndedNoticeOpen(true);
    },
    [live?.startAng]
  );
  const onReaderLeft = useCallback(() => {
    if (isFollowing && endedBy === null) {
      setReaderLeftNoticeOpen(true);
      setReaderRejoined(false);
    }
  }, [endedBy, isFollowing]);
  const onReaderRejoined = useCallback(() => {
    if (isFollowing && endedBy === null) {
      setReaderLeftNoticeOpen(false);
      setReaderRejoined(true);
    }
  }, [endedBy, isFollowing]);

  const onTakeoverCompleted = useCallback(
    (takeover: { sessionId: string; readerMemberId: string | null }) => {
      setTakeoverUntil(null);
      setTakeoverSeconds(null);
      // The old reader is the only device that knows the rendered first
      // visible panktee. Persist it at the authoritative hand-off boundary;
      // the API also has a session-position fallback for disconnected readers.
      if (!isFollowing && takeover.readerMemberId !== null) {
        onTakeoverSave?.(handoffFirstVisibleVerseId.current || centerVerseId, scrollOffset.current);
      }
      // This device was the old reader. Re-enter the same path as a follower;
      // the replacement session carries the old position so no progress jumps.
      if (!isFollowing && takeover.readerMemberId !== null) {
        // The current Path route is role-bound. Returning to Continue lets its
        // existing live-session refresh present the new reader/follower state
        // without reconnecting this socket as a driver by accident.
        navigation.goBack();
      }
    },
    [
      centerVerseId,
      handoffFirstVisibleVerseId,
      isFollowing,
      navigation,
      onTakeoverSave,
      scrollOffset,
    ]
  );
  const onTakeoverStarted = useCallback(
    (event: LiveReaderTakeoverStarted) => {
      const at = new Date(event.commitAt).getTime();
      if (Number.isFinite(at)) {
        setTakeoverUntil(at);
        // Always render the complete user-facing countdown. The server commit
        // timestamp remains authoritative; this state is visual feedback only.
        setTakeoverSeconds(Constants.TAKEOVER_COUNTDOWN_SECONDS);
      }

      // The live socket position is intentionally transient. Checkpoint it as
      // soon as the hand-off begins so the takeover cannot fall back to the
      // last explicitly saved Ang when the reader moved without long-pressing
      // a panktee. This does not create a slot or a reading-day entry; it only
      // updates the existing session position. The completion callback remains
      // as a best-effort fallback for clients that miss this event.
      if (!isFollowing && live?.sessionId) {
        const visibleVerseId = handoffFirstVisibleVerseId.current || centerVerseId;
        checkpointReading(live.sehajPathId, live.sessionId, {
          currentAng: pathAng,
          // Checkpoint the top visible verse: takeover's server fallback uses
          // the session checkpoint when the durable save races or fails.
          currentVerseId: visibleVerseId,
          scrollPosition: Math.max(0, Math.round(scrollOffset.current)),
        }).catch((error: unknown) => {
          recordError(error, 'SehajPath: takeover checkpoint failed');
        });
        onTakeoverSave?.(visibleVerseId, scrollOffset.current);
      }
    },
    [
      centerVerseId,
      handoffFirstVisibleVerseId,
      isFollowing,
      live,
      onTakeoverSave,
      pathAng,
      scrollOffset,
    ]
  );
  const onTakeoverCancelled = useCallback(() => {
    setTakeoverUntil(null);
    setTakeoverSeconds(null);
  }, []);

  const { connection, readerLabel, reportNow } = useLiveReading({
    live,
    pathAng,
    centerVerseId,
    scrollOffset,
    firstVisibleVerseId,
    onRemotePosition,
    onSaved: onRemoteSave,
    onReadingEnded,
    onReaderLeft,
    onReaderRejoined,
    onTakeoverCompleted,
    onTakeoverStarted,
    onTakeoverCancelled,
    onSettings: onReaderLayout,
    settings: ownLayout,
  });

  const leaveAfterReading = useCallback(() => {
    setEndedNoticeOpen(false);
    navigation.replace(Routes.Continue, { pathId, initialTab: 'progress' });
  }, [navigation, pathId]);
  const turnEnded = useRef(false);
  const requestExit = useCallback(() => {
    if (live?.driving && live.sessionId && live.startAng !== undefined && !turnEnded.current) {
      setFinishOpen(true);
      return;
    }
    onLeaveReader();
  }, [live, onLeaveReader]);
  const confirmFinish = useCallback(async () => {
    if (!live?.driving || !live.sessionId || live.startAng === undefined || finishing) {
      return;
    }
    setFinishing(true);
    trackSharedPathEvent('FINISH');
    const result = await finishReading(live.sehajPathId, live.sessionId, {
      expectedStartAng: live.startAng,
      endAng: pathAng,
      endVerseId: centerVerseId,
      firstVisibleVerseId: handoffFirstVisibleVerseId.current || centerVerseId,
      scrollPosition: Math.max(0, Math.round(scrollOffset.current)),
    });
    if (result.ok) {
      turnEnded.current = true;
      setFinishing(false);
      setFinishOpen(false);
      onFinishComplete();
      return;
    }
    setFinishing(false);
    if (result.kind !== 'refused') {
      onError(result.message);
    }
  }, [
    centerVerseId,
    finishing,
    handoffFirstVisibleVerseId,
    live,
    onError,
    onFinishComplete,
    pathAng,
    scrollOffset,
  ]);

  useEffect(() => {
    if (takeoverUntil === null) {
      return;
    }
    const timer = setInterval(() => {
      const remaining = Math.ceil((takeoverUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setTakeoverUntil(null);
        setTakeoverSeconds(null);
      } else if (remaining < (takeoverSeconds ?? Constants.TAKEOVER_COUNTDOWN_SECONDS)) {
        setTakeoverSeconds(remaining);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [takeoverSeconds, takeoverUntil]);

  const readerNotice = useMemo(() => {
    if (!live?.driving) {
      return null;
    }
    if (takeoverUntil !== null) {
      return `This slot is booked. Reading will switch in ${
        takeoverSeconds ?? Constants.TAKEOVER_COUNTDOWN_SECONDS
      } seconds.`;
    }
    if (connection === 'dropped') {
      return 'Reconnecting — the group can’t see your reading';
    }
    if (connection === 'refused') {
      return 'Not connected — the group can’t see your reading';
    }
    return null;
  }, [connection, live?.driving, takeoverSeconds, takeoverUntil]);

  const followingLabel = useMemo(() => {
    if (endedBy !== null) {
      return `${endedBy} has finished reading`;
    }
    if (connection === 'dropped') {
      return 'Reconnecting…';
    }
    if (connection === 'refused') {
      return 'No longer following';
    }
    if (readerRejoined) {
      return 'Reader rejoined — reading resumed';
    }
    return `Following ${readerLabel ?? 'the reader'}`;
  }, [connection, endedBy, readerLabel, readerRejoined]);

  const followedFontSize = useMemo(
    () =>
      isFollowing && readerLayout?.fontSizeIndex !== undefined
        ? fontSizeFor('reader', readerLayout.fontSizeIndex)
        : null,
    [isFollowing, readerLayout?.fontSizeIndex]
  );

  return {
    canDrivePage: !isFollowing || endedBy !== null,
    confirmFinish,
    endedAt,
    endedBy,
    endedNoticeOpen,
    finishOpen,
    finishing,
    followedFontSize,
    followingLabel,
    isFollowing,
    leaveAfterReading,
    readerLabel,
    readerLeftNoticeOpen,
    readerNotice,
    takeoverInProgress: takeoverUntil !== null,
    readerRejoined,
    reportScroll: () => {
      onScroll();
      reportNow();
    },
    requestExit,
    setFinishOpen,
    setReaderLeftNoticeOpen,
  };
};
