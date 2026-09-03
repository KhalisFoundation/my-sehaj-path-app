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
