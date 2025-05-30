import { StyleSheet } from 'react-native';
import font from '../utils/font';

export const SimpleTextStyles = StyleSheet.create({
  simpleTextContainer: {
    flexWrap: 'wrap',
    flexDirection: 'row',
  },
  simpleText: {
    color: 'rgba(153, 153, 153, 1)',
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 16,
  },
});
