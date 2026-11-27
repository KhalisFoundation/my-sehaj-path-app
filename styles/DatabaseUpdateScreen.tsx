import { StyleSheet } from 'react-native';
import font from '@utils/font';

export const DatabaseUpdateScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  navContainer: {
    backgroundColor: '#0D2346',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 18,
  },
  navText: {
    color: '#FFFFFF',
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 21,
  },
  content: {
    alignItems: 'center',
    padding: 28,
    paddingBottom: 44,
    gap: 18,
  },
  logo: {
    width: 180,
    height: 130,
    resizeMode: 'contain',
  },
  subtitle: {
    color: '#2C3E50',
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  statusCard: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#F3F6FA',
    borderRadius: 16,
    padding: 18,
    gap: 8,
  },
  title: {
    color: '#11336A',
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 26,
    textAlign: 'center',
  },
  message: {
    color: '#2C3E50',
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  button: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#11336A',
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 16,
  },
});
