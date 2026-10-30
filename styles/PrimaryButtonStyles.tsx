import { StyleSheet } from 'react-native';
import font from '@utils/font';
import { UIConstants } from '@constants/UIConstants';

export const PrimaryButtonStyles = StyleSheet.create({
  container: {
    width: 'auto',
    minWidth: 125,
    minHeight: 50,
    height: 'auto',
    marginTop: 10,
    borderRadius: 100,
  },
  button: {
    flexDirection: 'row',
    padding: UIConstants.PADDING,
    paddingHorizontal: UIConstants.PADDING * 2,
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#0D2346',
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 18,
  },
});
