import { StyleSheet } from 'react-native';

export const DropdownSettingItemStyles = StyleSheet.create({
  /**
   * The label wraps before it will touch the value beside it.
   *
   * The row is `space-between`, which stops distributing space once the two
   * sides fill it — at the larger font settings "Vishraam Source" and its value
   * ran together into one word. Letting only the label give way keeps the value
   * and its chevron intact, and the margin guarantees a gap even at full width.
   */
  label: {
    flexShrink: 1,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    marginLeft: 12,
  },
});
