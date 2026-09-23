import React from 'react';
import { Provider } from 'react-redux';
import { render, fireEvent } from '@testing-library/react-native';
import { MembersRow } from '../../components/MembersRow';
import { store } from '../../store';
import type { SehajPathMember } from '@api/generated/types.gen';

const onAdd = jest.fn();

const member = (over: Partial<SehajPathMember> = {}) =>
  ({
    id: 'm1',
    displayLabel: 'Inder Singh',
    role: 'MEMBER',
    status: 'ACTIVE',
    ...over,
  } as SehajPathMember);

const renderRow = (
  members: SehajPathMember[],
  avatarUriFor?: (m: SehajPathMember) => string | null
) =>
  render(
    <Provider store={store}>
      <MembersRow members={members} avatarUriFor={avatarUriFor} onAdd={onAdd} />
    </Provider>
  );

beforeEach(() => jest.clearAllMocks());

describe('the members row', () => {
  it('names each person, because the reader is looking for someone in particular', () => {
    const { getByText } = renderRow([
      member({ id: 'm1', displayLabel: 'Inder Singh' }),
      member({ id: 'm2', displayLabel: 'Gurbaj Singh' }),
    ]);

    expect(getByText('Inder Singh')).toBeTruthy();
    expect(getByText('Gurbaj Singh')).toBeTruthy();
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

  it('opens the invite sheet from the plus', () => {
    const { getByLabelText } = renderRow([member()]);
    fireEvent.press(getByLabelText('Invite a member'));
    expect(onAdd).toHaveBeenCalled();
  });

  it('still offers the plus when nobody has joined yet', () => {
    // The empty state is exactly when inviting matters most.
    const { getByLabelText } = renderRow([]);
    expect(getByLabelText('Invite a member')).toBeTruthy();
  });
});
