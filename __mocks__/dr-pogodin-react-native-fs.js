// Mock for @dr.pogodin/react-native-fs (native, named exports). Tests override
// individual functions per case.
module.exports = {
  DocumentDirectoryPath: '/mock/Documents',
  exists: jest.fn(() => Promise.resolve(false)),
  unlink: jest.fn(() => Promise.resolve()),
  appendFile: jest.fn(() => Promise.resolve()),
  moveFile: jest.fn(() => Promise.resolve()),
  read: jest.fn(() => Promise.resolve('')),
  hash: jest.fn(() => Promise.resolve('')),
  stat: jest.fn(() => Promise.resolve({ size: 0 })),
  stopDownload: jest.fn(),
  resumeDownload: jest.fn(),
  downloadFile: jest.fn(() => ({
    jobId: 1,
    promise: Promise.resolve({ statusCode: 200, bytesWritten: 0, jobId: 1 }),
  })),
};
