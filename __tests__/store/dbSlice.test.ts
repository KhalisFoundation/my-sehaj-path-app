import {
  dbSlice,
  dbDownloadStarted,
  dbReady,
  dbInstalled,
  dbNoticeShown,
  dbNotConfigured,
  dbFailed,
} from '../../store/slices/dbSlice';

const { reducer } = dbSlice;

describe('dbSlice', () => {
  it('download lifecycle: started -> ready', () => {
    let state = reducer(undefined, dbDownloadStarted());
    expect(state).toEqual({ status: 'downloading', completed: null });

    // `dbReady` is the quiet path: ready, with nothing to announce.
    state = reducer(state, dbReady());
    expect(state).toEqual({ status: 'ready', completed: null });
  });

  it('only a genuine success announces itself, and only once', () => {
    // A failed update also ends at `ready` — correctly, since the previous
    // database survives — so `dbReady` must never raise the notice.
    expect(reducer(undefined, dbReady()).completed).toBeNull();

    expect(reducer(undefined, dbInstalled('installed')).completed).toBe('installed');
    expect(reducer(undefined, dbInstalled('updated'))).toEqual({
      status: 'ready',
      completed: 'updated',
    });

    const announced = reducer(undefined, dbInstalled('updated'));
    expect(reducer(announced, dbNoticeShown()).completed).toBeNull();
  });

  it('notConfigured and failed set the status without touching progress semantics', () => {
    expect(reducer(undefined, dbNotConfigured()).status).toBe('notConfigured');
    expect(reducer(undefined, dbFailed()).status).toBe('failed');
  });
});
