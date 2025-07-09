import { StyleSheet } from 'react-native';
import font from '@utils/font';

export const SimpleTextForPathStyles = StyleSheet.create({
  coloredContainer: {
    backgroundColor: 'rgba(253, 198, 6, 0.3)',
    width: 'auto',
    padding: 2,
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 2,
  },
  container: {
    backgroundColor: 'transparent',
  },
  text: {
    color: '#000',
    fontSize: 18,
    lineHeight: 36,
    fontFamily: font.Baloo_Paaji_2_Medium,
  },
  icon: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    padding: 2,
    borderRadius: 5,
  },
});
