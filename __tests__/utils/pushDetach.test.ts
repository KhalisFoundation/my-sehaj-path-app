import { pushControllerRemove } from '@api/generated/sdk.gen';
import { detachPushDevice } from '../../utils/pushNotifications';
import { logBreadcrumb, recordError } from '../../utils/crashlytics';

jest.mock('@api/generated/sdk.gen', () => ({
  pushControllerRegister: jest.fn(),
  pushControllerRemove: jest.fn(),
}));
jest.mock('@react-native-firebase/messaging', () => {
  const messaging = () => ({ getToken: jest.fn(() => Promise.resolve('test-token')) });
  return { __esModule: true, default: messaging };
});
jest.mock('../../utils/crashlytics', () => ({
  logBreadcrumb: jest.fn(),
  recordError: jest.fn(),
}));

const removeMock = pushControllerRemove as jest.MockedFunction<typeof pushControllerRemove>;

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('detachPushDevice', () => {
  it('detaches the current token from the account, without forgetting the device', async () => {
    removeMock.mockResolvedValueOnce({ data: undefined, response: { status: 204 } } as never);

    await detachPushDevice();

    // No `forget`: the device stays registered for general broadcasts and only
    // loses the account.
    expect(removeMock).toHaveBeenCalledWith({ path: { token: 'test-token' } });
    expect(recordError).not.toHaveBeenCalled();
  });

  it('keeps an offline sign-out as a breadcrumb, not an error', async () => {
    removeMock.mockResolvedValueOnce({ error: {}, response: undefined } as never);

    await expect(detachPushDevice()).resolves.toBeUndefined();

    expect(logBreadcrumb).toHaveBeenCalledWith(
      'push: sign-out detach got no response from the server'
    );
    expect(recordError).not.toHaveBeenCalled();
  });

  it('reports an HTTP failure but never throws', async () => {
    removeMock.mockResolvedValueOnce({ error: {}, response: { status: 500 } } as never);

    await expect(detachPushDevice()).resolves.toBeUndefined();

    expect(recordError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Push device detach failed with HTTP 500' }),
      'push: sign-out detach failed'
    );
  });

  it('gives up after the timeout so a hung request cannot block sign-out', async () => {
    jest.useFakeTimers();
    removeMock.mockReturnValueOnce(new Promise(() => undefined) as never);

    const done = detachPushDevice();
    await jest.advanceTimersByTimeAsync(5_000);

    await expect(done).resolves.toBeUndefined();
    expect(logBreadcrumb).toHaveBeenCalledWith('push: sign-out detach timed out');
  });
});
