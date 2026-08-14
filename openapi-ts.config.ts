import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: {
    // Committed copy of the Sehaj Path API spec. Refresh via `yarn gen:api:pull`.
    path: './api-spec/openapi.json',
  },
  // The spec covers the whole user-store API; this app imports only the
  // sehajPaths*/sehajPathSettings*/sehajPathSync* functions. Unused endpoints
  // are harmless (tag-filtering is version-finicky in openapi-ts 0.99).
  output: { path: 'api/generated', postProcess: ['prettier'] },
  plugins: ['@hey-api/client-axios', '@hey-api/typescript', '@hey-api/sdk'],
});
