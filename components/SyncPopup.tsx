import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from './AppText';
import { Constants, ErrorConstants } from '@constants';
import { logout } from '@auth';
import { recordError, showErrorAlert, trackEvent } from '@utils';
import { DialogStyles as styles } from '@styles';
import { store } from '../store';
import {
  discardLocalDataAndSync,
  runConfirmedAccountSync,
  switchAccountData,
} from '../store/confirmedSync';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { approveSync } from '../store/slices/syncSlice';
import { onForeground } from '../store/syncLifecycle';
import { hasLocalData } from '../store/syncWork';
import { Dialog } from './Dialog';

/** The account-switch dialogs are answer-only; the OS back gesture must not decide for the user. */
const noop = (): void => undefined;

/** Delay before the first automatic retry of a failed restore; doubles after that. */
const RESTORE_RETRY_MS = 15_000;
/**
 * How many times a failed restore retries by itself before it stops asking.
 *
 * Bounded on purpose. An unbounded timer turns a server outage into unlimited
 * requests and a stream of duplicate Crashlytics reports for as long as the
 * screen stays open — from every affected device at once. Three attempts at
 * 15s/30s/60s cover the ordinary case (a connection that comes back within a
 * minute or two); past that the outage is not something retrying will fix, and
 * Retry stays on screen as the user's explicit way to try again.
 */
const MAX_RESTORE_RETRIES = 3;

/**
 * The login/sync decision, reduced to a small tree.
 *
 * Which case applies is decided by two questions only — who owns the data that is
 * currently loaded, and whether that owner has anything the server has not seen:
 *
 *   no owner + no data      → nothing to ask. Associate silently (cases 1 & 2).
 *   no owner + data         → ask before uploading it (case 3).
 *   other owner, backed up  → switch silently, with a notice (case 4).
 *   other owner, unsynced   → ask what happens to that work (case 5).
 *
 * Every dialog here shows at most TWO main buttons. Secondary and destructive
 * actions are text links underneath, and anything destructive gets its own
 * confirmation. Nothing uploads or is removed without an explicit choice.
 */
interface SyncPopupProps {
  /**
   * Account switches must be guarded app-wide, even before Home is visible.
   * A first claim stays Home-only so the normal welcome prompt does not cover
   * the reader immediately after a signed-out user logs in.
   */
  mode?: 'unowned' | 'accountSwitch';
  /** Clears a reader that may still hold the previous account's path in refs. */
  onAccountSwitched?: () => void;
}

const ignoreRequestClose = () => undefined;

/**
 * Label for a button that may be running. Shows a spinner beside "Syncing…" so
 * the wait reads as progress rather than a button whose text simply changed.
 */
const ActionLabel = ({
  running,
  idle,
  runningLabel = Constants.SYNCING,
  textStyle,
  spinnerColor,
}: {
  running: boolean;
  idle: string;
  runningLabel?: string;
  textStyle: object;
  spinnerColor: string;
}) =>
  running ? (
    <View style={styles.busyLabel}>
      <ActivityIndicator size="small" color={spinnerColor} />
      <Text style={textStyle}>{runningLabel}</Text>
    </View>
  ) : (
    <Text style={textStyle}>{idle}</Text>
  );

/**
 * Which action is currently running. A single `syncing` boolean is not enough:
 * it puts the busy label on whichever button owns it, so pressing "Add a copy"
 * would show "Syncing…" on "Keep it safe" instead. Only the pressed button shows
 * progress; the rest are disabled but keep their own labels.
 */
type BusyAction = 'sync' | 'discard' | 'keepForPrevious' | 'addCopy' | null;

