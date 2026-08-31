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
 * is nothing to verify), and falls back to the store if the native call fails or
 * takes too long, so NetInfo can never become a way for the database to stop
 * working.
 *
 * The timeout is not defensive padding. This runs on the download's FAILURE path,
 * and that path holds the single-flight lock: if it never settles, the `finally`
 * that clears `activeDownload` never runs, every later foreground and reconnect
 * joins a dead promise, and the database can never download again until the app
 * is restarted. `NetInfo.fetch()` is a bridge call with no timeout of its own, so
 * bounding it here is what keeps one wedged native call from disabling the
 * offline database for the rest of the process.
 *
 * Lives here rather than in `provisionDatabase` so `downloadDatabase` can use it
 * too: provisioning imports the downloader, so the reverse would be a cycle.
 */
const NETINFO_TIMEOUT_MS = 3_000;

export const isOnlineNow = async (): Promise<boolean> => {
  const cached = store.getState().network.isOnline;
  if (!cached) {
    return false;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Resolving to the cached value on timeout rather than rejecting keeps the
    // unknown case behaving exactly like the catch below.
    const timeout = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(store.getState().network.isOnline), NETINFO_TIMEOUT_MS);
    });
    const live = NetInfo.fetch().then((state) =>
      Boolean(state.isConnected && (state.isInternetReachable ?? state.isConnected))
    );
    return await Promise.race([live, timeout]);
  } catch {
    return store.getState().network.isOnline;
  } finally {
    // Without this the timer keeps the app awake for the rest of the budget on
    // every successful check.
    clearTimeout(timer);
  }
};
