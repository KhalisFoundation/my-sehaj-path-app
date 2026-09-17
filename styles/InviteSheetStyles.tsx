import { StyleSheet } from 'react-native';
import font from '@utils/font';
import { UIConstants } from '@constants/UIConstants';

export const InviteSheetStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 20, 40, 0.45)',
  },
  sheet: {
    backgroundColor: '#FDFCF7',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 22,
    paddingBottom: 34,
    gap: 14,
  },
  grabber: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C9D3E4',
    alignSelf: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 18,
    color: UIConstants.PRIMARY_COLOR,
    textAlign: 'center',
  },
  inviteDescription: {
    color: '#6B7C99',
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 14,
    textAlign: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FA',
    borderRadius: 10,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 10,
  },
  // Shrinks so the button keeps its full width; the link truncates instead.
  link: {
    flex: 1,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 13,
    color: UIConstants.PRIMARY_COLOR,
  },
  copy: {
    backgroundColor: UIConstants.PRIMARY_COLOR,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  copyText: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 13,
    color: 'white',
  },
  share: {
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: UIConstants.PRIMARY_COLOR,
  },
  shareText: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 15,
    color: UIConstants.PRIMARY_COLOR,
  },
  retry: {
    width: '80%',
    minWidth: 160,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: UIConstants.PRIMARY_COLOR,
  },
  sectionLabel: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 14,
    color: UIConstants.PRIMARY_COLOR,
  },
  activeInvites: {
    gap: 4,
  },
  expiryText: {
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 13,
    color: '#4A5F84',
    textAlign: 'center',
  },
  expiryOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  expiryOption: {
    flexGrow: 1,
    flexBasis: '45%',
    borderWidth: 1,
    borderColor: '#D6DCE6',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  expirySelected: {
    backgroundColor: UIConstants.PRIMARY_COLOR,
    borderColor: UIConstants.PRIMARY_COLOR,
  },
  expiryOptionText: {
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 13,
    color: UIConstants.PRIMARY_COLOR,
  },
  expirySelectedText: {
    color: '#FFFFFF',
  },
  createAnother: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 14,
    color: UIConstants.PRIMARY_COLOR,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  hint: {
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 12,
    color: '#6B7C99',
    lineHeight: 18,
  },
  problem: {
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 14,
    color: '#A3341F',
  },
  loadingState: {
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
    minHeight: 180,
  },
  loadingText: {
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 15,
  },
  createLinkMessage: {
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 14,
    textAlign: 'center',
  },
  loading: {
    marginVertical: 20,
  },
});
