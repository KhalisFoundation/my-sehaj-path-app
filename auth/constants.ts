import { SSO_SERVICE_URL, SSO_IDP_URL } from '@env';

const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

// Mirrors gurdham/mobile's auth/constants.ts. Base URL from `.env` (this app
// uses react-native-dotenv rather than react-native-config).
//
// The SERVICE PROVIDER. Login, logout and the profile lookup live here; it is
// what brokers SAML with the identity provider and hands back a token.
export const SP_API = stripTrailingSlash(SSO_SERVICE_URL ?? 'https://serviceprovider.khalis.net');

// The IDENTITY PROVIDER, which is a different host from the service provider.
// Account deletion is served here rather than by the SP, so it needs its own
// base — deriving it from SP_API would break the moment the two differ, which
// they do in every environment.
export const IDP_API = stripTrailingSlash(SSO_IDP_URL ?? 'https://sso.khalis.net');

// Deep-link return targets. Must be query-string-free — the SP appends
// `?token=…` to the login redirect. Both hosts are registered natively.
//
// `REDIRECT_URL` plays two roles: it is sent to the SP as `redirect_url`, and it
// is the prefix an INCOMING deep link must match to count as our login callback.
// It must stay the FULL url (not just the scheme) — `isLoginCallback` checks the
// character right after it, which is what rejects lookalikes such as
// `khalissehajpath://login-evil?token=…`.
export const REDIRECT_URL = 'khalissehajpath://login';
export const LOGOUT_REDIRECT_URL = 'khalissehajpath://logout';

export function getSSOLoginUrl(): string {
  const encoded = encodeURIComponent(REDIRECT_URL);
  return `${SP_API}/login/sso?redirect_url=${encoded}`;
}

/**
 * Account deletion, required by App Store guideline 5.1.1(v) and Google Play.
 *
 * On the IDENTITY PROVIDER, not the service provider — the two are different
 * hosts, which is why this builds from `IDP_API` rather than `SP_API`.
 *
 * A direct authenticated DELETE, not a browser flow: WordPress verifies the
 * bearer token by asking the SP about it, so the app sends the JWT it already
 * holds and needs no second credential and no deep-link return.
 */
export function getAccountDeleteEndpoint(): string {
  return `${IDP_API}/wp-json/khalis/v1/account?confirm=true`;
}

/**
 * Full SSO logout URL. Unlike clearing the local token, this ends the IdP
 * session too (single-logout), so the next login isn't a silent re-auth.
 */
export function getSSOLogoutUrl(token: string): string {
  const encodedToken = encodeURIComponent(token);
  const encodedRedirect = encodeURIComponent(LOGOUT_REDIRECT_URL);
  return `${SP_API}/logout/all?token=${encodedToken}&redirect_url=${encodedRedirect}`;
}
