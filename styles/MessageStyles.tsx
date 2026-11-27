import font from '@utils/font';
import { StyleSheet } from 'react-native';

export const MessageStyles = StyleSheet.create({
  saveContainer: {
    position: 'absolute',
    bottom: 2,
    zIndex: 100,
    width: '100%',
    maxWidth: 356,
    /**
     * A FLOOR, not a fixed height.
     *
     * At 48 the pill had 28pt of usable space after padding — which is exactly
     * what a 22pt line needs at the largest font setting, leaving nothing for a
     * descender or a second line. The text sat off-centre and then clipped,
     * worst on iOS, and the reader's longer message wrapped straight out of the
     * box. Text that scales cannot live in a container that does not.
     */
    minHeight: 48,
    alignSelf: 'center',
    padding: 10,
    alignItems: 'center',
    flexDirection: 'row',
    borderRadius: 10,
    backgroundColor: '#11336A',
    gap: 10,
  },

  saveText: {
    // Wrap inside the pill rather than running past its edge at the larger
    // settings, now that the pill can grow to hold a second line.
    flexShrink: 1,
    color: '#fff',
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 16,
  },
});
