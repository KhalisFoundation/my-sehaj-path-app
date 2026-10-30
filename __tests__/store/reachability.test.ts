/**
 * How a NetInfo reading becomes `network.isOnline`.
 *
 * The rule lives in the slice so App.tsx and this test cannot drift. The
 * three-valued
 * `isInternetReachable` can be pinned down. Folding its `null` in with `&&`
 * made "not determined yet" mean offline, which — because the slice starts
 * optimistically online — meant the FIRST NetInfo event took the app offline
 * and nothing ever brought it back. `canSyncNow` requires `network.isOnline`,
 * so the only symptom was that sync silently never ran.
 */
import { isOnlineFrom } from '../../store/slices/networkSlice';

describe('turning a NetInfo reading into online/offline', () => {
  it('is online when the network is confirmed reachable', () => {
    expect(isOnlineFrom({ isConnected: true, isInternetReachable: true })).toBe(true);
  });

  it('is online when reachability is still unknown', () => {
    // The case that broke everything: null is "not determined yet", not "no".
    // On the iOS simulator it can stay null forever, so treating it as offline
    // left the app permanently offline while every request would have worked.
    expect(isOnlineFrom({ isConnected: true, isInternetReachable: null })).toBe(true);
  });

  it('is offline only when reachability is explicitly false', () => {
    expect(isOnlineFrom({ isConnected: true, isInternetReachable: false })).toBe(false);
  });

  it('is offline with no connection, whatever reachability says', () => {
    expect(isOnlineFrom({ isConnected: false, isInternetReachable: true })).toBe(false);
    expect(isOnlineFrom({ isConnected: false, isInternetReachable: null })).toBe(false);
  });

  it('is offline when the connection itself is unknown', () => {
    // Unknown reachability is recoverable — the request finds out. An unknown
    // CONNECTION is not something to optimistically send into.
    expect(isOnlineFrom({ isConnected: null, isInternetReachable: null })).toBe(false);
  });
});
