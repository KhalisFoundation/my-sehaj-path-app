import { configureApiClient, SEHAJ_API_BASE_URL, setTokenGetter } from '@api/config';
import { sehajPathSyncControllerSync } from '@api/generated/sdk.gen';
import type { SyncSehajPathDto } from '@api/generated/types.gen';

describe('generated API client setup', () => {
  it('resolves the base URL from @env (deterministic test value)', () => {
    expect(SEHAJ_API_BASE_URL).toBe('http://localhost:3500');
  });

  it('configures the client without throwing', () => {
    expect(() => configureApiClient()).not.toThrow();
  });

  it('exposes the sehaj-path SDK functions', () => {
    expect(typeof sehajPathSyncControllerSync).toBe('function');
  });

  it('accepts a token getter', () => {
    expect(() => setTokenGetter(async () => 'test-token')).not.toThrow();
  });

  it('types the sync payload (compile-time check)', () => {
    // Type-only: a well-formed SyncSehajPathDto compiles; a wrong field would fail tsc.
    const body: SyncSehajPathDto = { paths: [], lastSyncedAt: 0 };
    expect(body.paths).toEqual([]);
  });
});
