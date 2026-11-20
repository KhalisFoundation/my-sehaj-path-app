import { StyleSheet } from 'react-native';
import { UIConstants } from '@constants/UIConstants';
import font from '@utils/font';

export const PathMembershipRemovalDialogStyles = StyleSheet.create({
  card: {
    borderRadius: UIConstants.BORDER_RADIUS * 2.5,
    maxHeight: '98%',
    overflow: 'hidden',
    paddingTop: UIConstants.RHYTHM * 1.5,
  },
  scroll: {
    alignSelf: 'stretch',
    flexShrink: 1,
  },
  content: {
    alignItems: 'center',
    gap: UIConstants.RHYTHM,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    flexShrink: 1,
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: UIConstants.SUBTITLE_FONT_SIZE,
  },
  infoBadge: {
    width: 58,
    height: 58,
    borderRadius: UIConstants.BORDER_RADIUS * 3,
    backgroundColor: UIConstants.STATUS_ERROR_BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: UIConstants.SUBTITLE_FONT_SIZE,
    textAlign: 'center',
  },
  message: {
    color: UIConstants.MODAL_SECONDARY_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    maxWidth: 350,
    fontSize: UIConstants.SMALL_FONT_SIZE,
    textAlign: 'center',
  },
  action: {
    width: '100%',
    backgroundColor: UIConstants.PRIMARY_COLOR,
    borderRadius: UIConstants.BORDER_RADIUS * 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: UIConstants.RHYTHM * 0.5,
  },
  actionText: {
    color: UIConstants.NAV_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: UIConstants.SUBTITLE_FONT_SIZE,
  },
});
