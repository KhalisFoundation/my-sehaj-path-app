import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
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
import { Dialog } from './Dialog';

/**
 * Signed-in account-sync confirmation (Step 9). Shown for a claim / fresh-device /
 * switch — i.e. when the loaded data isn't already associated with the signed-in
 * account (`sync.account !== email`). A known account (case C) resumes silently,
 * so it never appears. Recovery mode has its own repair flow, so it's excluded
 * too. Nothing syncs until the user taps "Sync now".
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

const SyncPopupComponent = ({ mode = 'unowned', onAccountSwitched }: SyncPopupProps) => {
  const dispatch = useAppDispatch();
  const [syncing, setSyncing] = useState(false);
  const [automaticSwitchFailed, setAutomaticSwitchFailed] = useState(false);
  const automaticSwitchTarget = useRef<string | null>(null);
  const status = useAppSelector((state) => state.auth.status);
  const email = useAppSelector((state) => state.auth.email);
  const firstname = useAppSelector((state) => state.auth.firstname);
  const answered = useAppSelector((state) => state.sync.syncPopupAnswered);
  const account = useAppSelector((state) => state.sync.account);
  const recoveryNeeded = useAppSelector((state) => state.sync.recoveryNeeded);
  const hasLocalPaths = useAppSelector((state) => state.paths.paths.length > 0);
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
    (previousAccountHasUnsyncedData || (hasLocalPaths && !previousAccountIsFullySynced));
  const isVisible =
    status === 'signedIn' &&
    !!email &&
    (mode === 'accountSwitch' ? isAccountSwitch : account === null && !answered && !recoveryNeeded);

  const completeAccountSwitch = async (addPreviousProgress: boolean, automatic = false) => {
    if (!email || syncing) {
      return;
    }
    setSyncing(true);
    const ok = await switchAccountData(store, email, addPreviousProgress);
    setSyncing(false);
    if (!ok) {
      if (automatic) {
        setAutomaticSwitchFailed(true);
      }
      showErrorAlert(ErrorConstants.FAILED_TO_SYNC);
      return;
    }
    dispatch(approveSync(email));
    if (mode === 'accountSwitch') {
      onAccountSwitched?.();
    }
    onForeground();
  };

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

  const onSyncNow = async () => {
    if (!email || syncing) {
      return;
    }
    setSyncing(true);
    // Wait for the result: only close the popup on success. On failure (offline
    // or a server error) keep it open and alert, so the user can retry.
    const ok = await runConfirmedAccountSync(store, email);
    setSyncing(false);
    if (ok) {
      dispatch(approveSync(email));
    } else {
      showErrorAlert(ErrorConstants.FAILED_TO_SYNC);
    }
  };

  const onNotNow = useCallback(() => {
    dispatch(declineSync());
  }, [dispatch]);

  const onUseCloudData = async () => {
    if (!email || syncing) {
      return;
    }
    setSyncing(true);
    const ok = await discardLocalDataAndSync(store, email);
    setSyncing(false);
    if (ok) {
      dispatch(approveSync(email));
    } else {
      showErrorAlert(ErrorConstants.FAILED_TO_SYNC);
    }
  };

  const name = firstname?.trim() || email || '';
  let syncMessage = `${Constants.SIGNED_IN_AS} ${email}. ${Constants.SYNC_ACCOUNT_PROMPT}`;
  if (recoveryNeeded && isAccountSwitch) {
    syncMessage = `This device has progress for ${account}, but its backup status could not be verified. Please log in as that account first.`;
  } else if (previousAccountHasUnsyncedData) {
    syncMessage = `This device has unsynced progress saved for ${account}. Would you like to add a copy to ${email}, or keep it for ${account}?`;
  } else if (isAccountSwitch && !previousAccountIsFullySynced) {
    syncMessage = `This device has progress saved for ${account}, but its cloud backup could not be verified. Add a copy to ${email}, or keep it safely for ${account}.`;
  } else if (isAccountSwitch) {
    syncMessage = automaticSwitchFailed
      ? `Your previous progress is safe, but this device could not switch to ${email}. Please try again.`
      : `Switching to ${email}…`;
  } else if (account === null && hasLocalPaths) {
    syncMessage = `${Constants.SIGNED_IN_AS} ${email}. Sync these local paths to this account, or use this account's cloud data instead. Using cloud data deletes these local paths from this device.`;
  }

  return (
    <Dialog
      visible={isVisible}
      // A different signed-in account must not dismiss the guard and expose the
      // previous account's active dataset. It can sync/switch or log out.
      onRequestClose={mode === 'accountSwitch' ? ignoreRequestClose : onNotNow}
    >
      <Text style={styles.title}>
        {Constants.WELCOME}
        {name ? `, ${name}` : ''}!
      </Text>
      <Text style={styles.message}>{syncMessage}</Text>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={logout}
          disabled={syncing}
          accessibilityRole="button"
          accessibilityLabel={Constants.LOGOUT}
        >
          <Text style={styles.secondaryText}>{Constants.LOGOUT}</Text>
        </TouchableOpacity>
        {mode !== 'accountSwitch' ? (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onNotNow}
            disabled={syncing}
            accessibilityRole="button"
            accessibilityLabel={Constants.NOT_NOW}
          >
            <Text style={styles.secondaryText}>{Constants.NOT_NOW}</Text>
          </TouchableOpacity>
        ) : null}
        {mode === 'accountSwitch' && accountSwitchNeedsChoice && !recoveryNeeded ? (
          <>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => completeAccountSwitch(false)}
              disabled={syncing}
              accessibilityRole="button"
              accessibilityLabel={`Keep for ${account}`}
            >
              <Text style={styles.secondaryText}>Keep separate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => completeAccountSwitch(true)}
              disabled={syncing}
              accessibilityRole="button"
              accessibilityLabel={`Add to ${email}`}
            >
              <Text style={styles.primaryText}>
                {syncing ? Constants.SYNCING : 'Add to this account'}
              </Text>
            </TouchableOpacity>
          </>
        ) : null}
        {mode === 'accountSwitch' && automaticSwitchFailed ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => completeAccountSwitch(false)}
            disabled={syncing}
            accessibilityRole="button"
            accessibilityLabel={`Continue as ${email}`}
          >
            <Text style={styles.primaryText}>{syncing ? Constants.SYNCING : 'Continue'}</Text>
          </TouchableOpacity>
        ) : null}
        {mode !== 'accountSwitch' && (
          <>
            {account === null && hasLocalPaths ? (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onUseCloudData}
                disabled={syncing}
                accessibilityRole="button"
                accessibilityLabel="Use cloud data"
              >
                <Text style={styles.secondaryText}>Use cloud data</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onSyncNow}
              disabled={syncing}
              accessibilityRole="button"
              accessibilityLabel={Constants.SYNC_NOW}
            >
              <Text style={styles.primaryText}>
                {syncing ? Constants.SYNCING : Constants.SYNC_NOW}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Dialog>
  );
};

export const SyncPopup = React.memo(SyncPopupComponent);
