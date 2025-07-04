import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';
import { useState } from 'react';
import { ErrorConstants } from '@constants';

export const useInternet = () => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const updateOnlineStatus = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      setIsOnline(netInfo.isConnected || false);
      return netInfo.isConnected;
    } catch (error) {
      setIsOnline(false);
      return false;
    }
  };
  const checkNetwork = async () => {
    try {
      const netInfo = await updateOnlineStatus();
      if (!netInfo) {
        Alert.alert(ErrorConstants.NO_INTERNET_TITLE, ErrorConstants.NO_INTERNET_MESSAGE, [
          {
            text: 'OK',
            onPress: () => {},
          },
        ]);
      }
    } catch (error) {
      Alert.alert(ErrorConstants.NETWORK_ERROR_TITLE, ErrorConstants.NETWORK_ERROR_MESSAGE, [
        {
          text: 'OK',
          onPress: () => {},
        },
      ]);
    }
  };
  return { checkNetwork, isOnline, updateOnlineStatus };
};
