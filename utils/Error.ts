import { Alert, AlertButton } from 'react-native';

export const showErrorAlert = (
  errorMessage: string,
  onReload?: () => void,
  reloadButtonText: string = 'Reload Screen'
) => {
  const buttons: AlertButton[] = [
    {
      text: 'OK',
      style: 'default',
    },
  ];

  if (onReload) {
    buttons.push({
      text: reloadButtonText,
      onPress: onReload,
      style: 'default',
    });
  }

  Alert.alert('Error', `${errorMessage}\n\n.`, buttons);
};
