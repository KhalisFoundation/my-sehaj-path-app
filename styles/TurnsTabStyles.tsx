import { StyleSheet } from 'react-native';
import font from '@utils/font';
import { CALENDAR_TIMELINE_HOUR_HEIGHT, UIConstants } from '@constants';

export const TurnsTabStyles = StyleSheet.create({
  container: {
    marginTop: UIConstants.RHYTHM * 0.6,
    marginBottom: UIConstants.RHYTHM,
    flex: 1,
    minHeight: 0,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarHeader: {
    flexShrink: 0,
  },
  month: {
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: UIConstants.SUBTITLE_FONT_SIZE,
  },
  monthControls: {
    flexDirection: 'row',
    gap: UIConstants.RHYTHM * 2,
  },
  monthArrowButton: {
    padding: UIConstants.PADDING,
    borderRadius: UIConstants.BORDER_RADIUS * 2,
    backgroundColor: UIConstants.SUBTLE_SURFACE_BACKGROUND,
  },
  weekHeader: {
    flexDirection: 'row',
    marginTop: UIConstants.RHYTHM,
  },
  weekday: {
    flex: 1,
    color: UIConstants.BODY_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: UIConstants.CAPTION_FONT_SIZE,
    textAlign: 'center',
  },
  weekDates: {
    flexDirection: 'row',
  },
  weekDateButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDateCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: UIConstants.BORDER_RADIUS * 2,
  },
  weekDateCircleSelected: {
    backgroundColor: UIConstants.PRIMARY_COLOR,
    minHeight: 24,
    minWidth: 24,
    paddingHorizontal: 12,
  },
  weekDate: {
    color: UIConstants.MUTED_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: UIConstants.BODY_FONT_SIZE,
  },
  weekDateSelected: {
    color: UIConstants.NAV_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Medium,
  },
  dayDivider: {
    height: UIConstants.DIVIDER_HEIGHT,
    backgroundColor: UIConstants.DIVIDER_SECONDARY,
    marginTop: UIConstants.RHYTHM,
  },
  selectedDay: {
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: UIConstants.BODY_FONT_SIZE,
    marginTop: UIConstants.RHYTHM,
  },
  scheduleViewport: {
    paddingTop: UIConstants.RHYTHM,
    flex: 1,
    minHeight: 0,
  },
  schedule: {
    flexDirection: 'row',
    height: CALENDAR_TIMELINE_HOUR_HEIGHT * 24,
  },
  timeColumn: {
    width: UIConstants.RHYTHM * 6.5,
  },
  timeLabel: {
    height: CALENDAR_TIMELINE_HOUR_HEIGHT,
    color: UIConstants.BODY_TEXT_SECONDARY,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 14,
    transform: [{ translateY: -10 }],
  },
  timeline: {
    flex: 1,
    position: 'relative',
    borderLeftWidth: UIConstants.DIVIDER_HEIGHT,
    borderLeftColor: UIConstants.DIVIDER_COLOR,
  },
  timelineTapTarget: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
  },
  hourLine: {
    height: CALENDAR_TIMELINE_HOUR_HEIGHT,
    borderTopWidth: UIConstants.DIVIDER_HEIGHT,
    borderTopColor: UIConstants.DIVIDER_SECONDARY,
  },
  loading: {
    marginTop: UIConstants.RHYTHM * 8,
  },
  loadingState: {
    position: 'absolute',
    top: CALENDAR_TIMELINE_HOUR_HEIGHT * 3,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  loadingText: {
    color: UIConstants.MUTED_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: UIConstants.CAPTION_FONT_SIZE,
    marginTop: UIConstants.RHYTHM,
    textAlign: 'center',
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
  emptyState: {
    position: 'absolute',
    top: CALENDAR_TIMELINE_HOUR_HEIGHT * 3,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  emptyTitle: {
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: UIConstants.BODY_FONT_SIZE,
  },
  emptyText: {
    color: UIConstants.MUTED_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: UIConstants.CAPTION_FONT_SIZE,
    marginTop: UIConstants.RHYTHM / 2,
    textAlign: 'center',
  },
  slot: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: UIConstants.RHYTHM,
    paddingVertical: UIConstants.RHYTHM / 2,
    backgroundColor: UIConstants.SUBTLE_SURFACE_BACKGROUND,
    borderRadius: UIConstants.BORDER_RADIUS / 2,
    borderLeftWidth: UIConstants.DIVIDER_HEIGHT * 2,
    borderLeftColor: UIConstants.PRIMARY_COLOR,
    overflow: 'hidden',
  },
  slotOnTimeline: {
    zIndex: 10,
  },
  compactSlot: {
    paddingVertical: 0,
  },
  liveSlot: {
    backgroundColor: UIConstants.SUBTLE_SURFACE_BACKGROUND_V2,
  },
  slotAvatar: {
    width: UIConstants.PADDING * 4,
    height: UIConstants.PADDING * 4,
    borderRadius: UIConstants.BORDER_RADIUS * 2,
  },
  slotAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotAvatarInitial: {
    color: UIConstants.NAV_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: UIConstants.CAPTION_FONT_SIZE,
  },
  slotDetails: {
    flex: 1,
    marginLeft: UIConstants.RHYTHM,
  },
  compactSlotDetails: { marginLeft: 0 },
  slotTime: {
    color: UIConstants.PRIMARY_COLOR,
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: UIConstants.CAPTION_FONT_SIZE,
  },
  slotReader: {
    color: UIConstants.MUTED_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: UIConstants.CAPTION_FONT_SIZE,
    marginTop: UIConstants.RHYTHM / 3,
  },
  cancelSlotButton: {
    alignSelf: 'flex-start',
    marginTop: UIConstants.RHYTHM / 2,
    paddingHorizontal: UIConstants.RHYTHM,
    paddingVertical: UIConstants.RHYTHM / 3,
    borderRadius: UIConstants.BORDER_RADIUS / 2,
    backgroundColor: UIConstants.SURFACE_BACKGROUND,
  },
  cancelSlotText: {
    color: UIConstants.DANGER_COLOR,
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: UIConstants.CAPTION_FONT_SIZE,
  },
  addTurnButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: UIConstants.RHYTHM,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginVertical: UIConstants.RHYTHM * 2,
    minWidth: UIConstants.PADDING * 10,
    minHeight: UIConstants.PADDING * 4,
    paddingHorizontal: UIConstants.PADDING * 2,
    borderRadius: UIConstants.BORDER_RADIUS / 2,
    backgroundColor: UIConstants.PRIMARY_COLOR,
  },
  addTurnText: {
    color: UIConstants.NAV_TEXT_COLOR,
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: UIConstants.BODY_FONT_SIZE,
  },
});
