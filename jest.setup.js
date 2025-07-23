import { jest } from '@jest/globals';

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: jest.fn(() => ({
    Navigator: ({ children }) => children,
    Screen: ({ children }) => children,
  })),
  NativeStackScreenProps: jest.fn(),
  NativeStackNavigationProp: jest.fn(),
}));
