import EncryptedStorage from 'react-native-encrypted-storage';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { logout } from '@auth/logout';
import { getCurrentToken, saveCurrentToken } from '@auth/tokenUtils';
import { isLoginPending, setLoginPending } from '@auth/loginPending';
import { store } from '../../store';
import { setSignedIn } from '../../store/slices/authSlice';
import { addPath } from '../../store/slices/pathsSlice';
import { hydrateEmptySync } from '../../store/slices/syncSlice';
import { blockPathOp, hasSendableWork } from '../../store/syncWork';
import type { DateData, PathData } from '../../types';

const mockedOpenAuth = InAppBrowser.openAuth as jest.MockedFunction<typeof InAppBrowser.openAuth>;

const makePath = (pathId: number): PathData => ({
  pathId,
  saveData: { angNumber: 0, verseId: 0 },
  progress: 1,
  startDate: '1-January-2026',
  completionDate: '',
  pathName: `Path #${pathId}`,
});
const makeDate = (pathid: number): DateData => ({ pathid, dates: [], scrollPosition: 0 });

beforeEach(() => {
  (EncryptedStorage as unknown as { __reset: () => void }).__reset();
  jest.clearAllMocks();
  (
    InAppBrowser.isAvailable as jest.MockedFunction<typeof InAppBrowser.isAvailable>
  ).mockResolvedValue(true);
  mockedOpenAuth.mockResolvedValue({ type: 'cancel' });
  store.dispatch(hydrateEmptySync());
});

describe('logout', () => {
  it('clears token + pending flag, signs out, and ends the IdP session in-app', async () => {
    await saveCurrentToken('tok123');
    await setLoginPending();
    store.dispatch(
      setSignedIn({ token: 'tok123', email: 'a@b.com', firstname: 'A', lastname: 'B' })
    );

    await logout();
    await Promise.resolve();

    expect(await getCurrentToken()).toBeNull();
    expect(await isLoginPending()).toBe(false);
    expect(store.getState().auth.status).toBe('signedOut');
    expect(store.getState().auth.token).toBeNull();
    // Logout must use the same secure browser session as login to clear the IdP
    // cookie — a normal browser may not share it, and a headless call cannot.
    expect(mockedOpenAuth).toHaveBeenCalledWith(
      expect.stringContaining('/logout/all?token=tok123'),
      'khalissehajpath://logout',
      expect.any(Object)
    );
    expect(InAppBrowser.open).not.toHaveBeenCalled();
  });

  it('still signs out locally when the logout session fails', async () => {
    // The browser logout is best-effort; a failure must not block local logout.
    await saveCurrentToken('tok123');
    mockedOpenAuth.mockRejectedValueOnce(new Error('session failed'));
    store.dispatch(
      setSignedIn({ token: 'tok123', email: 'a@b.com', firstname: 'A', lastname: 'B' })
    );

    await logout();
    await Promise.resolve();

    expect(await getCurrentToken()).toBeNull();
    expect(store.getState().auth.status).toBe('signedOut');
  });

  it('signs out locally even when there is no token (no logout session)', async () => {
    await logout();
    await Promise.resolve();
    expect(store.getState().auth.status).toBe('signedOut');
    expect(mockedOpenAuth).not.toHaveBeenCalled();
  });

  it('clears permanently-blocked work so the next login retries it', async () => {
    // Regression: without this, work the server rejected stays skipped after
    // logging back in — and local path ids are reused across accounts, so B's
    // unrelated path could be suppressed by A's marker.
    store.dispatch(
      setSignedIn({ token: 'tok123', email: 'a@b.com', firstname: 'A', lastname: 'B' })
    );
    store.dispatch(addPath({ path: makePath(1), date: makeDate(1) }));
    const op = store.getState().sync.pathOps[1];
    expect(op).toBeDefined();
    blockPathOp(store, 1, op.localUpdatedAt);
    expect(hasSendableWork(store)).toBe(false);

    await logout();

    expect(hasSendableWork(store)).toBe(true);
  });
});
