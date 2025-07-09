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
