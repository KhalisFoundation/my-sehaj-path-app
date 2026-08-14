import {
  dbSlice,
  dbDownloadStarted,
  dbDownloadProgress,
  dbReady,
  dbNotConfigured,
  dbFailed,
} from '../../store/slices/dbSlice';

const { reducer } = dbSlice;

describe('dbSlice', () => {
  it('download lifecycle: started -> progress -> ready', () => {
    let state = reducer(undefined, dbDownloadStarted());
    expect(state).toEqual({ status: 'downloading', progress: 0 });

    state = reducer(state, dbDownloadProgress(42));
    expect(state).toEqual({ status: 'downloading', progress: 42 });

    state = reducer(state, dbReady());
    expect(state).toEqual({ status: 'ready', progress: 100 });
  });

  it('notConfigured and failed set the status without touching progress semantics', () => {
    expect(reducer(undefined, dbNotConfigured()).status).toBe('notConfigured');
    expect(reducer(undefined, dbFailed()).status).toBe('failed');
  });
});
