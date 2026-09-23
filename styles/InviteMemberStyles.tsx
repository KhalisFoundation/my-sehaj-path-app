import { StyleSheet } from 'react-native';
import font from '@utils/font';
import { UIConstants } from '@constants/UIConstants';

export const InviteMemberStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FDFCF7' },
  content: { padding: 24, gap: 14, paddingBottom: 40 },

  title: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 24,
    color: UIConstants.PRIMARY_COLOR,
  },
  subtitle: { fontFamily: font.Baloo_Paaji_2_Regular, fontSize: 15, color: '#6B7C99' },
  body: {
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 15,
    color: UIConstants.PRIMARY_COLOR,
    lineHeight: 22,
  },
  hint: {
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 13,
    color: '#6B7C99',
    lineHeight: 19,
  },
  problem: { fontFamily: font.Baloo_Paaji_2_Regular, fontSize: 14, color: '#A3341F' },

  // The link is data, not prose — a monospaced-feeling box so a person can see
  // it is meant to be sent rather than read.
  linkBox: {
    backgroundColor: '#EEF2FA',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  link: {
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 14,
    color: UIConstants.PRIMARY_COLOR,
  },

  primary: {
    backgroundColor: UIConstants.PRIMARY_COLOR,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryText: { fontFamily: font.Baloo_Paaji_2_Extra_Bold, fontSize: 16, color: 'white' },
  disabled: { opacity: 0.5 },

  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF4E0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  waitingText: { fontFamily: font.Baloo_Paaji_2_Extra_Bold, fontSize: 15, color: '#8A5A00' },
  waitingChevron: { fontFamily: font.Baloo_Paaji_2_Extra_Bold, fontSize: 20, color: '#8A5A00' },

  sectionLabel: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 13,
    color: '#6B7C99',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  loading: { marginTop: 8, alignSelf: 'flex-start' },
  empty: { fontFamily: font.Baloo_Paaji_2_Regular, fontSize: 15, color: '#6B7C99' },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  memberName: {
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 16,
    color: UIConstants.PRIMARY_COLOR,
    flexShrink: 1,
  },
  badge: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 12,
    color: '#6B7C99',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
