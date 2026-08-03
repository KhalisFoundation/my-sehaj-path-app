import React, { useCallback } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Constants } from '@constants';
import { startLogin } from '@auth';
import { DialogStyles as styles } from '@styles';
import { writeSyncPrefs } from '../store/syncPrefs';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { dismissSignInPopup } from '../store/slices/syncSlice';
import { Dialog } from './Dialog';

/**
 * Signed-out "log in to save your progress" popup. Shown once after a fresh
 * install and again after each logout (re-armed on logout). Both choices mark it
 * dismissed so it won't nag until the next logout.
 */
const SignInPopupComponent = () => {
  const dispatch = useAppDispatch();
  const status = useAppSelector((state) => state.auth.status);
  const checked = useAppSelector((state) => state.sync.signInPopupChecked);
  const dismissed = useAppSelector((state) => state.sync.signInPopupDismissed);

  const isVisible = status === 'signedOut' && checked && !dismissed;

  const dismiss = useCallback(() => {
    dispatch(dismissSignInPopup());
    writeSyncPrefs({ signInPopupDismissed: true });
  }, [dispatch]);

  const onLogin = useCallback(() => {
    dismiss();
    startLogin();
  }, [dismiss]);

  return (
    <Dialog visible={isVisible} onRequestClose={dismiss}>
      <Text style={styles.title}>{Constants.LOGIN_SYNC_TITLE}</Text>
      <Text style={styles.message}>{Constants.LOGIN_SYNC_PROMPT}</Text>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel={Constants.NOT_NOW}
        >
          <Text style={styles.secondaryText}>{Constants.NOT_NOW}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onLogin}
          accessibilityRole="button"
          accessibilityLabel={Constants.LOGIN}
        >
          <Text style={styles.primaryText}>{Constants.LOGIN}</Text>
        </TouchableOpacity>
      </View>
    </Dialog>
  );
};

export const SignInPopup = React.memo(SignInPopupComponent);
