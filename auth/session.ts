import { store } from '../store';
import { setSignedIn, setSignedOut } from '../store/slices/authSlice';
import {
  clearCurrentToken,
  getCurrentToken,
  getCurrentUser,
  InvalidTokenError,
} from './tokenUtils';

// A retry can overlap the original `/user` request for the same token. Only
// the newest request may update auth; otherwise an older transient failure
// could overwrite a newer successful profile with `email: null`.
let latestSessionAttempt = 0;

/**
 * Resolve the auth slice from a token. Logged-in is determined by the token's
 * presence: the SSO `/user` profile is best-effort — a transient fetch failure
 * keeps the user signed in with a null email, while a definitively invalid
 * token (InvalidTokenError) clears the session.
 */
export async function establishSession(token: string): Promise<void> {
  const attempt = ++latestSessionAttempt;
  const isCurrentAttempt = async (): Promise<boolean> =>
    attempt === latestSessionAttempt && (await getCurrentToken()) === token;

  try {
    const user = await getCurrentUser(token);
    // A newer login or logout changed secure storage while `/user` was in
    // flight. Ignore this stale result instead of overwriting current state.
    if (!(await isCurrentAttempt())) {
      return;
    }
    store.dispatch(
      setSignedIn({
        token,
        email: user?.email ?? null,
        firstname: user?.firstname ?? null,
        lastname: user?.lastname ?? null,
      })
    );
  } catch (error) {
    if (error instanceof InvalidTokenError) {
      if (!(await isCurrentAttempt())) {
        return;
      }
      await clearCurrentToken(token);
      store.dispatch(setSignedOut());
    } else {
      if (!(await isCurrentAttempt())) {
        return;
      }
      // Transient/network — trust the stored token; profile fills in later.
      store.dispatch(setSignedIn({ token, email: null, firstname: null, lastname: null }));
    }
  }
}

/**
 * Retries a profile lookup after a transient SSO failure. It is called when the
 * app returns to the foreground or the network reconnects, rather than keeping
 * an always-running retry timer. Never replaces a resolved/newer session.
 */
export async function retrySessionProfile(): Promise<void> {
  const token = await getCurrentToken();
  const { auth } = store.getState();
  if (!token || auth.token !== token || auth.email !== null) {
    return;
  }
  await establishSession(token);
}
