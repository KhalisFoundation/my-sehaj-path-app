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
import { clearLocalDataForAccountDeletion } from '../store/confirmedSync';
import { getAccountDeleteEndpoint } from './constants';
import { clearLoginPending } from './loginPending';
import { clearCurrentToken, getCurrentToken } from './tokenUtils';

/**
 * Why deletion outcomes are a union rather than a thrown error: each one ends
 * somewhere different — signed out, back at login, or staying put with the
 * account untouched — and that difference matters more than the failure itself.
 */
export type DeleteAccountResult =
  | {
      ok: true;
      /**
       * False when the account was deleted on the server but this device could
       * NOT be cleared. The caller must not report a clean deletion: a failed
       * clear is rolled back by the persistence layer, so the previous account's
       * paths are still on disk and would show in guest mode after sign-out.
       */
      cleared: boolean;
    }
  | {
      ok: false;
      reason:
        | 'no_session'
        | 'unauthorized'
        | 'already_scheduled'
        | 'last_admin'
        | 'network'
        | 'server';
      /** Present for `server`: the HTTP status, so a failure can be diagnosed. */
      status?: number;
      /**
       * Present for `already_scheduled`, which clears this device like a 200.
       * False means the wipe was rolled back, so the caller must not claim the
       * device is clean.
       */
      cleared?: boolean;
    };

/**
 * Without a timeout a hung request never settles, so the row stays disabled and
 * the user is stuck with no way forward. Matches `api/config.ts`.
 */
const DELETE_TIMEOUT_MS = 20_000;

/**
 * `AbortController` + `setTimeout`, deliberately NOT `AbortSignal.timeout()`.
 *
 * React Native's runtime does not provide the static `AbortSignal.timeout`,
 * although Node does — so it type-checks, passes under jest, and then throws a
 * TypeError on device. Because that throw lands inside the request's own
 * try/catch it is swallowed as an ordinary network failure, and deletion fails
 * before the request is ever sent, identically every time.
 */
const withTimeout = (ms: number): { signal: AbortSignal; done: () => void } => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
};

/**
 * A WordPress REST error code, or `''` when there isn't a usable one.
 *
 * Deliberately returns only the `code` field, and only when it looks like a
 * machine identifier. Response bodies are attacker- and server-controlled and
 * may carry an email, a stack trace, or internal paths — none of which belongs
 * in a crash report, where it would be retained by a third party.
 */
async function readErrorCode(response: Response): Promise<string> {
  const code = await response
    .json()
    .then((body: { code?: unknown }) => (typeof body?.code === 'string' ? body.code : ''))
    .catch(() => '');
  // Identifier shape only: lower-case, digits and underscores. Anything else is
  // prose, not a code, and is discarded rather than reported.
  return /^[a-z0-9_]{1,64}$/.test(code) ? code : '';
}

/**
 * Report a rejection with the status and a validated code — never a body.
 */
function reportRejection(status: number, code: string): void {
  recordError(
    new Error(`Account deletion rejected (HTTP ${status})`),
    'auth: deleteAccount rejected',
    { status: String(status), code: code || 'none' }
  );
}

/**
 * End the session WITHOUT touching the user's reading.
 *
 * Kept separate from the full clear because signing out and deleting an account
 * are different amounts of destruction, and only one of them may take reading
 * with it.
 */
async function signOutLocally(): Promise<void> {
  const token = await getCurrentToken();
  if (!(await clearCurrentToken(token ?? undefined))) {
    recordError(
      new Error('account deletion: token could not be cleared'),
      'auth: deleteAccount token-clear failed'
    );
  }
  await clearLoginPending();
  store.dispatch(setSignedOut());
  store.dispatch(dismissSessionExpired());
  // Same reasoning as logout: "the server rejected this" markers must not
  // outlive the session, and here the account they referred to no longer exists.
  clearBlockedWork(store);
  store.dispatch(resetSyncPopup());
  await writeSyncPrefs({ signInPopupDismissed: false });
  store.dispatch(showSignInPopupAgain());
}

