import NetInfo from '@react-native-community/netinfo';
import { useInternet } from '../../hooks/useInternet';

const mockFetch = NetInfo.fetch as jest.MockedFunction<typeof NetInfo.fetch>;

describe('useInternet', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the fetched connection state and clears the fallback timer', async () => {
    jest.useFakeTimers();
    mockFetch.mockResolvedValue({ isConnected: true } as never);

    await expect(useInternet().checkNetwork()).resolves.toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('returns false when NetInfo rejects', async () => {
    mockFetch.mockRejectedValue(new Error('NetInfo failed'));

    await expect(useInternet().checkNetwork()).resolves.toBe(false);
  });

  it('returns false after 500ms when NetInfo does not settle', async () => {
    jest.useFakeTimers();
    mockFetch.mockReturnValue(new Promise(() => undefined));
    const result = useInternet().checkNetwork();

    await jest.advanceTimersByTimeAsync(499);
    let settled = false;
    result.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe(false);
  });
});
