// In-memory stand-in for react-native-encrypted-storage so tests run without
// native code. Mirrors the real getItem/setItem/removeItem contract.
let store = {};

module.exports = {
  setItem: jest.fn(async (key, value) => {
    store[key] = value;
  }),
  getItem: jest.fn(async (key) => (key in store ? store[key] : null)),
  removeItem: jest.fn(async (key) => {
    delete store[key];
  }),
  clear: jest.fn(async () => {
    store = {};
  }),
  // Test helper (not part of the real module) to reset between cases.
  __reset: () => {
    store = {};
  },
};
