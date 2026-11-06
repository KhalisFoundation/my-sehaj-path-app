import { StyleSheet } from 'react-native';
import { UIConstants } from '@constants/UIConstants';
import font from '@utils/font';

export const SelectionSheetSettingItemStyles = StyleSheet.create({
  /**
   * The label wraps before it will touch the value beside it.
   *
   * The row is `space-between`, which stops distributing space once the two
   * sides fill it — at the larger font settings "Vishraam Source" and its value
   * ran together into one word. Letting only the label give way keeps the value
   * and its chevron intact, and the margin guarantees a gap even at full width.
   */
  label: {
    flexShrink: 1,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    marginLeft: UIConstants.RHYTHM,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  backdropFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  backdropBlur: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  backdropTint: {
    flex: 1,
    backgroundColor: UIConstants.MODAL_BACKDROP_COLOR,
  },
  sheet: {
    maxHeight: '76%',
    backgroundColor: UIConstants.SURFACE_BACKGROUND,
    borderTopLeftRadius: UIConstants.BORDER_RADIUS * 3,
    borderTopRightRadius: UIConstants.BORDER_RADIUS * 3,
    overflow: 'hidden',
  },
  grabber: {
    width: 52,
    height: 6,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: UIConstants.RHYTHM,
    marginBottom: UIConstants.RHYTHM,
    backgroundColor: UIConstants.SHEET_HANDLE_COLOR,
  },
  sheetHeader: {
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: UIConstants.RHYTHM * 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: UIConstants.DIVIDER_COLOR,
  },
  sheetTitle: {
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: UIConstants.SUBTITLE_FONT_SIZE,
    lineHeight: UIConstants.BODY_LINE_HEIGHT,
    textAlign: 'center',
  },
  optionsScroll: {
    flexGrow: 0,
  },
  option: {
    minHeight: 72,
    justifyContent: 'center',
    paddingHorizontal: UIConstants.RHYTHM * 2,
    paddingVertical: UIConstants.RHYTHM,
  },
  selectedOption: {
    backgroundColor: UIConstants.SUBTLE_SURFACE_BACKGROUND,
  },
  optionSeparator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: UIConstants.DIVIDER_COLOR,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionText: {
    fontSize: UIConstants.SUBTITLE_FONT_SIZE,
    fontFamily: font.Baloo_Paaji_2_Regular,
    color: UIConstants.PRIMARY_COLOR,
  },
});
