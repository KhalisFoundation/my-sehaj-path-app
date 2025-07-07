import NetInfo from '@react-native-community/netinfo';
import { useState, useEffect } from 'react';

export const useInternet = () => {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  const updateOnlineStatus = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      const isConnected = Boolean(netInfo.isConnected && netInfo.isInternetReachable);
      setIsOnline(isConnected);
      return isConnected;
    } catch (error) {
      console.error('Error checking network status:', error);
      setIsOnline(false);
      return false;
    }
  };

  const checkNetwork = async () => {
    try {
      const isConnected = await updateOnlineStatus();
      return isConnected;
    } catch (error) {
      console.error('Error in checkNetwork:', error);
      return false;
    }
  };

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isConnected = Boolean(state.isConnected && state.isInternetReachable);
      setIsOnline(isConnected);
    });

    updateOnlineStatus();

    return () => unsubscribe();
  }, []);

  return { checkNetwork, isOnline, updateOnlineStatus };
};
