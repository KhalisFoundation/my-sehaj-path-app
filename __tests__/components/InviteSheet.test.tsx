import React from 'react';
import Clipboard from '@react-native-clipboard/clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';
import { Provider } from 'react-redux';
import { render, fireEvent, waitFor, type RenderAPI } from '@testing-library/react-native';
import { InviteSheet } from '../../components/InviteSheet';
import { store } from '../../store';
import { enableSharing, createInvite, listActiveInvites } from '../../store/groupApi';

jest.mock('../../store/groupApi', () => ({
  enableSharing: jest.fn(),
  createInvite: jest.fn(),
  listActiveInvites: jest.fn(),
}));

const enableSharingMock = enableSharing as jest.MockedFunction<typeof enableSharing>;
const createInviteMock = createInvite as jest.MockedFunction<typeof createInvite>;
const listActiveInvitesMock = listActiveInvites as jest.MockedFunction<typeof listActiveInvites>;
const setString = Clipboard.setString as jest.Mock;

const onClose = jest.fn();
const onShared = jest.fn();

const renderSheet = (visible = true, autoCreate = false) =>
  render(
    <Provider store={store}>
      <InviteSheet
        visible={visible}
        sehajPathId="p1"
        onClose={onClose}
        onShared={onShared}
        autoCreate={autoCreate}
      />
    </Provider>
  );

const minted = (token = 'tok123') => {
  enableSharingMock.mockResolvedValue({ ok: true, data: { sharing: 'PUBLIC' } } as never);
  createInviteMock.mockResolvedValue({ ok: true, data: { token } } as never);
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  listActiveInvitesMock.mockResolvedValue({ ok: true, data: [] } as never);
  jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
});

const createLink = async (findByText: RenderAPI['findByText']) => {
  fireEvent.press(await findByText('Create new link'));
  await findByText('Copy Link');
};

describe('the invite sheet', () => {
  it('mints nothing while closed, so opening a path cannot share it', async () => {
    minted();
    renderSheet(false);

    await waitFor(() => expect(enableSharingMock).not.toHaveBeenCalled());
    expect(createInviteMock).not.toHaveBeenCalled();
  });

  it('shares the path before minting, because minting first would be refused', async () => {
    minted();
    const { findByText } = renderSheet();
    await createLink(findByText);

    expect(enableSharingMock.mock.invocationCallOrder[0]).toBeLessThan(
      createInviteMock.mock.invocationCallOrder[0]
    );
  });

  it('tells the path to reload its members once sharing is on', async () => {
    // Turning on sharing creates the owner's own membership row, so the row
    // behind the sheet is stale the moment this succeeds.
    minted();
    const { findByText } = renderSheet();
    await createLink(findByText);

    expect(onShared).toHaveBeenCalled();
  });

  it('copies the link to the clipboard', async () => {
    minted();
    const { findByText } = renderSheet();
    await createLink(findByText);
    fireEvent.press(await findByText('Copy Link'));

    expect(setString).toHaveBeenCalledWith('http://localhost:3500/invite/tok123');
  });

  it('confirms the copy in place, so the button is not pressed again and again', async () => {
    minted();
    const { findByText } = renderSheet();
    await createLink(findByText);
    fireEvent.press(await findByText('Copy Link'));

    expect(await findByText('Copied')).toBeTruthy();
  });

  it('also offers the share sheet, for sending straight to a chat', async () => {
    minted();
    const { findByLabelText, findByText } = renderSheet();
    await createLink(findByText);
    fireEvent.press(await findByLabelText('Share invite link'));

    await waitFor(() =>
      expect(Share.share).toHaveBeenCalledWith({
        message: 'http://localhost:3500/invite/tok123',
      })
    );
  });

  it('survives the share sheet being dismissed', async () => {
    minted();
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('dismissed'));

    const { findByLabelText, findByText } = renderSheet();
    await createLink(findByText);
    fireEvent.press(await findByLabelText('Share invite link'));

    await waitFor(() => expect(Share.share).toHaveBeenCalled());
    expect(await findByText('Copy Link')).toBeTruthy();
  });

  it('stops at the refusal when the caller does not own the path', async () => {
    enableSharingMock.mockResolvedValue({
      ok: false,
      kind: 'refused',
      status: 403,
      message: 'Only the owner of this path can share it.',
    } as never);

    const { findByText } = renderSheet();
    expect(await findByText('Only the owner of this path can share it.')).toBeTruthy();
    expect(createInviteMock).not.toHaveBeenCalled();
  });

  it('shows nothing to copy when the link could not be minted', async () => {
    enableSharingMock.mockResolvedValue({ ok: true, data: { sharing: 'PUBLIC' } } as never);
    createInviteMock.mockResolvedValue({
      ok: false,
      kind: 'unreachable',
      message: 'No connection.',
    } as never);

    const { findByText, queryByText } = renderSheet();
    await findByText('Create new link');
    fireEvent.press(await findByText('Create new link'));
    expect(await findByText('No connection.')).toBeTruthy();
    expect(queryByText('Copy Link')).toBeNull();
  });

  it('keeps the expired-link state when the cached link has expired', async () => {
    await AsyncStorage.setItem(
      'sehaj-path-invite:p1',
      JSON.stringify({
        link: 'http://localhost:3500/invite/expired',
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      })
    );
    minted();

    const { findByText, queryByText } = renderSheet();

    expect(
      await findByText('This link has expired. Create a new one to share this path.')
    ).toBeTruthy();
    expect(await findByText('Create new link')).toBeTruthy();
    expect(queryByText('Copy Link')).toBeNull();
  });

  it('does not show create-link controls when active invites cannot be loaded', async () => {
    enableSharingMock.mockResolvedValue({ ok: true, data: { sharing: 'PUBLIC' } } as never);
    listActiveInvitesMock.mockResolvedValue({
      ok: false,
      kind: 'unreachable',
      message: 'Could not load active invite links.',
    } as never);

    const { findByText, queryByText } = renderSheet(true, true);

    expect(await findByText('Could not load active invite links.')).toBeTruthy();
    expect(createInviteMock).not.toHaveBeenCalled();
    expect(queryByText('Create new link')).toBeNull();
    expect(queryByText('24 hours')).toBeNull();
  });

  it('closes when the dimmed area is tapped', async () => {
    minted();
    const { findByLabelText } = renderSheet();
    fireEvent.press(await findByLabelText('Close'));

    expect(onClose).toHaveBeenCalled();
  });
});
