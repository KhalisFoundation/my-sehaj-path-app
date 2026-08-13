import { recordError } from '@utils';
import { store } from '../store';
import { setSignedOut } from '../store/slices/authSlice';
import {
  showSignInPopupAgain,
  resetSyncPopup,
  dismissSessionExpired,
} from '../store/slices/syncSlice';
import { writeSyncPrefs } from '../store/syncPrefs';
import { clearBlockedWork } from '../store/syncWork';
import { openAuthSession } from './browser';
import { getSSOLogoutUrl, LOGOUT_REDIRECT_URL } from './constants';
import { clearLoginPending } from './loginPending';
import { clearCurrentToken, getCurrentToken } from './tokenUtils';

/**
 * Log out (single-logout / account-switch):
 *   1. Capture the token (the SP needs it to identify the SAML session).
 *   2. Clear local state — token, auth slice, and any pending-login flag — so
 *      the app reflects signed-out immediately and can never be trapped.
 *   3. Open the SP `/logout/all` URL in the secure auth browser to end the IdP
 *      session. The endpoint redirects back to our scheme when it is done.
 *
 * Step 3 must use the SAME secure browser session as login. A normal in-app
 * browser does not reliably share its IdP cookies, so logout can appear to run
 * while the next login silently restores the same account. A headless HTTP
 * request cannot clear a browser-held IdP session either.
 *
 * Local data clears immediately. The caller then waits for the browser visit to
 * finish before offering Login again. Android's in-app-browser auth polyfill
 * has one active redirect listener; allowing a new login while logout still
 * owns it can reopen the stale logout Custom Tab instead of starting login.
 */
export async function logout(): Promise<void> {
  const token = await getCurrentToken();
  const cleared = await clearCurrentToken(token ?? undefined);
  if (!cleared) {
    recordError(new Error('logout: token could not be cleared'), 'auth: logout token-clear failed');
  }
  await clearLoginPending();
  store.dispatch(setSignedOut());
  store.dispatch(dismissSessionExpired());
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
    // Ends the IdP session in the same secure browser context as login. We do
    // not consume the returned redirect — local logout is already complete.
    // Awaiting it prevents Android from starting Login against an unfinished
    // logout browser session.
    try {
      await openAuthSession(getSSOLogoutUrl(token), LOGOUT_REDIRECT_URL);
    } catch {
      // Best-effort — local logout has already completed.
    }
  }
}
