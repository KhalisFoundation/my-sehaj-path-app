import React from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from './AppText';
import { Dialog } from './Dialog';
import { Constants } from '@constants';
import { DialogStyles as styles } from '@styles';

interface SignInRequiredDialogProps {
  visible: boolean;
  onClose: () => void;
  onSignIn: () => void;
  loading?: boolean;
  error?: string | null;
  title?: string;
  message?: string;
}

/**
 * The shared sign-in prompt for actions that require an account.
 * Keeping this separate from the native Alert gives the prompt the same
 * typography, spacing, and sign-in action on iOS and Android.
 */
export const SignInRequiredDialog = ({
  visible,
  onClose,
  onSignIn,
  loading = false,
  error = null,
  title = Constants.INVITE_SIGN_IN_TITLE,
  message = Constants.INVITE_SIGN_IN_REQUIRED,
}: SignInRequiredDialogProps) => (
  <Dialog visible={visible} onRequestClose={onClose}>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.message}>{message}</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <View style={styles.actions}>
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={Constants.CANCEL}
      >
        <Text style={styles.secondaryText}>{Constants.CANCEL}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={onSignIn}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={Constants.LOGIN}
      >
        {loading ? (
          <View style={styles.busyLabel}>
            <ActivityIndicator color="#FFFFFF" size="small" />
            <Text style={styles.primaryText}>{Constants.SIGNING_IN}</Text>
          </View>
        ) : (
          <Text style={styles.primaryText}>{Constants.LOGIN}</Text>
        )}
      </TouchableOpacity>
    </View>
  </Dialog>
);
