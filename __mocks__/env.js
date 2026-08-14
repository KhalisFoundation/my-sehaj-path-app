// Deterministic `@env` values for jest. The react-native-dotenv babel plugin
// is disabled under test (see babel.config.js), so `@env` resolves here instead
// of inlining the local `.env`. Test-only values — not production config.
module.exports = {
  SEHAJ_API_URL: 'http://localhost:3500',
  SSO_SERVICE_URL: 'https://sso.test.local',
};
