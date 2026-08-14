import type { SyncSehajPathDto } from '@api/generated/types.gen';
import type { AppStore, RootState } from '../../store/index';
import {
  MAX_SYNC_BODY_BYTES,
  MAX_SYNC_PATHS,
  checkSyncRequestSize,
  syncRequestByteLength,
  syncRequestFingerprint,
  utf8ByteLength,
} from '../../store/syncRequest';
import {
  blockPathOp,
  blockSettings,
  blockSyncBody,
  clearBlockedWork,
  hasAnyUnsentWork,
  hasSendableWork,
  hasWorkBlockingPull,
  isSyncBodyBlocked,
} from '../../store/syncWork';

type PathOps = Record<number, { kind: string; localUpdatedAt: number }>;

const stateWith = (sync: {
  pathOps?: PathOps;
  scrollDirty?: Record<number, number>;
  pendingSettingsUpdatedAt?: number | null;
}): RootState =>
  ({
    sync: {
      pathOps: sync.pathOps ?? {},
      scrollDirty: sync.scrollDirty ?? {},
      pendingSettingsUpdatedAt: sync.pendingSettingsUpdatedAt ?? null,
    },
  } as unknown as RootState);

/** Each test gets a distinct identity so the WeakMap registry cannot leak. */
const newStore = (): AppStore => ({} as unknown as AppStore);

describe('hasSendableWork', () => {
  it('counts a pending op', () => {
    const store = newStore();
    const state = stateWith({ pathOps: { 1: { kind: 'update', localUpdatedAt: 5 } } });
    expect(hasSendableWork(store, state)).toBe(true);
  });

  it('ignores an op blocked at that exact version', () => {
    const store = newStore();
    const state = stateWith({ pathOps: { 1: { kind: 'update', localUpdatedAt: 5 } } });
    blockPathOp(store, 1, 5);
    expect(hasSendableWork(store, state)).toBe(false);
  });

  it('counts the op again once a newer edit changes its version', () => {
    const store = newStore();
    blockPathOp(store, 1, 5);
    const edited = stateWith({ pathOps: { 1: { kind: 'update', localUpdatedAt: 6 } } });
    expect(hasSendableWork(store, edited)).toBe(true);
  });

  it('ignores a blocked settings revision but counts a newer one', () => {
    const store = newStore();
    blockSettings(store, 10);
    expect(hasSendableWork(store, stateWith({ pendingSettingsUpdatedAt: 10 }))).toBe(false);
    expect(hasSendableWork(store, stateWith({ pendingSettingsUpdatedAt: 11 }))).toBe(true);
  });
});

describe('hasWorkBlockingPull', () => {
  it('does not let a blocked op freeze downloads', () => {
    const store = newStore();
    const state = stateWith({ pathOps: { 1: { kind: 'update', localUpdatedAt: 5 } } });
    blockPathOp(store, 1, 5);
    // Rule 9: one permanently rejected action must not stop cloud refreshes.
    expect(hasWorkBlockingPull(store, state)).toBe(false);
  });

  it('still blocks a pull while a scroll is dirty', () => {
    const store = newStore();
    expect(hasWorkBlockingPull(store, stateWith({ scrollDirty: { 1: 99 } }))).toBe(true);
  });

  it('does not block a path pull on a pending settings change', () => {
    const store = newStore();
    // Settings have their own staleness guard when the response is applied;
    // blocking here would stop another device's paths from ever arriving.
    expect(hasWorkBlockingPull(store, stateWith({ pendingSettingsUpdatedAt: 3 }))).toBe(false);
  });
});

describe('hasAnyUnsentWork', () => {
  it('counts a blocked op, unlike hasSendableWork', () => {
    const store = newStore();
    const state = stateWith({ pathOps: { 1: { kind: 'update', localUpdatedAt: 5 } } });
    blockPathOp(store, 1, 5);
    expect(hasSendableWork(store, state)).toBe(false);
    // It is still progress the server never received, so the account is not
    // backed up and must not be hidden by a silent switch.
    expect(hasAnyUnsentWork(state)).toBe(true);
  });
});

