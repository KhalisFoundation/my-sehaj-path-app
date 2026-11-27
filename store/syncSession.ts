import type { RootState } from './index';

/**
 * The identity that was active when a cloud request began. API responses must
 * only be applied while this exact signed-in session still owns the store.
 */
export interface SyncSession {
  token: string;
  email: string;
}

export const captureSyncSession = (state: RootState): SyncSession | null => {
  if (!state.auth.token || !state.auth.email) {
    return null;
  }
  return { token: state.auth.token, email: state.auth.email };
};

export const isCurrentSyncSession = (state: RootState, session: SyncSession): boolean =>
  state.auth.token === session.token && state.auth.email === session.email;

export const syncSessionHeaders = (session: SyncSession): Record<string, string> => ({
  Authorization: `Bearer ${session.token}`,
  // Why this exists: version 3 removes stale shared-path cards only on a 404.
  // This opt-in lets newer builds receive the correct 410 for deletion while
  // older released builds keep their working 404 cleanup. Remove this header
  // and the API's legacy branch only after version 3 is no longer supported.
  'x-sehaj-path-error-codes': '1',
});
