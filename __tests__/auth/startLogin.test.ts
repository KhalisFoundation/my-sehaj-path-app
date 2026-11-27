import { Platform } from 'react-native';
import EncryptedStorage from 'react-native-encrypted-storage';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { startLogin } from '@auth/startLogin';
import { isLoginPending } from '@auth/loginPending';
import { consumeLoginUrl } from '@auth/loginCallback';
import { showErrorAlert } from '@utils';

jest.mock('@auth/loginCallback', () => ({
  consumeLoginUrl: jest.fn(),
}));
jest.mock('@utils', () => ({
  recordError: jest.fn(),
  showErrorAlert: jest.fn(),
}));

const mockedConsume = consumeLoginUrl as jest.MockedFunction<typeof consumeLoginUrl>;
const mockedIsAvailable = InAppBrowser.isAvailable as jest.MockedFunction<
  typeof InAppBrowser.isAvailable
>;
const mockedOpenAuth = InAppBrowser.openAuth as jest.MockedFunction<typeof InAppBrowser.openAuth>;
const CALLBACK_URL = 'khalissehajpath://login?token=tok123';

// Platform.OS is read-only in typings; tests need to flip it per case.
const setPlatform = (os: 'ios' | 'android') => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
};

beforeEach(() => {
  (EncryptedStorage as unknown as { __reset: () => void }).__reset();
  jest.clearAllMocks();
  mockedIsAvailable.mockResolvedValue(true);
  setPlatform('ios');
});

describe('startLogin', () => {
  it('sets the pending flag and opens the SSO login URL in the in-app session', async () => {
    mockedOpenAuth.mockResolvedValue({ type: 'cancel' });
    await startLogin();
    expect(InAppBrowser.openAuth).toHaveBeenCalledWith(
      expect.stringContaining('/login/sso?redirect_url='),
      'khalissehajpath://login',
      expect.any(Object)
    );
  });

  it('iOS: a captured callback is consumed inline and no error is shown', async () => {
    mockedOpenAuth.mockResolvedValue({ type: 'success', url: CALLBACK_URL });
    mockedConsume.mockResolvedValue(true);

    await startLogin();

    expect(mockedConsume).toHaveBeenCalledWith(CALLBACK_URL);
    expect(showErrorAlert).not.toHaveBeenCalled();
  });

  it('iOS: a callback that cannot be consumed clears pending and alerts', async () => {
    mockedOpenAuth.mockResolvedValue({ type: 'success', url: CALLBACK_URL });
    mockedConsume.mockResolvedValue(false);

    await startLogin();

    expect(mockedConsume).toHaveBeenCalledWith(CALLBACK_URL);
    expect(showErrorAlert).toHaveBeenCalledTimes(1);
    expect(await isLoginPending()).toBe(false); // rolled back
  });

  it('iOS: a cancelled sheet rolls back the pending flag and does not consume', async () => {
    mockedOpenAuth.mockResolvedValue({ type: 'cancel' });

    await startLogin();

    expect(mockedConsume).not.toHaveBeenCalled();
    expect(showErrorAlert).not.toHaveBeenCalled();
    expect(await isLoginPending()).toBe(false); // rolled back
  });

  it('Android: does NOT consume inline (the deep-link listener does) and keeps pending', async () => {
    setPlatform('android');
    // Even if the Custom Tab reports the redirect, startLogin must leave it to
    // the deep-link listener to avoid a double-consume / dismiss race.
    mockedOpenAuth.mockResolvedValue({ type: 'success', url: CALLBACK_URL });

    await startLogin();

    expect(mockedConsume).not.toHaveBeenCalled();
    expect(await isLoginPending()).toBe(true); // left for the listener
  });

  it('falls back to the system browser when the in-app browser is unavailable', async () => {
    mockedIsAvailable.mockResolvedValue(false);

    await startLogin();

    expect(InAppBrowser.openAuth).not.toHaveBeenCalled();
    // Pending stays for the deep-link listener that handles the external return.
    expect(await isLoginPending()).toBe(true);
  });
});
