import EncryptedStorage from 'react-native-encrypted-storage';
import { SP_API } from './constants';

// Same key gurdham/mobile uses, so the pattern is consistent across Khalis apps.
const TOKEN_KEY = 'USER_TOKEN';

export interface UserData {
  email: string;
  firstname: string;
  lastname: string;
  exp: number;
  iat: number;
  nameID: string;
  nameIDFormat: string;
}

export async function getCurrentToken(): Promise<string | null> {
  try {
    const value = await EncryptedStorage.getItem(TOKEN_KEY);
    return value || null;
  } catch {
    return null;
  }
}

/**
 * Replace the persisted token safely on both platforms.
 *
 * react-native-encrypted-storage's iOS setItem includes the new value in its
 * pre-insert delete query; when a different token already exists that delete
 * misses and SecItemAdd fails with errSecDuplicateItem. Removing by key first
 * avoids that native bug (iOS Keychain entries also survive reinstall).
 * (Mirrors gurdham/mobile's tokenUtils.saveCurrentToken.)
 */
export async function saveCurrentToken(token: string): Promise<void> {
  try {
    await EncryptedStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    const code = String((error as { code?: string | number })?.code ?? '');
    // -25300 is errSecItemNotFound: nothing to replace.
    if (code !== '-25300') {
      throw error;
    }
  }
  await EncryptedStorage.setItem(TOKEN_KEY, token);
}

/** Remove the stored token. The caller can report the uncommon storage error. */
export async function clearCurrentToken(): Promise<boolean> {
  try {
    await EncryptedStorage.removeItem(TOKEN_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Signals the token itself is invalid/expired (SP returned its login page, not
 * JSON) — a permanent failure, not worth retrying.
 */
export class InvalidTokenError extends Error {}

const USER_FETCH_TIMEOUT_MS = 10_000;

/** Fetch the decoded user from the SSO Service Provider for a token. */
export async function fetchUserData(token: string): Promise<UserData> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), USER_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${SP_API}/user`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new InvalidTokenError(`SSO rejected token (HTTP ${response.status})`);
      }
      throw new Error(`Failed to fetch user data (HTTP ${response.status})`);
    }

    // An expired token may redirect to an HTML login page instead of JSON.
    const text = (await response.text()).trim();
    if (!text || text.startsWith('<')) {
      throw new InvalidTokenError('SSO returned HTML instead of JSON (token likely invalid)');
    }
    try {
      return JSON.parse(text) as UserData;
    } catch {
      throw new Error('SSO returned non-JSON payload');
    }
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Returns the SSO user for a token, or null on a transient failure (keep the
 * token — it may still be valid). Definitively invalid tokens throw
 * InvalidTokenError so the caller can clear login state.
 */
export async function getCurrentUser(tokenOverride?: string | null): Promise<UserData | null> {
  const token = tokenOverride ?? (await getCurrentToken());
  if (!token) {
    return null;
  }

  try {
    return await fetchUserData(token);
  } catch (error) {
    if (error instanceof InvalidTokenError) {
      throw error;
    }
    return null;
  }
}
