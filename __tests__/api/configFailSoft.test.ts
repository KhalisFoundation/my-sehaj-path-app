jest.mock('@env', () => ({ SEHAJ_API_URL: undefined }));
jest.mock('../../utils/crashlytics', () => ({
  recordError: jest.fn(),
  logBreadcrumb: jest.fn(),
  allowCrashReporting: jest.fn(),
  testCrash: jest.fn(),
}));

import { configureApiClient, isApiConfigured } from '../../api/config';
import { recordError } from '../../utils/crashlytics';

/**
 * `.env` is gitignored, so a release build whose CI forgot to inject
 * SEHAJ_API_URL is realistic. Throwing here would escape App's effect into the
 * error boundary and make the ENTIRE app unusable — reading included. Sync is an
 * enhancement; it must never be able to break reading.
 */
describe('configureApiClient with no SEHAJ_API_URL', () => {
  it('never throws, reports the misconfiguration, and leaves sync disabled', () => {
    expect(() => configureApiClient()).not.toThrow();
    expect(configureApiClient()).toBe(false);
    expect(isApiConfigured()).toBe(false);
    expect(recordError).toHaveBeenCalledWith(expect.any(Error), 'api: missing base URL');
  });
});
