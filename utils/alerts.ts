import { Alert } from 'react-native';

interface SaveProgressAlertProps {
  onSaveAndGoBack: () => void;
  onGoBackWithoutSaving: () => void;
  destinationLabel?: string;
}

export const showSaveProgressAlert = ({
  onSaveAndGoBack,
  onGoBackWithoutSaving,
  destinationLabel = 'Home',
}: SaveProgressAlertProps) => {
  Alert.alert(
    'Save Progress?',
    `You have navigated to a different ang. Do you want to save your current progress before opening ${destinationLabel}?`,
    [
      {
        text: `Save & Open ${destinationLabel}`,
        onPress: onSaveAndGoBack,
      },
      {
        text: `Open ${destinationLabel} Without Saving`,
        onPress: onGoBackWithoutSaving,
        style: 'destructive',
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]
  );
};

/**
 * Confirms an explicit sign-out before it runs. Logout ends the IdP session and
 * clears the local account, so it should not fire on a single accidental tap.
 */
export const showLogoutConfirmAlert = ({ onConfirm }: { onConfirm: () => void }) => {
  Alert.alert('Log out?', 'You will be signed out on this device.', [
    {
      text: 'Cancel',
      style: 'cancel',
    },
    {
      text: 'Log Out',
      onPress: onConfirm,
      style: 'destructive',
    },
  ]);
};

/**
 * Shown when the user is leaving the path screen but the position could not be
 * saved. We never trap the user: they can retry (stay) or leave anyway.
 */
export const showLeaveAnywayAlert = ({ onLeaveAnyway }: { onLeaveAnyway: () => void }) => {
  Alert.alert(
    "Couldn't save your progress",
    'We could not save your current reading position. You can try again, or leave anyway (your latest position may not be saved).',
    [
      {
        text: 'Try Again',
        style: 'cancel',
      },
      {
        text: 'Leave Anyway',
        onPress: onLeaveAnyway,
        style: 'destructive',
      },
    ]
  );
};
