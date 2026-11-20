import {
  emptyPersistedSync,
  parseSyncMeta,
  serializeSyncMeta,
  toPersisted,
} from '../../store/syncFormat';
import {
  initialSyncState,
  type PersistedSyncState,
  type SyncState,
} from '../../store/slices/syncSlice';

const UUID = '11111111-2222-4333-8444-555555555555';

const validPersisted = (): PersistedSyncState => ({
  version: 1,
  account: 'user@example.com',
  lastSyncedAt: 1700000000000,
  meta: {
    1: {
      serverPathId: UUID,
      serverUpdatedAt: 1699999999000,
      localUpdatedAt: 1700000000001,
      startDate: 1690000000000,
      deletedAt: null,
      onServer: true,
    },
  },
  pathOps: { 1: { kind: 'update', localUpdatedAt: 1700000000001 } },
  scrollDirty: { 1: 1700000000002 },
  settingsUpdatedAt: 1700000000003,
  pendingSettingsUpdatedAt: null,
});

/** Round-trips through JSON the way the real disk read does. */
const parseObject = (value: unknown) => parseSyncMeta(JSON.stringify(value));

describe('parseSyncMeta — happy paths', () => {
  it('absent key parses to empty', () => {
    expect(parseSyncMeta(null)).toEqual({ status: 'empty' });
  });

  it('valid version-1 data round-trips', () => {
    const value = validPersisted();
    const result = parseSyncMeta(serializeSyncMeta(value));
    expect(result).toEqual({ status: 'valid', value });
  });

  it('serialized empty state round-trips as valid', () => {
    const result = parseSyncMeta(serializeSyncMeta(emptyPersistedSync()));
    expect(result).toEqual({ status: 'valid', value: emptyPersistedSync() });
  });
});

describe('parseSyncMeta — malformed enters recovery', () => {
  it('non-JSON', () => {
    expect(parseSyncMeta('{not json')).toEqual({ status: 'recovery' });
  });

  it('unsupported version', () => {
    expect(parseObject({ ...validPersisted(), version: 2 })).toEqual({ status: 'recovery' });
  });

  it('invalid UUID', () => {
    const v = validPersisted();
    v.meta[1].serverPathId = 'not-a-uuid';
    expect(parseObject(v)).toEqual({ status: 'recovery' });
  });

  it('negative / non-finite timestamp', () => {
    const v = validPersisted();
    v.meta[1].serverUpdatedAt = -1;
    expect(parseObject(v)).toEqual({ status: 'recovery' });
  });

  it('invalid operation kind', () => {
    const v = validPersisted();
    (v.pathOps[1] as { kind: string }).kind = 'destroy';
    expect(parseObject(v)).toEqual({ status: 'recovery' });
  });

  it('operation referencing missing metadata (dangling ref)', () => {
    const v = validPersisted();
    v.pathOps = { 99: { kind: 'update', localUpdatedAt: 1 } };
    expect(parseObject(v)).toEqual({ status: 'recovery' });
  });

  it('scroll entry referencing missing metadata (dangling ref)', () => {
    const v = validPersisted();
    v.scrollDirty = { 99: 1 };
    expect(parseObject(v)).toEqual({ status: 'recovery' });
  });

  it('non-integer numeric key', () => {
    const result = parseSyncMeta(
      JSON.stringify({ ...validPersisted(), meta: { '1.5': validPersisted().meta[1] } })
    );
    expect(result).toEqual({ status: 'recovery' });
  });

  it('extra top-level field (e.g. a leaked token) is rejected', () => {
    expect(parseObject({ ...validPersisted(), token: 'secret' })).toEqual({ status: 'recovery' });
  });

  it('extra field inside a meta record is rejected', () => {
    const v = validPersisted();
    (v.meta[1] as unknown as Record<string, unknown>).token = 'secret';
    expect(parseObject(v)).toEqual({ status: 'recovery' });
  });
});

describe('toPersisted', () => {
  it('extracts exactly the persisted keys and no runtime/token fields', () => {
    const state: SyncState = {
      ...initialSyncState,
      account: 'a@b.com',
      lastSyncedAt: 5,
      status: 'error',
      lastError: 'boom',
      syncApprovedForEmail: 'a@b.com',
    };
    const persisted = toPersisted(state);
    expect(Object.keys(persisted).sort()).toEqual(
      [
        'account',
        'lastSyncedAt',
        'meta',
        'pathOps',
        'pendingSettingsUpdatedAt',
        'scrollDirty',
        'settingsUpdatedAt',
        'version',
      ].sort()
    );
    expect((persisted as unknown as Record<string, unknown>).status).toBeUndefined();
    expect((persisted as unknown as Record<string, unknown>).lastError).toBeUndefined();
  });
});

/**
 * Optional metadata fields.
 *
 * The validator rejects unknown keys, which is right — a leaked token must not
 * survive a round trip. But it enumerated one exact-key set per optional-field
 * combination, so adding `shared` to `SyncMeta` without extending the allowlist
 * made every record the app wrote fail validation on the NEXT launch.
 *
 * The consequence was disproportionate and silent: hydration classified the
 * whole blob as malformed, wiped the in-memory account and set
 * `recoveryNeeded`, which disables all cloud sync until a manual repair. The
 * app simply stopped contacting the server, with correct metadata on disk.
 */
describe('optional fields in persisted sync metadata', () => {
  const withMeta = (extra: Record<string, unknown>) =>
    JSON.stringify({
      ...validPersisted(),
      meta: { 1: { ...validPersisted().meta[1], ...extra } },
    });

  it('accepts a record marked shared', () => {
    const parsed = parseSyncMeta(withMeta({ shared: true }));
    expect(parsed.status).toBe('valid');
  });

  it('accepts a record marked not shared', () => {
    // The value the app actually writes for a personal path, and the one that
    // took cloud sync down.
    const parsed = parseSyncMeta(withMeta({ shared: false }));
    expect(parsed.status).toBe('valid');
  });

  it('still accepts metadata written before group reading existed', () => {
    const parsed = parseSyncMeta(JSON.stringify(validPersisted()));
    expect(parsed.status).toBe('valid');
  });

  it('accepts both optional fields together', () => {
    const parsed = parseSyncMeta(withMeta({ shared: true, serverCreatedAt: 1690000000000 }));
    expect(parsed.status).toBe('valid');
  });

  it('rejects a non-boolean shared', () => {
    expect(parseSyncMeta(withMeta({ shared: 'yes' })).status).toBe('recovery');
  });

  it('still rejects a genuinely unknown field', () => {
    // The reason exact-key matching exists: a leaked token must never survive.
    expect(parseSyncMeta(withMeta({ token: 'secret' })).status).toBe('recovery');
  });

  it('still rejects a record missing a required field', () => {
    const meta = { ...validPersisted().meta[1] } as Record<string, unknown>;
    delete meta.onServer;
    const parsed = parseSyncMeta(JSON.stringify({ ...validPersisted(), meta: { 1: meta } }));
    expect(parsed.status).toBe('recovery');
  });

  it('round-trips a shared flag through serialize and parse', () => {
    // The actual failure was a write the next read could not accept.
    const parsed = parseSyncMeta(withMeta({ shared: true }));
    if (parsed.status !== 'valid') {
      throw new Error('expected valid');
    }
    expect(parsed.value.meta[1].shared).toBe(true);
    const again = parseSyncMeta(serializeSyncMeta(parsed.value));
    expect(again.status).toBe('valid');
  });
});
