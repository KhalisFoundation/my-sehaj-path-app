import React from 'react';
import { Share } from 'react-native';
import { Provider } from 'react-redux';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { InviteMember } from '../../screens/InviteMember';
import { store } from '../../store';
import { Routes } from '@constants';
import { enableSharing, createInvite, listMembers } from '../../store/groupApi';

jest.mock('../../store/groupApi', () => ({
  enableSharing: jest.fn(),
  createInvite: jest.fn(),
  listMembers: jest.fn(),
}));

const enableSharingMock = enableSharing as jest.MockedFunction<typeof enableSharing>;
const createInviteMock = createInvite as jest.MockedFunction<typeof createInvite>;
const listMembersMock = listMembers as jest.MockedFunction<typeof listMembers>;

const navigate = jest.fn();
const navigation = { navigate } as never;
const route = {
  key: 'InviteMember',
  name: 'InviteMember',
  params: { sehajPathId: 'p1', pathName: 'Family path' },
} as never;

const renderScreen = () =>
  render(
    <Provider store={store}>
      <InviteMember navigation={navigation} route={route} />
    </Provider>
  );

const members = (
  ...rows: Partial<{ id: string; displayLabel: string; role: string; status: string }>[]
) =>
  listMembersMock.mockResolvedValue({
    ok: true,
    data: rows.map((row, index) => ({
      id: row.id ?? `m${index}`,
      displayLabel: row.displayLabel ?? `Member ${index}`,
      role: row.role ?? 'MEMBER',
      status: row.status ?? 'ACTIVE',
    })),
  } as never);

const minted = (token: string) => {
  enableSharingMock.mockResolvedValue({ ok: true, data: { sharing: 'PUBLIC' } } as never);
  createInviteMock.mockResolvedValue({ ok: true, data: { token } } as never);
};

beforeEach(() => {
  jest.clearAllMocks();
  members();
  jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
});

describe('the InviteMember screen', () => {
  it('does not share the path merely because the screen was opened', async () => {
    const { findByText } = renderScreen();
    await findByText('Create an invite link');

    // Sharing is irreversible in practice — once other people are reading it,
    // a path cannot quietly go back to being one person's. Opening a screen
    // must not do that.
    expect(enableSharingMock).not.toHaveBeenCalled();
    expect(createInviteMock).not.toHaveBeenCalled();
  });

  it('shares the path and mints a link, in that order', async () => {
    minted('tok123');
    const { findByText } = renderScreen();
    fireEvent.press(await findByText('Create an invite link'));

    await waitFor(() => expect(createInviteMock).toHaveBeenCalledWith('p1'));
    expect(enableSharingMock).toHaveBeenCalledWith('p1');
    // Minting before sharing would be refused; the order is load-bearing.
    expect(enableSharingMock.mock.invocationCallOrder[0]).toBeLessThan(
      createInviteMock.mock.invocationCallOrder[0]
    );
  });

  it('shows the full link, because a truncated one cannot be checked by eye', async () => {
    minted('tok123');
    const { findByText } = renderScreen();
    fireEvent.press(await findByText('Create an invite link'));

    expect(await findByText('http://localhost:3500/invite/tok123')).toBeTruthy();
  });

  it('warns that the link cannot be shown again, because that is actually true', async () => {
    minted('tok123');
    const { findByText } = renderScreen();
    fireEvent.press(await findByText('Create an invite link'));

    // The server stores only a hash, so leaving this screen really does lose it.
    expect(await findByText(/can’t be shown again/)).toBeTruthy();
  });

  it('hands the link to the platform share sheet', async () => {
    minted('tok123');
    const { findByText, findByLabelText } = renderScreen();
    fireEvent.press(await findByText('Create an invite link'));
    fireEvent.press(await findByLabelText('Share this invite link'));

    await waitFor(() =>
      expect(Share.share).toHaveBeenCalledWith({
        message: 'http://localhost:3500/invite/tok123',
      })
    );
  });

  it('survives the share sheet being dismissed', async () => {
    minted('tok123');
    // Dismissing rejects on some platforms, and that is not a failure.
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('dismissed'));

    const { findByText, findByLabelText } = renderScreen();
    fireEvent.press(await findByText('Create an invite link'));
    fireEvent.press(await findByLabelText('Share this invite link'));

    await waitFor(() => expect(Share.share).toHaveBeenCalled());
    expect(await findByText(/can’t be shown again/)).toBeTruthy();
  });

  it('stops at the refusal when the caller does not own the path', async () => {
    enableSharingMock.mockResolvedValue({
      ok: false,
      kind: 'refused',
      status: 403,
      message: 'Only the owner of this path can share it.',
    } as never);

    const { findByText } = renderScreen();
    fireEvent.press(await findByText('Create an invite link'));

    expect(await findByText('Only the owner of this path can share it.')).toBeTruthy();
    // No point minting against a path that was never shared.
    expect(createInviteMock).not.toHaveBeenCalled();
  });

  it('does not double-mint when the button is tapped twice', async () => {
    let release: (value: unknown) => void = () => {};
    enableSharingMock.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }) as never
    );

    const { findByText, getByText } = renderScreen();
    fireEvent.press(await findByText('Create an invite link'));
    fireEvent.press(getByText('Creating…'));

    expect(enableSharingMock).toHaveBeenCalledTimes(1);
    release({ ok: false, kind: 'unreachable', message: 'No connection.' });
    await waitFor(() => expect(getByText('No connection.')).toBeTruthy());
  });

  it('lists the people reading, and marks who can approve', async () => {
    members({ displayLabel: 'Harpreet', role: 'ADMIN' }, { displayLabel: 'ਸਿਮਰਨ', role: 'MEMBER' });
    const { findByText } = renderScreen();

    expect(await findByText('Harpreet')).toBeTruthy();
    expect(await findByText('ਸਿਮਰਨ')).toBeTruthy();
    expect(await findByText('Admin')).toBeTruthy();
  });

  it('keeps people who only asked out of the reading list', async () => {
    members(
      { displayLabel: 'Harpreet', status: 'ACTIVE' },
      { displayLabel: 'Manveer', status: 'REQUESTED' }
    );
    const { findByText, queryByText } = renderScreen();
    await findByText('Harpreet');

    // Not members yet. Showing them as reading would misrepresent the group.
    expect(queryByText('Manveer')).toBeNull();
  });

  it('treats a path that is not shared yet as empty rather than broken', async () => {
    listMembersMock.mockResolvedValue({
      ok: false,
      kind: 'refused',
      status: 404,
      message: 'Path not found',
    } as never);

    const { findByText } = renderScreen();
    // The normal state before the first invite, not an error worth showing.
    expect(await findByText('Nobody else has joined yet.')).toBeTruthy();
  });
});
