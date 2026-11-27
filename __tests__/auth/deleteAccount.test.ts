import { deleteAccount } from '@auth/deleteAccount';
import { getAccountDeleteEndpoint } from '@auth/constants';
import { clearLocalDataForAccountDeletion } from '../../store/confirmedSync';
import { getCurrentToken, clearCurrentToken } from '@auth/tokenUtils';
import { recordError } from '@utils';

/**
 * Account deletion is the one flow that destroys data on purpose, so most of
 * these pin what must NOT happen: no local wipe when nothing was deleted, and no
 * silent success on an error status.
 */
jest.mock('@utils', () => ({
  recordError: jest.fn(),
  showErrorAlert: jest.fn(),
}));
jest.mock('../../store/confirmedSync', () => ({
  clearLocalDataForAccountDeletion: jest.fn().mockResolvedValue(true),
}));
jest.mock('@auth/tokenUtils', () => ({
  getCurrentToken: jest.fn().mockResolvedValue('tok123'),
  clearCurrentToken: jest.fn().mockResolvedValue(true),
}));
jest.mock('@auth/loginPending', () => ({
  clearLoginPending: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../store/syncPrefs', () => ({
  writeSyncPrefs: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../store/syncWork', () => ({
  clearBlockedWork: jest.fn(),
}));

const mockedClear = clearLocalDataForAccountDeletion as jest.MockedFunction<
  typeof clearLocalDataForAccountDeletion
>;
const mockedToken = getCurrentToken as jest.MockedFunction<typeof getCurrentToken>;
const fetchMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockedClear.mockResolvedValue(true);
  mockedToken.mockResolvedValue('tok123');
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

