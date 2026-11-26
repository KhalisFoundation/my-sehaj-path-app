import React from 'react';
import { Provider } from 'react-redux';
import { fireEvent, render } from '@testing-library/react-native';
import { JoinPath } from '../../screens/JoinPath';
import { store } from '../../store';
import { setSignedIn } from '../../store/slices/authSlice';
import { setAccount } from '../../store/slices/syncSlice';
import { resolveInvite } from '../../store/groupApi';
import { runConfirmedAccountSync } from '../../store/confirmedSync';
import { hasLocalData } from '../../store/syncWork';
import { Routes } from '@constants';

jest.mock('../../store/groupApi', () => ({
  joinInvite: jest.fn(),
  resolveInvite: jest.fn(),
  resolveInvitePreview: jest.fn(),
  reportUnexpectedGroupRefusal: jest.fn(),
}));
jest.mock('../../store/applyServerResponse', () => ({ ensureAccessiblePath: jest.fn() }));
jest.mock('../../store/confirmedSync', () => ({ runConfirmedAccountSync: jest.fn() }));
jest.mock('../../store/syncWork', () => ({ hasLocalData: jest.fn() }));
jest.mock('@auth', () => ({ startLogin: jest.fn() }));
jest.mock('@hooks', () => ({ useScreenAnalytics: jest.fn() }));
jest.mock('../../utils/Error', () => ({ showErrorAlert: jest.fn() }));

const resolveInviteMock = resolveInvite as jest.MockedFunction<typeof resolveInvite>;
const syncMock = runConfirmedAccountSync as jest.MockedFunction<typeof runConfirmedAccountSync>;
const hasLocalDataMock = hasLocalData as jest.MockedFunction<typeof hasLocalData>;

const reset = jest.fn();
const navigation = { reset, replace: jest.fn(), navigate: jest.fn() } as never;
// What an invite opened from outside the app produces: this is the only route.
const route = { key: 'JoinPath', name: 'JoinPath', params: { token: 'abc' } } as never;

const renderScreen = () =>
  render(
    <Provider store={store}>
      <JoinPath navigation={navigation} route={route} />
    </Provider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  store.dispatch(
    setSignedIn({ token: 't', email: 'reader@example.com', firstname: 'R', lastname: 'S' })
  );
  // Join syncs first whenever this device is not yet linked to the signed-in
  // account (a fresh login or an A → B switch). Linked is the normal case.
  store.dispatch(setAccount('reader@example.com'));
  hasLocalDataMock.mockReturnValue(false);
});

describe('the invite screen, opened cold from a link', () => {
  it('lets someone who is already a member leave without opening the path', async () => {
    resolveInviteMock.mockResolvedValue({
      ok: true,
      data: { sehajPathId: 'g1', name: 'Family path', memberCount: 3, membership: 'ACTIVE' },
    } as never);

    const { findByText } = renderScreen();
    expect(await findByText('Go To Path')).toBeTruthy();

    fireEvent.press(await findByText('Not now'));

    expect(reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: Routes.Home }] });
  });

  it('lets someone whose sync keeps failing leave instead of retrying for ever', async () => {
    // This device is not linked to the account yet, so Join syncs first, and
    // that sync fails.
    store.dispatch(setAccount(null));
    hasLocalDataMock.mockReturnValue(true);
    syncMock.mockResolvedValue(false);

    const { findByText } = renderScreen();
    expect(await findByText('Retry')).toBeTruthy();

    fireEvent.press(await findByText('Not now'));

    expect(reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: Routes.Home }] });
  });
});
