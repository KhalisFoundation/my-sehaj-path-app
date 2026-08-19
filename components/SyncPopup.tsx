import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Constants, ErrorConstants } from '@constants';
import { logout } from '@auth';
import { showErrorAlert, trackEvent } from '@utils';
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
  /** The account just put away — keeps the closing notice on screen to be read. */
  const [switchedFrom, setSwitchedFrom] = useState<string | null>(null);
  const automaticSwitchTarget = useRef<string | null>(null);
  const silentAssociationTarget = useRef<string | null>(null);

  const status = useAppSelector((state) => state.auth.status);
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
      state.sync.lastSyncedAt > 0 &&
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
        deviceHasData &&
        // A silent association may be in flight for a device that was empty a
        // moment ago. Creating a path during that window flips `deviceHasData`
        // and would ask "what about your local progress?" about a path the user
        // just made, while it is already being connected.
        !associating);

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
      // A silent association that fails must stay silent: the data is untouched
      // and still readable, and the next foreground or reconnect retries it.
      if (!silent) {
        showErrorAlert(ErrorConstants.FAILED_TO_SYNC);
      }
    },
    [dispatch, email]
  );

  // Case 4: a provably backed-up account is replaced without asking.
  useEffect(() => {
    const target = `${account ?? ''}->${email ?? ''}`;
    if (
      mode === 'accountSwitch' &&
      isAccountSwitch &&
      !accountSwitchNeedsChoice &&
      !recoveryNeeded &&
      !automaticSwitchFailed &&
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
  const attemptKey = `${email ?? ''}:${isOnline ? 'online' : 'offline'}`;
  useEffect(() => {
    if (canAssociateSilently && silentAssociationTarget.current !== attemptKey && !syncing) {
      silentAssociationTarget.current = attemptKey;
      associate(true);
    }
  }, [canAssociateSilently, attemptKey, syncing, associate]);

  // `Dialog` is memoised, so an inline arrow here would be a fresh prop on every
  // render and defeat the memo. Setter identity is stable, so these are too.
  const dismissSwitchedNotice = useCallback(() => setSwitchedFrom(null), []);
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

  if (loadingProgress) {
    return (
      <Dialog visible onRequestClose={ignoreRequestClose}>
        <View style={styles.loadingState} accessibilityLabel={Constants.LOADING_PROGRESS}>
          <ActivityIndicator size="large" color="#11336A" />
          <Text style={styles.message}>{Constants.LOADING_PROGRESS}</Text>
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
    !recoveryNeeded;
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
    !!email
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
    <Dialog visible={isVisible} onRequestClose={noop}>
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
        Three actions only, and no Logout here. This progress belongs to nobody
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
