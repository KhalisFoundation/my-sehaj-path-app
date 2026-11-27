import React from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from './AppText';
import { Dialog } from './Dialog';
import { Constants } from '@constants';
import { DialogStyles as styles } from '@styles';

interface LoginRequiredDialogProps {
  visible: boolean;
  onClose: () => void;
  onLogin: () => void;
  loading?: boolean;
  error?: string | null;
  title?: string;
  message?: string;
}

/** Shared login prompt for actions that require an account. */
export const LoginRequiredDialog = ({
  visible,
  onClose,
  onLogin,
  loading = false,
  error = null,
  title = Constants.INVITE_LOGIN_TITLE,
  message = Constants.INVITE_LOGIN_REQUIRED,
}: LoginRequiredDialogProps) => (
  <Dialog
    visible={visible}
    onRequestClose={onClose}
    backdropStyle={styles.compactBackdrop}
    cardStyle={styles.compactCard}
  >
    <Text style={[styles.title, styles.compactTitle]}>{title}</Text>
    <Text style={[styles.message, styles.compactMessage]}>{message}</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <View style={[styles.actions, styles.compactActions]}>
      <TouchableOpacity
        style={[styles.secondaryButton, styles.compactSecondaryButton]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={Constants.CANCEL}
      >
        <Text style={styles.secondaryText}>{Constants.CANCEL}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.primaryButton, styles.compactActionButton]}
        onPress={onLogin}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={Constants.LOGIN}
      >
        {loading ? (
          <View style={styles.busyLabel}>
            <ActivityIndicator color="#FFFFFF" size="small" />
            <Text style={styles.primaryText}>{Constants.LOGGING_IN}</Text>
          </View>
        ) : (
          <Text style={styles.primaryText}>{Constants.LOGIN}</Text>
        )}
      </TouchableOpacity>
    </View>
  </Dialog>
);
