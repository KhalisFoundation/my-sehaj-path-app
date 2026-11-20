// Jest maps every RNFirebase module to this file. Keep the modular APIs used
// by the app available here as well as the legacy default factory, so tests
// exercise imports without needing a native Firebase module.
const messagingInstance = {
  onMessage: jest.fn(() => jest.fn()),
  onNotificationOpenedApp: jest.fn(() => jest.fn()),
  getInitialNotification: jest.fn().mockResolvedValue(null),
  getToken: jest.fn().mockResolvedValue('test-token'),
  requestPermission: jest.fn().mockResolvedValue(1),
  onTokenRefresh: jest.fn(() => jest.fn()),
};

const analyticsInstance = {};
const crashlyticsInstance = {};

const legacyMessaging = () => messagingInstance;
legacyMessaging.setBackgroundMessageHandler = jest.fn();

const firebaseStub = {
  __esModule: true,
  default: legacyMessaging,
  AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2 },
  getApp: jest.fn(() => ({})),
  getMessaging: jest.fn(() => messagingInstance),
  onMessage: jest.fn((_messaging, listener) => messagingInstance.onMessage(listener)),
  onNotificationOpenedApp: jest.fn((_messaging, listener) =>
    messagingInstance.onNotificationOpenedApp(listener)
  ),
  getInitialNotification: jest.fn(() => messagingInstance.getInitialNotification()),
  getToken: jest.fn(() => messagingInstance.getToken()),
  requestPermission: jest.fn(() => messagingInstance.requestPermission()),
  onTokenRefresh: jest.fn((_messaging, listener) => messagingInstance.onTokenRefresh(listener)),
  getAnalytics: jest.fn(() => analyticsInstance),
  getAppInstanceId: jest.fn().mockResolvedValue('test-app-instance'),
  logEvent: jest.fn().mockResolvedValue(undefined),
  setAnalyticsCollectionEnabled: jest.fn().mockResolvedValue(undefined),
  getCrashlytics: jest.fn(() => crashlyticsInstance),
  log: jest.fn(),
  recordError: jest.fn(),
  setAttributes: jest.fn().mockResolvedValue(undefined),
  setCrashlyticsCollectionEnabled: jest.fn().mockResolvedValue(undefined),
  crash: jest.fn(),
};

// Preserve the old catch-all behaviour for Firebase modules not used by this
// app yet, while making the modular APIs above explicit and type-shaped.
module.exports = new Proxy(firebaseStub, {
  get: (target, property) => (property in target ? target[property] : jest.fn()),
});
