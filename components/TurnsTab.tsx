import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { AppText as Text } from './AppText';
import { TurnsTabStyles as styles } from '@styles';
import {
  CALENDAR_CONTEXT_HOURS,
  CALENDAR_TIMELINE_HOUR_HEIGHT,
  CALENDAR_WORKING_DAY_START_HOUR,
  Constants,
  ErrorConstants,
  UIConstants,
} from '@constants';
import { avatarHeaders, loadPlan } from '../store/groupApi';
import { planWindowFor } from '../store/slotAvailability';
import type { SehajPathMember, SehajPathSlot } from '@api/generated/types.gen';
import { initialOf, tintFor } from './MemberAvatars';
import { RightChevronIcon, CalendarIcon, PlusIcon } from '@icons';
import { subscribePlanRefresh } from '../store/planEvents';
import { recordError } from '../utils/crashlytics';
import {
  addLocalDays,
  asLocalDateTime,
  combineLocalDayAndTime,
  endOfLocalDayExclusive,
  formatCalendarDate,
  formatMonthYear,
  formatTime,
  isAfter,
  isSameLocalDay,
  minuteOfLocalDay,
  startOfLocalDay,
  startOfLocalWeek,
} from '../utils/dateTime';

interface Props {
  sehajPathId: string;
  onBookSlot: (startsAt?: Date) => void;
  onFollow?: () => void;
  onCancelSlot?: (slot: SehajPathSlot) => Promise<void> | void;
  onEditSlot?: (slot: SehajPathSlot) => void;
  canManageSlots?: boolean;
  members?: SehajPathMember[];
  avatarUriFor?: (member: SehajPathMember) => string | null;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTES_PER_HOUR = 60;

export const timelineFrameFor = (
  slot: Pick<SehajPathSlot, 'startsAt' | 'endsAt'>
): { top: number; height: number } => {
  const pixelsPerMinute = CALENDAR_TIMELINE_HOUR_HEIGHT / MINUTES_PER_HOUR;
  const minuteOfDay = minuteOfLocalDay(slot.startsAt);
  const durationMinutes = Math.max(
    1,
    asLocalDateTime(slot.endsAt).diff(slot.startsAt, 'minute', true)
  );
  return {
    top: minuteOfDay * pixelsPerMinute,
    height: durationMinutes * pixelsPerMinute,
  };
};

interface SlotLane {
  lane: number;
  laneCount: number;
}

/**
 * Places overlapping appointments in independent lanes, as calendar apps do.
 * A finished turn may free real reading time before its booked end, so another
 * turn can overlap the original booking in the plan. Both must remain visible.
 */
export const timelineLanesFor = (slots: SehajPathSlot[]): Map<string, SlotLane> => {
  const lanes = new Map<string, SlotLane>();
  const clusters: SehajPathSlot[][] = [];
  let cluster: SehajPathSlot[] = [];
  let clusterEnd = 0;

  for (const slot of slots) {
    const start = asLocalDateTime(slot.startsAt).valueOf();
    const end = asLocalDateTime(slot.endsAt).valueOf();
    if (cluster.length > 0 && start >= clusterEnd) {
      clusters.push(cluster);
      cluster = [];
      clusterEnd = 0;
    }
    cluster.push(slot);
    clusterEnd = Math.max(clusterEnd, end);
  }
  if (cluster.length > 0) {
    clusters.push(cluster);
  }

  for (const overlappingSlots of clusters) {
    const laneEnds: number[] = [];
    for (const slot of overlappingSlots) {
      const start = asLocalDateTime(slot.startsAt).valueOf();
      const end = asLocalDateTime(slot.endsAt).valueOf();
      const lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
      const assignedLane = lane === -1 ? laneEnds.length : lane;
      laneEnds[assignedLane] = end;
      lanes.set(slot.id, { lane: assignedLane, laneCount: 0 });
    }
    for (const slot of overlappingSlots) {
      const layout = lanes.get(slot.id);
      if (layout) {
        layout.laneCount = laneEnds.length;
      }
    }
  }
  return lanes;
};

const laneFrameFor = ({
  lane,
  laneCount,
}: SlotLane): { left: `${number}%`; width: `${number}%` } => {
  const outerGap = 1;
  const laneGap = 2;
  const width = (100 - outerGap * 2 - laneGap * (laneCount - 1)) / laneCount;
  return {
    left: `${outerGap + lane * (width + laneGap)}%`,
    width: `${width}%`,
  };
};

const currentTimeOffsetFor = (day: Date): number => {
  const now = new Date();
  if (!isSameLocalDay(day, now)) {
    return Math.max(0, CALENDAR_WORKING_DAY_START_HOUR * CALENDAR_TIMELINE_HOUR_HEIGHT);
  }
  const startHour = minuteOfLocalDay(now) / MINUTES_PER_HOUR - CALENDAR_CONTEXT_HOURS;
  return Math.max(0, startHour * CALENDAR_TIMELINE_HOUR_HEIGHT);
};

const timeLabel = (hour: number): string =>
  asLocalDateTime('2000-01-01').hour(hour).format('h:mm A');

const slotTimeLabel = (slot: SehajPathSlot): string =>
  `${formatTime(slot.startsAt)} - ${formatTime(slot.endsAt)}`;

/**
 * A booking remains one slot in the API. For a selected local calendar day we
 * only render the portion of that interval that falls within that day. This
 * makes an 11:50 PM–12:05 AM booking visible on both days without creating a
 * second booking or changing the API contract.
 */
type VisibleSlot = SehajPathSlot & { sourceSlot: SehajPathSlot };

export const visibleSlotsForDay = (slots: SehajPathSlot[], day: Date): VisibleSlot[] => {
  const dayStart = startOfLocalDay(day);
  const dayEnd = endOfLocalDayExclusive(day);

  return slots
    .filter(
      (slot) =>
        ['SCHEDULED', 'ACTIVE', 'COMPLETED'].includes(slot.status) &&
        isAfter(slot.endsAt, dayStart) &&
        isAfter(dayEnd, slot.startsAt)
    )
    .map((slot) => {
      const visibleStart = isAfter(slot.startsAt, dayStart) ? slot.startsAt : dayStart;
      const visibleEnd = isAfter(dayEnd, slot.endsAt) ? slot.endsAt : dayEnd;
      return {
        ...slot,
        startsAt: asLocalDateTime(visibleStart).toISOString(),
        endsAt: asLocalDateTime(visibleEnd).toISOString(),
        sourceSlot: slot,
      };
    })
    .filter((slot) => asLocalDateTime(slot.endsAt).isAfter(asLocalDateTime(slot.startsAt)))
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
};

export const TurnsTab = ({
  sehajPathId,
  onBookSlot,
  onFollow,
  onCancelSlot,
  onEditSlot,
  canManageSlots = false,
  members = [],
  avatarUriFor,
}: Props) => {
  const [day, setDay] = useState(() => startOfLocalDay(new Date()));
  const [slots, setSlots] = useState<SehajPathSlot[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const [requestedScrollAt, setRequestedScrollAt] = useState<Date | null>(null);
  const { height: windowHeight } = useWindowDimensions();
  const scheduleViewportRef = useRef<ScrollView>(null);
  const initialViewportAppliedRef = useRef(false);

  const load = useCallback(async () => {
    setLoadError(false);
    const { from, to } = planWindowFor(day);
    try {
      const result = await loadPlan(sehajPathId, from, to);
      if (result.ok) {
        setSlots(result.data.slots);
      } else {
        setLoadError(true);
        setSlots([]);
      }
    } catch (error) {
      recordError(error, 'TurnsTab: failed to load schedule');
      setLoadError(true);
      setSlots([]);
    }
  }, [day, sehajPathId]);

  useEffect(() => {
    // A date change starts a new viewport; let the first content layout place
    // it near the relevant time before the network response arrives.
    initialViewportAppliedRef.current = false;
    load().catch(() => undefined);
  }, [load]);

  useEffect(
    () =>
      subscribePlanRefresh((changedPathId, startsAt) => {
        if (changedPathId === sehajPathId) {
          if (startsAt) {
            setRequestedScrollAt(startsAt);
          }
          load().catch(() => undefined);
        }
      }),
    [load, sehajPathId]
  );

  const week = useMemo(() => {
    const first = startOfLocalWeek(day);
    return Array.from({ length: WEEKDAY_LABELS.length }, (_, index) => addLocalDays(first, index));
  }, [day]);
  const booked = useMemo(() => visibleSlotsForDay(slots ?? [], day), [slots, day]);
  const slotLanes = useMemo(() => timelineLanesFor(booked), [booked]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const now = new Date();
      const active = booked.find((slot) => slot.status === 'ACTIVE');
      const next = booked.find((slot) => !isAfter(now, slot.startsAt));
      const requested =
        requestedScrollAt !== null && isSameLocalDay(requestedScrollAt, day)
          ? requestedScrollAt
          : null;
      let targetTime = requested ?? now;
      if (requested === null && active) {
        targetTime = asLocalDateTime(active.startsAt).toDate();
      } else if (requested === null && next) {
        targetTime = asLocalDateTime(next.startsAt).toDate();
      }
      const isToday = isSameLocalDay(day, now);
      let startHour = CALENDAR_WORKING_DAY_START_HOUR;
      if (requested ?? active ?? next) {
        startHour = minuteOfLocalDay(targetTime) / MINUTES_PER_HOUR - CALENDAR_CONTEXT_HOURS;
      } else if (isToday || booked.length === 0) {
        startHour = minuteOfLocalDay(now) / MINUTES_PER_HOUR - CALENDAR_CONTEXT_HOURS;
      }
      const offset = Math.max(0, startHour * CALENDAR_TIMELINE_HOUR_HEIGHT);
      scheduleViewportRef.current?.scrollTo({ y: offset, animated: false });
    }, 0);

    return () => clearTimeout(timer);
  }, [booked, day, requestedScrollAt]);
  const openSlotAtTimelineTime = useCallback(
    (event: GestureResponderEvent) => {
      const pixelsPerMinute = CALENDAR_TIMELINE_HOUR_HEIGHT / MINUTES_PER_HOUR;
      const timelineY = event?.nativeEvent?.locationY ?? 0;
      const minutes = Math.max(
        0,
        Math.min(MINUTES_PER_HOUR * 24 - 1, Math.floor(timelineY / pixelsPerMinute))
      );
      const selected = combineLocalDayAndTime(
        day,
        asLocalDateTime(day)
          .hour(Math.floor(minutes / MINUTES_PER_HOUR))
          .minute(minutes % MINUTES_PER_HOUR)
      );
      onBookSlot(selected);
    },
    [day, onBookSlot]
  );
  const membersById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members]
  );
  const currentMemberId = useMemo(() => members.find((member) => member.isMine)?.id, [members]);
  const scheduleMaxHeight =
    headerHeight > 0 && footerHeight > 0
      ? Math.max(0, windowHeight - headerHeight - footerHeight - UIConstants.PADDING * 23)
      : 0;

  return (
    <>
      <View style={styles.container}>
        <View
          style={styles.calendarHeader}
          onLayout={({ nativeEvent }) => setHeaderHeight(nativeEvent.layout.height)}
        >
          <View style={styles.monthRow}>
            <Text style={styles.month}>{formatMonthYear(day)}</Text>
            <View style={styles.monthControls}>
              <TouchableOpacity
                onPress={() => setDay((current) => addLocalDays(current, -7))}
                style={styles.monthArrowButton}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Previous week"
              >
                <View style={{ transform: [{ rotateY: '180deg' }] }}>
                  <RightChevronIcon />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setDay((current) => addLocalDays(current, 7))}
                style={styles.monthArrowButton}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Next week"
              >
                <RightChevronIcon />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.weekHeader}>
            {WEEKDAY_LABELS.map((label) => (
              <Text key={label} style={styles.weekday}>
                {label}
              </Text>
            ))}
          </View>
          <View style={styles.weekDates}>
            {week.map((date) => {
              const selected = isSameLocalDay(date, day);
              return (
                <Pressable
                  key={date.toISOString()}
                  onPress={() => setDay(startOfLocalDay(date))}
                  style={[styles.weekDateButton]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <View style={[styles.weekDateCircle, selected && styles.weekDateCircleSelected]}>
                    <Text style={[styles.weekDate, selected && styles.weekDateSelected]}>
                      {asLocalDateTime(date).date()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.dayDivider} />
          <Text style={styles.selectedDay}>{formatCalendarDate(day)}</Text>
        </View>
        <ScrollView
          ref={scheduleViewportRef}
          style={[
            styles.scheduleViewport,
            scheduleMaxHeight > 0 && { maxHeight: scheduleMaxHeight },
          ]}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            if (initialViewportAppliedRef.current) {
              return;
            }
            initialViewportAppliedRef.current = true;
            scheduleViewportRef.current?.scrollTo({
              y: currentTimeOffsetFor(day),
              animated: false,
            });
          }}
        >
          <View style={styles.schedule}>
            <View style={styles.timeColumn}>
              {HOURS.map((hour) => (
                <Text key={hour} style={styles.timeLabel}>
                  {timeLabel(hour)}
                </Text>
              ))}
            </View>
            <View style={styles.timeline}>
              {HOURS.map((hour) => (
                <View key={hour} style={styles.hourLine} />
              ))}
              {slots !== null && !loadError ? (
                <Pressable
                  style={styles.timelineTapTarget}
                  onPress={openSlotAtTimelineTime}
                  accessibilityRole="button"
                  accessibilityLabel={Constants.ADD_TURN_AT_TIME}
                />
              ) : null}
              {slots === null && !loadError ? (
                <View style={styles.loadingState}>
                  <ActivityIndicator />
                  <Text style={styles.loadingText}>{Constants.LOADING_TURNS}</Text>
                </View>
              ) : null}
              {loadError ? (
                <View style={styles.loadingState}>
                  <Text style={styles.loadingText}>{ErrorConstants.FAILED_TO_LOAD_TURNS}</Text>
                  <Pressable
                    style={styles.retryButton}
                    onPress={() => load().catch(() => undefined)}
                    accessibilityRole="button"
                    accessibilityLabel={Constants.RETRY_TURNS}
                  >
                    <Text style={styles.retryText}>{Constants.RETRY}</Text>
                  </Pressable>
                </View>
              ) : null}
              {slots !== null && booked.length === 0 ? (
                <View style={styles.emptyState} pointerEvents="none">
                  <CalendarIcon width={24} height={24} />
                  <Text style={styles.emptyTitle}>{Constants.NO_TURNS_YET}</Text>
                  <Text style={styles.emptyText}>{Constants.ADD_TURN_TO_CREATE_SCHEDULE}</Text>
                </View>
              ) : null}
              {booked.map((slot) => {
                const frame = timelineFrameFor(slot);
                const lane = slotLanes.get(slot.id) ?? { lane: 0, laneCount: 1 };
                const compact = frame.height < UIConstants.PADDING * 4;
                const followable =
                  slot.status === 'ACTIVE' && !slot.isMine && onFollow !== undefined;
                const member = slot.readerMemberId
                  ? membersById.get(slot.readerMemberId)
                  : undefined;
                const readerLabel = slot.isMine ? Constants.YOU : slot.readerLabel;
                const avatarUri = member && avatarUriFor ? avatarUriFor(member) : null;
                const belongsToCurrentMember =
                  slot.isMine ||
                  (currentMemberId !== undefined && slot.readerMemberId === currentMemberId);
                const cancellable =
                  (belongsToCurrentMember || canManageSlots) &&
                  slot.status === 'SCHEDULED' &&
                  isAfter(slot.sourceSlot.startsAt, new Date()) &&
                  onCancelSlot !== undefined;
                const openSlotMenu = () => {
                  if (!cancellable) {
                    return;
                  }
                  Alert.alert('Turn options', slotTimeLabel(slot.sourceSlot), [
                    { text: Constants.CANCEL, style: 'cancel' },
                    ...(onEditSlot
                      ? [{ text: Constants.EDIT_TURN, onPress: () => onEditSlot(slot.sourceSlot) }]
                      : []),
                    {
                      text: 'Delete turn',
                      style: 'destructive',
                      onPress: async () => {
                        await onCancelSlot(slot.sourceSlot);
                        await load();
                      },
                    },
                  ]);
                };
                return (
                  <Pressable
                    key={`${slot.id}:${day.toISOString()}`}
                    onPress={followable ? onFollow : undefined}
                    onLongPress={openSlotMenu}
                    delayLongPress={350}
                    style={[
                      styles.slot,
                      frame,
                      laneFrameFor(lane),
                      compact && styles.compactSlot,
                      slot.status === 'ACTIVE' && styles.liveSlot,
                      styles.slotOnTimeline,
                    ]}
                    accessibilityRole={followable ? 'button' : undefined}
                    accessibilityLabel={followable ? Constants.FOLLOW_ALONG : undefined}
                  >
                    {!compact && avatarUri ? (
                      <Image
                        source={{ uri: avatarUri, headers: avatarHeaders() }}
                        style={styles.slotAvatar}
                        accessibilityLabel={readerLabel}
                      />
                    ) : !compact ? (
                      <View
                        style={[
                          styles.slotAvatar,
                          styles.slotAvatarFallback,
                          { backgroundColor: tintFor(member?.id ?? slot.id) },
                        ]}
                      >
                        <Text style={styles.slotAvatarInitial} allowFontScaling={false}>
                          {initialOf(readerLabel)}
                        </Text>
                      </View>
                    ) : null}
                    <View style={[styles.slotDetails, compact && styles.compactSlotDetails]}>
                      <Text style={styles.slotTime} numberOfLines={1}>
                        {slotTimeLabel(slot.sourceSlot)}
                      </Text>
                      {!compact && (
                        <Text style={styles.slotReader} numberOfLines={1}>
                          {readerLabel}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
        <TouchableOpacity
          style={[styles.addTurnButton]}
          onLayout={({ nativeEvent }) => setFooterHeight(nativeEvent.layout.height)}
          onPress={() => onBookSlot()}
          accessibilityRole="button"
        >
          <PlusIcon />
          <Text style={styles.addTurnText}>{Constants.ADD_TURN}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
};