describe('clearBlockedWork', () => {
  it('stops one account markers from suppressing another account reusing the id', () => {
    const store = newStore();
    const state = stateWith({ pathOps: { 3: { kind: 'update', localUpdatedAt: 5 } } });
    blockPathOp(store, 3, 5);
    expect(hasSendableWork(store, state)).toBe(false);

    clearBlockedWork(store);

    expect(hasSendableWork(store, state)).toBe(true);
  });
});

const body = (over: Partial<SyncSehajPathDto> = {}): SyncSehajPathDto =>
  ({ paths: [], ...over } as SyncSehajPathDto);

const path = (pathId: string, updatedAt: number) =>
  ({ pathId, updatedAt } as SyncSehajPathDto['paths'][number]);

describe('syncRequestFingerprint', () => {
  it('is stable regardless of path order', () => {
    const a = body({ paths: [path('a', 1), path('b', 2)] });
    const b = body({ paths: [path('b', 2), path('a', 1)] });
    expect(syncRequestFingerprint(a)).toBe(syncRequestFingerprint(b));
  });

  it('changes when any path version changes, so a local edit retries', () => {
    const before = body({ paths: [path('a', 1)] });
    const after = body({ paths: [path('a', 2)] });
    expect(syncRequestFingerprint(before)).not.toBe(syncRequestFingerprint(after));
  });

  it('changes when the cursor or pending settings change', () => {
    const base = body({ paths: [path('a', 1)] });
    expect(syncRequestFingerprint({ ...base, lastSyncedAt: 5 })).not.toBe(
      syncRequestFingerprint(base)
    );
    expect(syncRequestFingerprint({ ...base, settings: {} })).not.toBe(
      syncRequestFingerprint(base)
    );
  });

  it('blocks only the exact body that was rejected', () => {
    const store = newStore();
    const rejected = body({ paths: [path('a', 1)] });
    blockSyncBody(store, syncRequestFingerprint(rejected));

    expect(isSyncBodyBlocked(store, syncRequestFingerprint(rejected))).toBe(true);
    expect(isSyncBodyBlocked(store, syncRequestFingerprint(body({ paths: [path('a', 2)] })))).toBe(
      false
    );
  });
});

describe('sync payload size guard', () => {
  it('measures UTF-8 bytes, not UTF-16 code units', () => {
    // Gurmukhi is 3 UTF-8 bytes per character, so a UTF-16 length check would
    // approve a body the server rejects.
    const gurmukhi = body({ paths: [path('ਸਹਿਜ ਪਾਠ', 1)] });
    const json = JSON.stringify(gurmukhi);
    expect(syncRequestByteLength(gurmukhi)).toBeGreaterThan(json.length);
  });

  it('counts code points the way an encoder does, without TextEncoder', () => {
    // Hermes has no TextEncoder, so this must be computed directly. These are the
    // byte counts a UTF-8 encoder produces.
    expect(utf8ByteLength('abc')).toBe(3); // ASCII
    expect(utf8ByteLength('é')).toBe(2); // 2-byte
    expect(utf8ByteLength('ਸ')).toBe(3); // Gurmukhi, 3-byte
    expect(utf8ByteLength('😀')).toBe(4); // surrogate pair counted once
    expect(utf8ByteLength('\ud800')).toBe(3); // lone surrogate → replacement char
  });

  it('accepts an ordinary body', () => {
    expect(checkSyncRequestSize(body({ paths: [path('a', 1)] })).ok).toBe(true);
  });

  it('rejects more paths than the server accepts', () => {
    const tooMany = body({
      paths: Array.from({ length: MAX_SYNC_PATHS + 1 }, (_, i) => path(`p${i}`, 1)),
    });
    const result = checkSyncRequestSize(tooMany);
    expect(result.ok).toBe(false);
    expect(result.paths).toBe(MAX_SYNC_PATHS + 1);
  });

  it('rejects a body over the byte limit', () => {
    const huge = body({ paths: [path('x'.repeat(MAX_SYNC_BODY_BYTES + 10), 1)] });
    expect(checkSyncRequestSize(huge).ok).toBe(false);
  });
});
