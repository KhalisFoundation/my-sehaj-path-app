import { SSO_SERVICE_URL } from '@env';

// Mirrors gurdham/mobile's auth/constants.ts. Base URL from `.env` (this app
// uses react-native-dotenv rather than react-native-config).
export const SP_API = SSO_SERVICE_URL ?? 'https://serviceprovider.khalis.net';

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
 * Full SSO logout URL. Unlike clearing the local token, this ends the IdP
 * session too (single-logout), so the next login isn't a silent re-auth.
 */
export function getSSOLogoutUrl(token: string): string {
  const encodedToken = encodeURIComponent(token);
  const encodedRedirect = encodeURIComponent(LOGOUT_REDIRECT_URL);
  return `${SP_API}/logout/all?token=${encodedToken}&redirect_url=${encodedRedirect}`;
}
