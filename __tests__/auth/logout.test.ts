import { Linking } from 'react-native';
import EncryptedStorage from 'react-native-encrypted-storage';
import { logout } from '@auth/logout';
import { getCurrentToken, saveCurrentToken } from '@auth/tokenUtils';
import { isLoginPending, setLoginPending } from '@auth/loginPending';
import { store } from '../../store';
import { setSignedIn } from '../../store/slices/authSlice';
import { addPath } from '../../store/slices/pathsSlice';
import { hydrateEmptySync } from '../../store/slices/syncSlice';
import { blockPathOp, hasSendableWork } from '../../store/syncWork';
import type { DateData, PathData } from '../../types';

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
  store.dispatch(hydrateEmptySync());
});

describe('logout', () => {
  it('clears token + pending flag, signs out, and opens /logout/all', async () => {
    await saveCurrentToken('tok123');
    await setLoginPending();
    store.dispatch(
      setSignedIn({ token: 'tok123', email: 'a@b.com', firstname: 'A', lastname: 'B' })
    );
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);

    await logout();

    expect(await getCurrentToken()).toBeNull();
    expect(await isLoginPending()).toBe(false);
    expect(store.getState().auth.status).toBe('signedOut');
    expect(store.getState().auth.token).toBeNull();
    expect(openURL).toHaveBeenCalledWith(expect.stringContaining('/logout/all?token=tok123'));
  });

  it('signs out locally even when there is no token (no logout URL opened)', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    await logout();
    expect(store.getState().auth.status).toBe('signedOut');
    expect(openURL).not.toHaveBeenCalled();
  });

  it('clears permanently-blocked work so the next login retries it', async () => {
    // Regression: without this, work the server rejected stays skipped after
    // logging back in — and local path ids are reused across accounts, so B's
    // unrelated path could be suppressed by A's marker.
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
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
