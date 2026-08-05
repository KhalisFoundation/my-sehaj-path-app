import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SyncStatusNoticeStyles as styles } from '@styles';
import { SyncedCheckIcon } from '../icons';
import { isApiConfigured } from '@api/config';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { clearSyncConfirmation } from '../store/slices/syncSlice';

type Phase = 'hidden' | 'syncing' | 'done' | 'error';
type RenderedPhase = Phase | 'offline';

/** Long enough that a fast sync stays silent instead of flashing. */
const SHOW_AFTER_MS = 400;
/** Grace period so the gap between the upload and download halves is not read as the end. */
const SETTLE_MS = 250;
/**
 * A resolved message holds the screen this long before anything may replace it.
 * Sync often finishes in a few hundred milliseconds, and a tick that appears and
 * is overwritten by the next "Syncing…" is one the user never actually read.
 */
const MIN_VISIBLE_MS = 1200;
/**
 * Cap on holding "Syncing…" while work remains queued but nothing has failed.
 * Long enough to cover the outbox debounce and a retry, short enough that a
 * spinner never becomes permanent furniture.
 */
const STALL_AFTER_MS = 20_000;
/**
 * Success is reassurance the user has already inferred from the app working, so
 * it clears quickly. A failure is information they have to act on, so it stays
 * long enough to be read and understood.
 */
const DONE_DISMISS_MS = 2000;
const ERROR_DISMISS_MS = 4000;
const ENTER_DURATION_MS = 220;
const EXIT_DURATION_MS = 180;

/**
 * One small, non-blocking status line for cloud sync.
 *
 * It behaves as a state machine rather than a set of independent toasts:
 * *syncing → synced*, or *syncing → unable to sync*.
 *
 * It speaks only when a sync **carries something** — queued work to upload, or a
 * sync the user explicitly asked for — and then only if that takes long enough
 * to be worth mentioning. A routine refresh that finds nothing new stays silent
 * however long it takes, which is what keeps landing on Home from confirming a
 * sync that did nothing.
 *
 * Whatever it starts, it finishes: once "Syncing…" appears the outcome is always
 * reported, because a spinner that vanishes unresolved is worse than none.
 */
