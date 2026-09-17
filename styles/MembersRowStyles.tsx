import { StyleSheet } from 'react-native';
import font from '@utils/font';
import { UIConstants } from '@constants/UIConstants';

export const MembersRowStyles = StyleSheet.create({
  membersRoot: {
    flex: 1,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  memberHeaderTitle: {
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 18,
  },
  memberHeaderCount: {
    color: UIConstants.MUTED_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 16,
  },
  memberList: {
    flex: 1,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  memberListContent: {
    paddingBottom: 2,
  },
  memberListContentFilled: {
    flexGrow: 1,
  },
  memberActions: {
    marginTop: 'auto',
    gap: UIConstants.RHYTHM,
  },
  emptyMemberList: {
    backgroundColor: UIConstants.SURFACE_BACKGROUND,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  emptyMessage: {
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 18,
    minHeight: 80,
    paddingVertical: 28,
    textAlign: 'center',
  },
  member: {
    minHeight: 66,
    paddingVertical: UIConstants.PADDING * 0.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
    paddingHorizontal: 18,
    backgroundColor: UIConstants.SURFACE_BACKGROUND,
    borderColor: '#E6E8ED',
    borderRadius: 22,
    borderWidth: 1,
  },
  memberCopy: {
    flex: 1,
    gap: 3,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: UIConstants.BORDER_RADIUS * 3,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 18,
    color: 'white',
  },
  name: {
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 18,
    color: UIConstants.PRIMARY_COLOR,
  },
  role: {
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 12,
    color: '#777777',
  },
  menu: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  menuText: {
    color: UIConstants.PRIMARY_COLOR,
    fontSize: 24,
    lineHeight: 24,
  },
  primaryAction: {
    backgroundColor: UIConstants.PRIMARY_COLOR,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 16,
  },
  primaryActionText: {
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 18,
    color: 'white',
  },
  secondaryAction: {
    borderWidth: 1,
    borderColor: UIConstants.PRIMARY_COLOR,
    borderRadius: UIConstants.BORDER_RADIUS * 2,
    alignItems: 'center',
    paddingVertical: UIConstants.PADDING * 0.3,
  },
  secondaryActionText: {
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 18,
    color: UIConstants.PRIMARY_COLOR,
  },
  inviteCreateSection: {
    gap: 10,
  },
  inviteHint: {
    color: UIConstants.MUTED_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 15,
    textAlign: 'center',
  },
  inviteExpired: {
    color: '#A3341F',
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 15,
    textAlign: 'center',
  },
  inviteExpiryOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  inviteExpiryOption: {
    borderColor: UIConstants.INPUT_BORDER_COLOR,
    borderRadius: UIConstants.BORDER_RADIUS,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  inviteExpirySelected: {
    backgroundColor: UIConstants.PRIMARY_COLOR,
    borderColor: UIConstants.PRIMARY_COLOR,
  },
  inviteExpiryText: {
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 13,
  },
  inviteExpirySelectedText: {
    color: UIConstants.NAV_TEXT_COLOR,
  },
  leaveAction: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  leaveActionText: {
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 16,
    color: '#A3341F',
  },
  actionBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  actionPopover: {
    position: 'absolute',
    backgroundColor: UIConstants.SURFACE_BACKGROUND,
    borderColor: '#E6E8ED',
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 208,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  popoverTitle: {
    color: '#777777',
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 13,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  popoverAction: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  popoverDivider: {
    backgroundColor: '#E6E8ED',
    height: 1,
    marginHorizontal: 16,
  },
  adminText: {
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 16,
    color: UIConstants.PRIMARY_COLOR,
  },
  removeText: {
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 16,
    color: '#A3341F',
  },
});
