import { Linking } from 'react-native';
import { store } from '../store';
import { setSignedOut } from '../store/slices/authSlice';
import { consumeLoginUrl, isLoginCallback } from './loginCallback';
import { establishSession } from './session';
import { getCurrentToken } from './tokenUtils';

/**
 * Resolve auth from stored secure storage: a stored token → establish the
 * session; no token → signed out.
 */
export async function hydrateAuth(): Promise<void> {
  const token = await getCurrentToken();
  if (!token) {
    store.dispatch(setSignedOut());
    return;
  }
  await establishSession(token);
}

/**
 * Single boot entry for auth — SERIALIZES the cold-start paths so a callback
 * token and a stored token never race (fixes the cold-start race):
 *   - if the app was cold-started from a login callback → consume it;
 *   - otherwise → hydrate from stored secure storage.
 * The warm listener (`useSSOLogin`) handles callbacks after boot.
 */
export async function initAuth(): Promise<void> {
  let initialUrl: string | null = null;
  try {
    initialUrl = await Linking.getInitialURL();
  } catch {
    initialUrl = null;
  }

  if (initialUrl && isLoginCallback(initialUrl)) {
    const consumed = await consumeLoginUrl(initialUrl);
    if (consumed) {
      return;
    }
  }
  await hydrateAuth();
}
