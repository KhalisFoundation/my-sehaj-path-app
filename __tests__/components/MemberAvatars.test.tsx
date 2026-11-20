import React from 'react';
import { render } from '@testing-library/react-native';

// `AppText` reads the saved font size from the store. Mocked the same way the
// other component tests do it, rather than standing up a Provider for a
// component that has no state of its own.
jest.mock('../../store/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ settings: { fontSize: { fontSize: 'Small (Default)', number: 24 } } }),
  useAppDispatch: () => jest.fn(),
}));

import { MemberAvatars, type AvatarMember } from '../../components/MemberAvatars';

const member = (id: string, displayLabel: string, avatarUri?: string): AvatarMember => ({
  id,
  displayLabel,
  avatarUri,
});

/** Walks the rendered tree for the circle holding `initial` and reads its fill. */
const colourOfInitial = (tree: unknown, initial: string): string | undefined => {
  let found: string | undefined;
  const walk = (node: any, parentBg?: string) => {
    if (!node || typeof node !== 'object') {
      return;
    }
    const style = node.props?.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
    const bg = flat?.backgroundColor ?? parentBg;
    if (node.children?.length === 1 && node.children[0] === initial) {
      found = parentBg;
    }
    (node.children ?? []).forEach((child: any) => walk(child, bg));
  };
  walk(tree);
  return found;
};

describe('MemberAvatars', () => {
  it('draws nothing for a personal path', () => {
    // A stack of one is not a group, and an empty row would leave a hole in the
    // card where the group summary sits on shared paths.
    const { toJSON } = render(<MemberAvatars members={[member('m1', 'Amrit')]} />);
    expect(toJSON()).toBeNull();
  });

  it('draws nothing when there are no members at all', () => {
    const { toJSON } = render(<MemberAvatars members={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('counts everybody, not just the faces it drew', () => {
    const { getByText } = render(
      <MemberAvatars
        members={[
          member('m1', 'Amrit'),
          member('m2', 'Gurbaj'),
          member('m3', 'Simar'),
          member('m4', 'Harleen'),
          member('m5', 'Jasleen'),
        ]}
      />
    );
    expect(getByText('by 5 readers')).toBeTruthy();
    // Three faces plus the overflow chip.
    expect(getByText('+2')).toBeTruthy();
  });

  it('shows no overflow chip when everybody fits', () => {
    const { queryByText, getByText } = render(
      <MemberAvatars members={[member('m1', 'Amrit'), member('m2', 'Gurbaj')]} />
    );
    expect(getByText('by 2 readers')).toBeTruthy();
    expect(queryByText(/^\+/)).toBeNull();
  });

  it('falls back to the first letter when somebody has no picture', () => {
    const { getByText } = render(
      <MemberAvatars members={[member('m1', 'amrit'), member('m2', 'Gurbaj')]} />
    );
    // Uppercased for the circle even though the name was not.
    expect(getByText('A')).toBeTruthy();
    expect(getByText('G')).toBeTruthy();
  });

  it('uses the picture when there is one, instead of a letter', () => {
    const { queryByText, getByLabelText } = render(
      <MemberAvatars
        members={[member('m1', 'Amrit', 'data:image/png;base64,abc'), member('m2', 'Gurbaj')]}
      />
    );
    expect(getByLabelText('Amrit')).toBeTruthy();
    expect(queryByText('A')).toBeNull();
    expect(queryByText('G')).toBeTruthy();
  });

  it('survives a blank name rather than drawing an empty circle', () => {
    const { getByText } = render(
      <MemberAvatars members={[member('m1', '   '), member('m2', 'Gurbaj')]} />
    );
    expect(getByText('·')).toBeTruthy();
  });

  it('takes the first CHARACTER, so a Gurmukhi name is not mangled', () => {
    const { getByText } = render(
      <MemberAvatars members={[member('m1', 'ਅਮ੍ਰਿਤ'), member('m2', 'Gurbaj')]} />
    );
    expect(getByText('ਅ')).toBeTruthy();
  });

  it('gives the same member the same colour every render', () => {
    // Hashed from the membership id, not the list index — a face that changed
    // colour when somebody else joined would read as a different person.
    const first = render(<MemberAvatars members={[member('m1', 'Amrit'), member('m2', 'G')]} />);
    const firstColour = colourOfInitial(first.toJSON(), 'A');

    const second = render(
      <MemberAvatars members={[member('m0', 'Zed'), member('m1', 'Amrit'), member('m2', 'G')]} />
    );
    expect(colourOfInitial(second.toJSON(), 'A')).toBe(firstColour);
  });
});
