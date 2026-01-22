import { StyleSheet } from 'react-native';
import font from '@utils/font';

export const PrimaryButtonStyles = StyleSheet.create({
  container: {
    width: 'auto',
    minWidth: 125,
    minHeight: 50,
    height: 'auto',
    marginTop: 10,
    borderRadius: 100,
  },
  button: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#0D2346',
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 18,
  },
});
