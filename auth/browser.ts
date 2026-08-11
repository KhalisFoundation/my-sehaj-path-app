import { Linking } from 'react-native';
import InAppBrowser, { type InAppBrowserOptions } from 'react-native-inappbrowser-reborn';
import { recordError } from '@utils';

/**
 * Options for the secure in-app auth session used by both login and logout.
 *
 * `ephemeralWebSession: false` is REQUIRED, not cosmetic: the session must share
 * the system cookie jar so the IdP (SAML) session cookie set during login is the
 * same one a later logout ends. An ephemeral session would isolate that cookie
 * and make single-logout impossible (the next login would silently re-auth).
 */
const AUTH_SESSION_OPTIONS: InAppBrowserOptions = {
  // iOS (ASWebAuthenticationSession / SafariViewController)
  ephemeralWebSession: false,
  dismissButtonStyle: 'cancel',
  // Android (Chrome Custom Tabs)
  showTitle: true,
  enableUrlBarHiding: true,
  enableDefaultShare: false,
  forceCloseOnRedirection: false,
  showInRecents: false,
};

/**
 * Result of opening an auth session.
 * - `callback`  — the in-app browser captured the redirect back to our scheme;
 *                 `url` carries the returned `?token=…` for the caller to consume.
 * - `cancelled` — the in-app sheet was dismissed without completing (user backed
 *                 out); the caller should roll back any pending state.
 * - `external`  — the in-app browser was unavailable, so the URL was opened in
 *                 the system browser; the redirect will arrive via the deep-link
 *                 listener instead, so the caller must NOT roll back here.
 */
export type AuthSessionResult =
  | { type: 'callback'; url: string }
  | { type: 'cancelled' }
  | { type: 'external' };

/**
 * Opens `url` in a secure in-app auth session — ASWebAuthenticationSession on
 * iOS, Chrome Custom Tabs on Android — and resolves how it ended.
 *
 * The in-app session keeps the user inside the app (no Safari/Chrome app switch)
 * and, on iOS, captures the redirect to our custom scheme directly, so a
 * successful login returns its token inline rather than through a deep link.
 *
 * Degrades gracefully: if the in-app browser is unavailable, or the session
 * itself errors, it falls back to the system browser and reports `external`.
 * Only re-throws when even the system browser cannot open the URL, so the
 * caller can surface a single, honest "couldn't open sign-in" error.
 */
export async function openAuthSession(
  url: string,
  redirectUrl: string
): Promise<AuthSessionResult> {
  let available = false;
  try {
    available = await InAppBrowser.isAvailable();
  } catch (error) {
    recordError(error, 'auth: InAppBrowser.isAvailable() threw');
    available = false;
  }

  if (available) {
    try {
      const result = await InAppBrowser.openAuth(url, redirectUrl, AUTH_SESSION_OPTIONS);
      if (result.type === 'success' && result.url) {
        return { type: 'callback', url: result.url };
      }
      // 'cancel' / 'dismiss', or success without a URL — the user did not
      // complete the flow in-app.
      return { type: 'cancelled' };
    } catch (error) {
      // The session failed to start/finish. Fall through to the system browser
      // rather than dead-ending the user.
      recordError(error, 'auth: in-app auth session failed; falling back to system browser');
    }
  }

  // Fallback path: system browser. The redirect returns through the OS deep
  // link, handled by the app's `url` listener / cold-start bootstrap.
  await Linking.openURL(url);
  return { type: 'external' };
}
