module.exports = {
  SafeAreaProvider: ({ children }) => children,
  SafeAreaView: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  initialWindowMetrics: {
    frame: { x: 0, y: 0, width: 375, height: 667 },
    insets: { top: 0, left: 0, right: 0, bottom: 0 },
  },
};
