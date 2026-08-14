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
