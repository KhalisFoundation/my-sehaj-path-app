import { SEHAJ_API_URL } from '@env';
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

let tokenGetter: () => Promise<string | null> = async () => null;

export const setTokenGetter = (getter: () => Promise<string | null>): void => {
  tokenGetter = getter;
};

let configured = false;

/**
 * Configure the generated client once at app boot: set the base URL and attach
 * a request interceptor that adds the current Bearer token. Idempotent — safe
 * to call on every mount (interceptor is registered only once). Throws if no
 * base URL is available (release build missing SEHAJ_API_URL).
 */
export const configureApiClient = (): void => {
  if (configured) {
    return;
  }
  if (!SEHAJ_API_BASE_URL) {
    throw new Error(
      'SEHAJ_API_URL is not set. Provide it via .env / the build environment for release builds.'
    );
  }
  configured = true;
  client.setConfig({ baseURL: SEHAJ_API_BASE_URL });
  client.instance.interceptors.request.use(async (requestConfig) => {
    const token = await tokenGetter();
    if (token) {
      requestConfig.headers.Authorization = `Bearer ${token}`;
    }
    return requestConfig;
  });
};
