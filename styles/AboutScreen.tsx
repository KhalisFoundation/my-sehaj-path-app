import { StyleSheet } from 'react-native';
import font from '@utils/font';
import { UIConstants } from '@constants/UIConstants';

/**
 * Mirrors `DatabaseUpdateScreen` — same navy header on a white body, same
 * rhythm — so About reads as part of this app rather than as a page borrowed
 * from another one. Content is left-aligned rather than centred: it is prose to
 * be read, not a status to be glanced at.
 *
 * Every colour and base size comes from `UIConstants` rather than a literal, so
 * this screen changes with the rest of the app instead of drifting from it.
 */
export const AboutScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UIConstants.SCREEN_BACKGROUND,
  },
  navContainer: {
    backgroundColor: UIConstants.NAV_BACKGROUND,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: UIConstants.RHYTHM * 0.85,
    padding: UIConstants.RHYTHM * 1.5,
  },
  navText: {
    color: UIConstants.NAV_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: UIConstants.NAV_TITLE_FONT_SIZE,
  },
  content: {
    padding: UIConstants.RHYTHM,
    paddingBottom: UIConstants.RHYTHM * 2,
    gap: UIConstants.RHYTHM,
  },
  appName: {
    color: UIConstants.BRAND_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: UIConstants.TITLE_FONT_SIZE,
  },
  label: {
    color: UIConstants.BODY_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: UIConstants.BODY_FONT_SIZE,
  },
  khalisLogo: {
    width: UIConstants.ABOUT_KHALIS_LOGO_WIDTH,
    height: UIConstants.ABOUT_KHALIS_LOGO_HEIGHT,
    resizeMode: 'contain',
  },
  body: {
    color: UIConstants.BODY_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: UIConstants.BODY_FONT_SIZE,
    lineHeight: UIConstants.BODY_LINE_HEIGHT,
  },
  link: {
    color: UIConstants.BRAND_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: UIConstants.BODY_FONT_SIZE,
    lineHeight: UIConstants.BODY_LINE_HEIGHT,
    textDecorationLine: 'underline',
  },
  baniDbLogo: {
    width: UIConstants.ABOUT_BANIDB_LOGO_SIZE,
    height: UIConstants.ABOUT_BANIDB_LOGO_SIZE,
    resizeMode: 'contain',
  },
  blessing: {
    color: UIConstants.BRAND_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: UIConstants.SUBTITLE_FONT_SIZE,
  },
  divider: {
    height: UIConstants.DIVIDER_HEIGHT,
    backgroundColor: UIConstants.DIVIDER_COLOR,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: UIConstants.RHYTHM * 0.65,
    paddingTop: UIConstants.RHYTHM * 0.2,
  },
  footerText: {
    color: UIConstants.MUTED_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: UIConstants.CAPTION_FONT_SIZE,
  },
});
