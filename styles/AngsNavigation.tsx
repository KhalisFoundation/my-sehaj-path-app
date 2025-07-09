import { StyleSheet } from 'react-native';
import font from '@utils/font';

export const AngsNavigationStyle = StyleSheet.create({
  blurView: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 999,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlayContainer: {
    padding: 15,
    width: '100%',
    height: '100%',
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },

  angsNavigationContainer: {
    backgroundColor: '#EBF0F8',
    position: 'relative',
    padding: 5,
    paddingVertical: 25,
    width: '95%',
    maxWidth: 500,
    alignItems: 'center',
    gap: 15,
    borderRadius: 15,
  },
  angsNavigationText: {
    fontSize: 18,
    fontFamily: font.Baloo_Paaji_2_Medium,
    color: '#11336A',
  },
  angsNavigationInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    borderRadius: 25,
    backgroundColor: 'white',
    fontFamily: font.Baloo_Paaji_2_Medium,
    color: '#11336A',
    fontSize: 20,
    width: '60%',
    textAlign: 'center',
    textAlignVertical: 'center',
    padding: 8,
  },
  goButton: {
    backgroundColor: '#11336A',
    padding: 8,
    borderRadius: 25,
    alignItems: 'center',
    width: '50%',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontFamily: font.Baloo_Paaji_2_Medium,
  },
  crossIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 999,
  },
  warningText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontFamily: font.Baloo_Paaji_2_Medium,
    textAlign: 'center',
    marginTop: -5,
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
  disabledButtonText: {
    color: '#999999',
  },
});