const SyncPopupComponent = ({ mode = 'unowned', onAccountSwitched }: SyncPopupProps) => {
  const dispatch = useAppDispatch();
  const [busy, setBusy] = useState<BusyAction>(null);
  const syncing = busy !== null;
  /** A connect attempt is running — the device's state is still settling. */
  const associating = busy === 'sync';
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [automaticSwitchFailed, setAutomaticSwitchFailed] = useState(false);
  /** A silent restore could not reach the account — the user must be told. */
  const [restoreFailed, setRestoreFailed] = useState(false);
  /** Automatic retries already spent on the current failure. */
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  /** Stops the give-up report firing again on every later render. */
  const exhaustionReported = useRef(false);
  /** Lets an offline user read on-device content; reconnecting asks again. */
  const [syncDeferredOffline, setSyncDeferredOffline] = useState(false);
  /** The account just put away — keeps the closing notice on screen to be read. */
  const [switchedFrom, setSwitchedFrom] = useState<string | null>(null);
  const automaticSwitchTarget = useRef<string | null>(null);
  const silentAssociationTarget = useRef<string | null>(null);
  /**
   * An email whose silent association was started and has not yet succeeded.
   *
   * A partially-successful attempt pulls the account's paths into Redux and
   * then fails before `approveSync`, leaving `account` null with data present —
   * which looks exactly like unowned local progress and made the dialog flash
   * up asking about paths it had just downloaded FROM that account.
   */
  const silentAssociationPending = useRef<string | null>(null);

  const status = useAppSelector((state) => state.auth.status);
  /**
   * The sign-in is still settling.
   *
   * `establishSession` dispatches `setSignedIn` — which is what populates
   * `email` and lets the silent restore start — BEFORE `loginCallback` clears
   * this flag. So a restore can begin, and fail, while "Signing you in…" is
   * still on screen. Announcing "Unable to load your progress" underneath that
   * notice contradicts it.
   */
  const signingIn = useAppSelector((state) => state.auth.signingIn);
  const email = useAppSelector((state) => state.auth.email);
  const firstname = useAppSelector((state) => state.auth.firstname);
  const answered = useAppSelector((state) => state.sync.syncPopupAnswered);
  const account = useAppSelector((state) => state.sync.account);
  const recoveryNeeded = useAppSelector((state) => state.sync.recoveryNeeded);
  const isOnline = useAppSelector((state) => state.network.isOnline);
  // Not `paths.length`: an orphan date record is real reading history too, and
  // quarantined records live outside Redux entirely.
  const deviceHasData = useAppSelector((state) => hasLocalData(store, state));
  const previousAccountHasUnsyncedData = useAppSelector(
    (state) =>
      state.sync.account !== null &&
      state.sync.account !== state.auth.email &&
      (Object.keys(state.sync.pathOps ?? {}).length > 0 ||
        Object.keys(state.sync.scrollDirty ?? {}).length > 0 ||
        state.sync.pendingSettingsUpdatedAt != null)
  );
  const previousAccountIsFullySynced = useAppSelector(
    (state) =>
      !state.sync.recoveryNeeded &&
      // `lastSyncedAt` is only the server pull cursor. Older accounts can have
      // a zero cursor even when every path is confirmed on the server, so it
      // must not make an otherwise safe account switch ask "Keep it safe".
      // With no paths, however, local-only date/quarantined history cannot be
      // proven on the server and must still be protected by the prompt.
      (!deviceHasData || state.paths.paths.length > 0) &&
      state.paths.paths.every((path) => {
        const meta = state.sync.meta[path.pathId];
        return !!meta && meta.onServer && meta.deletedAt == null;
      })
  );

  const isAccountSwitch = account !== null && account !== email;
  const accountSwitchNeedsChoice =
    isAccountSwitch &&
    (previousAccountHasUnsyncedData || (deviceHasData && !previousAccountIsFullySynced));

  /**
   * Cases 1 & 2: unowned but empty. There is no progress to ask about, so a
   * prompt would only be noise — and leaving `sync.account` null keeps the outbox
   * disabled, meaning nothing the user creates afterwards would ever sync.
   */
  const canAssociateSilently =
    mode === 'unowned' && account === null && !deviceHasData && !recoveryNeeded && !!email;

  const isVisible =
    status === 'signedIn' &&
    !!email &&
    !confirmingDiscard &&
    (mode === 'accountSwitch'
      ? isAccountSwitch
      : account === null &&
        !answered &&
        !recoveryNeeded &&
        !syncDeferredOffline &&
        deviceHasData &&
        // A silent association may be in flight for a device that was empty a
        // moment ago. Creating a path during that window flips `deviceHasData`
        // and would ask "what about your local progress?" about a path the user
        // just made, while it is already being connected.
        !associating &&
        // `!associating` alone is too narrow: it only covers the in-flight
        // moment. A silent attempt that pulled the account's paths and THEN
        // failed releases `busy` with `account` still null, so the data on the
        // device is the account's own — not unowned progress to ask about. Stay
        // quiet until that attempt has actually succeeded; the next foreground
        // or reconnect retries it.
        silentAssociationPending.current !== email);

  // "Continue offline" is only a temporary dismissal, never an answer to a
  // data-ownership question. Bring the safety prompt back once sync is usable.
  useEffect(() => {
    if (isOnline) {
      setSyncDeferredOffline(false);
    }
  }, [isOnline]);

  const completeAccountSwitch = async (addPreviousProgress: boolean, automatic = false) => {
    if (!email || syncing) {
      return;
    }
    // Captured before anything changes: `switchAccountData` moves the account to
    // B, so by the time the closing notice renders this value is already gone.
    const previousAccount = account;
    // Only a real choice is worth recording: the automatic path (a provably
    // backed-up account) is resolved without ever showing the user anything.
    if (!automatic) {
      trackEvent(
        'AccountSwitch',
        'click',
        addPreviousProgress ? 'copy previous progress' : 'discard previous progress'
      );
    }
    setBusy(addPreviousProgress ? 'addCopy' : 'keepForPrevious');
    let switched = false;
    try {
      const ok = await switchAccountData(store, email, addPreviousProgress);
      if (!ok) {
        if (automatic) {
          setAutomaticSwitchFailed(true);
        }
        showErrorAlert(ErrorConstants.FAILED_TO_SYNC);
        return;
      }
      switched = true;
      dispatch(approveSync(email));
      setLoadingProgress(true);
      if (mode === 'accountSwitch') {
        onAccountSwitched?.();
      }
      // B's saved data replaces A's immediately, then a cloud refresh follows.
      await onForeground();
    } finally {
      // Set together so React batches them into ONE render: loading gives way
      // to the confirmation with no frame in between.
      if (switched && previousAccount) {
        setSwitchedFrom(previousAccount);
      }
      setLoadingProgress(false);
      setBusy(null);
    }
  };

  const associate = useCallback(
    async (silent: boolean) => {
      if (!email) {
        return;
      }
      // `silent` is the automatic association of an empty device — the user was
      // never shown a prompt, so there is no click to record.
      if (!silent) {
        trackEvent('SyncAssociate', 'click', 'link device data to account');
      }
      setBusy('sync');
      const ok = await runConfirmedAccountSync(store, email);
      if (ok) {
        dispatch(approveSync(email));
        // Succeeded: this device is connected, so the dialog may speak again if
        // it ever legitimately needs to.
        silentAssociationPending.current = null;
        // Pull once more before releasing the busy state. Home's focus effect
        // does NOT re-fire when the user was already standing on Home as they
        // signed in, so nothing else would fetch what another device synced
        // while this one was signed out — the list would sit stale until the
        // screen happened to be re-focused.
        setLoadingProgress(true);
        try {
          await onForeground();
        } finally {
          setLoadingProgress(false);
          setBusy(null);
        }
        return;
      }
      setBusy(null);
      if (!silent) {
        showErrorAlert(ErrorConstants.FAILED_TO_SYNC);
        return;
      }
      // A silent association used to fail silently, on the reasoning that the
      // local data was untouched and still readable. That stopped being true
      // once logout began clearing this device: the account's copy is now the
      // ONLY copy, so a failed pull leaves an empty app and says nothing —
      // which reads as "my reading is gone" rather than "no connection".
      //
      // It also could not recover on its own. `silentAssociationTarget` is set
      // to `attemptKey` BEFORE the attempt, and that key only changes when
      // connectivity flips, so a slow-but-connected network got exactly one try
      // for the whole session. The dialog's Retry is what breaks that.
      //
      // But `false` does NOT mean "the restore failed". It means "this attempt
      // did not complete", and several of those reasons are entirely benign:
      // another attempt was already in flight (`inFlight`), the session changed
      // mid-request, or the account had already been associated by another
      // trigger. Reporting all of them as failure put "Unable to load your
      // progress" on screen next to the data it claimed could not be loaded.
      if (store.getState().sync.account === email) {
        silentAssociationPending.current = null;
        return;
      }
      setRestoreFailed(true);
    },
    [dispatch, email]
  );

  /**
   * Run the restore again, directly.
   *
   * Deliberately NOT by clearing `silentAssociationTarget` and waiting for the
   * effect: a ref is not a dependency, so nothing would re-run and the button
   * would do nothing at all. Leaving the target set also keeps the automatic
   * path honest — the effect still fires by itself when connectivity flips, and
   * this stays the one manual attempt the user asked for.
   */
  const retryRestore = useCallback(() => {
    if (!email) {
      return;
    }
    trackEvent('SyncAssociate', 'click', 'retry account restore');
    setRestoreFailed(false);
    setRestoreAttempt(0);
    exhaustionReported.current = false;
    silentAssociationPending.current = email;
    associate(true);
  }, [associate, email]);

  const dismissRestoreFailed = useCallback(() => setRestoreFailed(false), []);

  // Case 4: a provably backed-up account is replaced without asking.
  useEffect(() => {
    const target = `${account ?? ''}->${email ?? ''}`;
    if (
      mode === 'accountSwitch' &&
      isAccountSwitch &&
      !accountSwitchNeedsChoice &&
      !recoveryNeeded &&
      !automaticSwitchFailed &&
      !syncDeferredOffline &&
      isOnline &&
      automaticSwitchTarget.current !== target &&
      !syncing
    ) {
      automaticSwitchTarget.current = target;
      completeAccountSwitch(false, true);
    }
    // The callback reads these same guarded values. Keeping it out of the list
    // avoids restarting the switch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    account,
    email,
    isAccountSwitch,
    accountSwitchNeedsChoice,
    recoveryNeeded,
    automaticSwitchFailed,
    syncDeferredOffline,
    isOnline,
    syncing,
  ]);

  // Cases 1 & 2: associate an empty device without a prompt.
  //
  // The attempt is keyed by account AND connectivity, not by account alone. The
  // key used to be the email, set before the request and never cleared — so a
  // single failure (a cold start, a blip) meant the device was never associated
  // for the rest of the session. The user would then create a path and be asked
  // about "local progress" on what should have been a connected account.
  //
  // Keying on connectivity too gives a natural retry: coming back online is a
  // new opportunity, and the attempt runs again. It cannot spin, because the key
  // only changes when the network state actually changes.
  /**
   * Release the one-shot attempt guards when the session ends.
   *
   * These are refs on a component that never unmounts: `SyncPopup mode="unowned"`
   * lives in HomeScreen, and Home stays mounted while the drawer signs the user
   * out and back in. `logout()` resets the sync slice, but Redux is the only
   * thing it can reach — the refs below survived it.
   *
   * `attemptKey` is just email + connectivity, so signing back in as the SAME
   * account produced a key identical to the spent one. The effect below saw its
   * own completed attempt, declined to run, and the device was never associated:
   * no busy state, so no loading dialog, and no failure either, so nothing
   * retried and nothing was shown. The account simply stayed unconnected until
   * the app was restarted — which "fixed" it only because a fresh mount gives
   * fresh refs.
   */
  useEffect(() => {
    if (status !== 'signedIn' || !email) {
      silentAssociationTarget.current = null;
      silentAssociationPending.current = null;
      automaticSwitchTarget.current = null;
      exhaustionReported.current = false;
      setRestoreFailed(false);
      setRestoreAttempt(0);
    }
  }, [status, email]);

  const attemptKey = `${email ?? ''}:${isOnline ? 'online' : 'offline'}`;
  useEffect(() => {
    if (canAssociateSilently && silentAssociationTarget.current !== attemptKey && !syncing) {
      silentAssociationTarget.current = attemptKey;
      silentAssociationPending.current = email;
      associate(true);
    }
  }, [canAssociateSilently, attemptKey, syncing, associate, email]);

  /**
   * Retract the failure notice the moment the account is genuinely associated.
   *
   * The check inside `associate` catches an attempt that was rejected because
   * the work was already DONE. This catches the other order: an attempt rejected
   * because the work was still RUNNING, which returns `false` while `account` is
   * legitimately not set yet — and is then set a moment later when the attempt
   * that won actually lands. Without this, that race left a stale "Unable to
   * load your progress" sitting on top of freshly restored reading.
   */
  useEffect(() => {
    if (account !== null && account === email) {
      setRestoreFailed(false);
      setRestoreAttempt(0);
      exhaustionReported.current = false;
    }
  }, [account, email]);

  /**
   * Keep retrying a failed restore on its own, until it lands.
   *
   * The automatic trigger is `attemptKey`, and it only changes when NetInfo
   * reports a connectivity EDGE. It frequently reports none: `reachabilityLong
   * Timeout` is 60 s, so a connection that drops and comes back inside that
   * window leaves `isOnline` true the whole time. The key never changes, the
   * effect never re-runs, and the restore waits for a manual Retry the user has
   * no reason to expect — on a device cleared by logout, staring at an empty app.
   *
   * Self-limiting rather than a poll: it exists only while a restore is still
   * owed, and the effect above tears it down the moment the account associates.
   * It also stays out of the way while an attempt is already running, so it can
   * never stack requests on a slow connection.
   */
  useEffect(() => {
    if (restoreFailed && restoreAttempt >= MAX_RESTORE_RETRIES && !exhaustionReported.current) {
      // The only signal that this happened at all.
      //
      // `runConfirmedAccountSync` reports just its `catch`; the guard and
      // error-response paths return false silently. So a user left staring at an
      // empty app — on a device whose local copy logout deleted — produced no
      // Crashlytics event whatsoever. Reported once, after the retries are spent,
      // rather than per attempt: the point is "this device never recovered", and
      // per-attempt reporting is what made an unbounded retry a flood.
      exhaustionReported.current = true;
      recordError(
        new Error('account restore gave up after exhausting automatic retries'),
        'syncPopup: restore unrecoverable'
      );
    }
    if (!restoreFailed || !email || !isOnline || syncing || restoreAttempt >= MAX_RESTORE_RETRIES) {
      return;
    }
    // Backing off rather than a fixed beat: the first retry covers a connection
    // that blipped, the later ones a server that needs a moment, and the gap
    // grows instead of hammering something already struggling.
    const timer = setTimeout(() => {
      setRestoreAttempt((attempt) => attempt + 1);
      silentAssociationPending.current = email;
      associate(true);
    }, RESTORE_RETRY_MS * 2 ** restoreAttempt);
    return () => clearTimeout(timer);
  }, [restoreFailed, email, isOnline, syncing, associate, restoreAttempt]);

  // `Dialog` is memoised, so an inline arrow here would be a fresh prop on every
  // render and defeat the memo. Setter identity is stable, so these are too.
  const dismissSwitchedNotice = useCallback(() => setSwitchedFrom(null), []);
  const continueOffline = useCallback(() => setSyncDeferredOffline(true), []);
  // Guarded like the Cancel button beside it. The button is `disabled={syncing}`,
  // but the Android back gesture reaches this directly — without the guard it
  // closed the dialog while `discardLocalDataAndSync` was still deleting, so the
  // user was returned to the previous screen mid-wipe with no way to see how it
  // ended.
  const cancelDiscardConfirm = useCallback(() => {
    if (syncing) {
      return;
    }
    setConfirmingDiscard(false);
  }, [syncing]);

  const onDiscardConfirmed = async () => {
    if (!email || syncing) {
      return;
    }
    setBusy('discard');
    const ok = await discardLocalDataAndSync(store, email);
    setBusy(null);
    setConfirmingDiscard(false);
    if (ok) {
      dispatch(approveSync(email));
    } else {
      showErrorAlert(ErrorConstants.FAILED_TO_SYNC);
    }
  };

  const name = firstname?.trim() || email || '';

  // A silent restore in flight is the account's reading arriving, which is worth
  // saying out loud: on a device cleared by logout there is nothing on screen
  // yet, so an unexplained wait looks like an empty app. The prompted
  // association is excluded — its own button already shows a spinner, and a
  // modal on top of that would be the same news twice.
  const restoring = associating && silentAssociationPending.current !== null;
  if (loadingProgress || restoring) {
    return (
      <Dialog visible onRequestClose={ignoreRequestClose}>
        <View style={styles.loadingState} accessibilityLabel={Constants.LOADING_PROGRESS}>
          <ActivityIndicator size="large" color="#11336A" />
          <Text style={styles.message}>{Constants.LOADING_PROGRESS}</Text>
        </View>
      </Dialog>
    );
  }

  // --- A restore that could not reach the account ---------------------------
  // Deliberately ahead of every other branch. This device is empty, so none of
  // the ownership dialogs below can fire — their conditions all need either an
  // owner or local data — and without this the user would be left on a blank
  // Home with no explanation of where their reading went.
  //
  // `!signingIn` matters as much as the rest: the sign-in notice is still up
  // during the first attempt, and a failure dialog under a "Signing you in…"
  // banner tells the user two opposite things at once. Holding it until the
  // sign-in settles also gives the association a chance to land on its own, in
  // which case the effect above retracts this entirely and nothing is shown.
  if (restoreFailed && !signingIn && status === 'signedIn' && !!email) {
    return (
      <Dialog visible onRequestClose={dismissRestoreFailed}>
        <Text style={styles.title}>{Constants.RESTORE_FAILED_TITLE}</Text>
        <Text style={styles.message}>
          {isOnline ? Constants.RESTORE_FAILED_MESSAGE : Constants.RESTORE_OFFLINE_MESSAGE}
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={retryRestore}
            disabled={syncing}
            accessibilityRole="button"
            accessibilityLabel={Constants.RETRY}
          >
            <ActionLabel
              running={busy === 'sync'}
              idle={Constants.RETRY}
              textStyle={styles.primaryText}
              spinnerColor="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
        {/*
          Never a dead end. The downloaded database still works offline, so a
          user with no connection must be able to leave this and keep reading —
          signing in again, or a later retry, still restores the account.
        */}
        <View style={styles.links}>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={dismissRestoreFailed}
            disabled={syncing}
            accessibilityRole="button"
            accessibilityLabel={Constants.CONTINUE_OFFLINE}
          >
            <Text style={styles.linkText}>{Constants.CONTINUE_OFFLINE}</Text>
          </TouchableOpacity>
        </View>
      </Dialog>
    );
  }

  // --- Offline: never trap the user behind a decision that needs the server --
  const needsSyncDecision =
    (mode === 'unowned' && isVisible) ||
    (mode === 'accountSwitch' && isAccountSwitch && !syncing && !syncDeferredOffline);
  if (needsSyncDecision && !isOnline) {
    return (
      <Dialog visible onRequestClose={continueOffline}>
        {/*
          The offline wording, not the unavailable one. This branch is guarded on
          `!isOnline`, so the connection genuinely is the problem and checking it
          is the fix — unlike `SyncUnavailablePopup`, where no server is
          configured and that advice would send the user chasing nothing.
        */}
        <Text style={styles.title}>{Constants.SYNC_OFFLINE_TITLE}</Text>
        <Text style={styles.message}>{Constants.SYNC_OFFLINE_MESSAGE}</Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={continueOffline}
            accessibilityRole="button"
            accessibilityLabel={Constants.CONTINUE_OFFLINE}
          >
            <Text style={styles.primaryText}>{Constants.CONTINUE_OFFLINE}</Text>
          </TouchableOpacity>
        </View>
      </Dialog>
    );
  }

  // --- Case 5: the previous account has work the server has never seen -------
  // Signing out must dismiss this. `auth.email` clears before `sync.account`
  // does, so the switch condition alone stays true after logout and would pin
  // the dialog on screen forever — making Logout look broken.
  // The switch is done. Hold the explanation until the user dismisses it — a
  // silent switch is exactly the moment they need to be told their other
  // account's reading was not lost, and that message used to flash past.
  if (mode === 'accountSwitch' && switchedFrom && status === 'signedIn' && !!email) {
    return (
      <Dialog visible onRequestClose={dismissSwitchedNotice}>
        <Text style={styles.title}>{Constants.SWITCHED_ACCOUNT_TITLE}</Text>
        <Text style={styles.message}>
          <Text style={styles.strong}>{switchedFrom}</Text>
          {`'s progress is saved on this device and comes back when you sign in as that account.`}
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setSwitchedFrom(null)}
            accessibilityRole="button"
            accessibilityLabel={Constants.OK}
          >
            <Text style={styles.primaryText}>{Constants.OK}</Text>
          </TouchableOpacity>
        </View>
      </Dialog>
    );
  }

  // A switch that needs no decision has nothing to say while it runs. Showing
  // "Switching account…" and then the loading dialog is two waiting screens back
  // to back, for an account whose reading is already safely backed up. Render
  // the loading state directly so the whole thing reads as one step, ending in
  // the explanation of where that account's reading went.
  const switchNeedsNoDecision =
    mode === 'accountSwitch' &&
    (isAccountSwitch || syncing) &&
    status === 'signedIn' &&
    !!email &&
    !accountSwitchNeedsChoice &&
    !automaticSwitchFailed &&
    !recoveryNeeded &&
    !syncDeferredOffline &&
    isOnline;
  if (switchNeedsNoDecision) {
    return (
      <Dialog visible onRequestClose={ignoreRequestClose}>
        <View style={styles.loadingState} accessibilityLabel={Constants.LOADING_PROGRESS}>
          <ActivityIndicator size="large" color="#11336A" />
          <Text style={styles.message}>{Constants.LOADING_PROGRESS}</Text>
        </View>
      </Dialog>
    );
  }

  // `|| syncing` is what removes the flash. `switchAccountData` sets the account
  // to B, so `isAccountSwitch` goes false the moment it succeeds — closing this
  // dialog for one render before the loading dialog replaced it. Staying up
  // while the switch is still running keeps the sequence continuous, and keeps
  // the per-button progress and the Logout escape available throughout.
  if (
    mode === 'accountSwitch' &&
    (isAccountSwitch || syncing) &&
    status === 'signedIn' &&
    !!email &&
    !syncDeferredOffline
  ) {
    const blockedByRecovery = recoveryNeeded;
    // Title and body must describe the SAME state. A silent switch showing
    // "Unsynced progress found" tells the user their progress is at risk when
    // nothing is wrong.
    // Emails are the two things the user must actually tell apart here, so they
    // are the only emphasised words. Each account is named ONCE — repeating a
    // long address three times in four lines is what made this read as a wall of
    // text rather than a question.
    const who = <Text style={styles.strong}>{account}</Text>;
    const signedIn = <Text style={styles.strong}>{email}</Text>;

    const switchContent = () => {
      if (blockedByRecovery) {
        return {
          title: Constants.ACCOUNT_SWITCH_BLOCKED_TITLE,
          message: (
            <>
              Progress for {who} is on this device, but we could not confirm it is backed up. Please
              sign in as that account first.
            </>
          ),
        };
      }
      if (accountSwitchNeedsChoice) {
        return {
          title: Constants.ACCOUNT_SWITCH_TITLE,
          message: (
            <>
              {who} has progress on this device that was never saved to their account. Keep it for
              them, or add a copy to {signedIn}?
            </>
          ),
        };
      }
      if (automaticSwitchFailed) {
        return {
          title: Constants.ACCOUNT_SWITCH_FAILED_TITLE,
          message: (
            <>
              Progress for {who} is safe, but this device could not switch to {signedIn}. Please try
              again.
            </>
          ),
        };
      }
      return {
        title: Constants.SWITCHING_ACCOUNT_TITLE,
        message: (
          <>Progress for {who} stays on this device and returns when you sign in as that account.</>
        ),
      };
    };
    const { title, message } = switchContent();

    return (
      <Dialog visible onRequestClose={ignoreRequestClose}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>

        {accountSwitchNeedsChoice && !blockedByRecovery ? (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => completeAccountSwitch(true)}
              disabled={syncing}
              accessibilityRole="button"
              accessibilityLabel={`Add a copy to ${email}`}
            >
              <ActionLabel
                running={busy === 'addCopy'}
                idle={Constants.ADD_COPY_TO_ACCOUNT}
                textStyle={styles.secondaryText}
                spinnerColor="#7F8C8D"
              />
            </TouchableOpacity>
            {/* Keeping A's work is the safe default, so it gets the primary slot. */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => completeAccountSwitch(false)}
              disabled={syncing}
              accessibilityRole="button"
              accessibilityLabel={`Keep it safe for ${account}`}
            >
              <ActionLabel
                running={busy === 'keepForPrevious'}
                idle={Constants.KEEP_FOR_PREVIOUS}
                textStyle={styles.primaryText}
                spinnerColor="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
        ) : null}

        {automaticSwitchFailed && !accountSwitchNeedsChoice ? (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => completeAccountSwitch(false)}
              disabled={syncing}
              accessibilityRole="button"
              accessibilityLabel={`Continue as ${email}`}
            >
              <ActionLabel
                running={busy === 'keepForPrevious'}
                idle="Try again"
                textStyle={styles.primaryText}
                spinnerColor="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.links}>
          {/*
            Never disabled. This dialog cannot be dismissed any other way, so if a
            switch hangs or keeps failing, disabling Logout while `syncing` is
            true traps the user in a modal with no way out.

            Deliberately the plain `logout()`, NOT the drawer's clear-then-logout.
            The data on screen belongs to the previous account and its ownership
            is exactly what is still unresolved here — often because it is not
            backed up, which is why this dialog is up at all. Clearing on the way
            out would delete it while answering that question by force.
          */}
          <TouchableOpacity
            style={styles.linkButton}
            onPress={async () => {
              await logout();
            }}
            accessibilityRole="button"
            accessibilityLabel={Constants.LOGOUT}
          >
            <Text style={styles.destructiveLinkText}>{Constants.LOGOUT}</Text>
          </TouchableOpacity>
        </View>
      </Dialog>
    );
  }

  // --- Case 3 → Discard confirmation ----------------------------------------
  if (confirmingDiscard) {
    return (
      <Dialog visible onRequestClose={cancelDiscardConfirm}>
        <Text style={styles.title}>{Constants.DISCARD_CONFIRM_TITLE}</Text>
        <Text style={styles.message}>{Constants.DISCARD_CONFIRM_MESSAGE}</Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setConfirmingDiscard(false)}
            disabled={syncing}
            accessibilityRole="button"
            accessibilityLabel={Constants.CANCEL}
          >
            <Text style={styles.secondaryText}>{Constants.CANCEL}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.destructiveButton}
            onPress={onDiscardConfirmed}
            disabled={syncing}
            accessibilityRole="button"
            accessibilityLabel={Constants.DISCARD_CONFIRM_ACTION}
          >
            <ActionLabel
              running={busy === 'discard'}
              idle={Constants.DISCARD_CONFIRM_ACTION}
              runningLabel={Constants.DISCARDING}
              textStyle={styles.primaryText}
              spinnerColor="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      </Dialog>
    );
  }

  // --- Case 3: unowned progress exists and an account just signed in --------
  return (
    /*
      Deliberately not dismissible. This is a fork in the data, not a prompt:
      the progress on this device either joins the account or it does not, and
      both answers are below. The "Not now" button that used to sit here only
      called `declineSync`, which associated nothing and pulled nothing — so the
      user ended up signed in while the account's own progress stayed invisible,
      and `syncPopupAnswered` meant they were never asked again. "Later" was
      really "never", with the account's history hidden behind it.
    */
    <Dialog visible={mode === 'unowned' && isVisible} onRequestClose={noop}>
      <Text style={styles.title}>
        {Constants.WELCOME}
        {name ? `, ${name}` : ''}!
      </Text>
      <Text style={styles.message}>
        {`This device has reading progress that isn’t saved to any account. Add it to ${email}?`}
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => associate(false)}
          disabled={syncing}
          accessibilityRole="button"
          accessibilityLabel={Constants.SYNC_LOCAL_ACTION}
        >
          <ActionLabel
            running={busy === 'sync'}
            idle={Constants.SYNC_LOCAL_ACTION}
            textStyle={styles.primaryText}
            spinnerColor="#FFFFFF"
          />
        </TouchableOpacity>
      </View>
      {/*
        Two actions only, and no Logout here. This progress belongs to nobody
        yet, so signing out resolves nothing — it just leaves the same question
        waiting at the next login. Logout stays on the account-switch dialog,
        where "wrong account" is a real answer.
      */}
      <View style={styles.links}>
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => setConfirmingDiscard(true)}
          disabled={syncing}
          accessibilityRole="button"
          accessibilityLabel={Constants.DISCARD_LOCAL_LINK}
        >
          <Text style={styles.destructiveLinkText}>{Constants.DISCARD_LOCAL_LINK}</Text>
        </TouchableOpacity>
      </View>
    </Dialog>
  );
};

export const SyncPopup = React.memo(SyncPopupComponent);
