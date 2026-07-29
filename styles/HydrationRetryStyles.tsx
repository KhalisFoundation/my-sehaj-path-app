import { StyleSheet } from 'react-native';
import font from '@utils/font';

export const HydrationRetryStyles = StyleSheet.create({
  background: {
    height: '100%',
    width: '100%',
  },
  overlay: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(13, 35, 70, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 26,
    lineHeight: 34,
    color: 'rgba(255, 255, 255, 1)',
    textAlign: 'center',
    marginBottom: 14,
  },
  // Reassurance line — the most important thing: their data is safe.
  reassurance: {
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255, 255, 255, 0.82)',
    textAlign: 'center',
  },
  hint: {
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.55)',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 36,
  },
});
