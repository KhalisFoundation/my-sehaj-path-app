import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import dayjs from 'dayjs';
import { CalenderStyles } from '@styles';
import { LeftArrowIcon, RightArrowIcon } from '@icons';
import { CalenderDays } from '@constants';
import { DateData, useLocal } from '@hooks';

interface Props {
  streak: any;
  pathId: number;
  onStreakUpdate?: (streakValue: number) => void;
}

export const Calender = ({ pathId, streak, onStreakUpdate }: Props) => {
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [days, setDays] = useState<string[]>([]);
  const [progressDates, setProgressDates] = useState<DateData>();
  const { fetchFromLocal } = useLocal();

  const calculateStreak = (dates: string[]): number => {
    if (!dates || dates.length === 0) {
      return 0;
    }

    const sortedDates = dates
      .map((dateStr) => dayjs(dateStr, 'D-MMMM-YYYY'))
      .sort((a, b) => a.diff(b, 'day'));

    let currentStreak = 1;
    let maxStreak = 1;

    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = sortedDates[i - 1];
      const currentDate = sortedDates[i];
      if (currentDate.diff(prevDate, 'day') === 1) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    return maxStreak;
  };

  const currentStreak = useMemo(() => {
    if (!progressDates?.dates) {
      return 0;
    }
    const dateStrings = progressDates.dates.map((d) => d.date);
    return calculateStreak(dateStrings);
  }, [progressDates]);

  useEffect(() => {
    const daysInMonth = currentMonth.daysInMonth();
    const firstDayOfMonth = currentMonth.startOf('month').day();
    const daysArray = Array.from({ length: 42 }, (_, index) => {
      if (index < firstDayOfMonth) {
        return '';
      }
      const day = index - firstDayOfMonth + 1;
      if (day > 0 && day <= daysInMonth) {
        return day.toString();
      }
      return '';
    });
    setDays(daysArray as string[]);
  }, [currentMonth]);

  useEffect(() => {
    const fetchProgressDates = async () => {
      const { pathDateDataArray } = await fetchFromLocal();
      const pathDateData = pathDateDataArray.find((path) => path.pathid === pathId);
      if (pathDateData) {
        setProgressDates(pathDateData);
      }
    };
    fetchProgressDates();
  }, [fetchFromLocal, pathId]);

  useEffect(() => {
    if (currentStreak !== undefined) {
      streak.current = currentStreak;
      if (onStreakUpdate) {
        onStreakUpdate(currentStreak);
      }
    }
  }, [currentStreak, streak, onStreakUpdate]);

  const hasProgress = (date: dayjs.Dayjs): boolean => {
    if (!progressDates?.dates) {
      return false;
    }
    const dateString = date.format('D-MMMM-YYYY');
    return progressDates.dates.some((d) => d.date === dateString);
  };

  const renderDateCell = (date: string, dateIndex: number) => {
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
  };

  const createDateRows = () => {
    const rows = [];
    for (let i = 0; i < days.length; i += 7) {
      const row = days.slice(i, i + 7);
      rows.push(row);
    }
    return rows;
  };

  return (
    <View style={CalenderStyles.calenderContainer}>
      <View style={CalenderStyles.calenderHeader}>
        <TouchableOpacity
          onPress={() => setCurrentMonth(currentMonth.subtract(1, 'month'))}
          accessibilityLabel="Previous month"
          accessibilityRole="button"
          accessibilityHint="Tap to view previous month"
        >
          <LeftArrowIcon />
        </TouchableOpacity>
        <Text style={CalenderStyles.calenderHeaderText}>{currentMonth.format('MMMM YYYY')}</Text>
        <TouchableOpacity
          onPress={() => setCurrentMonth(currentMonth.add(1, 'month'))}
          accessibilityLabel="Next month"
          accessibilityRole="button"
          accessibilityHint="Tap to view next month"
        >
          <RightArrowIcon />
        </TouchableOpacity>
      </View>

      <View style={CalenderStyles.calenderDays}>
        {Object.keys(CalenderDays).map((day, index) => (
          <Text key={index} style={CalenderStyles.calenderDay} allowFontScaling={false}>
            {CalenderDays[day]}
          </Text>
        ))}
      </View>

      <View style={CalenderStyles.calenderDates}>
        {createDateRows().map((row, index) => {
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
