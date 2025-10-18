import { UIConstants } from '@constants/UIConstants';
import font from '@utils/font';
import { StyleSheet } from 'react-native';

export const PathNextAngStyles = StyleSheet.create({
  nextAngContainer: {
    gap: UIConstants.RHYTHM * 5,
    marginBottom: UIConstants.RHYTHM * 10,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imgBg: {
    width: 55,
    height: 55,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  nextButton: {
    width: 83,
    height: 83,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#11336A',
    borderRadius: 100,
  },
  angText: {
    fontSize: 18,
    fontFamily: font.Baloo_Paaji_2_Medium,
    color: '#11336A',
  },
  nextButtonText: {
    color: '#11336A',
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 16,
  },
});
