import { Linking } from 'react-native';
import { recordError, showErrorAlert } from '@utils';
import { getSSOLoginUrl } from './constants';
import { clearLoginPending, setLoginPending } from './loginPending';

/**
 * Start the SSO login flow: mark a login as pending, then open the SP login URL
 * in the system browser (the IdP session cookie lives there — required for
 * logout later).
 *
 * Never throws — callers fire it un-awaited. If the pending flag can't be
 * persisted we abort before opening the browser; if the browser fails to open
 * we roll back the pending flag so it doesn't linger for its whole TTL.
 */
export async function startLogin(): Promise<void> {
  const pendingSaved = await setLoginPending();
  if (!pendingSaved) {
    recordError(
      new Error('login-pending flag could not be saved'),
      'auth: startLogin aborted (secure storage)'
    );
    showErrorAlert('Could not start sign in. Please try again.');
    return;
  }
  try {
    await Linking.openURL(getSSOLoginUrl());
  } catch (error) {
    // Browser launch failed — roll back so the pending window doesn't stay open.
    await clearLoginPending();
    recordError(error, 'auth: startLogin failed to open the login URL');
    showErrorAlert('Could not open the sign-in page. Please try again.');
  }
}
