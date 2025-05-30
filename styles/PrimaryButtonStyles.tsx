import { StyleSheet } from 'react-native';
import font from '../utils/font';

export const PrimaryButtonStyles = StyleSheet.create({
  container: {
    width: 'auto',
    minWidth: 112,
    height: 'auto',
    marginTop: 10,
    borderRadius: 100,
  },
  button: {
    flexDirection: 'row',
    padding: 11,
    gap: 10,
    alignItems: 'center',
  },
  text: {
    color: 'white',
    letterSpacing: 3,
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 18,
    transform: [{ translateY: -1 }],
  },
});