const SyncStatusNoticeComponent = () => {
  // This floats above the whole app, outside any SafeAreaView, so it has to
  // offset itself past the status bar / notch or it renders underneath them.
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();

  const status = useAppSelector((state) => state.sync.status);
  const isOffline = useAppSelector(
    (state) => state.auth.status === 'signedIn' && !state.network.isOnline && isApiConfigured()
  );
  const pulling = useAppSelector((state) => state.sync.pulling);
  const catchUpSyncRunning = useAppSelector((state) => state.sync.catchUpSyncRunning);
  const confirmNextSync = useAppSelector((state) => state.sync.confirmNextSync);
  const lastError = useAppSelector((state) => state.sync.lastError);
  /**
   * Work this sync cycle is responsible for.
   *
   * Counts queued operations and settings — not `scrollDirty`. A dirty scroll on
   * its own never schedules a drain; it waits to be promoted at the next
   * checkpoint. Counting it here made the notice wait for something that was not
   * coming, holding "Syncing…" indefinitely.
   */
  const pendingCount = useAppSelector(
    (state) =>
      Object.keys(state.sync.pathOps).length + (state.sync.pendingSettingsUpdatedAt == null ? 0 : 1)
  );
  // Creating a path is automatically durable and its upload is routine. It
  // should not announce itself; later reading progress and settings changes
  // remain worth reporting during the post-login catch-up.
  const hasNoticeWorthyPendingWork = useAppSelector(
    (state) =>
      state.sync.pendingSettingsUpdatedAt != null ||
      Object.values(state.sync.pathOps).some((op) => op.kind !== 'create')
  );
  const hasOnlyNewPathCreates = useAppSelector((state) => {
    const ops = Object.values(state.sync.pathOps);
    return ops.length > 0 && ops.every((op) => op.kind === 'create');
  });
  const accountMatches = useAppSelector(
    (state) => !!state.auth.email && state.sync.account === state.auth.email
  );

  // Uploading, downloading, or working through the session catch-up.
  const busy = status === 'flushing' || pulling || catchUpSyncRunning;
  const [phase, setPhase] = useState<Phase>('hidden');
  // Keep the last visible phase mounted briefly while its exit animation runs.
  // Without this separate render state, setting `phase` to hidden removes the
  // view immediately and there is nothing left for React Native to fade out.
  const [renderedPhase, setRenderedPhase] = useState<RenderedPhase>('hidden');
  const noticeAnimation = useRef(new Animated.Value(0)).current;
  /**
   * Whether THIS run is worth talking about, captured when it starts.
   *
   * A plain refresh is a network round trip, so it is always slower than
   * `SHOW_AFTER_MS`. Announcing on duration alone therefore fires on every Home
   * focus and then owes the user a "Synced" for a check that found nothing —
   * which is exactly the double notification it was meant to avoid. The question
   * is not "is this slow?" but "does this carry anything?".
   */
  const meaningful = useRef(false);
  const wasBusy = useRef(false);
  /** When the current resolved message appeared, so it can be protected. */
  const resolvedAt = useRef(0);
  /**
   * The user was last told a sync FAILED.
   *
   * The outbox retries on its own and usually succeeds a few seconds later, but
   * silently — so the failure stays the last thing the user saw and they believe
   * their reading is unsaved until they happen to reopen the app. A success after
   * a failure is therefore always worth announcing: it corrects something they
   * currently believe.
   */
  const showedError = useRef(false);

  useEffect(() => {
    if (!busy) {
      wasBusy.current = false;
      return undefined;
    }
    if (!wasBusy.current) {
      wasBusy.current = true;
      // Rising edge: real work queued, the user explicitly asked, or this is the
      // once-per-launch catch-up — the one sync the user may actually be waiting
      // on, since they just opened the app and want to know it is current.
      meaningful.current =
        hasNoticeWorthyPendingWork ||
        confirmNextSync ||
        (catchUpSyncRunning && !hasOnlyNewPathCreates) ||
        showedError.current;
    }
    if (!meaningful.current) {
      return undefined; // a read-only refresh stays silent however long it takes
    }
    const heldFor = Date.now() - resolvedAt.current;
    const wait = Math.max(SHOW_AFTER_MS, resolvedAt.current ? MIN_VISIBLE_MS - heldFor : 0);
    const timer = setTimeout(() => setPhase('syncing'), wait);
    return () => clearTimeout(timer);
  }, [
    busy,
    catchUpSyncRunning,
    confirmNextSync,
    hasNoticeWorthyPendingWork,
    hasOnlyNewPathCreates,
    pendingCount,
  ]);

  useEffect(() => {
    if (busy) {
      return undefined;
    }
    // Already resolved: this run is over and the message is being read. Without
    // this the effect re-fires on its own `phase` change and hides the result
    // almost immediately, long before its dismiss timer.
    if (phase === 'done' || phase === 'error') {
      return undefined;
    }

    // One sync is several phases — upload, then download — and `busy` dips
    // between them. Resolving on the first dip would end the message mid-sync,
    // then start a second one for the download half. Wait out the gap and treat
    // the whole thing as one run.
    const timer = setTimeout(() => {
      if (status === 'error') {
        meaningful.current = false;
        showedError.current = true;
        setPhase('error');
        dispatch(clearSyncConfirmation());
        return;
      }

      // Once the banner is already visible, the store is the source of truth.
      // A quick upload → pull hand-off can briefly start a second "busy" run
      // after the first one set `phase` to syncing. In that case the second run
      // may be a plain refresh and therefore not be marked meaningful again.
      // Do not leave the existing banner waiting on that internal marker: an
      // empty queue plus an idle pull means the complete sync really finished.
      if (
        (phase === 'syncing' || meaningful.current || confirmNextSync || showedError.current) &&
        pendingCount === 0 &&
        accountMatches
      ) {
        meaningful.current = false;
        showedError.current = false; // the record is corrected
        setPhase('done');
        dispatch(clearSyncConfirmation());
        return;
      }

      // Work is still queued but nothing FAILED — a scroll landed mid-request, or
      // the outbox has another pass to make. That is a sync still in progress,
      // not a broken one, and calling it "Unable to sync" tells the user their
      // reading is at risk when it has already been saved. Only `status ===
      // 'error'` above may claim failure.
      //
      // Hold "Syncing…" rather than hiding: the next drain finishes the job
      // seconds later, and blinking the message out and back reads as two failed
      // attempts. The confirmation request is left pending so that drain reports
      // it. `STALL_AFTER_MS` stops this waiting for ever.
      if (phase !== 'syncing') {
        meaningful.current = false;
        setPhase('hidden');
      }
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [accountMatches, busy, confirmNextSync, dispatch, pendingCount, phase, status]);

  useEffect(() => {
    if (phase === 'syncing') {
      // Safety net only: a sync that never resolves must not leave a spinner
      // pinned to the screen for the rest of the session.
      resolvedAt.current = 0;
      const timer = setTimeout(() => {
        meaningful.current = false;
        setPhase('hidden');
      }, STALL_AFTER_MS);
      return () => clearTimeout(timer);
    }
    if (phase !== 'done' && phase !== 'error') {
      resolvedAt.current = 0;
      return undefined;
    }
    resolvedAt.current = Date.now();
    const timer = setTimeout(
      () => setPhase('hidden'),
      phase === 'done' ? DONE_DISMISS_MS : ERROR_DISMISS_MS
    );
    return () => clearTimeout(timer);
  }, [phase]);

  // Offline is a current connection state, rather than the outcome of one
  // particular request. It takes priority over a stale sync/done phase and
  // stays visible until the device reconnects.
  const displayPhase: RenderedPhase = isOffline ? 'offline' : phase;

  useEffect(() => {
    noticeAnimation.stopAnimation();
    if (displayPhase === 'hidden') {
      if (renderedPhase === 'hidden') {
        return;
      }
      Animated.timing(noticeAnimation, {
        toValue: 0,
        duration: EXIT_DURATION_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setRenderedPhase('hidden');
        }
      });
      return;
    }

    setRenderedPhase(displayPhase);
    Animated.timing(noticeAnimation, {
      toValue: 1,
      duration: ENTER_DURATION_MS,
      useNativeDriver: true,
    }).start();
  }, [displayPhase, noticeAnimation, renderedPhase]);

  if (renderedPhase === 'hidden') {
    return null;
  }

  const errorMessage =
    lastError === 'network'
      ? 'Unable to sync. Your progress is safe on this device.'
      : 'Unable to sync some progress. Your local progress is safe.';
  const messages: Record<string, string> = {
    syncing: 'Syncing your progress…',
    done: 'Synced',
    offline: 'No internet connection',
  };
  const message = messages[renderedPhase] ?? errorMessage;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.notice,
        { top: insets.top + 72 },
        {
          opacity: noticeAnimation,
          transform: [
            {
              translateY: noticeAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [-16, 0],
              }),
            },
          ],
        },
        // Syncing and Synced share the primary blue: same conversation, two
        // moments of it. Only a failure changes colour, because that is the one
        // message the user has to actually notice.
        (renderedPhase === 'error' || renderedPhase === 'offline') && styles.errorNotice,
      ]}
    >
      {renderedPhase === 'offline' ? (
        <View style={styles.row}>
          <View style={styles.offlineIcon}>
            <Text style={styles.offlineIconText}>!</Text>
          </View>
          <View>
            <Text style={styles.text}>{message}</Text>
            <Text style={styles.offlineSubtext}>Sync paused</Text>
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          {renderedPhase === 'syncing' ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
          {renderedPhase === 'done' ? <SyncedCheckIcon /> : null}
          <Text style={styles.text}>{message}</Text>
        </View>
      )}
    </Animated.View>
  );
};

export const SyncStatusNotice = React.memo(SyncStatusNoticeComponent);
