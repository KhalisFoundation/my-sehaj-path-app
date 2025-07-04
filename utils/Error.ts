import { Alert } from 'react-native';

export const showErrorAlert = (
  errorMessage: string,
  onReload?: () => void,
  reloadButtonText: string = 'Reload Screen'
) => {
  Alert.alert('Error', `${errorMessage}\n\nPlease try again.`, [
    {
      text: 'OK',
      style: 'default',
    },
    {
      text: reloadButtonText,
      style: 'default',
      onPress: onReload,
    },
  ]);
};
