import { isOnlineNow } from '../../db/connectivity';
import { store } from '../../store';
import { setOnline } from '../../store/slices/networkSlice';

/**
 * `isOnlineNow` deliberately does NOT ask NetInfo for a positive answer.
 *
 * Three NetInfo approaches were tried on a real device and all returned stale
 * state: the store's cached copy, `NetInfo.fetch()`, and `NetInfo.refresh()`
 * with native reachability disabled — the last resolving in the same
 * millisecond as its caller, which no real probe can do. Each time, cellular had
 * been switched off and the download's socket already cut, and NetInfo still
 * said `isConnected=true isInternetReachable=true`.
 *
 * So these tests are about the probe: a request either completes or it does not.
 */
const fetchMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  store.dispatch(setOnline(true));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe('proving the connection by using it', () => {
  it('reports online when the probe answers', async () => {
    fetchMock.mockResolvedValue({ status: 204 });
    await expect(isOnlineNow()).resolves.toBe(true);
  });

  it('sends a HEAD request that cannot be served from cache', async () => {
    // A cached 204 from before the connection dropped would defeat the point.
    fetchMock.mockResolvedValue({ status: 204 });
    await isOnlineNow();

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('HEAD');
    expect(init.cache).toBe('no-store');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('reports offline when the probe fails, even though the store says online', async () => {
    // The case every NetInfo approach got wrong: the phone still believes it is
    // connected, but nothing can actually reach the network.
    fetchMock.mockRejectedValue(new Error('Unable to resolve host'));
    await expect(isOnlineNow()).resolves.toBe(false);
  });

  it('reports offline when the probe answers with an error status', async () => {
    fetchMock.mockResolvedValue({ status: 500 });
    await expect(isOnlineNow()).resolves.toBe(false);
  });

  it('accepts a redirect as proof the network works', async () => {
    // A captive portal answering 302 still proves packets are moving, and the
    // question here is only whether the device can reach anything at all.
    fetchMock.mockResolvedValue({ status: 302 });
    await expect(isOnlineNow()).resolves.toBe(true);
  });

  it('does not probe at all when the store already says offline', async () => {
    // The one thing the cached value is trusted for: a negative. If the listener
    // has already seen the drop there is nothing left to verify.
    store.dispatch(setOnline(false));

    await expect(isOnlineNow()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gives up rather than hanging when the probe never answers', async () => {
    // This runs while the download's single-flight lock is held. If it never
    // settles, the lock is never released and the database can never download
    // again until the app restarts. Resolving at all is the assertion.
    jest.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new Error('Aborted')));
        })
    );

    const pending = isOnlineNow();
    await jest.advanceTimersByTimeAsync(3_000);

    await expect(pending).resolves.toBe(false);
  });
});
