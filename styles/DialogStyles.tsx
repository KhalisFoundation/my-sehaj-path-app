import { StyleSheet } from 'react-native';
import font from '@utils/font';

export const DialogStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 36,
  },
  card: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    gap: 12,
  },
  title: {
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 26,
    color: '#11336A',
    textAlign: 'center',
  },
  message: {
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 16,
    lineHeight: 22,
    color: '#2C3E50',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  secondaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  secondaryText: {
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 16,
    color: '#7F8C8D',
  },
  primaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#11336A',
    borderRadius: 28,
    justifyContent: 'center',
  },
  primaryText: {
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
