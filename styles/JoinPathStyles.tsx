import { StyleSheet } from 'react-native';
import font from '@utils/font';

export const JoinPathStyles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#FDFCF7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 14,
  },
  eyebrow: {
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 14,
    color: '#8A8F9A',
    textAlign: 'center',
  },
  title: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 26,
    lineHeight: 34,
    color: '#11336A',
    textAlign: 'center',
  },
  body: {
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 16,
    lineHeight: 24,
    color: '#4A5160',
    textAlign: 'center',
  },
  hint: {
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#8A8F9A',
    textAlign: 'center',
  },
  primary: {
    backgroundColor: '#11336A',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 40,
    marginTop: 8,
    minWidth: 220,
    alignItems: 'center',
  },
  primaryText: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 16,
    color: 'white',
  },
  disabled: { opacity: 0.6 },
  secondary: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  secondaryText: {
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 15,
    color: '#11336A',
  },
});
