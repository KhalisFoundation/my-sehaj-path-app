module.exports = (api) => {
  // Cache per NODE_ENV so the test vs. non-test plugin set below is respected.
  api.cache.using(() => process.env.NODE_ENV);
  const isTest = process.env.NODE_ENV === 'test';

  const plugins = [
    [
      'module-resolver',
      {
        alias: {
          '@assets': './assets',
          '@components': './components',
          '@constants': './constants',
          '@screens': './screens',
          '@utils': './utils',
          '@styles': './styles',
          '@icons': './icons',
          '@hooks': './hooks',
          '@api': './api',
          '@auth': './auth',
        },
      },
    ],
  ];

  // react-native-dotenv inlines `@env` from `.env` at build time. Skip it under
  // jest so `@env` stays a real import that jest maps to a deterministic mock
  // (see jest.config moduleNameMapper) — tests never depend on a local `.env`.
  if (!isTest) {
    plugins.push([
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: '.env',
        allowUndefined: true,
        safe: false,
      },
    ]);
  }

  return {
    presets: ['module:@react-native/babel-preset'],
    plugins,
  };
};
