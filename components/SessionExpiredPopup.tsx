import React, { useCallback } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Constants } from '@constants';
import { startLogin } from '@auth';
import { DialogStyles as styles } from '@styles';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { dismissSessionExpired, dismissSignInPopup } from '../store/slices/syncSlice';
import { writeSyncPrefs } from '../store/syncPrefs';
import { Dialog } from './Dialog';

const SessionExpiredPopupComponent = () => {
  const dispatch = useAppDispatch();
  const visible = useAppSelector((state) => state.sync.sessionExpired);

  const dismiss = useCallback(() => {
    dispatch(dismissSessionExpired());
    dispatch(dismissSignInPopup());
    writeSyncPrefs({ signInPopupDismissed: true });
  }, [dispatch]);

  const login = useCallback(() => {
    dismiss();
    startLogin();
  }, [dismiss]);

  return (
    <Dialog visible={visible} onRequestClose={dismiss}>
      <Text style={styles.title}>{Constants.SESSION_EXPIRED_TITLE}</Text>
      <Text style={styles.message}>{Constants.SESSION_EXPIRED_MESSAGE}</Text>
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
          onPress={login}
          accessibilityRole="button"
          accessibilityLabel={Constants.LOGIN}
        >
          <Text style={styles.primaryText}>{Constants.LOGIN}</Text>
        </TouchableOpacity>
      </View>
    </Dialog>
  );
};

export const SessionExpiredPopup = React.memo(SessionExpiredPopupComponent);
