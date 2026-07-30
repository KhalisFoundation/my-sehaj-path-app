import { Linking } from 'react-native';
import EncryptedStorage from 'react-native-encrypted-storage';
import { logout } from '@auth/logout';
import { getCurrentToken, saveCurrentToken } from '@auth/tokenUtils';
import { isLoginPending, setLoginPending } from '@auth/loginPending';
import { store } from '../../store';
import { setSignedIn } from '../../store/slices/authSlice';

beforeEach(() => {
  (EncryptedStorage as unknown as { __reset: () => void }).__reset();
  jest.clearAllMocks();
});

describe('logout', () => {
  it('clears token + pending flag, signs out, and opens /logout/all', async () => {
    await saveCurrentToken('tok123');
    await setLoginPending();
    store.dispatch(
      setSignedIn({ token: 'tok123', email: 'a@b.com', firstname: 'A', lastname: 'B' })
    );
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);

    await logout();

    expect(await getCurrentToken()).toBeNull();
    expect(await isLoginPending()).toBe(false);
    expect(store.getState().auth.status).toBe('signedOut');
    expect(store.getState().auth.token).toBeNull();
    expect(openURL).toHaveBeenCalledWith(expect.stringContaining('/logout/all?token=tok123'));
  });

  it('signs out locally even when there is no token (no logout URL opened)', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    await logout();
    expect(store.getState().auth.status).toBe('signedOut');
    expect(openURL).not.toHaveBeenCalled();
  });
});
