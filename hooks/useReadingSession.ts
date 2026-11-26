import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePreventRemove } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Constants, Routes } from '@constants';
import { fontSizeFor } from '@constants/FontSize';
import type { RootStackParamList } from '../App';
import { checkpointReading, finishReading } from '../store/groupApi';
import type { LivePosition, LiveReaderTakeoverStarted } from '../store/liveSession';
import { useLiveReading } from './useLiveReading';
import { trackSharedPathOutcome } from '../utils/sharedPathAnalytics';
import { recordError } from '../utils/crashlytics';

type LivePath = RootStackParamList['Path']['live'];
export type ReaderLayout = {
  larivaar?: boolean;
  paragraphMode?: boolean;
  vishraam?: boolean;
  vishraamsSource?: string;
  fontSizeIndex?: number;
};

/**
 * How long a follower waits after "reader left" before telling the person.
 *
 * A reader's connection blips for ordinary reasons (a lift, a weak signal, the
 * app briefly in the background) and is usually back within seconds. Showing a
 * "Reader has left" popup for every blip, then taking it away, is worse than
 * waiting a moment: the notice appears only if the reader is still gone.
 */
export const READER_LEFT_NOTICE_DELAY_MS = 5_000;

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
  /** The server deleted the shared path while this reader was connected. */
  onPathDeleted?: () => void;
  /** The current user was removed from the shared path while connected. */
  onMembershipEnded?: () => void;
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
  onPathDeleted,
  onMembershipEnded,
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
  // Pending "reader left" notice, and whether one has actually been shown.
  const readerLeftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readerLeftShown = useRef(false);
  // The notice describes one particular reader. `leftReader` remembers who it
  // was about, so it can be withdrawn if somebody else becomes the reader.
  // `readerLeftFinal` marks the permanent case (the server ended that reading),
  // which no change of reader can undo.
  const leftReader = useRef<string | null>(null);
  const readerLeftFinal = useRef(false);
  const currentReaderLabel = useRef<string | null>(null);
  const clearReaderLeftTimer = useCallback(() => {
    if (readerLeftTimer.current !== null) {
      clearTimeout(readerLeftTimer.current);
      readerLeftTimer.current = null;
    }
  }, []);
  useEffect(() => clearReaderLeftTimer, [clearReaderLeftTimer]);
  /** Take back a pending or visible "reader left" notice. */
  const withdrawReaderLeftNotice = useCallback(() => {
    clearReaderLeftTimer();
    readerLeftShown.current = false;
    setReaderLeftNoticeOpen(false);
    setReaderRejoined(false);
  }, [clearReaderLeftTimer]);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [takeoverUntil, setTakeoverUntil] = useState<number | null>(null);
  const [takeoverSeconds, setTakeoverSeconds] = useState<number | null>(null);
  const turnEnded = useRef(false);

  const onReadingEnded = useCallback(
    (ended: { readerLabel: string; endAng: number; endReason?: 'DISCONNECTED' }) => {
      // The reading is over either way, so any pending "left" notice is moot.
      clearReaderLeftTimer();
      if (ended.endReason === 'DISCONNECTED') {
        // Ended for good on the server: there is no rejoining, so nothing to
        // wait for. Tell the follower now.
        setEndedBy(null);
        setEndedAt(null);
        setEndedNoticeOpen(false);
        setReaderRejoined(false);
        readerLeftShown.current = true;
        readerLeftFinal.current = true;
        setReaderLeftNoticeOpen(true);
        return;
      }
      readerLeftShown.current = false;
      setReaderLeftNoticeOpen(false);
      setReaderRejoined(false);
      setEndedBy(ended.readerLabel);
      setEndedAt({ startAng: live?.startAng ?? ended.endAng, endAng: ended.endAng });
      setEndedNoticeOpen(true);
    },
    [clearReaderLeftTimer, live?.startAng]
  );
  const onReaderLeft = useCallback(() => {
    if (!isFollowing || endedBy !== null) {
      return;
    }
    // Wait before announcing it: if the reader is back within a few seconds it
    // was a network blip, and the follower never needs to hear about it.
    clearReaderLeftTimer();
    leftReader.current = currentReaderLabel.current;
    readerLeftTimer.current = setTimeout(() => {
      readerLeftTimer.current = null;
      readerLeftShown.current = true;
      setReaderRejoined(false);
      setReaderLeftNoticeOpen(true);
    }, READER_LEFT_NOTICE_DELAY_MS);
  }, [clearReaderLeftTimer, endedBy, isFollowing]);
  const onReaderRejoined = useCallback(() => {
    if (!isFollowing || endedBy !== null) {
      return;
    }
    clearReaderLeftTimer();
    // The popup goes away the moment the reader is back. If it was never shown
    // (the blip was shorter than the wait) there is nothing to retract, and
    // saying "rejoined" about a departure nobody was told of would only confuse.
    if (readerLeftShown.current) {
      readerLeftShown.current = false;
      setReaderLeftNoticeOpen(false);
      setReaderRejoined(true);
    }
  }, [clearReaderLeftTimer, endedBy, isFollowing]);

  const onTakeoverCompleted = useCallback(
    (takeover: { sessionId: string; readerMemberId: string | null }) => {
      // Somebody else is reading now. Whatever was said about the previous
      // reader leaving no longer applies, and must not be read as being about
      // the new one.
      if (isFollowing && !readerLeftFinal.current) {
        withdrawReaderLeftNotice();
      }
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
        turnEnded.current = true;
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
      withdrawReaderLeftNotice,
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

  const handlePathDeleted = useCallback(() => {
    turnEnded.current = true;
    onPathDeleted?.();
  }, [onPathDeleted]);

  const handleMembershipEnded = useCallback(() => {
    turnEnded.current = true;
    onMembershipEnded?.();
  }, [onMembershipEnded]);

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
    onPathDeleted: handlePathDeleted,
    onMembershipEnded: handleMembershipEnded,
    onSettings: onReaderLayout,
    settings: ownLayout,
  });

  // Keep the latest name where the socket callbacks above can read it, and
  // withdraw a "reader left" notice if the reader has changed since it was
  // raised: a follower that reconnects mid-wait is told who is reading now, and
  // the popup prints that name, so it would otherwise say the NEW reader left.
  useEffect(() => {
    currentReaderLabel.current = readerLabel;
    const aboutSomeoneElse =
      readerLabel !== null && leftReader.current !== null && readerLabel !== leftReader.current;
    const noticeActive = readerLeftTimer.current !== null || readerLeftShown.current;
    if (noticeActive && aboutSomeoneElse && !readerLeftFinal.current) {
      withdrawReaderLeftNotice();
    }
  }, [readerLabel, withdrawReaderLeftNotice]);

  const leaveAfterReading = useCallback(() => {
    setEndedNoticeOpen(false);
    // Continue is already below the follower reader in the normal flow:
    // Home → Continue → Path. Replacing Path with another Continue leaves two
    // Continue routes in the stack, so Back appears to reopen the same screen.
    // Return to the existing route instead.
    navigation.popTo(Routes.Continue, { pathId, initialTab: 'progress' });
  }, [navigation, pathId]);

  const requestExit = useCallback(() => {
    if (live?.driving && live.sessionId && live.startAng !== undefined && !turnEnded.current) {
      setFinishOpen(true);
      return;
    }
    turnEnded.current = true;
    onLeaveReader();
  }, [live, onLeaveReader]);

  // Keep the iOS swipe-back gesture, but ask first: while this device holds the
  // turn, a swipe opens the same Finish sheet Android back does.
  //
  // This must be `usePreventRemove`, not a plain `beforeRemove` listener.
  // Native-stack only stops the native swipe (`preventNativeDismiss`) for
  // routes registered through this hook. With a bare listener iOS had already
  // removed the screen by the time JS cancelled the pop, leaving the stack
  // believing the reader was still open while it was gone from view.
  //
  // Only a back (swipe, header back) is turned into the Finish prompt. Anything
  // else — a replace to the error screen, a reset on sign-out — and every exit
  // once the turn is over (finished, taken over, path deleted) goes through
  // unchanged. Re-dispatching `data.action` is not prevented again: navigation
  // marks it as already checked for this screen.
  usePreventRemove(live?.driving === true, ({ data }) => {
    const isBack = data.action.type === 'POP' || data.action.type === 'GO_BACK';
    if (turnEnded.current || !isBack) {
      navigation.dispatch(data.action);
      return;
    }
    requestExit();
  });
  const confirmFinish = useCallback(async () => {
    if (!live?.driving || !live.sessionId || live.startAng === undefined || finishing) {
      return;
    }
    setFinishing(true);
    const result = await finishReading(live.sehajPathId, live.sessionId, {
      expectedStartAng: live.startAng,
      endAng: pathAng,
      endVerseId: centerVerseId,
      firstVisibleVerseId: handoffFirstVisibleVerseId.current || centerVerseId,
      scrollPosition: Math.max(0, Math.round(scrollOffset.current)),
    });
    if (result.ok) {
      trackSharedPathOutcome('FINISH', 'success');
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
