// Controllable mock for the native in-app browser. Tests override
// `isAvailable` / `openAuth` per case; defaults keep the in-app path available
// and treat an un-configured session as a user cancel.
const InAppBrowser = {
  isAvailable: jest.fn(() => Promise.resolve(true)),
  openAuth: jest.fn(() => Promise.resolve({ type: 'cancel' })),
  open: jest.fn(() => Promise.resolve({ type: 'dismiss' })),
  close: jest.fn(),
  closeAuth: jest.fn(),
};

module.exports = {
  __esModule: true,
  default: InAppBrowser,
  InAppBrowser,
};
