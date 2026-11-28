import { StyleSheet } from 'react-native';
import { UIConstants } from '@constants/UIConstants';
import font from '@utils/font';

export const AngsNavigationStyle = StyleSheet.create({
  blurView: {
    zIndex: 999,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    elevation: 1,
    backgroundColor: UIConstants.FORM_DIALOG_BACKDROP_COLOR,
  },

  overlayContainer: {
    padding: UIConstants.RHYTHM,
    width: '100%',
    height: '100%',
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  angsNavigationContainer: {
    backgroundColor: UIConstants.SUBTLE_SURFACE_BACKGROUND_V2,
    position: 'relative',
    padding: UIConstants.RHYTHM * 0.5,
    paddingVertical: UIConstants.RHYTHM * 3,
    width: '92%',
    maxWidth: 560,
    alignItems: 'center',
    gap: UIConstants.RHYTHM * 1.5,
    borderRadius: UIConstants.BORDER_RADIUS,
    shadowColor: UIConstants.SHADOW_COLOR,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  angsNavigationText: {
    fontSize: UIConstants.BODY_FONT_SIZE,
    fontFamily: font.Baloo_Paaji_2_Medium,
    color: UIConstants.PRIMARY_COLOR,
  },
  angsNavigationInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '90%',
    gap: UIConstants.RHYTHM,
  },
  input: {
    borderRadius: UIConstants.BORDER_RADIUS * 2,
    backgroundColor: UIConstants.SURFACE_BACKGROUND,
    fontFamily: font.Baloo_Paaji_2_Medium,
    color: UIConstants.PRIMARY_COLOR,
    fontSize: UIConstants.SUBTITLE_FONT_SIZE,
    width: '72%',
    textAlign: 'center',
    textAlignVertical: 'center',
    padding: UIConstants.RHYTHM,
  },
  goButton: {
    backgroundColor: UIConstants.PRIMARY_COLOR,
    padding: UIConstants.RHYTHM,
    borderRadius: UIConstants.BORDER_RADIUS * 2,
    alignItems: 'center',
    width: '50%',
  },
  buttonText: {
    color: UIConstants.NAV_TEXT_COLOR,
    fontSize: UIConstants.BODY_FONT_SIZE,
    fontFamily: font.Baloo_Paaji_2_Medium,
  },
  crossIcon: {
    position: 'absolute',
    top: 20,
    right: 22,
    zIndex: 999,
  },
  warningText: {
    color: UIConstants.WARNING_TEXT_COLOR,
    fontSize: UIConstants.CAPTION_FONT_SIZE,
    fontFamily: font.Baloo_Paaji_2_Medium,
    textAlign: 'center',
    marginTop: -5,
  },
  disabledButton: {
    backgroundColor: UIConstants.DISABLED_BACKGROUND_COLOR,
  },
  disabledButtonText: {
    color: UIConstants.INPUT_PLACEHOLDER_COLOR,
  },
});
