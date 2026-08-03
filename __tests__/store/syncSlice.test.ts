import {
  syncSlice,
  initialSyncState,
  upsertMeta,
  markPathEdited,
  markPathDeleted,
  ackServerPath,
  clearOpIfUnchanged,
  markScrollDirty,
  markSettingsDirty,
  clearSettingsIfUnchanged,
  dropMeta,
  approveSync,
  declineSync,
  resetSyncPopup,
  hydrateSignInPopup,
  dismissSignInPopup,
  showSignInPopupAgain,
  type SyncState,
} from '../../store/slices/syncSlice';

const { reducer } = syncSlice;
const withMeta = (onServer: boolean): SyncState =>
  reducer(
    { ...initialSyncState },
    upsertMeta({ pathId: 1, meta: { serverPathId: 'uuid-1', startDate: 1000, onServer } })
  );

describe('syncSlice — coalescing', () => {
  it('starts unhydrated', () => {
    expect(initialSyncState.hydrated).toBe(false);
  });

  it('edit with no server ack coalesces to create', () => {
    const s = reducer(withMeta(false), markPathEdited({ pathId: 1, at: 100 }));
    expect(s.pathOps[1].kind).toBe('create');
  });

  it('edit on an acknowledged path coalesces to update', () => {
    const s = reducer(withMeta(true), markPathEdited({ pathId: 1, at: 100 }));
    expect(s.pathOps[1].kind).toBe('update');
  });

  it('repeated edits keep one op and advance localUpdatedAt monotonically', () => {
    let s = withMeta(true);
    s = reducer(s, markPathEdited({ pathId: 1, at: 100 }));
    const first = s.pathOps[1].localUpdatedAt;
    s = reducer(s, markPathEdited({ pathId: 1, at: 100 })); // same ms
    expect(Object.keys(s.pathOps)).toHaveLength(1);
    expect(s.pathOps[1].localUpdatedAt).toBeGreaterThan(first);
  });

  it('delete replaces an acknowledged update', () => {
    let s = reducer(withMeta(true), markPathEdited({ pathId: 1, at: 100 }));
    s = reducer(s, markPathDeleted({ pathId: 1, at: 200 }));
    expect(s.pathOps[1].kind).toBe('delete');
    expect(s.meta[1].deletedAt).toBe(200);
  });

  it('deletedAt uses the monotonic ts, not raw at (same-ms safety)', () => {
    let s = reducer(withMeta(true), markPathEdited({ pathId: 1, at: 500 }));
    s = reducer(s, markPathDeleted({ pathId: 1, at: 500 })); // same ms as the edit
    // ts advanced past the edit's 500 → deletedAt must be that advanced value.
    expect(s.meta[1].deletedAt).toBe(s.meta[1].localUpdatedAt);
    expect(s.meta[1].deletedAt).toBeGreaterThan(500);
  });

  it('editing a tombstoned path revives it (delete → create/update, deletedAt cleared)', () => {
    let s = reducer(withMeta(false), markPathDeleted({ pathId: 1, at: 200 }));
    s = reducer(s, markPathEdited({ pathId: 1, at: 300 }));
    expect(s.pathOps[1].kind).toBe('create'); // not on server → create
    expect(s.meta[1].deletedAt).toBeNull();
  });
});

