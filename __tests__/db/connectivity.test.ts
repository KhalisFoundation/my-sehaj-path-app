jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn() },
}));

import NetInfo from '@react-native-community/netinfo';
import { isOnlineNow } from '../../db/connectivity';
import { store } from '../../store';
import { setOnline } from '../../store/slices/networkSlice';

const mockedFetch = NetInfo.fetch as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  store.dispatch(setOnline(true));
});

describe('reading the live connection', () => {
  it('reports online when the phone is connected and reachable', async () => {
    mockedFetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
    await expect(isOnlineNow()).resolves.toBe(true);
  });

  it('reports offline when the phone is disconnected, even though the store says online', async () => {
    // The whole point: the store is a cached reading and is wrong at exactly the
    // moment a download is failing because the connection just dropped.
    mockedFetch.mockResolvedValue({ isConnected: false, isInternetReachable: false });
    await expect(isOnlineNow()).resolves.toBe(false);
  });

  it('treats unknown reachability as connected', async () => {
    // `isInternetReachable` is null while the probe is still running, which is
    // normal right after reconnecting. Reading unknown as offline would suppress
    // work that should run.
    mockedFetch.mockResolvedValue({ isConnected: true, isInternetReachable: null });
    await expect(isOnlineNow()).resolves.toBe(true);
  });

  it('does not ask NetInfo at all when the store already says offline', async () => {
    store.dispatch(setOnline(false));
    await expect(isOnlineNow()).resolves.toBe(false);
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});

describe('when NetInfo cannot answer', () => {
  it('falls back to the store if the native call throws', async () => {
    mockedFetch.mockRejectedValue(new Error('netinfo unavailable'));
    await expect(isOnlineNow()).resolves.toBe(true);
  });

  it('gives up after the timeout instead of hanging forever', async () => {
    // This is the severe one. `isOnlineNow` runs on the download's FAILURE path,
    // and that path holds the single-flight lock. If it never settles, the
    // `finally` that clears `activeDownload` never runs — so every later
    // foreground and reconnect joins a dead promise and the offline database can
    // never download again until the app is restarted.
    //
    // `NetInfo.fetch()` is a bridge call with no timeout of its own. Resolving
    // at all is the assertion; without the race this test would time out.
    jest.useFakeTimers();
    mockedFetch.mockReturnValue(new Promise(() => undefined)); // never settles

    const pending = isOnlineNow();
    await Promise.resolve();
    jest.advanceTimersByTime(3_000);

    await expect(pending).resolves.toBe(true);
  });
});
