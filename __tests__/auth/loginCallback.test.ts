import EncryptedStorage from 'react-native-encrypted-storage';
import { consumeLoginUrl, isLoginCallback } from '@auth/loginCallback';
import { isLoginPending, setLoginPending } from '@auth/loginPending';
import { getCurrentToken } from '@auth/tokenUtils';
import { store } from '../../store';
import { setSignedOut } from '../../store/slices/authSlice';

const mockUserFetch = () => {
  globalThis.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ email: 'a@b.com', firstname: 'A', lastname: 'B' }),
  })) as unknown as typeof fetch;
};

beforeEach(() => {
  (EncryptedStorage as unknown as { __reset: () => void }).__reset();
  jest.restoreAllMocks();
  jest.clearAllMocks();
  store.dispatch(setSignedOut());
});

describe('isLoginCallback', () => {
  it('recognizes a login URL with a token, not logout or token-less', () => {
    expect(isLoginCallback('khalissehajpath://login?token=x')).toBe(true);
    expect(isLoginCallback('khalissehajpath://logout')).toBe(false);
    expect(isLoginCallback('khalissehajpath://login')).toBe(false);
    expect(isLoginCallback('https://evil.example/login?token=x')).toBe(false);
  });

  it('rejects lookalike hosts (login-evil)', () => {
    expect(isLoginCallback('khalissehajpath://login-evil?token=x')).toBe(false);
  });
});

describe('consumeLoginUrl (forced-login guard)', () => {
  it('REJECTS a callback when no login is pending', async () => {
    mockUserFetch();
    const consumed = await consumeLoginUrl('khalissehajpath://login?token=tok');
    expect(consumed).toBe(false);
    expect(await getCurrentToken()).toBeNull();
    expect(store.getState().auth.status).not.toBe('signedIn');
  });

  it('ACCEPTS a callback when a login is pending, then clears the flag', async () => {
    mockUserFetch();
    await setLoginPending();
    const consumed = await consumeLoginUrl('khalissehajpath://login?token=tok');
    expect(consumed).toBe(true);
    expect(await getCurrentToken()).toBe('tok');
    expect(await isLoginPending()).toBe(false);
    expect(store.getState().auth.status).toBe('signedIn');
    expect(store.getState().auth.token).toBe('tok');
  });

  it('does not throw on a malformed token (?token=%) and consumes nothing', async () => {
    mockUserFetch();
    await setLoginPending();
    await expect(consumeLoginUrl('khalissehajpath://login?token=%')).resolves.toBe(false);
    expect(await getCurrentToken()).toBeNull();
  });
});
