import React from 'react';
import { Image, View } from 'react-native';
import { AppText as Text } from './AppText';
import { MemberAvatarsStyles as styles } from '@styles';
import { avatarHeaders } from '../store/groupApi';

/**
 * One person as the card needs to draw them.
 *
 * `avatarUri` is optional because most accounts have no picture — a name is the
 * only thing every member is guaranteed to have, and `displayLabel` itself falls
 * back to "Member" when even that is missing.
 */
export interface AvatarMember {
  /** Membership id. Stable per path, and the key React needs. */
  id: string;
  displayLabel: string;
  avatarUri?: string | null;
}

interface Props {
  members: AvatarMember[];
  /**
   * How many faces to draw before collapsing the rest into a count.
   *
   * Three fits the card at its narrowest without the stack crowding the text
   * beside it. A fourth circle is where the row starts to look like a list.
   */
  max?: number;
}

/**
 * The first letter a reader would recognise as theirs.
 *
 * Takes it from the label rather than an email, and uppercases with the
 * device's locale so a Gurmukhi or accented name is not mangled by an
 * ASCII-only assumption. Falls back to a dot rather than an empty circle, so a
 * member with a blank label still reads as a person rather than a gap.
 */
export const initialOf = (label: string): string => {
  const trimmed = label.trim();
  return trimmed.length > 0 ? [...trimmed][0].toLocaleUpperCase() : '·';
};

/**
 * A stable colour for a member, so the same person is the same colour on every
 * card and between launches.
 *
 * Hashed from the membership id rather than the index: position in the list
 * changes as people join and leave, and a face that changes colour when
 * somebody else joins reads as a different person.
 */
const TINTS = ['#11336A', '#2C6E63', '#7A4E2D', '#5B3A8C', '#8A5A12', '#8C3A46'];

export const tintFor = (id: string): string => {
  // Summed rather than bit-mixed: the ids are UUIDs, so their characters are
  // already well spread, and a plain sum keeps this readable without reaching
  // for bitwise operators the lint config disallows.
  let sum = 0;
  for (let i = 0; i < id.length; i += 1) {
    sum = (sum + id.charCodeAt(i) * (i + 1)) % 100_000;
  }
  return TINTS[sum % TINTS.length];
};

/**
 * Overlapping faces of the people reading a shared path, with a count beside
 * them.
 *
 * Renders nothing at all for a personal path — a stack of one is not a group,
 * and an empty row would leave a hole in the card where the group summary sits
 * on shared paths.
 */
export const MemberAvatars = ({ members, max = 3 }: Props) => {
  if (members.length < 2) {
    return null;
  }

  const shown = members.slice(0, max);
  const hidden = members.length - shown.length;

  return (
    <View style={styles.row}>
      <View style={styles.stack}>
        {shown.map((member, index) => (
          <View
            key={member.id}
            // Later circles sit on top, so the overlap reads left-to-right the
            // way the eye scans it. The first needs no pull-in.
            style={[styles.slot, index > 0 && styles.overlap, { zIndex: index, elevation: index }]}
          >
            {member.avatarUri ? (
              <Image
                source={{ uri: member.avatarUri, headers: avatarHeaders() }}
                style={styles.avatar}
                accessibilityLabel={member.displayLabel}
              />
            ) : (
              <View
                style={[styles.avatar, styles.fallback, { backgroundColor: tintFor(member.id) }]}
              >
                <Text style={styles.initial} allowFontScaling={false}>
                  {initialOf(member.displayLabel)}
                </Text>
              </View>
            )}
          </View>
        ))}

        {hidden > 0 && (
          <View
            style={[styles.slot, styles.overlap, { zIndex: shown.length, elevation: shown.length }]}
          >
            <View style={[styles.avatar, styles.fallback, styles.more]}>
              <Text style={styles.initial} allowFontScaling={false}>
                {`+${hidden}`}
              </Text>
            </View>
          </View>
        )}
      </View>

      <Text style={styles.count} numberOfLines={1}>
        {`by ${members.length} ${members.length === 1 ? 'reader' : 'readers'}`}
      </Text>
    </View>
  );
};
