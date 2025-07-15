module.exports = {
  preset: 'react-native',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@assets/(.*)$': '<rootDir>/assets/$1',
    '^@components/(.*)$': '<rootDir>/components/$1',
    '^@constants/(.*)$': '<rootDir>/constants/$1',
    '^@screens/(.*)$': '<rootDir>/screens/$1',
    '^@utils/(.*)$': '<rootDir>/utils/$1',
    '^@styles/(.*)$': '<rootDir>/styles/$1',
    '^@icons/(.*)$': '<rootDir>/icons/$1',
    '^@hooks/(.*)$': '<rootDir>/hooks/$1',
    'react-native-linear-gradient': '<rootDir>/__mocks__/react-native-linear-gradient.js',
    'react-native-svg': '<rootDir>/__mocks__/react-native-svg.js',
    'react-native-swipe-gestures': '<rootDir>/__mocks__/react-native-swipe-gestures.js',
    '@react-native-async-storage/async-storage': '<rootDir>/__mocks__/async-storage.js',
    '@react-native-community/netinfo': '<rootDir>/__mocks__/netinfo.js',
    '@react-native-community/blur': '<rootDir>/__mocks__/blur.js',
    '@rneui/themed': '<rootDir>/__mocks__/@rneui/themed.js',
  },

  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-navigation)',
  ],

  testMatch: ['**/__tests__/**/*.(test|spec).ts?(x)', '**/?(*.)+(test|spec).ts?(x)'],

  testEnvironment: 'node',

  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
    'screens/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],

  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  clearMocks: true,
  restoreMocks: true,
};
