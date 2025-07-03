import { Alert } from 'react-native';

export const showErrorAlert = (errorMessage: string) => {
  Alert.alert('Error', `${errorMessage}\n\nPlease try again by opening the app.`, [
    {
      text: 'OK',
      style: 'default',
    },
  ]);
};
