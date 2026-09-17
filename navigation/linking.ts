import type { LinkingOptions } from '@react-navigation/native';
import { Routes } from '@constants';
import { SEHAJ_API_BASE_URL } from '../api/config';
import type { RootStackParamList } from '../App';

/**
 * Opening the app from an invite link.
 *
 * An invite is a URL somebody pastes into a family chat, so the link has to
 * survive being shared by people who will not read it. Three forms are accepted
 * for that reason: the https link the server hands out, the same host with a
 * `www.`, and a custom scheme for the cases where a chat app strips https
 * links or the site is unreachable.
 *
 * The token is the whole payload. It is single-use only in the sense that the
 * server hashes it — the raw value exists in the link and nowhere else, so a
 * lost link cannot be recovered, only replaced.
 */

/**
 * The host invite links are ROUTED from, when one exists.
 *
 * Kept separate from where links are generated: this is what the app accepts,
 * and it costs nothing to accept a host we do not yet hand out. Generating
 * links for a domain nobody owns is what produced invites that opened a browser
 * error instead of the app.
 */
export const INVITE_HOST = 'users.khalis.net';

/**
 * The app's existing custom scheme, reused rather than adding a second one.
 *
 * SSO already registers `khalissehajpath` on both platforms, so an invite on
 * this scheme needs no new iOS entitlement and no new plist entry — only one
 * more `<intent-filter>` host on Android, matching how `login` and `logout` are
 * already declared.
 *
 * The native half is not optional: React Navigation can only route a URL the OS
 * has already handed to the app.
 */
export const APP_SCHEME = 'khalissehajpath';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    `https://${INVITE_HOST}`,
    `https://www.${INVITE_HOST}`,
    // The scheme alone, NOT `khalissehajpath://invite` — React Navigation
    // strips the prefix and matches what is left, so a prefix that already ate
    // `invite` would leave a bare token and match nothing.
    //
    // Sharing the scheme with SSO is safe: the login return is delivered
    // through its own `Linking` listener behind `isLoginCallback`, which
    // accepts only an exact `khalissehajpath://login`. A URL React Navigation
    // cannot route it simply ignores, so neither side consumes the other's.
    `${APP_SCHEME}://`,
  ],
  config: {
    screens: {
      // `invite/:token` rather than a query parameter: a path segment survives
      // being pasted, forwarded and re-encoded far better than `?token=`, which
      // some chat apps truncate at the question mark.
      [Routes.JoinPath]: 'invite/:token',
    },
  },
};

/**
 * The shareable link for a token.
 *
 * Built from the API's own base URL, because the API is what serves
 * `GET /invite/:token` — the page offering "Open in the app". That makes the
 * generated link true by construction on every environment: `localhost:3500` in
 * development, whatever the deployment is in production. No second host to keep
 * in step, and nothing to own that we do not already own.
 *
 * It deliberately does NOT use `INVITE_HOST`. Handing out a link for a domain
 * that does not resolve produced invites that opened a browser error, and an
 * https link cannot open the app at all until Universal Links are configured —
 * which needs a real domain, an Apple entitlement, and a `.well-known` file.
 * The landing page sidesteps all of that: it opens in any browser and offers
 * the custom scheme, which needs no verification and works today.
 *
 * Falls back to the custom scheme when this build has no API configured, so a
 * link is always something that can actually be opened.
 */
export const inviteLinkFor = (token: string): string => {
  const safe = encodeURIComponent(token);
  return SEHAJ_API_BASE_URL
    ? `${SEHAJ_API_BASE_URL}/invite/${safe}`
    : `${APP_SCHEME}://invite/${safe}`;
};
