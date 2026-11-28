import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { ModalBackdrop } from '../components/ModalBackdrop';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText as Text } from '../components/AppText';
import { ChooseSlotStyles as styles } from '@styles';
import { Constants, ErrorConstants, UIConstants } from '@constants';
import { CalendarIcon, RepeatIcon, RightChevronIcon } from '@icons';
import { bookSlot, loadPlan, reportUnexpectedGroupRefusal, updateSlot } from '../store/groupApi';
import {
  availabilityForSelectedTime,
  earliestBookableStart,
  ENFORCE_EDIT_BOOKING_LEAD_TIME,
  MINIMUM_BOOKING_LEAD_MINUTES,
  planWindowFor,
} from '../store/slotAvailability';
import { showErrorAlert } from '../utils/Error';
import { trackSharedPathOutcome } from '../utils/sharedPathAnalytics';
import { recordError } from '../utils/crashlytics';
import type { SehajPathSlot } from '@api/generated/types.gen';
import type { RootStackParamList } from '../App';
import { useScreenAnalytics } from '@hooks';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { notifyPlanRefresh } from '../store/planEvents';
import {
  addMinutes,
  asLocalDateTime,
  ceilToLocalMinute,
  combineLocalDayAndTime,
  formatCalendarDate,
  formatTime,
  isSameLocalDay,
  isValidDateTime,
  startOfLocalDay,
} from '../utils/dateTime';

type Props = NativeStackScreenProps<RootStackParamList, 'ChooseSlot'>;

const DURATIONS = [15, 30, 45, 60, 75, 90, 105, 120] as const;
type RepeatOption = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
type RecurringEditScope = 'OCCURRENCE' | 'THIS_AND_FUTURE';
type ScopeOption = { scope: RecurringEditScope; title: string; description: string };

const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

const ordinal = (day: number): string => {
  const remainder = day % 100;
  if (remainder >= 11 && remainder <= 13) {
    return `${day}th`;
  }
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
};

const repeatRuleFor = (repeat: RepeatOption, startsAt: Date): string | undefined => {
  const start = asLocalDateTime(startsAt);
  switch (repeat) {
    case 'daily':
      return 'FREQ=DAILY';
    case 'weekly':
      return `FREQ=WEEKLY;BYDAY=${WEEKDAY_CODES[start.day()]}`;
    case 'monthly':
      return `FREQ=MONTHLY;BYMONTHDAY=${start.date()}`;
    case 'yearly':
      return `FREQ=YEARLY;BYMONTH=${start.month() + 1};BYMONTHDAY=${start.date()}`;
    default:
      return undefined;
  }
};

const repeatLabelFor = (repeat: RepeatOption, startsAt: Date): string => {
  const start = asLocalDateTime(startsAt);
  switch (repeat) {
    case 'daily':
      return Constants.EVERY_DAY;
    case 'weekly':
      return `${Constants.EVERY_WEEK} ${start.format('dddd')}`;
    case 'monthly':
      return `${Constants.EVERY_MONTH} ${ordinal(start.date())}`;
    case 'yearly':
      return `${Constants.EVERY_YEAR} ${start.format('MMMM D')}`;
    default:
      return Constants.DO_NOT_REPEAT;
  }
};

const repeatDescriptionFor = (repeat: RepeatOption): string | undefined => {
  switch (repeat) {
    case 'weekly':
      return 'Repeats weekly on the selected day';
    case 'monthly':
      return 'Repeats monthly on the selected date';
    case 'yearly':
      return 'Repeats yearly on the selected date';
    default:
      return undefined;
  }
};

const repeatOptionForRule = (rule?: string): RepeatOption => {
  if (rule?.startsWith('FREQ=DAILY')) {
    return 'daily';
  }
  if (rule?.startsWith('FREQ=WEEKLY')) {
    return 'weekly';
  }
  if (rule?.startsWith('FREQ=MONTHLY')) {
    return 'monthly';
  }
  if (rule?.startsWith('FREQ=YEARLY')) {
    return 'yearly';
  }
  return 'none';
};

const deviceTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const nextSelectableMinute = (now = new Date()): Date => {
  const earliest = addMinutes(now, MINIMUM_BOOKING_LEAD_MINUTES);
  return ceilToLocalMinute(earliest);
};

const initialSelection = (value?: string): { day: Date; time: Date } => {
  if (!value) {
    const time = nextSelectableMinute();
    return {
      day: startOfLocalDay(time),
      time,
    };
  }
  if (!isValidDateTime(value)) {
    const time = nextSelectableMinute();
    return {
      day: startOfLocalDay(time),
      time,
    };
  }
  const selected = asLocalDateTime(value).toDate();
  return {
    day: startOfLocalDay(selected),
    time: selected,
  };
};

const timeOnDay = (day: Date, time: Date): Date => combineLocalDayAndTime(day, time);

const selectedTimeRangeLabel = (startsAt: Date, endsAt: Date): string => {
  if (isSameLocalDay(startsAt, endsAt)) {
    return `${formatTime(startsAt)} – ${formatTime(endsAt)}`;
  }
  return `${formatCalendarDate(startsAt)}, ${formatTime(startsAt)} – ${formatCalendarDate(
    endsAt
  )}, ${formatTime(endsAt)}`;
};

const unavailableMessage = (reason: 'past' | 'too-soon' | 'overlap' | 'invalid-duration') => {
  switch (reason) {
    case 'past':
      return Constants.SELECTED_TIME_PAST;
    case 'too-soon':
      return Constants.SELECTED_TIME_TOO_SOON.replace(
        '{minutes}',
        String(MINIMUM_BOOKING_LEAD_MINUTES)
      );
    case 'overlap':
      return Constants.SELECTED_TIME_OVERLAP;
    default:
      return Constants.SELECT_START_TIME;
  }
};

