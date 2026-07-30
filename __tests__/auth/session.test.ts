import EncryptedStorage from 'react-native-encrypted-storage';
import { establishSession } from '@auth/session';
import { getCurrentToken, saveCurrentToken } from '@auth/tokenUtils';
import { store } from '../../store';

const mockFetch = (impl: () => Promise<unknown>) => {
  globalThis.fetch = jest.fn(impl) as unknown as typeof fetch;
};

beforeEach(() => {
  (EncryptedStorage as unknown as { __reset: () => void }).__reset();
  jest.clearAllMocks();
});

describe('establishSession', () => {
  it('signs in with the profile on a successful /user fetch', async () => {
    await saveCurrentToken('tok');
    mockFetch(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ email: 'a@b.com', firstname: 'A', lastname: 'B' }),
    }));
    await establishSession('tok');
    expect(store.getState().auth.status).toBe('signedIn');
    expect(store.getState().auth.email).toBe('a@b.com');
    expect(store.getState().auth.token).toBe('tok'); // token available for API calls
  });

  it('signs out and clears the token on InvalidTokenError', async () => {
    await saveCurrentToken('tok');
    mockFetch(async () => ({ ok: false, status: 401, text: async () => '' }));
    await establishSession('tok');
    expect(store.getState().auth.status).toBe('signedOut');
    expect(await getCurrentToken()).toBeNull();
  });

  it('stays signed in with a null email on a transient failure', async () => {
    await saveCurrentToken('tok');
    mockFetch(async () => {
      throw new Error('offline');
    });
    await establishSession('tok');
    expect(store.getState().auth.status).toBe('signedIn');
    expect(store.getState().auth.email).toBeNull();
  });

  it('an invalid stale token does NOT delete a different (newer) stored token', async () => {
    // Newer login already stored token B on disk.
    await saveCurrentToken('B');
    // A stale request for token A comes back invalid.
    mockFetch(async () => ({ ok: false, status: 401, text: async () => '' }));
    await establishSession('A');
    // B must survive — the stale A request may not clear a different token.
    expect(await getCurrentToken()).toBe('B');
  });

  it('concurrency: an older invalid request resolving LAST cannot clear the newer token', async () => {
    await saveCurrentToken('A');

    // Two deferred fetches: first establishSession call gets fetchA, second fetchB.
    let resolveA!: (v: unknown) => void;
    let resolveB!: (v: unknown) => void;
    const fetchA = new Promise((r) => {
      resolveA = r;
    });
    const fetchB = new Promise((r) => {
      resolveB = r;
    });
    const responses = [fetchA, fetchB];
    let call = 0;
    globalThis.fetch = jest.fn(() => responses[call++]) as unknown as typeof fetch;

    const pA = establishSession('A'); // older request
    await saveCurrentToken('B');
    const pB = establishSession('B'); // newer request

    // B resolves valid first; A resolves invalid LAST (the risky ordering).
    resolveB({ ok: true, status: 200, text: async () => JSON.stringify({ email: 'b@x.com' }) });
    await pB;
    resolveA({ ok: false, status: 401, text: async () => '' });
    await pA;

    // The stale A request must not have deleted B's token or flipped state.
    expect(await getCurrentToken()).toBe('B');
    expect(store.getState().auth.status).toBe('signedIn');
    expect(store.getState().auth.email).toBe('b@x.com');
  });
});
