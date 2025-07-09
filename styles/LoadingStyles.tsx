import { StyleSheet } from 'react-native';
import font from '@utils/font';

export const LoadingStyles = StyleSheet.create({
  alertContainer: {
    position: 'absolute',
    zIndex: 9,
    backgroundColor: 'white',
    width: '80%',
    height: '15%',
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    top: '40%',
    borderRadius: 10,
  },
  alertText: {
    color: '#11336A',
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 16,
  },
});
