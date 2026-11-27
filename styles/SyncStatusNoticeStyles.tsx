import { StyleSheet } from 'react-native';
import font from '@utils/font';

export const SyncStatusNoticeStyles = StyleSheet.create({
  /**
   * `top` is supplied by the component from the safe-area inset: this floats
   * above the whole app, outside any SafeAreaView, so a fixed offset would sit
   * under the status bar / notch on most modern phones.
   */
  notice: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 1000,
    maxWidth: '90%',
    borderRadius: 8,
    backgroundColor: '#11336A',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  errorNotice: {
    backgroundColor: '#7A2E2E',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontFamily: font.Baloo_Paaji_2_Regular,
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  },
  offlineSubtext: {
    fontFamily: font.Baloo_Paaji_2_Regular,
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 15,
  },
});
