import NetInfo from '@react-native-community/netinfo';

/**
 * Imperative one-off connectivity probe.
 *
 * Reactive online/offline state now comes from the store
 * (`useAppSelector((state) => state.network.isOnline)`), fed by the single
 * NetInfo listener in App.tsx. This hook no longer holds state or subscribes,
 * so screens no longer create a listener each.
 */
export const useInternet = () => {
  const checkNetwork = async (): Promise<boolean> => {
    try {
      const state = await NetInfo.fetch();
      return Boolean(state.isConnected);
    } catch {
      return false;
    }
  };

  return { checkNetwork };
};
