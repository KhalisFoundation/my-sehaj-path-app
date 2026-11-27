import NetInfo from '@react-native-community/netinfo';

const NETWORK_CHECK_TIMEOUT_MS = 500;

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
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      const timeout = new Promise<boolean>((resolve) => {
        timeoutId = setTimeout(() => resolve(false), NETWORK_CHECK_TIMEOUT_MS);
      });
      const networkState = NetInfo.fetch().then((state) => Boolean(state.isConnected));

      return await Promise.race([networkState, timeout]);
    } catch {
      return false;
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  };

  return { checkNetwork };
};
