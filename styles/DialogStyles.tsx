import { StyleSheet } from 'react-native';
import font from '@utils/font';

export const DialogStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 36,
  },
  card: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    gap: 12,
  },
  title: {
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 26,
    color: '#11336A',
    textAlign: 'center',
  },
  message: {
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 16,
    lineHeight: 22,
    color: '#2C3E50',
    textAlign: 'center',
  },
  /** Emphasis inside a message — used for the account emails being compared. */
  strong: {
    fontFamily: font.Baloo_Paaji_2_Medium,
    color: '#11336A',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  secondaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  secondaryText: {
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 16,
    color: '#7F8C8D',
  },
  primaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#11336A',
    borderRadius: 28,
    justifyContent: 'center',
  },
  primaryText: {
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 16,
    color: '#FFFFFF',
  },
  /**
   * Secondary actions sit BELOW the two main buttons as plain text links, so a
   * dialog never shows more than two equal-weight choices. A destructive action
   * is a link rather than a button on purpose: it should be reachable but never
   * look like the expected answer.
   */
  links: {
    marginTop: 4,
    alignItems: 'center',
    gap: 10,
  },
  linkButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  linkText: {
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 14,
    color: '#7F8C8D',
    textAlign: 'center',
  },
  destructiveLinkText: {
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 14,
    color: '#B03A2E',
    textAlign: 'center',
  },
  /** Spinner + "Syncing…" laid out inline inside a button. */
  busyLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingState: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
  },
  destructiveButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#B03A2E',
    borderRadius: 28,
    justifyContent: 'center',
  },
});
