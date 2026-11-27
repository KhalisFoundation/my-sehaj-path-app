import EncryptedStorage from 'react-native-encrypted-storage';

// Set when the app itself starts a login; required before a login callback is
// accepted. Binds the SSO callback to a login THIS app initiated, and is
// short-lived + single-use (cleared on the first accepted callback), so the
// window in which any token would be accepted is small.
//
// LIMITATION (needs SSO-service support): this is not a per-request nonce.
// While pending, ANY valid token callback is accepted. Full request binding
// needs a random `state`/nonce the SP echoes back (the SSO API has no such
// param today) and, for interception, verified App/Universal Links +
// authorization-code/PKCE. Raise with the SSO team; see step-2 doc "Security".
const KEY = 'LOGIN_PENDING';
const TTL_MS = 10 * 60 * 1000; // a login round-trip should complete well within this

/** Records that a login started. Returns false if it could not be persisted. */
export async function setLoginPending(): Promise<boolean> {
  try {
    await EncryptedStorage.setItem(KEY, JSON.stringify({ startedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

/** True only if a login was started recently (within the TTL). */
export async function isLoginPending(nowMs: number = Date.now()): Promise<boolean> {
  try {
    const raw = await EncryptedStorage.getItem(KEY);
    if (!raw) {
      return false;
    }
    const parsed = JSON.parse(raw) as { startedAt?: unknown };
    if (typeof parsed.startedAt !== 'number') {
      return false;
    }
    return nowMs - parsed.startedAt <= TTL_MS;
  } catch {
    return false;
  }
}

export async function clearLoginPending(): Promise<void> {
  try {
    await EncryptedStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
}