describe('syncSlice — acknowledgement guards', () => {
  it('stale ackServerPath cannot clear a newer op', () => {
    let s = reducer(withMeta(true), markPathEdited({ pathId: 1, at: 100 }));
    const sent = s.pathOps[1].localUpdatedAt;
    s = reducer(s, markPathEdited({ pathId: 1, at: 200 })); // user edits again mid-flight
    s = reducer(s, ackServerPath({ pathId: 1, sentLocalUpdatedAt: sent, serverUpdatedAt: 500 }));
    expect(s.pathOps[1]).toBeDefined(); // newer op survives
    expect(s.meta[1].serverUpdatedAt).toBe(500); // clock still stored
  });

  it('matching ackServerPath clears the op and sets onServer', () => {
    let s = reducer(withMeta(false), markPathEdited({ pathId: 1, at: 100 }));
    const sent = s.pathOps[1].localUpdatedAt;
    s = reducer(s, ackServerPath({ pathId: 1, sentLocalUpdatedAt: sent, serverUpdatedAt: 500 }));
    expect(s.pathOps[1]).toBeUndefined();
    expect(s.meta[1].onServer).toBe(true);
  });

  it('create acked after a newer edit converts create → update', () => {
    let s = reducer(withMeta(false), markPathEdited({ pathId: 1, at: 100 })); // create
    const sent = s.pathOps[1].localUpdatedAt;
    s = reducer(s, markPathEdited({ pathId: 1, at: 200 })); // still create (not on server)
    s = reducer(s, ackServerPath({ pathId: 1, sentLocalUpdatedAt: sent, serverUpdatedAt: 500 }));
    expect(s.pathOps[1].kind).toBe('update'); // remaining work after create
  });

  it('clearOpIfUnchanged only clears the matching timestamp', () => {
    let s = reducer(withMeta(true), markPathEdited({ pathId: 1, at: 100 }));
    const ts = s.pathOps[1].localUpdatedAt;
    s = reducer(s, clearOpIfUnchanged({ pathId: 1, sentLocalUpdatedAt: ts - 1 }));
    expect(s.pathOps[1]).toBeDefined();
    s = reducer(s, clearOpIfUnchanged({ pathId: 1, sentLocalUpdatedAt: ts }));
    expect(s.pathOps[1]).toBeUndefined();
  });
});

describe('syncSlice — scroll / settings / drop', () => {
  it('markScrollDirty sets scrollDirty without creating a path op', () => {
    const s = reducer(withMeta(true), markScrollDirty({ pathId: 1, at: 100 }));
    expect(s.scrollDirty[1]).toBeGreaterThan(0);
    expect(s.pathOps[1]).toBeUndefined();
  });

  it('settings dirty/clear is timestamp-guarded', () => {
    let s = reducer({ ...initialSyncState }, markSettingsDirty({ at: 100 }));
    const ts = s.pendingSettingsUpdatedAt as number;
    s = reducer(s, clearSettingsIfUnchanged(ts - 1));
    expect(s.pendingSettingsUpdatedAt).toBe(ts);
    s = reducer(s, clearSettingsIfUnchanged(ts));
    expect(s.pendingSettingsUpdatedAt).toBeNull();
  });

  it('dropMeta removes metadata, op and scroll state', () => {
    let s = reducer(withMeta(true), markPathEdited({ pathId: 1, at: 100 }));
    s = reducer(s, markScrollDirty({ pathId: 1, at: 200 }));
    s = reducer(s, dropMeta(1));
    expect(s.meta[1]).toBeUndefined();
    expect(s.pathOps[1]).toBeUndefined();
    expect(s.scrollDirty[1]).toBeUndefined();
  });
});

describe('syncSlice — session sync prompt', () => {
  it('approve records the email; decline just marks answered; clear resets', () => {
    let s = reducer({ ...initialSyncState }, approveSync('a@b.com'));
    expect(s.syncPopupAnswered).toBe(true);
    expect(s.syncApprovedForEmail).toBe('a@b.com');
    s = reducer(s, resetSyncPopup());
    expect(s.syncPopupAnswered).toBe(false);
    expect(s.syncApprovedForEmail).toBeNull();
    s = reducer(s, declineSync());
    expect(s.syncPopupAnswered).toBe(true);
    expect(s.syncApprovedForEmail).toBeNull();
  });
});

describe('syncSlice — signed-out login nudge', () => {
  it('starts unchecked so the prompt does not flash before storage is read', () => {
    expect(initialSyncState.signInPopupChecked).toBe(false);
    expect(initialSyncState.signInPopupDismissed).toBe(false);
  });

  it('hydrateSignInPopup(true) marks it checked and dismissed', () => {
    const s = reducer({ ...initialSyncState }, hydrateSignInPopup(true));
    expect(s.signInPopupChecked).toBe(true);
    expect(s.signInPopupDismissed).toBe(true);
  });

  it('dismissSignInPopup hides it; showSignInPopupAgain re-shows it (e.g. after logout)', () => {
    let s = reducer({ ...initialSyncState }, hydrateSignInPopup(false));
    s = reducer(s, dismissSignInPopup());
    expect(s.signInPopupDismissed).toBe(true);
    s = reducer(s, showSignInPopupAgain());
    expect(s.signInPopupDismissed).toBe(false);
    expect(s.signInPopupChecked).toBe(true);
  });
});
