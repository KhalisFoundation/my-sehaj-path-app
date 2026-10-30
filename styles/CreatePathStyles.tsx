import { StyleSheet } from 'react-native';
import font from '@utils/font';
import { UIConstants } from '@constants';

export const CreatePathStyles = StyleSheet.create({
  background: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: UIConstants.SCREEN_OVERLAY,
    borderWidth: 4,
    borderColor: UIConstants.SCREEN_BORDER_COLOR,
  },
  scrollContent: {
    flexGrow: 1,
  },
  backButton: {
    marginTop: UIConstants.RHYTHM,
    marginLeft: UIConstants.RHYTHM,
    alignSelf: 'flex-start',
    padding: 8,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: UIConstants.RHYTHM * 2,
  },
  title: {
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 36,
    textAlign: 'center',
  },
  subtitle: {
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 18,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    maxWidth: 500,
    marginTop: UIConstants.RHYTHM * 3,
    paddingHorizontal: UIConstants.PADDING * 2,
    paddingVertical: UIConstants.PADDING,
    borderWidth: 1,
    borderColor: UIConstants.INPUT_BORDER_COLOR,
    borderRadius: UIConstants.BORDER_RADIUS,
    backgroundColor: UIConstants.INPUT_BACKGROUND,
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 18,
    textAlignVertical: 'center',
  },
  continueButton: {
    width: '100%',
    maxWidth: 500,
    marginTop: UIConstants.RHYTHM * 3,
    paddingVertical: UIConstants.PADDING * 0.5,
    borderRadius: UIConstants.BORDER_RADIUS * 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UIConstants.PRIMARY_COLOR,
  },
  continueText: {
    color: UIConstants.NAV_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 18,
  },
  addMemberButton: {
    width: '100%',
    maxWidth: 500,
    marginTop: UIConstants.PADDING,
    paddingVertical: UIConstants.PADDING * 0.5,
    borderWidth: 1,
    borderColor: UIConstants.PRIMARY_COLOR,
    borderRadius: UIConstants.BORDER_RADIUS * 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  addMemberText: {
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 18,
  },
  disabledButton: {
    opacity: 0.6,
  },
});
