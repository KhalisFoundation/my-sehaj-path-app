import NetInfo from '@react-native-community/netinfo';
import { useState, useEffect } from 'react';

export const useInternet = () => {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  const updateOnlineStatus = () => {
    return new Promise<boolean>((resolve) => {
      NetInfo.fetch()
        .then((netInfo) => {
          const isConnected = Boolean(netInfo.isConnected);
          setIsOnline(isConnected);
          resolve(isConnected);
        })
        .catch((error) => {
          console.error('Error checking network status:', error);
          setIsOnline(false);
          resolve(false);
        });
    });
  };

  const checkNetwork = () => {
    return new Promise<boolean>((resolve) => {
      if (isOnline) {
        resolve(true);
        return;
      }
      const timeout = setTimeout(() => {
        resolve(false);
      }, 500);

      NetInfo.fetch()
        .then((netInfo) => {
          clearTimeout(timeout);
          const isConnected = Boolean(netInfo.isConnected);
          setIsOnline(isConnected);
          resolve(isConnected);
        })
        .catch((error) => {
          clearTimeout(timeout);
          console.error('Error in checkNetwork:', error);
          NetInfo.fetch()
            .then((netInfo) => {
              const fallbackConnected = Boolean(netInfo.isConnected);
              setIsOnline(fallbackConnected);
              resolve(fallbackConnected);
            })
            .catch(() => {
              resolve(false);
            });
        });
    });
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
