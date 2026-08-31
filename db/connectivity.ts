import NetInfo from '@react-native-community/netinfo';
import { store } from '../store';

/**
 * Is the device online RIGHT NOW — asked of NetInfo, not of the store.
 *
 * `network.isOnline` is a cached NetInfo reading, and it is wrong at exactly the
 * moments the database code needs it most: a connection that has just dropped is
 * still `true` in the store until the listener delivers the edge, which is the
 * same instant an in-flight download is failing *because* of that drop.
 *
 * `isInternetReachable` is `null` while reachability is still being determined,
 * which is common in the first moments after a reconnect. Treating unknown as
 * offline would suppress work that should run, so it falls back to `isConnected`
 * rather than to `false`.
 *
 * Short-circuits when the store already says offline (the listener knows; there
 * is nothing to verify), and falls back to the store if the native call fails,
 * so NetInfo can never become a way for the database to stop working.
 *
 * Lives here rather than in `provisionDatabase` so `downloadDatabase` can use it
 * too: provisioning imports the downloader, so the reverse would be a cycle.
 */
export const isOnlineNow = async (): Promise<boolean> => {
  if (!store.getState().network.isOnline) {
    return false;
  }
  try {
    const state = await NetInfo.fetch();
    return Boolean(state.isConnected && (state.isInternetReachable ?? state.isConnected));
  } catch {
    return store.getState().network.isOnline;
  }
};
