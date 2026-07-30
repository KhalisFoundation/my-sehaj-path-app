import { Linking } from 'react-native';
import { recordError } from '@utils';
import { store } from '../store';
import { setSignedOut } from '../store/slices/authSlice';
import { getSSOLogoutUrl } from './constants';
import { clearLoginPending } from './loginPending';
import { clearCurrentToken, getCurrentToken } from './tokenUtils';

/**
 * Log out (single-logout / account-switch):
 *   1. Capture the token (the SP needs it to identify the SAML session).
 *   2. Clear local state — token, auth slice, and any pending-login flag.
 *   3. Open the SP `/logout/all` URL in the system browser to end the IdP
 *      session, which redirects back to the app.
 *
 * Clearing the local token alone would NOT log out — the next login would
 * silently re-authenticate the same user.
 */
export async function logout(): Promise<void> {
  const token = await getCurrentToken();
  const cleared = await clearCurrentToken();
  if (!cleared) {
    recordError(new Error('logout: token could not be cleared'), 'auth: logout token-clear failed');
  }
  await clearLoginPending();
  store.dispatch(setSignedOut());

  if (token) {
    try {
      await Linking.openURL(getSSOLogoutUrl(token));
    } catch {
      // Local logout has already completed.
    }
  }
}
