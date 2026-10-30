import { StyleSheet } from 'react-native';
import font from '@utils/font';
import { UIConstants } from '@constants/UIConstants';

export const GroupPathStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FDFCF7' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FDFCF7' },
  content: { padding: 24, gap: 14, paddingBottom: 40 },

  title: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 24,
    color: UIConstants.PRIMARY_COLOR,
  },

  membersRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  membersCount: {
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 15,
    color: '#6B7C99',
    flexShrink: 1,
  },
  add: {
    marginLeft: 'auto',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: UIConstants.PRIMARY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 22,
    color: 'white',
    lineHeight: 26,
  },

  problem: { fontFamily: font.Baloo_Paaji_2_Regular, fontSize: 14, color: '#A3341F' },
  warning: { fontFamily: font.Baloo_Paaji_2_Regular, fontSize: 13, color: '#8A5A00' },

  // The one thing on this screen that is happening right now, so it is the one
  // thing that gets a surface of its own.
  liveCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    gap: 6,
  },
  liveLabel: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 12,
    color: '#1F7A4D',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  liveReader: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 20,
    color: UIConstants.PRIMARY_COLOR,
  },
  liveAng: {
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 15,
    color: '#6B7C99',
    marginBottom: 8,
  },

  primary: {
    backgroundColor: UIConstants.PRIMARY_COLOR,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryText: { fontFamily: font.Baloo_Paaji_2_Extra_Bold, fontSize: 16, color: 'white' },
  disabled: { opacity: 0.5 },

  secondary: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: UIConstants.PRIMARY_COLOR,
  },
  secondaryText: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 16,
    color: UIConstants.PRIMARY_COLOR,
  },

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
});
