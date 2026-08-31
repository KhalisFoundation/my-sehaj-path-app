import { store } from '../store';

/**
 * A no-content endpoint used only to ask "does this device have working
 * internet, right now?".
 *
 * `generate_204` returns HTTP 204 with an empty body. It sends nothing about the
 * user, carries no cookies, and is the same endpoint Android itself uses for
 * captive-portal detection, so it is already being contacted by the OS on every
 * network change. Swap it for a Khalis-hosted equivalent if that is preferred —
 * the only requirements are that it is tiny, highly available, and NOT one of
 * our own database hosts (probing the host that just failed cannot tell "the
 * user is offline" from "that host is down").
 */
const PROBE_URL = 'https://clients3.google.com/generate_204';

/**
 * Long enough for a slow-but-working connection to answer, short enough that the
 * download's failure path is never held up for meaningfully long. This runs
 * while the single-flight download lock is held, so it must always settle.
 */
const PROBE_TIMEOUT_MS = 3_000;

/**
 * Is the device online RIGHT NOW — established by actually using the network.
 *
 * NetInfo cannot answer this, and three attempts proved it on a real device:
 *
 * 1. `network.isOnline` in the store is a cached NetInfo reading, so it still
 *    said `true` for a connection that had already gone.
 * 2. `NetInfo.fetch()` returned the same stale answer — its state, not a fresh
 *    check.
 * 3. `NetInfo.refresh()` with `useNativeReachability: false` resolved in the
 *    SAME MILLISECOND as the caller, which no real HTTP probe can do: it handed
 *    back cache too. And `isConnected` comes from Android's ConnectivityManager
 *    whatever NetInfo is configured to do, which lags the socket being cut.
 *
 * Measured each time: cellular switched off, the download's socket cut instantly
 * with `Software caused connection abort`, and NetInfo still reporting
 * `isConnected=true isInternetReachable=true` milliseconds later.
 *
 * So this stops asking and tests instead. A HEAD request either completes or it
 * does not, and that is the same question the download itself was asking — which
 * makes it the only answer that cannot be stale.
 *
 * The store is still consulted first, purely as a fast negative: when the
 * listener has already seen the drop there is nothing to verify, and we skip the
 * request. It is never trusted for a positive.
 *
 * Any failure — timeout, DNS, abort, non-2xx/3xx — is treated as offline. That
 * is the point: if a small HEAD to a highly available endpoint cannot complete,
 * this device does not have usable internet, whatever the OS believes.
 *
 * Lives here rather than in `provisionDatabase` so `downloadDatabase` can use it
 * too: provisioning imports the downloader, so the reverse would be a cycle.
 */
export const isOnlineNow = async (): Promise<boolean> => {
  if (!store.getState().network.isOnline) {
    return false;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(PROBE_URL, {
      method: 'HEAD',
      // A cached 204 from before the connection dropped would defeat the whole
      // purpose of asking.
      cache: 'no-store',
      signal: controller.signal,
    });
    return response.status >= 200 && response.status < 400;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};
