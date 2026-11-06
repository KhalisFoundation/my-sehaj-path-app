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
    gap: UIConstants.RHYTHM,
    backgroundColor: UIConstants.NAV_BACKGROUND,
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
    color: UIConstants.SETTINGS_SECTION_HEADING_COLOR,
    fontFamily: font.Brandon_Grotesque_Regular,
    fontSize: 16,
    lineHeight: 22,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: UIConstants.RHYTHM,
    paddingVertical: UIConstants.RHYTHM,
  },
  settingText: {
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Brandon_Grotesque_Regular,
    fontSize: UIConstants.SUBTITLE_FONT_SIZE,
    lineHeight: 28,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: UIConstants.RHYTHM,
    width: '50%',
    padding: UIConstants.RHYTHM * 1.5,
  },
  databaseUpdateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: UIConstants.RHYTHM,
    paddingVertical: UIConstants.RHYTHM,
  },
  databaseUpdateCopy: {
    flex: 1,
  },
  databaseUpdateText: {
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Brandon_Grotesque_Regular,
    fontSize: UIConstants.SUBTITLE_FONT_SIZE,
    lineHeight: 28,
  },
  deleteAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: UIConstants.RHYTHM,
    paddingVertical: UIConstants.RHYTHM,
  },
  deleteAccountText: {
    color: UIConstants.DESTRUCTIVE_TEXT_COLOR,
    fontFamily: font.Brandon_Grotesque_Regular,
    fontSize: UIConstants.SUBTITLE_FONT_SIZE,
    lineHeight: 28,
  },
});
