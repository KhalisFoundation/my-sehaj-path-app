import { Platform } from 'react-native';
import { recordError, showErrorAlert } from '@utils';
import { openAuthSession } from './browser';
import { getSSOLoginUrl, REDIRECT_URL } from './constants';
import { consumeLoginUrl } from './loginCallback';
import { clearLoginPending, setLoginPending } from './loginPending';

/**
 * Start the SSO login flow: mark a login as pending, then open the SP login URL
 * in a secure IN-APP browser session (ASWebAuthenticationSession on iOS, Chrome
 * Custom Tabs on Android). The session shares the system cookie jar, so the IdP
 * session cookie it sets is the one a later logout ends.
 *
 * The return path differs by platform, by design, because the OS mechanics do:
 *   - iOS: ASWebAuthenticationSession captures the redirect to our scheme INSIDE
 *     the session — the app's deep-link listener never fires — so we consume the
 *     returned `?token=…` inline here, and we get an explicit cancel signal.
 *   - Android / system-browser fallback: the redirect returns as a real deep
 *     link, consumed by `useSSOLogin` (warm) or the cold-start bootstrap. We do
 *     NOT touch the pending flag from the browser result here, because a Custom
 *     Tab "dismiss" can race the incoming redirect; the deep-link listener (or
 *     the pending-flag TTL) settles it, exactly like the pre-in-app flow.
 *
 * Never throws — callers fire it un-awaited. If the pending flag can't be
 * persisted we abort before opening the browser; if even the fallback browser
 * fails to open we roll back the pending flag so it doesn't linger for its TTL.
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
    const result = await openAuthSession(getSSOLoginUrl(), REDIRECT_URL);

    // iOS ASWebAuthenticationSession owns the whole flow end to end.
    if (Platform.OS === 'ios') {
      if (result.type === 'callback') {
        const consumed = await consumeLoginUrl(result.url);
        if (!consumed) {
          await clearLoginPending();
          recordError(
            new Error('login callback was not consumed'),
            'auth: startLogin callback rejected'
          );
          showErrorAlert('Could not complete sign in. Please try again.');
        }
      } else if (result.type === 'cancelled') {
        // User dismissed the sign-in sheet before completing. On iOS this is
        // race-free (no deep-link listener competes), so roll back the pending
        // flag immediately instead of letting it linger for its TTL.
        await clearLoginPending();
      }
      // 'external' (in-app browser unavailable) → the deep-link listener handles
      // the return; leave the pending flag in place for it.
      return;
    }

    // Android + system-browser fallback: the deep-link listener / cold-start
    // bootstrap consumes the redirect and clears the pending flag. Nothing to do
    // here — deliberately leaving the pending flag untouched avoids racing a
    // Custom Tab dismiss against the incoming redirect.
  } catch (error) {
    // Even the system-browser fallback failed to open.
    await clearLoginPending();
    recordError(error, 'auth: startLogin failed to open the login URL');
    showErrorAlert('Could not open the sign-in page. Please try again.');
  }
}
