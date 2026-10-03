import { StyleSheet } from 'react-native';
import font from '@utils/font';
import { UIConstants } from '@constants';

export const AddMembersStyles = StyleSheet.create({
  suggestedSheet: {
    maxHeight: '70%',
  },
  suggestedMemberList: {
    flexGrow: 0,
    maxHeight: 360,
    borderRadius: UIConstants.BORDER_RADIUS * 1.5,
    backgroundColor: UIConstants.SURFACE_BACKGROUND,
    overflow: 'hidden',
  },
  background: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: UIConstants.SCREEN_OVERLAY,
    borderWidth: 4,
    borderColor: UIConstants.SCREEN_BORDER_COLOR,
  },
  content: {
    flex: 1,
    paddingHorizontal: UIConstants.RHYTHM * 2,
    paddingBottom: UIConstants.RHYTHM,
    gap: UIConstants.RHYTHM,
    marginTop: UIConstants.RHYTHM,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: UIConstants.RHYTHM,
    gap: UIConstants.RHYTHM * 2,
  },
  heading: {
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 24,
  },
  subtitle: {
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: UIConstants.BODY_FONT_SIZE,
  },
  shareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: UIConstants.PADDING * 1.5,
    paddingVertical: UIConstants.PADDING,
    borderRadius: UIConstants.BORDER_RADIUS * 1.5,
    backgroundColor: UIConstants.SUBTLE_SURFACE_BACKGROUND_V2,
    borderWidth: 1,
    borderColor: UIConstants.BORDER_COLOR,
  },
  linkIcon: {
    width: 44,
    height: 44,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UIConstants.DIVIDER_COLOR,
  },
  shareCopy: {
    flex: 1,
    marginLeft: UIConstants.PADDING,
  },
  shareTitle: {
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 18,
  },
  shareDescription: {
    color: UIConstants.MUTED_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 14,
  },
  memberCard: {
    flexShrink: 1,
    maxHeight: 700,
    borderRadius: UIConstants.BORDER_RADIUS * 1.5,
    backgroundColor: UIConstants.SURFACE_BACKGROUND,
    overflow: 'hidden',
  },
  memberListContent: {
    paddingHorizontal: UIConstants.PADDING * 1.5,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: UIConstants.PADDING,
  },
  memberDivider: {
    height: 1,
    marginLeft: UIConstants.PADDING * 4,
    backgroundColor: UIConstants.DIVIDER_COLOR,
  },
  avatar: {
    width: 35,
    height: 35,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: UIConstants.NAV_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 14,
  },
  memberName: {
    flex: 1,
    marginLeft: UIConstants.RHYTHM,
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 18,
  },
  inviteButton: {
    minWidth: 87,
    alignItems: 'center',
    padding: UIConstants.PADDING * 0.6,
    borderRadius: UIConstants.BORDER_RADIUS * 2,
    backgroundColor: UIConstants.SUBTLE_SURFACE_BACKGROUND_V2,
  },
  inviteText: {
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: UIConstants.BODY_FONT_SIZE,
  },
  empty: {
    marginTop: UIConstants.RHYTHM * 3,
    color: UIConstants.MUTED_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: UIConstants.BODY_FONT_SIZE,
    textAlign: 'center',
  },
  problem: {
    marginTop: UIConstants.RHYTHM,
    color: UIConstants.BODY_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: UIConstants.BODY_FONT_SIZE,
    textAlign: 'center',
  },
  footer: {
    marginTop: 'auto',
    marginBottom: UIConstants.RHYTHM,
  },
  footerButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: UIConstants.BORDER_RADIUS,
    minHeight: 48,
    minWidth: 300,
    maxWidth: 500,
  },
  hiddenButton: {
    display: 'none',
  },
  continueButton: {
    backgroundColor: UIConstants.PRIMARY_COLOR,
  },
  continueText: {
    color: UIConstants.NAV_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 18,
  },
  onlyButton: {
    marginTop: UIConstants.RHYTHM,
    borderWidth: 1,
    borderColor: UIConstants.PRIMARY_COLOR,
  },
  onlyText: {
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 18,
  },
});
