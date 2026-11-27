import { jest } from '@jest/globals';

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: jest.fn(() => ({
    Navigator: ({ children }) => children,
    Screen: ({ children }) => children,
  })),
  NativeStackScreenProps: jest.fn(),
  NativeStackNavigationProp: jest.fn(),
}));

// NetInfo is a native module with no JS fallback, and `db/connectivity` calls
// `configure` and `refresh` on it. Defined inline rather than reusing the
// library's shipped mock, which re-enters this factory and blows the stack.
// Per-file `jest.mock` calls still override this where a test controls answers.
jest.mock('@react-native-community/netinfo', () => {
  const connected = { isConnected: true, isInternetReachable: true, type: 'wifi' };
  return {
    __esModule: true,
    default: {
      configure: jest.fn(),
      fetch: jest.fn().mockResolvedValue(connected),
      refresh: jest.fn().mockResolvedValue(connected),
      addEventListener: jest.fn().mockReturnValue(jest.fn()),
    },
  };
});

// Push libraries are native at runtime. Keep their contract available to every
// unit test so importing a screen does not require an installed device module.
jest.mock('@react-native-firebase/messaging', () => {
  const messaging = () => ({
    onMessage: jest.fn(() => jest.fn()),
    onNotificationOpenedApp: jest.fn(() => jest.fn()),
    getInitialNotification: jest.fn().mockResolvedValue(null),
    getToken: jest.fn().mockResolvedValue('test-token'),
    requestPermission: jest.fn().mockResolvedValue(1),
  });
  messaging.setBackgroundMessageHandler = jest.fn();
  return { __esModule: true, default: messaging };
});

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn().mockResolvedValue('general'),
    displayNotification: jest.fn().mockResolvedValue('notification-id'),
    requestPermission: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
    getNotificationSettings: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
    onForegroundEvent: jest.fn(() => jest.fn()),
    getInitialNotification: jest.fn().mockResolvedValue(null),
  },
  AndroidImportance: { HIGH: 4 },
  AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2 },
  EventType: { PRESS: 1, ACTION_PRESS: 2 },
}));

jest.mock('@react-native-firebase/crashlytics', () => {
  const instance = {};
  return {
    getCrashlytics: jest.fn(() => instance),
    log: jest.fn(),
    recordError: jest.fn(),
    setAttribute: jest.fn(),
    setAttributes: jest.fn(),
    setUserId: jest.fn(),
    setCrashlyticsCollectionEnabled: jest.fn().mockResolvedValue(undefined),
    crash: jest.fn(),
  };
});
