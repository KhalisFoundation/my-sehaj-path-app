import { recordError } from '@utils';
import { store } from '../store';
import { setSignedOut } from '../store/slices/authSlice';
import { showSignInPopupAgain, resetSyncPopup } from '../store/slices/syncSlice';
import { writeSyncPrefs } from '../store/syncPrefs';
import { clearBlockedWork } from '../store/syncWork';
import { openInAppBrowser } from './browser';
import { getSSOLogoutUrl } from './constants';
import { clearLoginPending } from './loginPending';
import { clearCurrentToken, getCurrentToken } from './tokenUtils';

/**
 * Log out (single-logout / account-switch):
 *   1. Capture the token (the SP needs it to identify the SAML session).
 *   2. Clear local state — token, auth slice, and any pending-login flag — so
 *      the app reflects signed-out immediately and can never be trapped.
 *   3. Open the SP `/logout/all` URL in a normal in-app browser to end the IdP
 *      session. The endpoint redirects back to our scheme when it is done.
 *
 * Step 3 must go through the browser and cannot be a headless HTTP call: the
 * IdP session cookie lives in the browser's cookie jar (the same jar the login
 * session used), NOT in the app. Only a browser visit to `/logout/all` clears
 * it. Without it the next login replays the surviving cookie and the IdP
 * silently re-authenticates the SAME account — the user is never asked which
 * account to sign in as. (Confirmed on-device: a headless logout skipped the
 * account chooser.) A normal in-app browser avoids the OS authentication
 * consent prompt while keeping this inside the app.
 *
 * Local logout completes immediately; the browser visit is best-effort and is
 * deliberately not awaited, so the UI is never held open while it is visible.
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
    // Ends the IdP session and clears its browser cookie. We don't consume the
    // returned redirect — local logout is already done. Do not wait for the
    // normal browser page to be dismissed before returning from logout.
    openInAppBrowser(getSSOLogoutUrl(token)).catch(() => {
      // Best-effort — local logout has already completed.
    });
  }
}
