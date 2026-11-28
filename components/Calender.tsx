import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppText as Text } from './AppText';
import { dayjs } from '../utils/dateTime';
import { CalenderStyles } from '@styles';
import { LeftArrowIcon, RightArrowIcon } from '@icons';
import { CalenderDays } from '@constants';
import { useAppSelector } from '../store/hooks';
import { listSharedReadingDays } from '../store/groupApi';
import { store } from '../store';
import { applyServerPathData } from '../store/slices/pathsSlice';

interface Props {
  streak: React.MutableRefObject<number>;
  pathId: number;
  sharedPathId?: string;
  onStreakUpdate?: (streakValue: number | null) => void;
}

const sharedDayToLegacy = (value: string): string | null => {
  // New servers return a date-only group key. Parse it in UTC so it can never
  // move to the previous/next day on this device. Keep accepting the older
  // timestamp response during a rolling API deployment.
  const canonical = dayjs.utc(value, 'YYYY-MM-DD', true);
  if (canonical.isValid()) {
    return canonical.format('D-MMMM-YYYY');
  }
  const legacyTimestamp = dayjs(value);
  return legacyTimestamp.isValid() ? legacyTimestamp.format('D-MMMM-YYYY') : null;
};

export const Calender = ({ pathId, sharedPathId, streak, onStreakUpdate }: Props) => {
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [days, setDays] = useState<string[]>([]);
  const [sharedDates, setSharedDates] = useState<string[] | null>(null);
  // Reactive: no fetch-on-mount, and it updates as soon as progress is saved.
  const progressDates = useAppSelector((state) =>
    state.paths.dates.find((date) => date.pathid === pathId)
  );

  const loadSharedDates = useCallback(async (): Promise<string[] | null> => {
    if (!sharedPathId) {
      return null;
    }
    const result = await listSharedReadingDays(sharedPathId);
    return result.ok ? result.data.dates : null;
  }, [sharedPathId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setSharedDates(null);
      loadSharedDates()
        .then((dates) => {
          if (active) {
            setSharedDates(dates);
            if (dates !== null) {
              const canonicalDates = dates.flatMap((date) => {
                const localDate = sharedDayToLegacy(date);
                return localDate === null ? [] : [{ date: localDate }];
              });
              store.dispatch(
                applyServerPathData({
                  pathId,
                  pathPatch: {},
                  // Once the API answers, it is the shared path's one source
                  // of truth. Merging personal cached dates made different
                  // members render different calendars indefinitely.
                  datePatch: { dates: canonicalDates },
                })
              );
            }
          }
        })
        .catch(() => {
          if (active && sharedPathId) {
            setSharedDates(null);
          }
        });
      return () => {
        active = false;
      };
    }, [loadSharedDates, pathId, sharedPathId])
  );

  const readingDateStrings = useMemo(() => {
    // Older builds wrote `{ date: '' }` for shared saves. It is not a day, and
    // counting it made the list non-empty, skipping the loading state.
    const persistedDates =
      progressDates?.dates?.map((date: any) => date.date).filter(Boolean) ?? [];
    if (sharedPathId) {
      // Use persisted reading days while the authoritative group streak is
      // loading. Once the group response arrives it replaces this local cache:
      // a shared streak must be identical for every member.
      if (sharedDates !== null) {
        return sharedDates.flatMap((date) => {
          const legacy = sharedDayToLegacy(date);
          return legacy === null ? [] : [legacy];
        });
      }
    }
    return persistedDates;
  }, [progressDates, sharedDates, sharedPathId]);

  const isStreakLoading =
    Boolean(sharedPathId) && sharedDates === null && readingDateStrings.length === 0;

  const calculateStreak = useCallback((dates: string[]): number => {
    if (!dates || dates.length === 0) {
      return 0;
    }
    const today = dayjs();
    const todayString = today.format('D-MMMM-YYYY');
    // A streak remains active through the current day until midnight. If the
    // user has not read today yet, yesterday is the latest valid anchor rather
    // than an immediate reset to zero.
    const anchor = dates.includes(todayString) ? today : today.subtract(1, 'day');
    const anchorString = anchor.format('D-MMMM-YYYY');

    if (!dates.includes(anchorString)) {
      return 0;
    }

    const sortedDates = dates
      .map((dateStr) => dayjs(dateStr, 'D-MMMM-YYYY'))
      .sort((firstDate, secondDate) => secondDate.diff(firstDate, 'day'));

    let currentStreak = 1;

    const anchorIndex = sortedDates.findIndex(
      (date) => date.format('D-MMMM-YYYY') === anchorString
    );
    if (anchorIndex < 0) {
      return 0;
    }

    for (let i = anchorIndex; i < sortedDates.length - 1; i++) {
      const currentDate = sortedDates[i];
      const nextDate = sortedDates[i + 1];
      if (currentDate.diff(nextDate, 'day') === 1) {
        currentStreak++;
      } else {
        break;
      }
    }

    return currentStreak;
  }, []);

  const currentStreak = useMemo(() => {
    return calculateStreak(readingDateStrings);
  }, [calculateStreak, readingDateStrings]);

  const daysArray = useMemo(() => {
    const daysInMonth = currentMonth.daysInMonth();
    const firstDayOfMonth = currentMonth.startOf('month').day();
    return Array.from({ length: 42 }, (_, index) => {
      if (index < firstDayOfMonth) {
        return '';
      }
      const day = index - firstDayOfMonth + 1;
      if (day > 0 && day <= daysInMonth) {
        return day.toString();
      }
      return '';
    });
  }, [currentMonth]);

  useEffect(() => {
    setDays(daysArray);
  }, [daysArray]);

  useEffect(() => {
    if (isStreakLoading) {
      onStreakUpdate?.(null);
      return;
    }

    streak.current = currentStreak;
    onStreakUpdate?.(currentStreak);
  }, [currentStreak, isStreakLoading, streak, onStreakUpdate]);

  const hasProgress = useCallback(
    (date: dayjs.Dayjs): boolean => {
      if (readingDateStrings.length === 0) {
        return false;
      }
      const dateString = date.format('D-MMMM-YYYY');
      return readingDateStrings.includes(dateString);
    },
    [readingDateStrings]
  );

  const dateRows = useMemo(() => {
    const rows = [];
    for (let i = 0; i < days.length; i += 7) {
      const row = days.slice(i, i + 7);
      rows.push(row);
    }
    return rows;
  }, [days]);

  const calendarDaysArray = useMemo(() => Object.keys(CalenderDays), []);

  const renderDateCell = useCallback(
    (date: string, dateIndex: number) => {
      if (!date) {
        return <View key={dateIndex} style={CalenderStyles.emptyDate} />;
      }
      const dateObj = currentMonth.date(parseInt(date, 10));
      const yesterdayObj = dateObj.subtract(1, 'day');
      const tomorrowObj = dateObj.add(1, 'day');
      const isProgress = hasProgress(dateObj);
      const hadProgressYesterday = hasProgress(yesterdayObj);
      const willHaveProgressTomorrow = hasProgress(tomorrowObj);
      const isPartOfStreak = isProgress && (hadProgressYesterday || willHaveProgressTomorrow);
      let isCurrentStreak = true;

      if (isPartOfStreak) {
        let dayToTest = dateObj.add(1, 'day');
        let safetyCounter = 0;
        const maxForwardChecks = 30;

        while (dayToTest.isBefore(dayjs(), 'day') && safetyCounter < maxForwardChecks) {
          if (!hasProgress(dayToTest)) {
            isCurrentStreak = false;
            break;
          }
          dayToTest = dayToTest.add(1, 'day');
          safetyCounter++;
        }
      }

      const showLightning = isPartOfStreak && isCurrentStreak;

      let containerStyle = CalenderStyles.calenderDate;
      let textStyle = CalenderStyles.dateText;
      if (isProgress) {
        containerStyle = CalenderStyles.progressDate;
        textStyle = CalenderStyles.progressDateText;
      } else if (dateObj.isBefore(dayjs(), 'day')) {
        containerStyle = CalenderStyles.emptyProgressDate;
        textStyle = CalenderStyles.progressDateText;
      }

      return (
        <View key={dateIndex} style={containerStyle}>
          <Text style={textStyle}>{date}</Text>
          {showLightning && (
            <Image
              source={require('@assets/Images/Streak.png')}
              style={CalenderStyles.lightningIcon}
            />
          )}
        </View>
      );
    },
    [currentMonth, hasProgress]
  );

  const handlePreviousMonth = useCallback(() => {
    setCurrentMonth(currentMonth.subtract(1, 'month'));
  }, [currentMonth]);

  const handleNextMonth = useCallback(() => {
    setCurrentMonth(currentMonth.add(1, 'month'));
  }, [currentMonth]);

  return (
    <View style={CalenderStyles.calenderContainer}>
      <View style={CalenderStyles.calenderHeader}>
        <TouchableOpacity
          onPress={handlePreviousMonth}
          accessibilityLabel="Previous month"
          accessibilityRole="button"
          accessibilityHint="Tap to view previous month"
        >
          <LeftArrowIcon />
        </TouchableOpacity>
        <Text style={CalenderStyles.calenderHeaderText}>{currentMonth.format('MMMM YYYY')}</Text>
        <TouchableOpacity
          onPress={handleNextMonth}
          accessibilityLabel="Next month"
          accessibilityRole="button"
          accessibilityHint="Tap to view next month"
        >
          <RightArrowIcon />
        </TouchableOpacity>
      </View>

      <View style={CalenderStyles.calenderDays}>
        {calendarDaysArray.map((day, index) => (
          <Text key={index} style={CalenderStyles.calenderDay} allowFontScaling={false}>
            {CalenderDays[day]}
          </Text>
        ))}
      </View>

      <View style={CalenderStyles.calenderDates}>
        {dateRows.map((row, index) => {
          return (
            <View key={index} style={CalenderStyles.calenderRow}>
              {row.map((date, dateIndex) => renderDateCell(date, dateIndex))}
            </View>
          );
        })}
      </View>
    </View>
  );
};
