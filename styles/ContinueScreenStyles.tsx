import { StyleSheet } from 'react-native';
import font from '@utils/font';
import { UIConstants } from '@constants/UIConstants';

export const ContinueScreenStyles = StyleSheet.create({
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF4E0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 20,
  },
  waitingText: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 15,
    color: '#8A5A00',
    flexShrink: 1,
  },
  waitingChevron: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 20,
    color: '#8A5A00',
  },
  backgroundImage: {
    height: '100%',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    backgroundColor: UIConstants.SCREEN_OVERLAY,
    height: '100%',
    paddingTop: UIConstants.PADDING * 2,
    paddingHorizontal: UIConstants.PADDING * 1.5,
    paddingBottom: UIConstants.PADDING,
    gap: UIConstants.RHYTHM,
    borderWidth: 4,
    borderColor: UIConstants.SCREEN_BORDER_COLOR,
  },
  navContainer: {
    flexDirection: 'row',
    gap: 15,
    alignItems: 'center',
  },
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
    borderBottomColor: UIConstants.PRIMARY_COLOR,
    paddingBottom: UIConstants.PADDING * 0.5,
  },
  tabText: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 16,
  },
  tabTextActive: {
    color: UIConstants.PRIMARY_COLOR,
  },
  tabTextInactive: {
    color: UIConstants.MUTED_TEXT_COLOR,
  },
  sehajHeadingContainer: {
    flexDirection: 'row',
    marginTop: UIConstants.RHYTHM * 2,
  },
  sehajHeading: {
    fontSize: 48,
    fontFamily: font.Baloo_Paaji_2_Medium,
  },
  waheguruHeading: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 16,
  },
  liveReaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: UIConstants.PADDING,
    borderRadius: UIConstants.BORDER_RADIUS * 1.5,
    backgroundColor: '#E7F0FC',
    gap: UIConstants.RHYTHM,
  },
  liveReaderAvatar: {
    width: 48,
    height: 48,
    borderRadius: UIConstants.BORDER_RADIUS * 2,
  },
  liveReaderFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UIConstants.PRIMARY_COLOR,
  },
  liveReaderInitial: {
    color: UIConstants.NAV_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: UIConstants.BODY_FONT_SIZE,
  },
  liveReaderCopy: {
    flex: 1,
  },
  liveReaderName: {
    color: '#111111',
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: UIConstants.BODY_FONT_SIZE,
  },
  liveReaderTime: {
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: UIConstants.BODY_FONT_SIZE,
    marginTop: UIConstants.RHYTHM / 3,
  },
  liveBadge: {
    borderWidth: 1,
    borderColor: '#61975B',
    borderRadius: UIConstants.BORDER_RADIUS * 0.5,
    paddingHorizontal: UIConstants.RHYTHM * 0.5,
    paddingVertical: UIConstants.RHYTHM * 0.3,
  },
  liveBadgeText: {
    color: '#61975B',
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: UIConstants.CAPTION_FONT_SIZE,
  },
  liveReaderAng: {
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: UIConstants.SUBTITLE_FONT_SIZE,
  },
  upcomingTurnSection: {
    marginTop: UIConstants.RHYTHM * 2,
  },
  upcomingTurnTitle: {
    color: UIConstants.MUTED_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: UIConstants.BODY_FONT_SIZE,
    marginBottom: UIConstants.RHYTHM,
  },
  upcomingTurnLoading: {
    alignItems: 'center',
    paddingVertical: UIConstants.RHYTHM,
  },
  upcomingTurnCard: {
    backgroundColor: UIConstants.SURFACE_BACKGROUND,
    borderRadius: UIConstants.BORDER_RADIUS,
    borderWidth: 1,
    borderColor: UIConstants.DIVIDER_SECONDARY,
    padding: UIConstants.PADDING,
  },
  upcomingTurnDay: {
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: UIConstants.BODY_FONT_SIZE,
  },
  upcomingTurnTime: {
    position: 'absolute',
    top: UIConstants.PADDING,
    right: UIConstants.PADDING,
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: UIConstants.BODY_FONT_SIZE,
  },
  upcomingTurnReader: {
    color: UIConstants.MUTED_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: UIConstants.BODY_FONT_SIZE,
    marginTop: UIConstants.RHYTHM,
  },
  noUpcomingTurns: {
    color: UIConstants.MUTED_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: UIConstants.BODY_FONT_SIZE,
  },
  addTurnLink: {
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Medium,
    textDecorationLine: 'underline',
  },
  memberSummary: {
    width: '100%',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: UIConstants.RHYTHM * 2,
    marginBottom: UIConstants.RHYTHM,
  },
  memberSummaryText: {
    color: '#111111',
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: UIConstants.BODY_FONT_SIZE,
    textAlign: 'center',
  },
  memberSummaryCount: {
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    textDecorationLine: 'underline',
  },
  pathLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: UIConstants.PADDING * 2,
  },
  fullScreenLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UIConstants.SCREEN_OVERLAY,
  },
  retryButton: {
    marginTop: UIConstants.RHYTHM,
    paddingHorizontal: UIConstants.PADDING,
    paddingVertical: UIConstants.RHYTHM / 2,
    borderRadius: UIConstants.BORDER_RADIUS,
    backgroundColor: UIConstants.PRIMARY_COLOR,
  },
  retryText: {
    color: UIConstants.NAV_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: UIConstants.CAPTION_FONT_SIZE,
  },
  pathLoadingText: {
    color: UIConstants.MUTED_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: UIConstants.BODY_FONT_SIZE,
    marginTop: UIConstants.RHYTHM,
  },
  previewCard: {
    height: 200,
    paddingHorizontal: UIConstants.PADDING,
    paddingVertical: UIConstants.RHYTHM,
    borderRadius: UIConstants.BORDER_RADIUS,
    borderWidth: 1,
    borderColor: UIConstants.DIVIDER_SECONDARY,
    backgroundColor: UIConstants.SURFACE_BACKGROUND,
    gap: UIConstants.RHYTHM / 2,
  },
  previewLabel: {
    color: UIConstants.MUTED_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: UIConstants.CAPTION_FONT_SIZE,
    marginTop: UIConstants.RHYTHM,
  },
  previewLine: {
    color: UIConstants.BODY_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: UIConstants.BODY_FONT_SIZE,
    lineHeight: UIConstants.BODY_FONT_SIZE * 1.6,
  },
  impTextContainer: {
    fontSize: 22,
    backgroundColor: UIConstants.PATH_SELECTED_BACKGROUND_COLOR,
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
    fontFamily: font.Baloo_Paaji_2_Regular,
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
