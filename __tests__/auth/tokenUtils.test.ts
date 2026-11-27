import EncryptedStorage from 'react-native-encrypted-storage';
import {
  clearCurrentToken,
  fetchUserData,
  getCurrentToken,
  getCurrentUser,
  InvalidTokenError,
  saveCurrentToken,
} from '@auth/tokenUtils';

const USER = {
  email: 'a@b.com',
  firstname: 'A',
  lastname: 'B',
  exp: 1,
  iat: 1,
  nameID: 'n',
  nameIDFormat: 'f',
};

const mockFetch = (impl: () => Promise<unknown>) => {
  globalThis.fetch = jest.fn(impl) as unknown as typeof fetch;
};

beforeEach(() => {
  (EncryptedStorage as unknown as { __reset: () => void }).__reset();
  jest.clearAllMocks();
});

describe('token storage', () => {
  it('save/get/clear round-trips', async () => {
    await saveCurrentToken('tok');
    expect(await getCurrentToken()).toBe('tok');
    await clearCurrentToken();
    expect(await getCurrentToken()).toBeNull();
  });

  it('replaces an existing token (remove-before-set)', async () => {
    await saveCurrentToken('old');
    await saveCurrentToken('new');
    expect(await getCurrentToken()).toBe('new');
  });
});

describe('fetchUserData', () => {
  it('returns parsed user on 200 JSON', async () => {
    mockFetch(async () => ({ ok: true, status: 200, text: async () => JSON.stringify(USER) }));
    expect(await fetchUserData('t')).toEqual(USER);
  });

  it('throws InvalidTokenError on 401', async () => {
    mockFetch(async () => ({ ok: false, status: 401, text: async () => '' }));
    await expect(fetchUserData('t')).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('throws InvalidTokenError when the body is an HTML login page', async () => {
    mockFetch(async () => ({ ok: true, status: 200, text: async () => '<html>login</html>' }));
    await expect(fetchUserData('t')).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('aborts a request that never responds', async () => {
    jest.useFakeTimers();
    globalThis.fetch = jest.fn(
      (_url: RequestInfo | URL, options?: RequestInit) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })
    ) as unknown as typeof fetch;

    const request = fetchUserData('t').catch((error: unknown) => error);
    try {
      await jest.advanceTimersByTimeAsync(10_000);
      await expect(request).resolves.toThrow('aborted');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('getCurrentUser', () => {
  it('resolves null after one transient failure (keeps the token)', async () => {
    mockFetch(async () => {
      throw new Error('network down');
    });
    expect(await getCurrentUser('t')).toBeNull();
    expect((globalThis.fetch as jest.Mock).mock.calls.length).toBe(1);
  });

  it('does NOT retry an InvalidTokenError', async () => {
    mockFetch(async () => ({ ok: false, status: 401, text: async () => '' }));
    await expect(getCurrentUser('t')).rejects.toBeInstanceOf(InvalidTokenError);
    expect((globalThis.fetch as jest.Mock).mock.calls.length).toBe(1);
  });
});
