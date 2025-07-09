import font from '@utils/font';
import { StyleSheet } from 'react-native';

export const PathRenameStyle = StyleSheet.create({
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
  renameContainer: {
    backgroundColor: '#EBF0F8',
    position: 'relative',
    padding: 5,
    paddingVertical: 25,
    width: '90%',
    maxWidth: 500,
    alignItems: 'center',
    gap: 15,
    borderRadius: 15,
  },
  renameText: {
    fontSize: 18,
    fontFamily: font.Baloo_Paaji_2_Medium,
    color: '#11336A',
  },
  input: {
    borderRadius: 25,
    backgroundColor: 'white',
    fontFamily: font.Baloo_Paaji_2_Medium,
    color: '#11336A',
    fontSize: 20,
    width: '90%',
    textAlign: 'center',
    textAlignVertical: 'center',
    padding: 8,
  },
  updateButton: {
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
});
