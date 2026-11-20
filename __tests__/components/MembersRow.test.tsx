import React from 'react';
import { Image } from 'react-native';
import { Provider } from 'react-redux';
import { render, fireEvent } from '@testing-library/react-native';
import { MembersRow } from '../../components/MembersRow';
import { store } from '../../store';
import * as groupApi from '../../store/groupApi';
import type { SehajPathMember } from '@api/generated/types.gen';

const onAdd = jest.fn();
const onCreateInvite = jest.fn();

const member = (over: Partial<SehajPathMember> = {}) =>
  ({
    id: 'm1',
    displayLabel: 'Inder Singh',
    role: 'ADMIN',
    status: 'ACTIVE',
    isMine: true,
    ...over,
  } as SehajPathMember);

const renderRow = (
  members: SehajPathMember[],
  avatarUriFor?: (m: SehajPathMember) => string | null
) =>
  render(
    <Provider store={store}>
      <MembersRow
        members={members}
        avatarUriFor={avatarUriFor}
        onAdd={onAdd}
        inviteStatus="none"
        onCreateInvite={onCreateInvite}
        canManageMembers
      />
    </Provider>
  );

beforeEach(() => jest.clearAllMocks());

describe('the avatar images', () => {
  it('are requested with the auth headers, because the avatar route is authenticated', () => {
    // Without headers the request gets a 401 and the member shows as an empty
    // circle, never falling back to their initial because a URL was supplied.
    const headers = { Authorization: 'Bearer test-token' };
    const spy = jest.spyOn(groupApi, 'avatarHeaders').mockReturnValue(headers);

    const view = renderRow(
      [member({ id: 'm1', hasAvatar: true })],
      () => 'https://api.example/sehaj-path/paths/p/members/m1/avatar'
    );

    const images = view.UNSAFE_getAllByType(Image);
    expect(images).toHaveLength(1);
    expect(images[0].props.source).toEqual({
      uri: 'https://api.example/sehaj-path/paths/p/members/m1/avatar',
      headers,
    });
    spy.mockRestore();
  });
});

describe('the members row', () => {
  it('names each person, because the reader is looking for someone in particular', () => {
    const { getByText } = renderRow([
      member({ id: 'm1', displayLabel: 'Inder Singh' }),
      member({ id: 'm2', displayLabel: 'Gurbaj Singh' }),
    ]);

    expect(getByText(/Inder Singh/)).toBeTruthy();
    expect(getByText(/Gurbaj Singh/)).toBeTruthy();
  });

  it('falls back to an initial when there is no picture', () => {
    const { getByText } = renderRow([member({ displayLabel: 'Inder Singh' })]);
    expect(getByText('I')).toBeTruthy();
  });

  it('takes the initial from a Gurmukhi name without mangling it', () => {
    // An ASCII-only assumption would produce the wrong glyph, or none.
    const { getByText } = renderRow([member({ displayLabel: 'ਸਿਮਰਨ' })]);
    expect(getByText('ਸ')).toBeTruthy();
  });

  it('still reads as a person when the label is blank', () => {
    const { getByText } = renderRow([member({ displayLabel: '   ' })]);
    // A dot rather than an empty circle, which would look like a gap.
    expect(getByText('·')).toBeTruthy();
  });

  it('uses the picture when there is one, instead of the initial', () => {
    const { queryByText } = renderRow(
      [member({ displayLabel: 'Inder Singh' })],
      () => 'https://example.test/avatar.png'
    );
    expect(queryByText('I')).toBeNull();
  });

  it('offers an admin a way to create an invite link', () => {
    const { getByText } = renderRow([member()]);
    fireEvent.press(getByText('Create link'));
    expect(onCreateInvite).toHaveBeenCalledWith(true);
  });

  it('still offers the plus when nobody has joined yet', () => {
    // The empty state is exactly when inviting matters most.
    const { getByText } = renderRow([]);
    expect(getByText('Create link')).toBeTruthy();
  });
});
