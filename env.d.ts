/**
 * Types for values injected by `react-native-dotenv` (babel plugin) from `.env`.
 * Keys are optional at build time (`allowUndefined: true`); code must provide a
 * fallback for any missing value.
 */
declare module '@env' {
  export const SEHAJ_API_URL: string | undefined;
  export const SSO_SERVICE_URL: string | undefined;
  export const SSO_IDP_URL: string | undefined;
}
