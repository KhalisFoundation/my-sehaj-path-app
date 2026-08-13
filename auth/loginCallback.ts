import { store } from '../store';
import { setSigningIn } from '../store/slices/authSlice';
import { REDIRECT_SCHEME } from './constants';
import { clearLoginPending, isLoginPending } from './loginPending';
import { establishSession } from './session';
import { saveCurrentToken } from './tokenUtils';

// Prevent duplicate cold/warm deliveries from consuming the same pending login
// at the same time. The durable pending marker remains the cross-launch guard.
let callbackInProgress = false;

function extractToken(url: string): string | null {
  const match = url.match(/[?&]token=([^&]+)/);
  if (!match?.[1]) {
    return null;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    // Malformed percent-encoding (e.g. `?token=%`) — treat as no token.
    return null;
  }
}

/**
 * True if the URL is exactly our SSO login return carrying a token. The char
 * after the scheme+host must be a boundary (`?`, `/`, or end) so lookalikes
 * like `khalissehajpath://login-evil?token=…` are rejected.
 */
export function isLoginCallback(url: string): boolean {
  if (!url.startsWith(REDIRECT_SCHEME)) {
    return false;
  }
  const boundary = url.charAt(REDIRECT_SCHEME.length);
  if (boundary !== '' && boundary !== '?' && boundary !== '/') {
    return false;
  }
  return /[?&]token=/.test(url);
}

/**
 * Accept an SSO login callback: only if a login was actually initiated by this
 * app (LOGIN_PENDING), then persist the token, clear the flag, and establish
 * the session. Returns true if the callback was consumed. Never throws.
 */
export async function consumeLoginUrl(url: string): Promise<boolean> {
  if (!isLoginCallback(url)) {
    return false;
  }
  const token = extractToken(url);
  if (!token || callbackInProgress) {
    return false;
  }

  callbackInProgress = true;
  try {
    if (!(await isLoginPending())) {
      return false;
    }
    // Report "signing in" NOW. Everything below — secure-storage writes plus the
    // SSO `/user` request inside `establishSession` — takes a second or two, and
    // until it finishes no other state changes, so the app would otherwise sit
    // silent right after the user signed in.
    store.dispatch(setSigningIn(true));
    // Consume first so the callback is single-use even if token storage or the
    // profile request fails. The user can explicitly start login again.
    await clearLoginPending();
    await saveCurrentToken(token);
    await establishSession(token);
    return true;
  } catch {
    return false;
  } finally {
    callbackInProgress = false;
    // `setSignedIn`/`setSignedOut` normally clear this; make sure a throw on the
    // way there can never strand the app showing a permanent "signing in".
    store.dispatch(setSigningIn(false));
  }
}
