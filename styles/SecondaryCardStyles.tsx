import { StyleSheet } from 'react-native';
import font from '@utils/font';
import { UIConstants } from '@constants/UIConstants';

export const CompletedPathCardStyles = StyleSheet.create({
  container: {
    backgroundColor: UIConstants.SURFACE_BACKGROUND,
    borderRadius: UIConstants.BORDER_RADIUS,
    padding: UIConstants.RHYTHM * 1.25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: UIConstants.PRIMARY_COLOR,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sehajText: {
    fontFamily: font.Brandon_Grotesque_Regular,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: UIConstants.PRIMARY_COLOR,
  },
  dateText: {
    fontFamily: font.Brandon_Grotesque_Regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: UIConstants.CARD_SECONDARY_TEXT_COLOR,
    marginVertical: UIConstants.RHYTHM * 0.5,
  },
});