/** Bottom sheet for booking an exact future shared-path turn. */
export const ChooseSlot = ({ route, navigation }: Props) => {
  const { sehajPathId } = route.params;
  const editingSlotId = route.params.slotId;
  const isEditing = editingSlotId !== undefined;
  const isRecurringEdit = isEditing && route.params.isRecurring === true;
  const initialRepeat = useMemo(
    () => (isRecurringEdit ? repeatOptionForRule(route.params.initialRecurrenceRule) : 'none'),
    [isRecurringEdit, route.params.initialRecurrenceRule]
  );
  const initial = useMemo(
    () => initialSelection(route.params.initialStartsAt),
    [route.params.initialStartsAt]
  );
  const originalStartsAt = useMemo(
    () => timeOnDay(initial.day, initial.time),
    [initial.day, initial.time]
  );
  const originalDurationMinutes = route.params.initialDurationMinutes ?? 15;
  useScreenAnalytics('ChooseSlot', 'ChooseSlot');
  const [day, setDay] = useState(initial.day);
  const [time, setTime] = useState(initial.time);
  const [minutes, setMinutes] = useState<number>(route.params.initialDurationMinutes ?? 15);
  const [repeat, setRepeat] = useState<RepeatOption>('none');
  const [repeatPickerOpen, setRepeatPickerOpen] = useState(false);
  const [recurringEditScopeOpen, setRecurringEditScopeOpen] = useState(false);
  // Which turns the edit applies to, chosen in the sheet before saving.
  const [editScopeChoice, setEditScopeChoice] = useState<RecurringEditScope>('OCCURRENCE');
  const [slots, setSlots] = useState<SehajPathSlot[] | null>(null);
  const [booking, setBooking] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [draftDay, setDraftDay] = useState(day);
  const [draftTime, setDraftTime] = useState(time);
  const [now, setNow] = useState(() => new Date());
  const [sheetHeight, setSheetHeight] = useState(0);
  const sheetStartHeight = useRef(0);
  const sheetHeightRef = useRef(0);
  const automaticStartSelectionRef = useRef<string | null>(null);
  // True while this sheet is on screen. A request can finish after the sheet was
  // dismissed (Android back, the iOS back gesture), and `navigation.goBack()` is
  // not tied to this sheet: it pops whatever is on top by then, which is the
  // path's Continue screen, and sends the person to Home.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  // Mirrors `booking` for the swipe handler, which is built once.
  const bookingRef = useRef(false);
  // The newest `load`. If the date changes while one is in flight, the older
  // answer is for the wrong day and must not replace the newer one.
  const loadSequenceRef = useRef(0);
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // `navigate(ChooseSlot, …)` may reuse an existing sheet in the stack. Keep
  // the displayed local calendar day in sync with the route in that case — in
  // particular, a turn created just after midnight must not be edited as if it
  // belonged to the previous day.
  useEffect(() => {
    const selection = initialSelection(route.params.initialStartsAt);
    setDay(selection.day);
    setTime(selection.time);
    setDraftDay(selection.day);
    setDraftTime(selection.time);
    setMinutes(route.params.initialDurationMinutes ?? 15);
    setRepeat(
      route.params.isRecurring === true
        ? repeatOptionForRule(route.params.initialRecurrenceRule)
        : 'none'
    );
  }, [
    editingSlotId,
    route.params.initialDurationMinutes,
    route.params.initialRecurrenceRule,
    route.params.initialStartsAt,
    route.params.isRecurring,
  ]);

  const automaticSelectionKey = `${editingSlotId ?? 'new'}:${
    route.params.initialStartsAt ?? 'default'
  }`;

  useEffect(() => {
    automaticStartSelectionRef.current = null;
  }, [automaticSelectionKey]);

  const load = useCallback(async () => {
    const sequence = ++loadSequenceRef.current;
    const isCurrent = () => mountedRef.current && sequence === loadSequenceRef.current;
    setSlots(null);
    const { from, to } = planWindowFor(day);
    try {
      const result = await loadPlan(sehajPathId, from, to);
      if (!isCurrent()) {
        return;
      }
      if (!result.ok) {
        setSlots([]);
        showErrorAlert(result.message, () => {
          load().catch(() => undefined);
        });
        return;
      }
      setSlots(result.data.slots);
    } catch (error) {
      if (!isCurrent()) {
        return;
      }
      setSlots([]);
      recordError(error, 'ChooseSlot: failed to load schedule');
      showErrorAlert(
        ErrorConstants.FAILED_TO_LOAD_TURNS,
        () => {
          load().catch(() => undefined);
        },
        Constants.RETRY
      );
    }
  }, [day, sehajPathId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  // A generic Add Turn entry point has no user-selected time yet. Once its
  // plan arrives, replace the provisional "now + lead time" default with the
  // earliest gap that fits the default duration. Do not override an edit or a
  // time chosen by tapping the calendar.
  useEffect(() => {
    const canChooseAutomatically =
      !isEditing && route.params.initialStartsAt === undefined && slots !== null;
    if (!canChooseAutomatically || automaticStartSelectionRef.current === automaticSelectionKey) {
      return;
    }

    automaticStartSelectionRef.current = automaticSelectionKey;
    const nextStart = earliestBookableStart({
      slots,
      durationMinutes: minutes,
      now,
    });
    const nextDay = startOfLocalDay(nextStart);
    setDay(nextDay);
    setTime(nextStart);
    setDraftDay(nextDay);
    setDraftTime(nextStart);
  }, [automaticSelectionKey, isEditing, minutes, now, route.params.initialStartsAt, slots]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(timer);
  }, []);

  const startsAt = useMemo(() => timeOnDay(day, time), [day, time]);
  const recurrenceRule = useMemo(() => repeatRuleFor(repeat, startsAt), [repeat, startsAt]);
  const recurrenceChanged = isRecurringEdit && repeat !== initialRepeat;
  const availability = useMemo(() => {
    if (slots === null) {
      return null;
    }
    return availabilityForSelectedTime({
      startsAt,
      durationMinutes: minutes,
      slots,
      excludeSlotId: editingSlotId,
      now,
      enforceLeadTime: !isEditing || ENFORCE_EDIT_BOOKING_LEAD_TIME,
    });
  }, [editingSlotId, isEditing, minutes, now, slots, startsAt]);
  const durationAvailability = useMemo(
    () =>
      DURATIONS.map((option) => ({
        option,
        available:
          slots !== null &&
          availabilityForSelectedTime({
            startsAt,
            durationMinutes: option,
            slots,
            excludeSlotId: editingSlotId,
            now,
            enforceLeadTime: !isEditing || ENFORCE_EDIT_BOOKING_LEAD_TIME,
          }).available,
      })),
    [editingSlotId, isEditing, now, slots, startsAt]
  );

  const chooseTime = useCallback((event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'set' && selected) {
      setDraftTime(selected);
      if (Platform.OS === 'android') {
        setTime(selected);
      }
    }
    if (Platform.OS === 'android') {
      setTimePickerOpen(false);
    }
  }, []);

  const chooseDate = useCallback((event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'set' && selected) {
      const nextDay = startOfLocalDay(selected);
      setDraftDay(nextDay);
      if (Platform.OS === 'android') {
        setDay(nextDay);
      }
    }
    if (Platform.OS === 'android') {
      setDatePickerOpen(false);
    }
  }, []);

  const openDatePicker = useCallback(() => {
    setDraftDay(day);
    setDatePickerOpen(true);
  }, [day]);

  const openTimePicker = useCallback(() => {
    setDraftTime(time);
    setTimePickerOpen(true);
  }, [time]);

  const selectRepeat = useCallback((option: RepeatOption) => {
    setRepeat(option);
    setRepeatPickerOpen(false);
  }, []);

  const hasChanges = useMemo(
    () =>
      !isEditing ||
      startsAt.getTime() !== originalStartsAt.getTime() ||
      minutes !== originalDurationMinutes ||
      recurrenceChanged,
    [isEditing, minutes, originalDurationMinutes, originalStartsAt, recurrenceChanged, startsAt]
  );

  const book = useCallback(
    async (editScope?: RecurringEditScope) => {
      if (!availability?.available || booking || (isEditing && !hasChanges)) {
        return;
      }
      if (isRecurringEdit && editScope === undefined) {
        // Which turns change is the user's call, so ask every time. A changed
        // repeat rule can only apply from this turn onward, so that single
        // option comes pre-selected; otherwise start on the narrower choice.
        setEditScopeChoice(recurrenceChanged ? 'THIS_AND_FUTURE' : 'OCCURRENCE');
        setRecurringEditScopeOpen(true);
        return;
      }
      setBooking(true);
      bookingRef.current = true;
      const analyticsEvent = isEditing ? 'TURN_EDIT' : 'TURN_ADD';
      try {
        let result;
        if (isEditing) {
          let updatedRecurrence: { recurrenceRule: string; recurrenceTimezone: string } | undefined;
          if (editScope === 'THIS_AND_FUTURE' && recurrenceRule) {
            updatedRecurrence = {
              recurrenceRule,
              recurrenceTimezone: deviceTimeZone(),
            };
          }
          result = await updateSlot(
            sehajPathId,
            editingSlotId,
            availability.slot.startsAt,
            availability.slot.endsAt,
            editScope,
            updatedRecurrence
          );
        } else {
          let recurrence;
          if (recurrenceRule) {
            recurrence = {
              recurrenceRule,
              recurrenceTimezone: deviceTimeZone(),
            };
          }
          result = await bookSlot(
            sehajPathId,
            availability.slot.startsAt,
            availability.slot.endsAt,
            recurrence
          );
        }

        if (result.ok) {
          trackSharedPathOutcome(analyticsEvent, 'success');
          // The turn exists whether or not the sheet is still here, so the plan
          // is always refreshed. Only leaving is conditional: a late
          // `goBack()` would pop whatever is on top by then.
          notifyPlanRefresh(sehajPathId, availability.slot.startsAt);
          if (mountedRef.current) {
            navigation.goBack();
          }
          return;
        }

        if (mountedRef.current) {
          showErrorAlert(result.message || ErrorConstants.FAILED_TO_BOOK_TURN);
        }
        reportUnexpectedGroupRefusal('turn mutation', result, [400, 409]);
        // The database is the final authority if another member books this range
        // while the sheet is open. Refresh so the exact selection becomes disabled.
        if (mountedRef.current) {
          await load();
        }
      } catch (error) {
        recordError(error, 'ChooseSlot: booking threw');
        if (mountedRef.current) {
          showErrorAlert(ErrorConstants.FAILED_TO_BOOK_TURN);
        }
      } finally {
        bookingRef.current = false;
        if (mountedRef.current) {
          setBooking(false);
        }
      }
    },
    [
      availability,
      booking,
      editingSlotId,
      hasChanges,
      isEditing,
      isRecurringEdit,
      load,
      navigation,
      recurrenceChanged,
      recurrenceRule,
      sehajPathId,
    ]
  );

  const addDisabled = availability?.available !== true || booking || (isEditing && !hasChanges);
  // A recurring edit always opens the scope sheet before anything is saved.
  // "Continue" accurately describes this intermediate action; the sheet's
  // final button remains the explicit update confirmation.
  let actionLabel = isEditing ? 'Update turn' : Constants.ADD_TURN;
  if (isRecurringEdit) {
    actionLabel = Constants.CONTINUE;
  }
  if (booking) {
    actionLabel = isEditing ? Constants.EDITING : Constants.BOOKING;
  }
  // What the edit sheet offers. Changing the repeat rule has only one valid
  // meaning (from this turn onward); anything else lets the user pick.
  const thisTurnOnly: ScopeOption = {
    scope: 'OCCURRENCE',
    title: 'Update this turn',
    description: 'Only this scheduled turn will change.',
  };
  const thisAndFollowing: ScopeOption = {
    scope: 'THIS_AND_FUTURE',
    title: 'Update this and following turns',
    description: recurrenceChanged
      ? 'The new repeat schedule applies from this turn onward.'
      : 'Past turns and already booked turns stay unchanged.',
  };
  const scopeOptions = recurrenceChanged ? [thisAndFollowing] : [thisTurnOnly, thisAndFollowing];
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          sheetStartHeight.current = sheetHeightRef.current;
        },
        onPanResponderMove: (_, gesture) => {
          const nextHeight = Math.max(
            windowHeight * 0.45,
            Math.min(sheetStartHeight.current - gesture.dy, windowHeight * 0.92)
          );
          sheetHeightRef.current = nextHeight;
          setSheetHeight(nextHeight);
        },
        onPanResponderRelease: (_, gesture) => {
          // Not while a booking is in flight: leaving would abandon a request
          // whose result the person has not seen. The sheet settles back instead.
          if (gesture.dy > 180 && !bookingRef.current) {
            navigation.goBack();
            return;
          }
          const nextHeight = Math.max(
            windowHeight * 0.45,
            Math.min(sheetHeightRef.current, windowHeight * 0.92)
          );
          sheetHeightRef.current = nextHeight;
          setSheetHeight(nextHeight);
        },
      }),
    [navigation, windowHeight]
  );

  return (
    <View style={styles.overlay}>
      <ModalBackdrop />
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          // Leaving mid-booking would abandon a request whose result the
          // person has not seen yet.
          if (!booking) {
            navigation.goBack();
          }
        }}
      />
      <View
        style={[styles.sheet, sheetHeight > 0 && { height: sheetHeight }]}
        onLayout={({ nativeEvent }) => {
          if (sheetHeight === 0) {
            sheetHeightRef.current = nativeEvent.layout.height;
            setSheetHeight(nativeEvent.layout.height);
          }
        }}
      >
        <View style={styles.grabberHitArea} {...panResponder.panHandlers}>
          <View style={styles.grabber} />
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>
            {isEditing ? Constants.EDIT_TURN_TITLE : Constants.ADD_TURN_TITLE}
          </Text>

          <Text style={styles.sectionLabel}>{Constants.DATE}</Text>
          <TouchableOpacity
            style={styles.field}
            onPress={openDatePicker}
            accessibilityRole="button"
            accessibilityLabel="Date picker"
          >
            <CalendarIcon width={24} height={24} />
            <Text style={styles.fieldText}>{formatCalendarDate(day)}</Text>
          </TouchableOpacity>
          {datePickerOpen && Platform.OS === 'android' ? (
            <DateTimePicker
              value={draftDay}
              mode="date"
              display="default"
              onChange={chooseDate}
              themeVariant="light"
            />
          ) : null}
          {datePickerOpen && Platform.OS !== 'android' && (
            <Modal
              transparent
              animationType="fade"
              visible
              onRequestClose={() => setDatePickerOpen(false)}
            >
              <Pressable style={styles.pickerOverlay} onPress={() => setDatePickerOpen(false)}>
                <ModalBackdrop />
                <Pressable style={styles.pickerCard} onPress={() => {}}>
                  <DateTimePicker
                    value={draftDay}
                    mode="date"
                    display="spinner"
                    onChange={chooseDate}
                    style={styles.nativePicker}
                    themeVariant="light"
                    textColor={UIConstants.PRIMARY_COLOR}
                  />
                  <View style={styles.pickerActions}>
                    <TouchableOpacity onPress={() => setDatePickerOpen(false)}>
                      <Text style={styles.pickerCancel}>{Constants.CANCEL}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setDay(draftDay);
                        setDatePickerOpen(false);
                      }}
                    >
                      <Text style={styles.pickerConfirm}>{Constants.OK}</Text>
                    </TouchableOpacity>
                  </View>
                </Pressable>
              </Pressable>
            </Modal>
          )}

          <Text style={styles.sectionLabel}>{Constants.START_TIME}</Text>
          <TouchableOpacity
            style={[styles.field, styles.timePickerField]}
            onPress={openTimePicker}
            accessibilityRole="button"
            accessibilityLabel="Start time picker"
          >
            <CalendarIcon width={24} height={24} />
            <Text style={styles.fieldText}>{formatTime(startsAt)}</Text>
          </TouchableOpacity>
          {timePickerOpen && Platform.OS === 'android' ? (
            <DateTimePicker
              value={draftTime}
              mode="time"
              display="default"
              onChange={chooseTime}
              themeVariant="light"
            />
          ) : null}
          {timePickerOpen && Platform.OS !== 'android' && (
            <Modal
              transparent
              animationType="fade"
              visible
              onRequestClose={() => setTimePickerOpen(false)}
            >
              <Pressable style={styles.pickerOverlay} onPress={() => setTimePickerOpen(false)}>
                <ModalBackdrop />
                <Pressable style={styles.pickerCard} onPress={() => {}}>
                  <DateTimePicker
                    value={draftTime}
                    mode="time"
                    display="spinner"
                    onChange={chooseTime}
                    style={styles.nativePicker}
                    themeVariant="light"
                    textColor={UIConstants.PRIMARY_COLOR}
                  />
                  <View style={styles.pickerActions}>
                    <TouchableOpacity onPress={() => setTimePickerOpen(false)}>
                      <Text style={styles.pickerCancel}>{Constants.CANCEL}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setTime(draftTime);
                        setTimePickerOpen(false);
                      }}
                    >
                      <Text style={styles.pickerConfirm}>{Constants.OK}</Text>
                    </TouchableOpacity>
                  </View>
                </Pressable>
              </Pressable>
            </Modal>
          )}

          {slots === null ? (
            <ActivityIndicator testID="turn-plan-loading" style={styles.loading} />
          ) : availability?.available ? (
            <Text style={styles.available}>
              {`${Constants.SELECTED_TIME_AVAILABLE}: ${selectedTimeRangeLabel(
                availability.slot.startsAt,
                availability.slot.endsAt
              )}`}
            </Text>
          ) : availability ? (
            <Text style={styles.unavailable}>{unavailableMessage(availability.reason)}</Text>
          ) : null}

          <Text style={styles.sectionLabel}>{Constants.DURATION}</Text>
          <View style={styles.durationGrid}>
            {DURATIONS.map((option) => {
              const selected = option === minutes;
              const available = durationAvailability.find(
                (item) => item.option === option
              )?.available;
              const disabled = available !== true;
              return (
                <TouchableOpacity
                  key={option}
                  onPress={() => setMinutes(option)}
                  disabled={disabled}
                  style={[
                    styles.duration,
                    selected && styles.durationSelected,
                    disabled && styles.durationDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                >
                  <Text
                    style={[
                      styles.durationText,
                      selected && styles.durationTextSelected,
                      disabled && styles.durationTextDisabled,
                    ]}
                  >
                    {`${option} mins`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {!isEditing || isRecurringEdit ? (
            <>
              <Text style={styles.sectionLabel}>{Constants.REPEAT}</Text>
              <TouchableOpacity
                style={styles.field}
                onPress={() => setRepeatPickerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Repeat options"
              >
                <RepeatIcon />
                <Text style={[styles.fieldText, styles.repeatFieldText]}>
                  {repeatLabelFor(repeat, startsAt)}
                </Text>
                <View style={styles.repeatFieldChevron}>
                  <RightChevronIcon />
                </View>
              </TouchableOpacity>
            </>
          ) : null}
        </ScrollView>

        <Modal
          transparent
          animationType="fade"
          visible={repeatPickerOpen}
          onRequestClose={() => setRepeatPickerOpen(false)}
        >
          <Pressable style={styles.repeatOverlay} onPress={() => setRepeatPickerOpen(false)}>
            <ModalBackdrop />
            <Pressable style={styles.repeatSheet} onPress={() => {}}>
              <View style={styles.repeatGrabber} />
              <Text style={styles.repeatTitle}>{Constants.REPEAT}</Text>
              {(
                (isRecurringEdit
                  ? ['daily', 'weekly', 'monthly', 'yearly']
                  : ['none', 'daily', 'weekly', 'monthly', 'yearly']) as RepeatOption[]
              ).map((option) => {
                const description = repeatDescriptionFor(option);
                const selected = repeat === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={styles.repeatOption}
                    onPress={() => selectRepeat(option)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    {option === 'none' ? <RepeatIcon /> : <CalendarIcon />}
                    <View style={styles.repeatOptionCopy}>
                      <Text style={styles.repeatOptionText}>
                        {repeatLabelFor(option, startsAt)}
                      </Text>
                      {description ? (
                        <Text style={styles.repeatOptionDescription}>{description}</Text>
                      ) : null}
                    </View>
                    <View style={[styles.repeatRadio, selected && styles.repeatRadioSelected]}>
                      {selected ? <View style={styles.repeatRadioDot} /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          transparent
          animationType="fade"
          visible={recurringEditScopeOpen}
          onRequestClose={() => setRecurringEditScopeOpen(false)}
        >
          <Pressable style={styles.repeatOverlay} onPress={() => setRecurringEditScopeOpen(false)}>
            <ModalBackdrop />
            <Pressable style={styles.repeatSheet} onPress={() => {}}>
              <View style={styles.repeatGrabber} />
              <Text style={styles.repeatTitle}>Update recurring turn</Text>
              {scopeOptions.map((option) => {
                const selected = editScopeChoice === option.scope;
                return (
                  <TouchableOpacity
                    key={option.scope}
                    style={styles.repeatOption}
                    onPress={() => setEditScopeChoice(option.scope)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <View style={styles.repeatOptionCopy}>
                      <Text style={styles.repeatOptionText}>{option.title}</Text>
                      <Text style={styles.repeatOptionDescription}>{option.description}</Text>
                    </View>
                    <View style={[styles.repeatRadio, selected && styles.repeatRadioSelected]}>
                      {selected ? <View style={styles.repeatRadioDot} /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={styles.scopeConfirm}
                onPress={() => {
                  setRecurringEditScopeOpen(false);
                  book(editScopeChoice).catch(() => undefined);
                }}
                accessibilityRole="button"
                accessibilityLabel="Confirm update"
              >
                <Text style={styles.bookText}>Update turn</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        <TouchableOpacity
          // Keep the action above the home indicator without lifting the sheet
          // itself off the bottom edge. The sheet should read as one continuous
          // full-width surface, not as a floating card.
          style={[
            styles.book,
            { marginBottom: Math.max(insets.bottom, UIConstants.RHYTHM) },
            addDisabled && styles.disabled,
          ]}
          onPress={() => {
            book().catch(() => undefined);
          }}
          disabled={addDisabled}
          accessibilityRole="button"
          accessibilityState={{ disabled: addDisabled }}
        >
          <Text style={styles.bookText}>{actionLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
