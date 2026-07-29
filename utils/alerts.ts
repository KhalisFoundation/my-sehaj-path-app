import { Alert } from 'react-native';

interface SaveProgressAlertProps {
  onSaveAndGoBack: () => void;
  onGoBackWithoutSaving: () => void;
}

export const showSaveProgressAlert = ({
  onSaveAndGoBack,
  onGoBackWithoutSaving,
}: SaveProgressAlertProps) => {
  Alert.alert(
    'Save Progress?',
    'You have navigated to a different ang. Do you want to save your current progress or go back without saving?',
    [
      {
        text: 'Save & Go Back',
        onPress: onSaveAndGoBack,
      },
      {
        text: 'Go Back Without Saving',
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
