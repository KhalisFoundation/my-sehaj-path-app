import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppText as Text } from './AppText';
import dayjs from 'dayjs';
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
  onStreakUpdate?: (streakValue: number) => void;
}

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
    return result.ok ? result.data.dates : [];
  }, [sharedPathId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadSharedDates()
        .then((dates) => {
          if (active) {
            setSharedDates(dates);
            if (dates && dates.length > 0) {
              const existing =
                store.getState().paths.dates.find((entry) => entry.pathid === pathId)?.dates ?? [];
              const merged = new Map(existing.map((entry) => [entry.date, entry]));
              dates.forEach((date) => {
                const localDate = dayjs(date).format('D-MMMM-YYYY');
                merged.set(localDate, { date: localDate });
              });
              store.dispatch(
                applyServerPathData({
                  pathId,
                  pathPatch: {},
                  datePatch: { dates: [...merged.values()] },
                })
              );
            }
          }
        })
        .catch(() => {
          if (active && sharedPathId) {
            setSharedDates([]);
          }
        });
      return () => {
        active = false;
      };
    }, [loadSharedDates, pathId, sharedPathId])
  );

  const readingDateStrings = useMemo(() => {
    if (sharedPathId) {
      return (sharedDates ?? []).map((date) => dayjs(date).format('D-MMMM-YYYY'));
    }
    return progressDates?.dates?.map((date: any) => date.date) ?? [];
  }, [progressDates, sharedDates, sharedPathId]);

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
    if (currentStreak !== undefined) {
      streak.current = currentStreak;
      if (onStreakUpdate) {
        onStreakUpdate(currentStreak);
      }
    }
  }, [currentStreak, streak, onStreakUpdate]);

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
