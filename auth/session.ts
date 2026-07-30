import { store } from '../store';
import { setSignedIn, setSignedOut } from '../store/slices/authSlice';
import {
  clearCurrentToken,
  getCurrentToken,
  getCurrentUser,
  InvalidTokenError,
} from './tokenUtils';

/**
 * Resolve the auth slice from a token. Logged-in is determined by the token's
 * presence: the SSO `/user` profile is best-effort — a transient fetch failure
 * keeps the user signed in with a null email, while a definitively invalid
 * token (InvalidTokenError) clears the session.
 */
export async function establishSession(token: string): Promise<void> {
  try {
    const user = await getCurrentUser(token);
    // A newer login or logout changed secure storage while `/user` was in
    // flight. Ignore this stale result instead of overwriting current state.
    if ((await getCurrentToken()) !== token) {
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
      if ((await getCurrentToken()) !== token) {
        return;
      }
      await clearCurrentToken();
      store.dispatch(setSignedOut());
    } else {
      if ((await getCurrentToken()) !== token) {
        return;
      }
      // Transient/network — trust the stored token; profile fills in later.
      store.dispatch(setSignedIn({ token, email: null, firstname: null, lastname: null }));
    }
  }
}
