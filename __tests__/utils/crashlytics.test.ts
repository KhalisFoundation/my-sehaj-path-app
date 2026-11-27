/**
 * Simulated Crashlytics session state.
 *
 * The key detail this mock reproduces: native custom keys are applied when
 * `setAttributes` RESOLVES, not when it is called, while `recordError` is
 * synchronous. A report therefore captures whatever keys have actually landed
 * by that moment — which is why the await in `writeReport` matters.
 */
const mockSession: Record<string, string> = {};
/** What each report saw on the session at the instant it was recorded. */
const mockReports: Record<string, string>[] = [];

const mockSetAttributes = jest.fn((attributes: Record<string, string>) =>
  Promise.resolve().then(() => {
    Object.assign(mockSession, attributes);
    return null;
  })
);
const mockRecordNative = jest.fn(() => {
  mockReports.push({ ...mockSession });
});

jest.mock('@react-native-firebase/crashlytics', () => ({
  getCrashlytics: () => ({}),
  log: jest.fn(),
  recordError: () => mockRecordNative(),
  setAttributes: (_instance: unknown, attributes: Record<string, string>) =>
    mockSetAttributes(attributes),
  setCrashlyticsCollectionEnabled: jest.fn(),
  crash: jest.fn(),
}));

import { recordError } from '../../utils/crashlytics';

/** Reports are queued, so let the microtask chain drain before asserting. */
const drain = async () => {
  for (let i = 0; i < 20; i += 1) {
    await Promise.resolve();
  }
};

beforeEach(() => {
  Object.keys(mockSession).forEach((key) => delete mockSession[key]);
  mockReports.length = 0;
  mockSetAttributes.mockClear();
  mockRecordNative.mockClear();
});

describe('recordError custom keys', () => {
  it('the key has landed on the session before the report is captured', async () => {
    recordError(new Error('boom'), 'db: failed', { db_failure_kind: 'network-timeout' });
    await drain();

    // Without awaiting setAttributes the report is captured first and carries
    // no kind at all, leaving it unfilterable.
    expect(mockReports).toEqual([{ db_failure_kind: 'network-timeout' }]);
  });

  it('a later unrelated error does not inherit the previous kind', async () => {
    recordError(new Error('boom'), 'db: failed', { db_failure_kind: 'insufficient-storage' });
    await drain();

    recordError(new Error('unrelated'), 'auth: token refresh failed');
    await drain();

    // Keys persist on the session until overwritten. Without the blanking step
    // this second report would be filed under 'insufficient-storage' and look
    // like a DB failure.
    expect(mockReports[1]).toEqual({ db_failure_kind: '' });
  });

  it('serializes concurrent reports so neither is filed under the other kind', async () => {
    recordError(new Error('a'), 'db: a', { db_failure_kind: 'network-unavailable' });
    recordError(new Error('b'), 'db: b', { db_failure_kind: 'invalid-file' });
    await drain();

    expect(mockReports).toEqual([
      { db_failure_kind: 'network-unavailable' },
      { db_failure_kind: 'invalid-file' },
    ]);
  });

  it('still records the error when attaching the key fails', async () => {
    mockSetAttributes.mockRejectedValueOnce(new Error('native bridge unavailable'));

    recordError(new Error('boom'), 'db: failed', { db_failure_kind: 'other' });
    await drain();

    // Losing a filter label must never cost the report itself.
    expect(mockRecordNative).toHaveBeenCalledTimes(1);
  });

  it('continues reporting when a native attribute write never settles', async () => {
    jest.useFakeTimers();
    mockSetAttributes.mockImplementationOnce(() => new Promise(() => undefined));

    recordError(new Error('first'), 'db: first', { db_failure_kind: 'network-timeout' });
    recordError(new Error('second'), 'auth: second');
    await drain();
    // Must clear ATTRIBUTE_WRITE_TIMEOUT_MS (5s), or the hung write is still
    // pending and the queue legitimately holds both reports.
    await jest.advanceTimersByTimeAsync(10_000);
    await drain();

    expect(mockRecordNative).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});
