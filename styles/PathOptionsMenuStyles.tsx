import { StyleSheet } from 'react-native';
import font from '@utils/font';

export const PathOptionsMenuStyles = StyleSheet.create({
  trigger: {
    padding: 4,
  },
  /**
   * Fills the screen so a tap anywhere closes the menu, but paints nothing —
   * the screen behind stays exactly as it was. Dimming is reserved for the
   * delete confirmation.
   */
  menuBackdrop: {
    flex: 1,
  },
  /** Positioned at runtime, directly beneath the dots that opened it. */
  menu: {
    position: 'absolute',
    minWidth: 180,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  menuItem: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  destructiveItemText: {
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 16,
    color: '#B03A2E',
  },
});
