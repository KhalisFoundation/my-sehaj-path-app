// Mock for @op-engineering/op-sqlite (native). Tests override `execute` per case.
const open = jest.fn(() => ({
  execute: jest.fn(() => Promise.resolve({ rows: [] })),
  close: jest.fn(),
}));

module.exports = { open };
