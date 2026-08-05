import { SEHAJ_API_URL } from '@env';
import { recordError } from '../utils/crashlytics';
import { client } from './generated/client.gen';

/**
 * The API base URL comes entirely from `SEHAJ_API_URL` (`.env` / CI) — a single
 * source, no dev/prod branching and no hardcoded URLs. Set it per environment
 * in `.env`. If it's missing, `configureApiClient` fails fast rather than
 * issuing requests against an undefined host.
 */
export const SEHAJ_API_BASE_URL: string | null = SEHAJ_API_URL
  ? SEHAJ_API_URL.replace(/\/+$/, '')
  : null;

/**
 * Without a timeout a hung request never settles, so every single-flight guard
 * that waits on it (preflight, the outbox drain, an account switch) stays latched
 * forever and sync silently stops. A timeout surfaces as an ordinary network
 * error, so callers already handle it: retry with backoff, change no data, and
 * never read it as "the account is empty".
 */
export const REQUEST_TIMEOUT_MS = 25_000;

/**
 * `/sync` carries up to 1000 paths and 2 MB through a serializable server
 * transaction, so it legitimately runs longer than a CRUD call. Reusing the
 * ordinary timeout would abort slow-but-valid merges and turn a working sync
 * into a retry loop.
 */
export const SYNC_REQUEST_TIMEOUT_MS = 60_000;

let tokenGetter: () => Promise<string | null> = async () => null;

export const setTokenGetter = (getter: () => Promise<string | null>): void => {
  tokenGetter = getter;
};

let configured = false;

/** True once a base URL was found, i.e. cloud sync is possible at all. */
export const isApiConfigured = (): boolean => configured;

/**
 * Configure the generated client once at app boot: set the base URL and attach
 * a request interceptor that adds the current Bearer token. Idempotent — safe
 * to call on every mount (interceptor is registered only once).
 *
 * Returns false and NEVER throws when no base URL is available. `.env` is
 * gitignored, so a release build whose CI forgot to inject `SEHAJ_API_URL` is a
 * real possibility — and throwing here would escape App's effect into the error
 * boundary, leaving the whole app unusable. Sync is an enhancement; it must
 * never stop someone from reading. Callers gate on `isApiConfigured()`, so the
 * app simply runs offline and tells the user why.
 */
export const configureApiClient = (): boolean => {
  if (configured) {
    return true;
  }
  if (!SEHAJ_API_BASE_URL) {
    recordError(
      new Error('SEHAJ_API_URL is not set; cloud sync is unavailable in this build'),
      'api: missing base URL'
    );
    return false;
  }
  configured = true;
  client.setConfig({
    baseURL: SEHAJ_API_BASE_URL,
    timeout: REQUEST_TIMEOUT_MS,
    // Never let the platform HTTP cache store these responses.
    //
    // Two problems it solves, both caused by the same thing. Express sends
    // ETags by default, so iOS/Android revalidate with `If-None-Match` and the
    // server answers 304 Not Modified with no body:
    //
    //  1. Axios counts only 2xx as success, so a 304 arrived as a transport
    //     error and the user was told "unable to sync" about a sync that
    //     worked.
    //  2. Worse, an HTTP cache keys on URL. These endpoints return DIFFERENT
    //     data per account at the SAME url, distinguished only by the bearer
    //     token — and the responses carry no `Vary: Authorization`. A cached
    //     entry from one account could therefore be revalidated, or served,
    //     for another.
    //
    // `no-store` stops the response being cached at all, so no conditional
    // request is ever made and neither problem can arise. These payloads are
    // small and already coalesced; there is nothing to gain from caching them.
    headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
  });
  client.instance.interceptors.request.use(async (requestConfig) => {
    const token = await tokenGetter();
    // A sync operation may pin the token that owned its local snapshot. Do not
    // replace that explicit header with a token from a later account switch.
    if (token && !requestConfig.headers.Authorization) {
      requestConfig.headers.Authorization = `Bearer ${token}`;
    }
    return requestConfig;
  });
  return true;
};
