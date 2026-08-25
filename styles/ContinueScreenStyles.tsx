import { StyleSheet } from 'react-native';
import font from '@utils/font';
import { UIConstants } from '@constants/UIConstants';

export const ContinueScreenStyles = StyleSheet.create({
  backgroundImage: {
    height: '100%',
  },
  scrollContainer: {
    minHeight: '100%',
  },
  container: {
    backgroundColor: 'rgba(245, 245, 245,0.89)',
    height: '100%',
    padding: UIConstants.PADDING * 3,
    gap: UIConstants.RHYTHM,
  },
  navContainer: {
    flexDirection: 'row',
    gap: 15,
    alignItems: 'center',
  },
  /** Back link on the left, the path's actions on the right. */
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: UIConstants.RHYTHM,
    marginTop: UIConstants.RHYTHM,
  },
  tabActive: {
    borderBottomWidth: 3,
    borderBottomColor: '#11336A',
    paddingBottom: UIConstants.RHYTHM,
  },
  tabText: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 16,
    color: '#11336A',
  },
  sehajHeadingContainer: {
    flexDirection: 'row',
    marginTop: UIConstants.RHYTHM * 2,
  },
  sehajHeading: {
    fontSize: 48,
    fontFamily: font.Brandon_Grotesque_Medium,
  },
  waheguruHeading: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 16,
    marginTop: UIConstants.RHYTHM * 2,
  },
  impTextContainer: {
    fontSize: 22,
    backgroundColor: 'rgba(253, 198, 6, 0.3)',
  },
  textStyle: {
    fontSize: 24,
    lineHeight: 48,
  },
  streakScroll: {
    flexDirection: 'row',
    gap: UIConstants.RHYTHM / 2,
    width: 246,
  },
  streakScrollContainer: {
    maxHeight: 85,
    marginTop: UIConstants.RHYTHM,
    marginBottom: 48,
  },
  complete10Angs: {
    fontFamily: font.Brandon_Grotesque_Regular,
    color: 'gray',
    fontSize: 24,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  continueButtonIcon: {
    paddingLeft: 11,
  },
  streakContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: UIConstants.RHYTHM,
  },
  streakText: {
    fontSize: 72,
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
  },
  streakTagLine: {
    fontSize: 14,
    fontFamily: font.Baloo_Paaji_2_Medium,
    color: '#0D23464D',
  },
  lightningIcon: {
    fontSize: 50,
    color: '#FFD700',
    position: 'relative',
    right: UIConstants.RHYTHM * 2,
  },
  streakValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  streakIcon: {
    width: 72,
    height: 72,
    position: 'relative',
    right: 20,
    shadowColor: '#EEEFAD4D',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
});