/**
 * Everything on this device that belonged to the deleted account.
 *
 * The reading goes first, while still signed in. If it cannot be made durable we
 * still tear down auth, because the account is gone at the identity provider
 * either way and a token that can no longer authenticate would strand the app in
 * a broken signed-in state.
 */
export async function clearDeletedAccountState(): Promise<boolean> {
  const cleared = await clearLocalDataForAccountDeletion(store);
  if (!cleared) {
    recordError(
      new Error('account deletion: local data could not be cleared'),
      'auth: deleteAccount clear failed'
    );
  }
  await signOutLocally();
  return cleared;
}

/**
 * Delete the signed-in user's Khalis account.
 *
 * A direct authenticated call to the IDENTITY PROVIDER — not the service
 * provider, and no browser. WordPress verifies the bearer token by asking the SP
 * about it, so the app sends the JWT it already holds and needs no second
 * credential.
 *
 * Deletion is *scheduled*, not immediate: the account is removed after 30 days,
 * and signing in during that window cancels it. The device is cleared straight
 * away regardless, because the session is dead at the IdP from this moment.
 *
 * Never calls `/logout/all` afterwards — that session no longer exists, so the
 * call would only produce an error to swallow.
 *
 * Never throws; every outcome is reported through the returned result.
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  const token = await getCurrentToken();
  if (!token) {
    return { ok: false, reason: 'no_session' };
  }

  const timeout = withTimeout(DELETE_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(getAccountDeleteEndpoint(), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      signal: timeout.signal,
    });
  } catch (error) {
    // Offline, DNS failure, or timeout. NOTHING was deleted, so the local data
    // must be left exactly as it is — clearing here would destroy the account's
    // reading over a dropped connection.
    recordError(error, 'auth: deleteAccount request failed');
    return { ok: false, reason: 'network' };
  } finally {
    // Release the timer whatever happened, or it keeps the app awake for the
    // rest of the timeout on every successful deletion.
    timeout.done();
  }

  if (response.status === 200) {
    // The boolean matters. `clearActiveAccountDataDurably` restores the previous
    // snapshot when the write cannot be made durable, so ignoring it would sign
    // the user out, say "Account deleted", and leave that account's paths
    // readable in guest mode.
    const cleared = await clearDeletedAccountState();
    return { ok: true, cleared };
  }

  if (response.status === 401) {
    // NOTHING WAS DELETED. The token was refused, so the account still exists
    // and the reading on this device is still the user's.
    //
    // Sign out, because a refused token cannot be used again — but do NOT clear
    // the reading. A 401 here is as likely to mean the endpoint is misconfigured
    // as that the session expired, and wiping somebody's Sehaj Paths because a
    // server rejected a header would be the worst bug this app could have.
    await signOutLocally();
    return { ok: false, reason: 'unauthorized' };
  }

  if (response.status === 409) {
    // 409 carries opposite meanings and only the body separates them, so this
    // clears data on an ALLOW-LIST and never on a fallback. `khalis_last_admin`
    // is a refusal; an unreadable body, or a code added to the API later, is not
    // evidence that anything was deleted — treating either as "already
    // scheduled" would wipe the reading of somebody whose account still exists.
    const code = await readErrorCode(response);

    if (code === 'khalis_already_requested') {
      // From the user's side this IS success — the thing they asked for is
      // already happening — so the device is cleared exactly as for a 200.
      const cleared = await clearDeletedAccountState();
      return { ok: false, reason: 'already_scheduled', cleared };
    }

    if (code === 'khalis_last_admin') {
      recordError(
        new Error('Account deletion refused: last admin'),
        'auth: deleteAccount refused (last admin)'
      );
      return { ok: false, reason: 'last_admin' };
    }

    // Anything else at 409: unknown to this build, so nothing is assumed and
    // nothing is deleted.
    reportRejection(response.status, code);
    return { ok: false, reason: 'server', status: response.status };
  }

  reportRejection(response.status, await readErrorCode(response));
  return { ok: false, reason: 'server', status: response.status };
}
