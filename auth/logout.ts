import { Linking } from 'react-native';
import { recordError } from '@utils';
import { store } from '../store';
import { setSignedOut } from '../store/slices/authSlice';
import { showSignInPopupAgain, resetSyncPopup } from '../store/slices/syncSlice';
import { writeSyncPrefs } from '../store/syncPrefs';
import { clearBlockedWork } from '../store/syncWork';
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
  const cleared = await clearCurrentToken(token ?? undefined);
  if (!cleared) {
    recordError(new Error('logout: token could not be cleared'), 'auth: logout token-clear failed');
  }
  await clearLoginPending();
  store.dispatch(setSignedOut());
  // Runtime "the server rejected this" markers must not outlive the session.
  // The next login may be a different account reusing the same local path ids,
  // and even for the same account the work deserves a fresh attempt rather than
  // staying skipped until the user happens to edit that path.
  clearBlockedWork(store);
  // Reset the per-session sync prompt so the next login asks again.
  store.dispatch(resetSyncPopup());
  // Re-arm the signed-out sign-in popup so it re-appears after logging out.
  await writeSyncPrefs({ signInPopupDismissed: false });
  store.dispatch(showSignInPopupAgain());

  if (token) {
    try {
      await Linking.openURL(getSSOLogoutUrl(token));
    } catch {
      // Local logout has already completed.
    }
  }
}
