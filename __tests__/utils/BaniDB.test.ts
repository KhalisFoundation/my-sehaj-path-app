import axios from 'axios';
import { BaniDB } from '../../utils/BaniDB';
import { logBreadcrumb, recordError } from '../../utils/crashlytics';

jest.mock('../../utils/crashlytics', () => ({ logBreadcrumb: jest.fn(), recordError: jest.fn() }));

const axiosError = (response?: { status: number }, code = 'ERR_NETWORK') =>
  Object.assign(new Error('request failed'), { isAxiosError: true, response, code });

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('fetching an ang from BaniDB', () => {
  it('gives up after a timeout instead of waiting forever', async () => {
    const get = jest.spyOn(axios, 'get').mockResolvedValue({ data: { ok: true } });

    await BaniDB(2);

    expect(get).toHaveBeenCalledWith(expect.stringContaining('2'), {
      timeout: expect.any(Number),
    });
  });

  it('keeps "no response" as a breadcrumb, not an error', async () => {
    jest.spyOn(axios, 'get').mockRejectedValue(axiosError(undefined, 'ECONNABORTED'));

    const result = await BaniDB(2);

    expect(result.success).toBe(false);
    expect(recordError).not.toHaveBeenCalled();
    expect(logBreadcrumb).toHaveBeenCalledWith(expect.stringContaining('ang 2'));
  });

  it('still reports BaniDB answering with an error, with its status', async () => {
    jest.spyOn(axios, 'get').mockRejectedValue(axiosError({ status: 503 }));

    const result = await BaniDB(2);

    expect(result.success).toBe(false);
    expect(recordError).toHaveBeenCalledWith(expect.anything(), 'BaniDB fetch failed for ang 2', {
      banidb_status: '503',
    });
  });
});
