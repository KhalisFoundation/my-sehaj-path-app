import { StyleSheet } from 'react-native';
import { UIConstants } from '@constants/UIConstants';
import font from '@utils/font';

export const SettingScreenStyle = StyleSheet.create({
  container: {
    flex: 1,
  },
  navContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0D2346',
  },
  navText: {
    color: UIConstants.NAV_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: UIConstants.NAV_TITLE_FONT_SIZE,
  },
  settingContainer: {
    marginTop: 15,
    padding: UIConstants.RHYTHM * 1.1,
    paddingTop: 0,
    // Room below the last row so it clears the home indicator when scrolled to
    // the end, rather than sitting flush against it.
    paddingBottom: UIConstants.RHYTHM * 3,
  },
  sectionHeading: {
    color: 'rgba(153, 153, 153, 1)',
    fontFamily: font.Brandon_Grotesque_Regular,
    fontSize: 16,
    lineHeight: 22,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  settingText: {
    color: '#11336A',
    fontFamily: font.Brandon_Grotesque_Regular,
    fontSize: 20,
    lineHeight: 28,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '50%',
    padding: UIConstants.RHYTHM * 1.5,
  },
  databaseUpdateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  databaseUpdateCopy: {
    flex: 1,
  },
  databaseUpdateText: {
    color: '#11336A',
    fontFamily: font.Brandon_Grotesque_Regular,
    fontSize: 20,
    lineHeight: 28,
  },
  deleteAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  deleteAccountText: {
    color: '#B3261E',
    fontFamily: font.Brandon_Grotesque_Regular,
    fontSize: 20,
    lineHeight: 28,
  },
});
