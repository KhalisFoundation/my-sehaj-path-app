import NetInfo from '@react-native-community/netinfo';
import { getToken, onTokenRefresh } from '@react-native-firebase/messaging';
import { pushControllerRegister } from '../../api/generated/sdk.gen';
import { logBreadcrumb, recordError } from '../../utils/crashlytics';
import { registerPushNotifications } from '../../utils/pushNotifications';

jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: jest.fn(() => ({})),
  getToken: jest.fn(),
  onTokenRefresh: jest.fn(() => jest.fn()),
  getInitialNotification: jest.fn(),
  onNotificationOpenedApp: jest.fn(),
}));
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    requestPermission: jest.fn(async () => ({ authorizationStatus: 1 })),
    createChannel: jest.fn(),
    onForegroundEvent: jest.fn(),
    getInitialNotification: jest.fn(),
  },
  AndroidImportance: { HIGH: 4 },
  AuthorizationStatus: { DENIED: 0, AUTHORIZED: 1 },
  EventType: {},
}));
jest.mock('../../api/generated/sdk.gen', () => ({ pushControllerRegister: jest.fn() }));
jest.mock('../../utils/crashlytics', () => ({ logBreadcrumb: jest.fn(), recordError: jest.fn() }));

const register = pushControllerRegister as jest.Mock;
const addListener = NetInfo.addEventListener as jest.Mock;
const noResponse = { error: new Error('Network Error'), data: undefined, response: undefined };
const ok = { data: { attachedToUser: true }, error: undefined, response: { status: 201 } };
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  (getToken as jest.Mock).mockResolvedValue('fcm-token');
  (onTokenRefresh as jest.Mock).mockReturnValue(jest.fn());
  addListener.mockReturnValue(jest.fn());
});

describe('registering the device for push', () => {
  it('treats "no response" as a breadcrumb, not an error', async () => {
    // Opening the app offline or between networks is not a fault. Reporting
    // it filed ~60 non-fatals a week that hid the failures worth looking at.
    register.mockResolvedValueOnce(noResponse);

    await registerPushNotifications('auth');

    expect(recordError).not.toHaveBeenCalled();
    expect(logBreadcrumb).toHaveBeenCalledWith(expect.stringContaining('no response'));
  });

  it('retries once the device is back online, and only once', async () => {
    register.mockResolvedValueOnce(noResponse).mockResolvedValue(ok);
    await registerPushNotifications('auth');
    const onChange = addListener.mock.calls[0][0] as (state: object) => void;

    onChange({ isConnected: false, isInternetReachable: false });
    await flush();
    expect(register).toHaveBeenCalledTimes(1);

    onChange({ isConnected: true, isInternetReachable: true });
    await flush();
    onChange({ isConnected: true, isInternetReachable: true });
    await flush();

    expect(register).toHaveBeenCalledTimes(2);
  });

  it('still reports the server refusing the registration', async () => {
    register.mockResolvedValueOnce({
      error: { message: 'bad' },
      data: undefined,
      response: { status: 500 },
    });

    await registerPushNotifications('auth');

    expect(recordError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Push device registration failed with HTTP 500' }),
      'push: registration failed'
    );
    expect(addListener).not.toHaveBeenCalled();
  });

  it('stops waiting to retry when the registration is torn down', async () => {
    const stopListening = jest.fn();
    addListener.mockReturnValue(stopListening);
    register.mockResolvedValueOnce(noResponse);

    const unsubscribe = await registerPushNotifications('auth');
    unsubscribe();

    expect(stopListening).toHaveBeenCalled();
  });
});
