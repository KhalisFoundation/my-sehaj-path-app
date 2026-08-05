import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Constants, ErrorConstants } from '@constants';
import { logout } from '@auth';
import { showErrorAlert } from '@utils';
import { DialogStyles as styles } from '@styles';
import { store } from '../store';
import {
  discardLocalDataAndSync,
  runConfirmedAccountSync,
  switchAccountData,
} from '../store/confirmedSync';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { approveSync, declineSync } from '../store/slices/syncSlice';
import { onForeground } from '../store/syncLifecycle';
import { hasLocalData } from '../store/syncWork';
import { Dialog } from './Dialog';

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
  textStyle,
  spinnerColor,
}: {
  running: boolean;
  idle: string;
  textStyle: object;
  spinnerColor: string;
}) =>
  running ? (
    <View style={styles.busyLabel}>
      <ActivityIndicator size="small" color={spinnerColor} />
      <Text style={textStyle}>{Constants.SYNCING}</Text>
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
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [automaticSwitchFailed, setAutomaticSwitchFailed] = useState(false);
  const automaticSwitchTarget = useRef<string | null>(null);
  const silentAssociationTarget = useRef<string | null>(null);

  const status = useAppSelector((state) => state.auth.status);
  const email = useAppSelector((state) => state.auth.email);
  const firstname = useAppSelector((state) => state.auth.firstname);
  const answered = useAppSelector((state) => state.sync.syncPopupAnswered);
  const account = useAppSelector((state) => state.sync.account);
  const recoveryNeeded = useAppSelector((state) => state.sync.recoveryNeeded);
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
      : account === null && !answered && !recoveryNeeded && deviceHasData);

  const completeAccountSwitch = async (addPreviousProgress: boolean, automatic = false) => {
    if (!email || syncing) {
      return;
    }
    setBusy(addPreviousProgress ? 'addCopy' : 'keepForPrevious');
    const ok = await switchAccountData(store, email, addPreviousProgress);
    if (!ok) {
      setBusy(null);
      if (automatic) {
        setAutomaticSwitchFailed(true);
      }
      showErrorAlert(ErrorConstants.FAILED_TO_SYNC);
      return;
    }
    dispatch(approveSync(email));
    // B's saved local data may replace A's visible data immediately, followed
    // by a cloud refresh. Keep that transition behind one clear loading dialog
    // rather than briefly showing an old screen plus the small sync notice.
    setLoadingProgress(true);
    try {
      if (mode === 'accountSwitch') {
        onAccountSwitched?.();
      }
      await onForeground();
    } finally {
      setLoadingProgress(false);
      setBusy(null);
    }
  };

  const associate = useCallback(
    async (silent: boolean) => {
      if (!email) {
        return;
      }
      setBusy('sync');
      const ok = await runConfirmedAccountSync(store, email);
      setBusy(null);
      if (ok) {
        dispatch(approveSync(email));
        return;
      }
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
  useEffect(() => {
    if (canAssociateSilently && silentAssociationTarget.current !== email && !syncing) {
      silentAssociationTarget.current = email;
      associate(true);
    }
  }, [canAssociateSilently, email, syncing, associate]);

  const onNotNow = useCallback(() => {
    dispatch(declineSync());
  }, [dispatch]);

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
  if (mode === 'accountSwitch' && isAccountSwitch && status === 'signedIn' && !!email) {
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
            onPress={() => logout()}
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
      <Dialog visible onRequestClose={() => setConfirmingDiscard(false)}>
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
    <Dialog visible={isVisible} onRequestClose={onNotNow}>
      <Text style={styles.title}>
        {Constants.WELCOME}
        {name ? `, ${name}` : ''}!
      </Text>
      <Text style={styles.message}>
        {`This device has reading progress that isn’t saved to any account. Add it to ${email}, or continue without syncing?`}
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onNotNow}
          disabled={syncing}
          accessibilityRole="button"
          accessibilityLabel={Constants.NOT_NOW}
        >
          <Text style={styles.secondaryText}>{Constants.NOT_NOW}</Text>
        </TouchableOpacity>
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