const reply = (status: number, body: unknown = {}) =>
  fetchMock.mockResolvedValue({
    status,
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response);

describe('the request', () => {
  it('DELETEs the IdP endpoint with the bearer token already held', async () => {
    reply(200);
    await deleteAccount();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(getAccountDeleteEndpoint());
    expect(url).toContain('/wp-json/khalis/v1/account?confirm=true');
    expect(init.method).toBe('DELETE');
    expect(init.headers.Authorization).toBe('Bearer tok123');
  });

  it('passes an abort signal built without AbortSignal.timeout', async () => {
    // React Native has no static `AbortSignal.timeout`, though Node does — so a
    // version using it type-checks, passes here, and fails on every device.
    reply(200);
    await deleteAccount();
    const [, init] = fetchMock.mock.calls[0];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not call the server at all when there is no session', async () => {
    mockedToken.mockResolvedValue(null);
    await expect(deleteAccount()).resolves.toEqual({ ok: false, reason: 'no_session' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockedClear).not.toHaveBeenCalled();
  });
});

describe('what each status does to this device', () => {
  it('200 — clears the account and reports success', async () => {
    reply(200);
    await expect(deleteAccount()).resolves.toEqual({ ok: true, cleared: true });
    expect(mockedClear).toHaveBeenCalledTimes(1);
    expect(clearCurrentToken).toHaveBeenCalled();
  });

  it('409 already scheduled — clears too, because the user got what they asked for', async () => {
    reply(409, { code: 'khalis_already_requested' });
    await expect(deleteAccount()).resolves.toEqual({
      ok: false,
      reason: 'already_scheduled',
      cleared: true,
    });
    expect(mockedClear).toHaveBeenCalledTimes(1);
  });

  it('409 with an UNKNOWN code deletes nothing', async () => {
    // Clearing is allow-listed, never a fallback. A code this build has not seen
    // is not evidence that anything was deleted.
    reply(409, { code: 'khalis_some_future_reason' });
    await expect(deleteAccount()).resolves.toEqual({
      ok: false,
      reason: 'server',
      status: 409,
    });
    expect(mockedClear).not.toHaveBeenCalled();
    expect(clearCurrentToken).not.toHaveBeenCalled();
  });

  it('409 last admin — REFUSES, and must not clear anything', async () => {
    // The dangerous one. A 409 meaning "we did NOT delete your account" shares a
    // status with one meaning "we already did". Treating them alike wipes the
    // reading of somebody whose account still exists.
    reply(409, { code: 'khalis_last_admin' });
    await expect(deleteAccount()).resolves.toEqual({ ok: false, reason: 'last_admin' });
    expect(mockedClear).not.toHaveBeenCalled();
    expect(clearCurrentToken).not.toHaveBeenCalled();
  });

  it('409 with an unreadable body deletes nothing', async () => {
    // An unparseable body proves nothing either way, so it must not be read as
    // "already deleted" — that assumption costs the user their reading.
    fetchMock.mockResolvedValue({
      status: 409,
      text: jest.fn().mockResolvedValue(''),
      json: jest.fn().mockRejectedValue(new Error('not json')),
    } as unknown as Response);
    await expect(deleteAccount()).resolves.toEqual({
      ok: false,
      reason: 'server',
      status: 409,
    });
    expect(mockedClear).not.toHaveBeenCalled();
  });

  it('401 — signs out but NEVER wipes the reading, because nothing was deleted', async () => {
    // A 401 here is as likely to be a misconfigured endpoint as an expired
    // session. Either way the account still exists, so the Sehaj Paths must
    // survive. This is the assertion that stops a server problem becoming data
    // loss.
    reply(401, { code: 'rest_not_authorized' });
    await expect(deleteAccount()).resolves.toEqual({ ok: false, reason: 'unauthorized' });
    expect(mockedClear).not.toHaveBeenCalled();
    expect(clearCurrentToken).toHaveBeenCalled();
  });

  it('500 — keeps everything; nothing was deleted', async () => {
    reply(500);
    await expect(deleteAccount()).resolves.toEqual({
      ok: false,
      reason: 'server',
      status: 500,
    });
    expect(mockedClear).not.toHaveBeenCalled();
    expect(clearCurrentToken).not.toHaveBeenCalled();
  });

  it('404 — reports the status, so a missing endpoint is diagnosable', async () => {
    reply(404, { code: 'rest_no_route' });
    await expect(deleteAccount()).resolves.toEqual({
      ok: false,
      reason: 'server',
      status: 404,
    });
    expect(mockedClear).not.toHaveBeenCalled();
  });

  it('offline — keeps everything; clearing here would destroy data over a dropped connection', async () => {
    fetchMock.mockRejectedValue(new Error('Network request failed'));
    await expect(deleteAccount()).resolves.toEqual({ ok: false, reason: 'network' });
    expect(mockedClear).not.toHaveBeenCalled();
    expect(clearCurrentToken).not.toHaveBeenCalled();
  });
});

describe('when the reading cannot be cleared', () => {
  it('still tears down auth — the account is gone at the IdP either way', async () => {
    mockedClear.mockResolvedValue(false);
    reply(200);
    const result = await deleteAccount();
    expect(result).toEqual({ ok: true, cleared: false });
    expect(clearCurrentToken).toHaveBeenCalled();
  });

  it('reports cleared:false so the caller cannot claim a clean deletion', async () => {
    // A failed wipe is rolled back by the persistence layer, so the previous
    // account's paths are still on disk. Saying "Account deleted" there would
    // expose them in guest mode.
    mockedClear.mockResolvedValue(false);
    reply(200);
    const result = await deleteAccount();
    expect(result.ok && result.cleared).toBe(false);
  });
});

describe('what reaches crash reporting', () => {
  it('sends the status and a validated code, never the response body', async () => {
    // Bodies are server-controlled and can carry an email, a stack trace or
    // internal paths — none of which should be retained by a third party.
    reply(500, { code: 'internal_error', message: 'user simarjot@example.com not found' });
    await deleteAccount();
    const [, , extra] = (recordError as jest.Mock).mock.calls.at(-1) ?? [];
    expect(extra).toEqual({ status: '500', code: 'internal_error' });
  });

  it('discards a code that is prose rather than an identifier', async () => {
    reply(500, { code: 'Something went wrong for user@example.com' });
    await deleteAccount();
    const [, , extra] = (recordError as jest.Mock).mock.calls.at(-1) ?? [];
    expect(extra).toEqual({ status: '500', code: 'none' });
  });
});
