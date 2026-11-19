import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type ScrollViewInstance,
} from 'react-native';
import { AppText as Text } from './AppText';
import { Dialog } from './Dialog';
import { DialogStyles as dialogStyles, TurnsTabStyles as styles } from '@styles';
import {
  CALENDAR_CONTEXT_HOURS,
  CALENDAR_TIMELINE_HOUR_HEIGHT,
  CALENDAR_WORKING_DAY_START_HOUR,
  Constants,
  ErrorConstants,
  UIConstants,
} from '@constants';
import { avatarHeaders, loadPlan } from '../store/groupApi';
import { useAppSelector } from '../store/hooks';
import { planWindowFor } from '../store/slotAvailability';
import { isRecurringTurn } from '../store/recurringTurn';
import type { SehajPathMember, SehajPathSlot } from '@api/generated/types.gen';
import { initialOf, tintFor } from './MemberAvatars';
import { RightChevronIcon, CalendarIcon, CrossIcon, PlusIcon } from '@icons';
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

/** How much of a recurring series a delete removes. */
type DeleteScope = 'OCCURRENCE' | 'THIS_AND_FUTURE';

interface Props {
  sehajPathId: string;
  onBookSlot: (startsAt?: Date) => void;
  onFollow?: () => void;
  /** Start this active recurring turn without creating a slot row. */
  onTakeTurn?: (slot: SehajPathSlot) => Promise<void> | void;
  /** `scope` is sent only for a recurring turn; an ordinary turn passes none. */
  onCancelSlot?: (slot: SehajPathSlot, scope?: DeleteScope) => Promise<void> | void;
  onEditSlot?: (slot: SehajPathSlot) => void;
  /** Lets the parent refresh derived turn UI after this calendar changes. */
  onPlanChanged?: () => void;
  canManageSlots?: boolean;
  members?: SehajPathMember[];
  avatarUriFor?: (member: SehajPathMember) => string | null;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTES_PER_HOUR = 60;
const MAX_CACHED_PLANS = 32;

type CachedTurnPlan = {
  stateVersion: number;
  slots: SehajPathSlot[];
};

const turnPlanCache = new Map<string, CachedTurnPlan>();

const cacheTurnPlan = (key: string, plan: CachedTurnPlan): void => {
  turnPlanCache.delete(key);
  turnPlanCache.set(key, plan);
  const oldest = turnPlanCache.keys().next().value;
  if (turnPlanCache.size > MAX_CACHED_PLANS && typeof oldest === 'string') {
    turnPlanCache.delete(oldest);
  }
};

export const clearTurnPlanCache = (): void => turnPlanCache.clear();

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
  onTakeTurn,
  onCancelSlot,
  onEditSlot,
  onPlanChanged,
  canManageSlots = false,
  members = [],
  avatarUriFor,
}: Props) => {
  const [day, setDay] = useState(() => startOfLocalDay(new Date()));
  const account = useAppSelector((state) => state.auth.email ?? 'guest');
  const planKey = useMemo(() => {
    const { from, to } = planWindowFor(day);
    return `${account}:${sehajPathId}:${from.toISOString()}:${to.toISOString()}`;
  }, [account, day, sehajPathId]);
  const cachedPlan = turnPlanCache.get(planKey);
  const [planState, setPlanState] = useState<{
    key: string;
    slots: SehajPathSlot[] | null;
  }>(() => ({ key: planKey, slots: cachedPlan?.slots ?? null }));
  const slots = planState.key === planKey ? planState.slots : cachedPlan?.slots ?? null;
  const [loadError, setLoadError] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const [requestedScrollAt, setRequestedScrollAt] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SehajPathSlot | null>(null);
  const [deletingSlotId, setDeletingSlotId] = useState<string | null>(null);
  const [takingTurnId, setTakingTurnId] = useState<string | null>(null);
  const [turnActionError, setTurnActionError] = useState<'DELETE' | 'TAKE' | null>(null);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [recurringDeleteScopeOpen, setRecurringDeleteScopeOpen] = useState(false);
  // The scope of the delete in flight, kept only so a retry sends exactly what
  // the failed attempt sent. It is never read to start a new delete: every
  // delete states its own scope, so one choice cannot leak into the next.
  const lastDeleteScopeRef = useRef<DeleteScope | undefined>(undefined);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(() => new Date());
  const { height: windowHeight } = useWindowDimensions();
  const scheduleViewportRef = useRef<ScrollViewInstance>(null);
  const initialViewportAppliedRef = useRef(false);
  const loadSequenceRef = useRef(0);

  const load = useCallback(async () => {
    const loadSequence = ++loadSequenceRef.current;
    setLoadError(false);
    const { from, to } = planWindowFor(day);
    const requestKey = `${account}:${sehajPathId}:${from.toISOString()}:${to.toISOString()}`;
    const previous = turnPlanCache.get(requestKey);
    try {
      const result = await loadPlan(sehajPathId, from, to);
      if (loadSequence !== loadSequenceRef.current) {
        return;
      }
      if (result.ok) {
        if (previous?.stateVersion === result.data.stateVersion) {
          setPlanState((current) =>
            current.key === requestKey && current.slots === previous.slots
              ? current
              : { key: requestKey, slots: previous.slots }
          );
          return;
        }
        const next = {
          stateVersion: result.data.stateVersion,
          slots: result.data.slots,
        };
        cacheTurnPlan(requestKey, next);
        setPlanState({ key: requestKey, slots: next.slots });
      } else {
        setLoadError(true);
        if (!previous) {
          setPlanState({ key: requestKey, slots: [] });
        }
      }
    } catch (error) {
      if (loadSequence !== loadSequenceRef.current) {
        return;
      }
      recordError(error, 'TurnsTab: failed to load schedule');
      setLoadError(true);
      if (!previous) {
        setPlanState({ key: requestKey, slots: [] });
      }
    }
  }, [account, day, sehajPathId]);

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
      }, sehajPathId),
    [load, sehajPathId]
  );

  const week = useMemo(() => {
    const first = startOfLocalWeek(day);
    return Array.from({ length: WEEKDAY_LABELS.length }, (_, index) => addLocalDays(first, index));
  }, [day]);
  const booked = useMemo(() => visibleSlotsForDay(slots ?? [], day), [slots, day]);
  const slotLanes = useMemo(() => timelineLanesFor(booked), [booked]);

  // A planned recurring turn becomes actionable at its start time and stops
  // being actionable at its end time. Wake only at the next relevant boundary
  // instead of rerendering the full calendar every second.
  const nextSlotBoundary = useMemo(() => {
    const nowMs = clockNow.getTime();
    return (slots ?? []).reduce<number | null>((next, slot) => {
      if (slot.status !== 'SCHEDULED') {
        return next;
      }
      for (const value of [slot.startsAt, slot.endsAt]) {
        const boundary = asLocalDateTime(value).valueOf();
        if (boundary > nowMs && (next === null || boundary < next)) {
          next = boundary;
        }
      }
      return next;
    }, null);
  }, [clockNow, slots]);

  useEffect(() => {
    if (nextSlotBoundary === null) {
      return;
    }
    const timeout = setTimeout(
      () => setClockNow(new Date()),
      Math.max(0, nextSlotBoundary - Date.now()) + 50
    );
    return () => clearTimeout(timeout);
  }, [nextSlotBoundary]);

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
  const selectedSlotMember = selectedSlot?.readerMemberId
    ? membersById.get(selectedSlot.readerMemberId)
    : undefined;
  const selectedSlotReaderLabel = selectedSlot
    ? selectedSlot.isMine
      ? Constants.YOU
      : selectedSlot.readerLabel
    : '';
  const selectedSlotAvatarUri =
    selectedSlotMember && avatarUriFor ? avatarUriFor(selectedSlotMember) : null;
  const currentMemberId = useMemo(() => members.find((member) => member.isMine)?.id, [members]);
  const canTakeTurn = useCallback(
    (slot: SehajPathSlot): boolean => {
      return (
        slot.isVirtual === true &&
        (slot.readerMemberId === null || slot.isMine) &&
        slot.status === 'SCHEDULED' &&
        asLocalDateTime(slot.startsAt).isSameOrBefore(clockNow) &&
        asLocalDateTime(slot.endsAt).isAfter(clockNow) &&
        onTakeTurn !== undefined
      );
    },
    [clockNow, onTakeTurn]
  );
  const scheduleMaxHeight =
    headerHeight > 0 && footerHeight > 0
      ? Math.max(0, windowHeight - headerHeight - footerHeight - UIConstants.PADDING * 23)
      : 0;

  const closeSlotMenu = useCallback(() => {
    if (deletingSlotId === null && takingTurnId === null) {
      setDeleteError(null);
      setTurnActionError(null);
      setDeleteConfirmationOpen(false);
      setRecurringDeleteScopeOpen(false);
      setSelectedSlot(null);
    }
  }, [deletingSlotId, takingTurnId]);
  const handleEditSelectedSlot = useCallback(() => {
    if (selectedSlot && onEditSlot) {
      onEditSlot(selectedSlot);
    }
    setDeleteConfirmationOpen(false);
    setSelectedSlot(null);
  }, [onEditSlot, selectedSlot]);
  const requestDeleteSelectedSlot = useCallback(() => {
    if (selectedSlot && deletingSlotId === null) {
      if (isRecurringTurn(selectedSlot)) {
        setRecurringDeleteScopeOpen(true);
      } else {
        setDeleteConfirmationOpen(true);
      }
    }
  }, [deletingSlotId, selectedSlot]);
  const cancelDeleteConfirmation = useCallback(() => {
    if (deletingSlotId === null) {
      setDeleteConfirmationOpen(false);
      setRecurringDeleteScopeOpen(false);
    }
  }, [deletingSlotId]);
  const handleDeleteSelectedSlot = useCallback(
    // `scope` is sent only when the caller chose one (a recurring turn). An
    // ordinary turn passes none, so no scope reaches the server.
    async (scope?: DeleteScope) => {
      if (!selectedSlot || !onCancelSlot || deletingSlotId !== null) {
        return;
      }
      const slotToDelete = selectedSlot;
      lastDeleteScopeRef.current = scope;
      setDeleteError(null);
      setTurnActionError(null);
      // A confirmed destructive action should not leave its confirmation card
      // sitting over the schedule while the request runs. Close it first; on a
      // failure we restore this same slot and show the retry state below.
      setDeleteConfirmationOpen(false);
      setRecurringDeleteScopeOpen(false);
      setSelectedSlot(null);
      setDeletingSlotId(slotToDelete.id);
      try {
        await onCancelSlot(slotToDelete, scope);
        await load();
        onPlanChanged?.();
      } catch (error) {
        recordError(error, 'TurnsTab: failed to delete turn');
        setSelectedSlot(slotToDelete);
        setTurnActionError('DELETE');
        setDeleteError(
          error instanceof Error && error.message.length > 0
            ? error.message
            : ErrorConstants.FAILED_TO_DELETE_TURN
        );
      } finally {
        setDeletingSlotId(null);
      }
    },
    [deletingSlotId, load, onCancelSlot, onPlanChanged, selectedSlot]
  );

  const retryDeleteSelectedSlot = useCallback(() => {
    setDeleteError(null);
    setTurnActionError(null);
    handleDeleteSelectedSlot(lastDeleteScopeRef.current).catch((error: unknown) => {
      recordError(error, 'TurnsTab: retry delete turn failed');
    });
  }, [handleDeleteSelectedSlot]);
  const handleTakeTurn = useCallback(async () => {
    if (!selectedSlot || !onTakeTurn || takingTurnId !== null) {
      return;
    }
    setDeleteError(null);
    setTurnActionError(null);
    setTakingTurnId(selectedSlot.id);
    try {
      await onTakeTurn(selectedSlot);
      setSelectedSlot(null);
      // The turn is taken, so it must stop being offered as takeable. The
      // reader screen is already opening; refresh in the background so going
      // back shows the current plan instead of the stale entry.
      load().catch(() => undefined);
      onPlanChanged?.();
    } catch (error) {
      recordError(error, 'TurnsTab: failed to take recurring turn');
      setTurnActionError('TAKE');
      setDeleteError(
        error instanceof Error && error.message.length > 0
          ? error.message
          : 'Unable to take this turn. Please try again.'
      );
    } finally {
      setTakingTurnId(null);
    }
  }, [load, onPlanChanged, onTakeTurn, selectedSlot, takingTurnId]);

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
                const editable =
                  (belongsToCurrentMember || canManageSlots) &&
                  slot.status === 'SCHEDULED' &&
                  isAfter(slot.sourceSlot.startsAt, clockNow) &&
                  onEditSlot !== undefined;
                const cancellable =
                  (belongsToCurrentMember || canManageSlots) &&
                  slot.status === 'SCHEDULED' &&
                  isAfter(slot.sourceSlot.startsAt, clockNow) &&
                  onCancelSlot !== undefined;
                const takeable = canTakeTurn(slot.sourceSlot);
                let slotAccessibilityLabel: string | undefined;
                if (followable) {
                  slotAccessibilityLabel = Constants.FOLLOW_ALONG;
                } else if (takeable) {
                  slotAccessibilityLabel = Constants.TAKE_YOUR_TURN;
                }
                const openSlotMenu = () => {
                  if (!editable && !cancellable && !takeable) {
                    return;
                  }
                  setSelectedSlot(slot.sourceSlot);
                };
                return (
                  <Pressable
                    key={`${slot.id}:${day.toISOString()}`}
                    onPress={followable ? onFollow : takeable ? openSlotMenu : undefined}
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
                    accessibilityRole={followable || takeable ? 'button' : undefined}
                    accessibilityLabel={slotAccessibilityLabel}
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
      <Dialog
        visible={selectedSlot !== null}
        onRequestClose={closeSlotMenu}
        dismissOnBackdropPress={deletingSlotId === null && takingTurnId === null}
        cardStyle={deleteError === null ? styles.turnOptionsCard : undefined}
        backdropStyle={deleteError === null ? styles.turnOptionsBackdrop : undefined}
      >
        {deleteError !== null ? (
          <>
            <Text style={dialogStyles.title}>
              {turnActionError === 'TAKE'
                ? 'Unable to take turn'
                : Constants.DELETE_TURN_FAILED_TITLE}
            </Text>
            <Text style={dialogStyles.message}>{deleteError}</Text>
            <View style={dialogStyles.actions}>
              <TouchableOpacity
                style={dialogStyles.secondaryButton}
                onPress={closeSlotMenu}
                accessibilityRole="button"
                accessibilityLabel={Constants.CANCEL}
              >
                <Text style={dialogStyles.secondaryText}>{Constants.CANCEL}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={dialogStyles.primaryButton}
                onPress={turnActionError === 'TAKE' ? handleTakeTurn : retryDeleteSelectedSlot}
                accessibilityRole="button"
                accessibilityLabel={Constants.RETRY}
              >
                <Text style={dialogStyles.primaryText}>{Constants.RETRY}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : recurringDeleteScopeOpen ? (
          <>
            <View style={styles.turnOptionsHeader}>
              <Text style={styles.turnOptionsTitle}>Delete recurring turn</Text>
              <TouchableOpacity
                style={styles.turnOptionsClose}
                onPress={closeSlotMenu}
                disabled={deletingSlotId !== null}
                accessibilityRole="button"
                accessibilityLabel="Close delete recurring turn"
                hitSlop={8}
              >
                <CrossIcon />
              </TouchableOpacity>
            </View>
            <Text style={styles.turnOptionsConfirmationMessage}>
              Choose whether to remove only this scheduled turn or this turn and future turns.
            </Text>
            <TouchableOpacity
              style={styles.turnOptionsPrimaryAction}
              onPress={() => {
                handleDeleteSelectedSlot('OCCURRENCE').catch(() => undefined);
              }}
              disabled={deletingSlotId !== null}
              accessibilityRole="button"
            >
              <Text style={styles.turnOptionsPrimaryText}>Delete this turn</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.turnOptionsDeleteAction}
              onPress={() => {
                handleDeleteSelectedSlot('THIS_AND_FUTURE').catch(() => undefined);
              }}
              disabled={deletingSlotId !== null}
              accessibilityRole="button"
            >
              <Text style={styles.turnOptionsDeleteText}>Delete this and following turns</Text>
            </TouchableOpacity>
          </>
        ) : deleteConfirmationOpen ? (
          <>
            <View style={styles.turnOptionsHeader}>
              <Text style={styles.turnOptionsTitle}>
                {Constants.DELETE_TURN_CONFIRMATION_TITLE}
              </Text>
              <TouchableOpacity
                style={styles.turnOptionsClose}
                onPress={closeSlotMenu}
                disabled={deletingSlotId !== null}
                accessibilityRole="button"
                accessibilityLabel="Close delete confirmation"
                hitSlop={8}
              >
                <CrossIcon />
              </TouchableOpacity>
            </View>
            <Text style={styles.turnOptionsConfirmationMessage}>
              {Constants.DELETE_TURN_CONFIRMATION_MESSAGE}
            </Text>
            <View style={styles.turnOptionsConfirmationActions}>
              <TouchableOpacity
                style={styles.turnOptionsConfirmationCancelAction}
                onPress={cancelDeleteConfirmation}
                disabled={deletingSlotId !== null}
                accessibilityRole="button"
                accessibilityLabel={Constants.CANCEL}
              >
                <Text style={styles.turnOptionsConfirmationCancelText}>{Constants.CANCEL}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.turnOptionsConfirmDeleteAction}
                onPress={() => {
                  handleDeleteSelectedSlot().catch(() => undefined);
                }}
                disabled={deletingSlotId !== null}
                accessibilityRole="button"
                accessibilityLabel={Constants.DELETE_TURN}
              >
                <Text style={styles.turnOptionsConfirmDeleteText}>{Constants.DELETE_TURN}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={styles.turnOptionsHeader}>
              <Text style={styles.turnOptionsTitle}>{Constants.TURN_OPTIONS}</Text>
              <TouchableOpacity
                style={styles.turnOptionsClose}
                onPress={closeSlotMenu}
                disabled={deletingSlotId !== null}
                accessibilityRole="button"
                accessibilityLabel="Close turn options"
                hitSlop={8}
              >
                <CrossIcon />
              </TouchableOpacity>
            </View>
            {selectedSlot ? (
              <View style={styles.turnOptionsSummary}>
                {selectedSlotAvatarUri ? (
                  <Image
                    source={{ uri: selectedSlotAvatarUri, headers: avatarHeaders() }}
                    style={styles.turnOptionsAvatar}
                    accessibilityLabel={selectedSlotReaderLabel}
                  />
                ) : (
                  <View
                    style={[
                      styles.turnOptionsAvatar,
                      styles.turnOptionsAvatarFallback,
                      { backgroundColor: tintFor(selectedSlotMember?.id ?? selectedSlot.id) },
                    ]}
                    accessibilityLabel={selectedSlotReaderLabel}
                  >
                    <Text style={styles.turnOptionsAvatarInitial} allowFontScaling={false}>
                      {initialOf(selectedSlotReaderLabel)}
                    </Text>
                  </View>
                )}
                <View style={styles.turnOptionsSummaryCopy}>
                  <Text style={styles.turnOptionsDate}>
                    {formatCalendarDate(selectedSlot.startsAt)}
                  </Text>
                  <Text style={styles.turnOptionsTime}>{slotTimeLabel(selectedSlot)}</Text>
                </View>
              </View>
            ) : null}
            {selectedSlot && canTakeTurn(selectedSlot) ? (
              <TouchableOpacity
                style={styles.turnOptionsPrimaryAction}
                onPress={() => {
                  handleTakeTurn().catch(() => undefined);
                }}
                disabled={takingTurnId !== null}
                accessibilityRole="button"
                accessibilityLabel={Constants.TAKE_YOUR_TURN}
              >
                {takingTurnId !== null ? (
                  <ActivityIndicator color={UIConstants.NAV_TEXT_COLOR} size="small" />
                ) : (
                  <Text style={styles.turnOptionsPrimaryText}>{Constants.TAKE_YOUR_TURN}</Text>
                )}
              </TouchableOpacity>
            ) : null}
            {selectedSlot && onEditSlot && !canTakeTurn(selectedSlot) ? (
              <TouchableOpacity
                style={styles.turnOptionsPrimaryAction}
                onPress={handleEditSelectedSlot}
                disabled={deletingSlotId !== null}
                accessibilityRole="button"
                accessibilityLabel={Constants.EDIT_TURN}
              >
                <Text style={styles.turnOptionsPrimaryText}>{Constants.EDIT_TURN}</Text>
              </TouchableOpacity>
            ) : null}
            {selectedSlot && !canTakeTurn(selectedSlot) ? (
              <View style={styles.turnOptionsDestructiveSection}>
                <TouchableOpacity
                  style={styles.turnOptionsDeleteAction}
                  onPress={requestDeleteSelectedSlot}
                  disabled={deletingSlotId !== null}
                  accessibilityRole="button"
                  accessibilityLabel={Constants.DELETE_TURN}
                >
                  {deletingSlotId !== null ? (
                    <View style={styles.turnOptionsBusyLabel}>
                      <ActivityIndicator color={UIConstants.DANGER_COLOR} size="small" />
                      <Text style={styles.turnOptionsDeleteText}>{Constants.DELETING_TURN}</Text>
                    </View>
                  ) : (
                    <Text style={styles.turnOptionsDeleteText}>{Constants.DELETE_TURN}</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        )}
      </Dialog>
    </>
  );
};
