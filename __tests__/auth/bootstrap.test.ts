import { Linking } from 'react-native';
import EncryptedStorage from 'react-native-encrypted-storage';
import { isLoginPending, setLoginPending } from '@auth/loginPending';
import { startLogin } from '@auth/startLogin';

beforeEach(() => {
  (EncryptedStorage as unknown as { __reset: () => void }).__reset();
  jest.clearAllMocks();
});

describe('login-pending TTL', () => {
  it('is not pending once the TTL has elapsed', async () => {
    await setLoginPending();
    expect(await isLoginPending()).toBe(true);
    // 11 minutes later (TTL is 10)
    expect(await isLoginPending(Date.now() + 11 * 60 * 1000)).toBe(false);
  });
});

describe('startLogin abort', () => {
  it('does NOT open the browser if the pending flag cannot be saved', async () => {
    jest.spyOn(EncryptedStorage, 'setItem').mockImplementationOnce(async () => {
      throw new Error('keychain unavailable');
    });
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);

    await startLogin();

    expect(openURL).not.toHaveBeenCalled();
  });

  it('rolls back the pending flag if the browser fails to open', async () => {
    jest.spyOn(Linking, 'openURL').mockImplementationOnce(async () => {
      throw new Error('no browser available');
    });

    await startLogin();

    expect(await isLoginPending()).toBe(false); // window not left open for its TTL
  });
});
