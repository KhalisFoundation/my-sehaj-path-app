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
  const start = new Date(slot.startsAt);
  const end = new Date(slot.endsAt);
  const pixelsPerMinute = CALENDAR_TIMELINE_HOUR_HEIGHT / MINUTES_PER_HOUR;
  const minuteOfDay = start.getHours() * MINUTES_PER_HOUR + start.getMinutes();
  const durationMinutes = Math.max(1, (end.getTime() - start.getTime()) / (60 * 1000));
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
    const start = new Date(slot.startsAt).getTime();
    const end = new Date(slot.endsAt).getTime();
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
      const start = new Date(slot.startsAt).getTime();
      const end = new Date(slot.endsAt).getTime();
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

const startOfDay = (day: Date): Date => new Date(day.getFullYear(), day.getMonth(), day.getDate());

const startOfWeek = (day: Date): Date => {
  const first = startOfDay(day);
  const mondayOffset = (first.getDay() + 6) % 7;
  first.setDate(first.getDate() - mondayOffset);
  return first;
};

const addDays = (day: Date, delta: number): Date => {
  const next = new Date(day);
  next.setDate(next.getDate() + delta);
  return next;
};

const sameDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const monthLabel = (day: Date): string =>
  day.toLocaleDateString([], { month: 'long', year: 'numeric' });

const selectedDayLabel = (day: Date): string =>
  day.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

const currentTimeOffsetFor = (day: Date): number => {
  const now = new Date();
  if (!sameDay(day, now)) {
    return Math.max(0, CALENDAR_WORKING_DAY_START_HOUR * CALENDAR_TIMELINE_HOUR_HEIGHT);
  }
  const startHour = now.getHours() + now.getMinutes() / MINUTES_PER_HOUR - CALENDAR_CONTEXT_HOURS;
  return Math.max(0, startHour * CALENDAR_TIMELINE_HOUR_HEIGHT);
};

const timeLabel = (hour: number): string =>
  new Date(2000, 0, 1, hour).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const slotTimeLabel = (slot: SehajPathSlot): string => {
  const format = (value: string) =>
    new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${format(slot.startsAt)} - ${format(slot.endsAt)}`;
};

const onDay = (slot: SehajPathSlot, day: Date): boolean => sameDay(new Date(slot.startsAt), day);

const visibleSlots = (slots: SehajPathSlot[], day: Date): SehajPathSlot[] =>
  slots
    .filter(
      (slot) => ['SCHEDULED', 'ACTIVE', 'COMPLETED'].includes(slot.status) && onDay(slot, day)
    )
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt));

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
  const [day, setDay] = useState(() => startOfDay(new Date()));
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
    const first = startOfWeek(day);
    return Array.from({ length: WEEKDAY_LABELS.length }, (_, index) => addDays(first, index));
  }, [day]);
  const booked = useMemo(() => visibleSlots(slots ?? [], day), [slots, day]);
  const slotLanes = useMemo(() => timelineLanesFor(booked), [booked]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const now = new Date();
      const active = booked.find((slot) => slot.status === 'ACTIVE');
      const next = booked.find((slot) => new Date(slot.startsAt).getTime() >= now.getTime());
      const requested =
        requestedScrollAt !== null && sameDay(requestedScrollAt, day) ? requestedScrollAt : null;
      const targetTime =
        requested ?? (active ? new Date(active.startsAt) : next ? new Date(next.startsAt) : now);
      const isToday = sameDay(day, now);
      let startHour = CALENDAR_WORKING_DAY_START_HOUR;
      if (requested ?? active ?? next) {
        startHour =
          targetTime.getHours() +
          targetTime.getMinutes() / MINUTES_PER_HOUR -
          CALENDAR_CONTEXT_HOURS;
      } else if (isToday || booked.length === 0) {
        startHour = now.getHours() + now.getMinutes() / MINUTES_PER_HOUR - CALENDAR_CONTEXT_HOURS;
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
      const selected = new Date(day);
      selected.setHours(Math.floor(minutes / MINUTES_PER_HOUR), minutes % MINUTES_PER_HOUR, 0, 0);
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
            <Text style={styles.month}>{monthLabel(day)}</Text>
            <View style={styles.monthControls}>
              <TouchableOpacity
                onPress={() => setDay((current) => addDays(current, -7))}
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
                onPress={() => setDay((current) => addDays(current, 7))}
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
              const selected = sameDay(date, day);
              return (
                <Pressable
                  key={date.toISOString()}
                  onPress={() => setDay(startOfDay(date))}
                  style={[styles.weekDateButton]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <View style={[styles.weekDateCircle, selected && styles.weekDateCircleSelected]}>
                    <Text style={[styles.weekDate, selected && styles.weekDateSelected]}>
                      {date.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.dayDivider} />
          <Text style={styles.selectedDay}>{selectedDayLabel(day)}</Text>
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
                  new Date(slot.startsAt).getTime() > Date.now() &&
                  onCancelSlot !== undefined;
                const openSlotMenu = () => {
                  if (!cancellable) {
                    return;
                  }
                  Alert.alert('Turn options', slotTimeLabel(slot), [
                    { text: Constants.CANCEL, style: 'cancel' },
                    ...(onEditSlot
                      ? [{ text: Constants.EDIT_TURN, onPress: () => onEditSlot(slot) }]
                      : []),
                    {
                      text: 'Delete turn',
                      style: 'destructive',
                      onPress: async () => {
                        await onCancelSlot(slot);
                        await load();
                      },
                    },
                  ]);
                };
                return (
                  <Pressable
                    key={slot.id}
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
                        {slotTimeLabel(slot)}
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
