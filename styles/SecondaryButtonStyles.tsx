import { StyleSheet } from 'react-native';
import font from '../utils/font';

export const SecondaryButtonStyles = StyleSheet.create({
  secondaryButtonContainer: {
    padding: 11,
    borderRadius: 5,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryButtonContent: {
    fontFamily: font.Baloo_Paaji_2_Medium,
    color: 'white',
    fontSize: 16,
  },
});
