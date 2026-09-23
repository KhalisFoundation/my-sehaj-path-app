import { getStateFromPath } from '@react-navigation/native';
import { linking, inviteLinkFor, INVITE_HOST, APP_SCHEME } from '../../navigation/linking';
import { Routes } from '@constants';

/**
 * The invite link is the demo's first step, and the half most likely to rot
 * silently: nothing in the app fails a build when a prefix stops matching, the
 * link just opens a browser instead. So these assert the routing itself rather
 * than the shape of the config object.
 */

/** What React Navigation is left holding after it strips a matching prefix. */
const afterPrefix = (url: string): string => {
  const prefix = linking.prefixes.find((candidate) => url.startsWith(candidate));
  if (prefix === undefined) {
    throw new Error(`no prefix in the config matches ${url}`);
  }
  return url.slice(prefix.length).replace(/^\/+/, '');
};

const routeFor = (url: string) => {
  const state = getStateFromPath(afterPrefix(url), linking.config);
  return state?.routes[state.routes.length - 1];
};

describe('opening an invite link', () => {
  it('routes the https link the server hands out to JoinPath, carrying the token', () => {
    const route = routeFor('https://users.khalis.net/invite/abc123');
    expect(route?.name).toBe(Routes.JoinPath);
    expect(route?.params).toEqual({ token: 'abc123' });
  });

  it('routes the same link with a www., because people paste what the browser shows', () => {
    expect(routeFor('https://www.users.khalis.net/invite/abc123')?.params).toEqual({
      token: 'abc123',
    });
  });

  it('routes the custom scheme, which works with no server-side verification', () => {
    // The fallback that makes the demo possible on a fresh install: no
    // assetlinks.json, no Apple entitlement, just the scheme SSO already owns.
    expect(routeFor(`${APP_SCHEME}://invite/abc123`)?.params).toEqual({ token: 'abc123' });
  });

  it('leaves the SSO login return alone', () => {
    // Shares the scheme, so React Navigation sees it — and must decline it,
    // otherwise signing in would navigate somewhere instead of completing.
    expect(
      getStateFromPath(afterPrefix(`${APP_SCHEME}://login?token=x`), linking.config)
    ).toBeUndefined();
  });

  it('decodes a token that had to be escaped in the URL', () => {
    // Tokens are opaque server-side strings. If one ever contains a character
    // that needs escaping, the screen must receive the raw value, not the
    // escaped one — it is looked up verbatim.
    expect(routeFor(`${APP_SCHEME}://invite/a%20b%2Fc`)?.params).toEqual({ token: 'a b/c' });
  });

  it('hands out a link to the API, which is what serves the landing page', () => {
    // NOT `INVITE_HOST`: that domain does not resolve, and an https link cannot
    // open the app until Universal Links are configured anyway. The API already
    // serves `GET /invite/:token`, so the generated link is true by
    // construction in every environment.
    expect(inviteLinkFor('tok123')).toBe('http://localhost:3500/invite/tok123');
  });

  it('escapes the token it puts in the link', () => {
    expect(inviteLinkFor('a b/c')).toBe('http://localhost:3500/invite/a%20b%2Fc');
  });

  it('still routes the host it would use once that domain exists', () => {
    // The router accepts more than the generator hands out, so switching the
    // generated link to a real domain later needs no change here.
    const route = routeFor(`https://${INVITE_HOST}/invite/round-trip-token`);
    expect(route?.name).toBe(Routes.JoinPath);
    expect(route?.params).toEqual({ token: 'round-trip-token' });
  });
});
