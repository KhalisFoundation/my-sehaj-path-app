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
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText as Text } from '../components/AppText';
import { ChooseSlotStyles as styles } from '@styles';
import { Constants, ErrorConstants, UIConstants } from '@constants';
import { CalendarIcon } from '@icons';
import { bookSlot, loadPlan, updateSlot } from '../store/groupApi';
import {
  availabilityForSelectedTime,
  MINIMUM_BOOKING_LEAD_MINUTES,
  planWindowFor,
} from '../store/slotAvailability';
import { showErrorAlert } from '../utils/Error';
import { trackSharedPathEvent } from '../utils/sharedPathAnalytics';
import { recordError } from '../utils/crashlytics';
import type { SehajPathSlot } from '@api/generated/types.gen';
import type { RootStackParamList } from '../App';
import { useScreenAnalytics } from '@hooks';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { notifyPlanRefresh } from '../store/planEvents';

type Props = NativeStackScreenProps<RootStackParamList, 'ChooseSlot'>;

const DURATIONS = [15, 30, 45, 60, 75, 90, 105, 120] as const;
const DAY_LABEL_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};
const timeLabel = (at: Date): string =>
  at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const dayLabel = (day: Date): string => day.toLocaleDateString([], DAY_LABEL_OPTIONS);

const nextSelectableMinute = (now = new Date()): Date => {
  const leadMs = MINIMUM_BOOKING_LEAD_MINUTES * 60 * 1000;
  const earliest = new Date(now.getTime() + leadMs);
  earliest.setSeconds(0, 0);
  if (earliest.getTime() < now.getTime() + leadMs) {
    earliest.setMinutes(earliest.getMinutes() + 1);
  }
  return earliest;
};

const initialSelection = (value?: string): { day: Date; time: Date } => {
  if (!value) {
    const time = nextSelectableMinute();
    return {
      day: new Date(time.getFullYear(), time.getMonth(), time.getDate()),
      time,
    };
  }
  const selected = new Date(value);
  if (Number.isNaN(selected.getTime())) {
    const time = nextSelectableMinute();
    return {
      day: new Date(time.getFullYear(), time.getMonth(), time.getDate()),
      time,
    };
  }
  return {
    day: new Date(selected.getFullYear(), selected.getMonth(), selected.getDate()),
    time: selected,
  };
};

const timeOnDay = (day: Date, time: Date): Date =>
  new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    time.getHours(),
    time.getMinutes(),
    0,
    0
  );

const unavailableMessage = (
  reason: 'past' | 'too-soon' | 'next-day' | 'overlap' | 'invalid-duration'
) => {
  switch (reason) {
    case 'past':
      return Constants.SELECTED_TIME_PAST;
    case 'too-soon':
      return Constants.SELECTED_TIME_TOO_SOON.replace(
        '{minutes}',
        String(MINIMUM_BOOKING_LEAD_MINUTES)
      );
    case 'next-day':
      return Constants.SELECTED_TIME_NEXT_DAY;
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
  const initial = useMemo(
    () => initialSelection(route.params.initialStartsAt),
    [route.params.initialStartsAt]
  );
  useScreenAnalytics('ChooseSlot', 'ChooseSlot');
  const [day, setDay] = useState(initial.day);
  const [time, setTime] = useState(initial.time);
  const [minutes, setMinutes] = useState<number>(route.params.initialDurationMinutes ?? 15);
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
  }, [route.params.initialDurationMinutes, route.params.initialStartsAt, editingSlotId]);

  const load = useCallback(async () => {
    setSlots(null);
    const { from, to } = planWindowFor(day);
    try {
      const result = await loadPlan(sehajPathId, from, to);
      if (!result.ok) {
        setSlots([]);
        showErrorAlert(result.message, () => {
          load().catch(() => undefined);
        });
        return;
      }
      setSlots(result.data.slots);
    } catch (error) {
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

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(timer);
  }, []);

  const startsAt = useMemo(() => timeOnDay(day, time), [day, time]);
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
      enforceLeadTime: !isEditing,
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
            enforceLeadTime: !isEditing,
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
      const nextDay = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate());
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

  const book = useCallback(async () => {
    if (!availability?.available || booking) {
      return;
    }
    setBooking(true);
    trackSharedPathEvent('TURN_ADD');
    try {
      let result;
      if (isEditing) {
        result = await updateSlot(
          sehajPathId,
          editingSlotId,
          availability.slot.startsAt,
          availability.slot.endsAt
        );
      } else {
        result = await bookSlot(sehajPathId, availability.slot.startsAt, availability.slot.endsAt);
      }

      if (result.ok) {
        notifyPlanRefresh(sehajPathId, availability.slot.startsAt);
        navigation.goBack();
        return;
      }

      showErrorAlert(result.message || ErrorConstants.FAILED_TO_BOOK_TURN);
      // The database is the final authority if another member books this range
      // while the sheet is open. Refresh so the exact selection becomes disabled.
      await load();
    } catch (error) {
      recordError(error, 'ChooseSlot: booking threw');
      showErrorAlert(ErrorConstants.FAILED_TO_BOOK_TURN);
    } finally {
      setBooking(false);
    }
  }, [availability, booking, editingSlotId, isEditing, load, navigation, sehajPathId]);

  const addDisabled = availability?.available !== true || booking;
  let actionLabel = isEditing ? Constants.SAVE_TURN_CHANGES : Constants.ADD_TURN;
  if (booking) {
    actionLabel = isEditing ? Constants.EDITING : Constants.BOOKING;
  }
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
          if (gesture.dy > 180) {
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
    <Pressable style={styles.overlay} onPress={() => navigation.goBack()}>
      <Pressable
        style={[
          styles.sheet,
          { marginBottom: insets.bottom },
          sheetHeight > 0 && { height: sheetHeight },
        ]}
        onPress={() => {}}
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
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
            <Text style={styles.fieldText}>{dayLabel(day)}</Text>
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
            <Text style={styles.fieldText}>{timeLabel(startsAt)}</Text>
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
            <ActivityIndicator style={styles.loading} />
          ) : availability?.available ? (
            <Text style={styles.available}>
              {`${Constants.SELECTED_TIME_AVAILABLE}: ${timeLabel(
                availability.slot.startsAt
              )} – ${timeLabel(availability.slot.endsAt)}`}
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
        </ScrollView>

        <TouchableOpacity
          style={[styles.book, addDisabled && styles.disabled]}
          onPress={book}
          disabled={addDisabled}
          accessibilityRole="button"
          accessibilityState={{ disabled: addDisabled }}
        >
          <Text style={styles.bookText}>{actionLabel}</Text>
        </TouchableOpacity>
      </Pressable>
    </Pressable>
  );
};
