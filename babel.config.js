module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
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
        },
      },
    ],
  ],
};
