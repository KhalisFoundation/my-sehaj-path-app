import dayjs, { type ConfigType, type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(customParseFormat);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(utc);
dayjs.extend(timezone);

export { dayjs };
export type { Dayjs };

export const MINUTE_MS = 60_000;

export const asLocalDateTime = (value?: ConfigType): Dayjs => dayjs(value);

export const asUtcDateTime = (value?: ConfigType, format?: string, strict?: boolean): Dayjs =>
  format === undefined ? dayjs.utc(value) : dayjs.utc(value as string, format, strict);

export const isValidDateTime = (value?: ConfigType): boolean => dayjs(value).isValid();

export const startOfLocalDay = (value: ConfigType): Date => dayjs(value).startOf('day').toDate();

/** The first instant of the following local calendar day. */
export const endOfLocalDayExclusive = (value: ConfigType): Date =>
  dayjs(value).add(1, 'day').startOf('day').toDate();

export const startOfLocalWeek = (value: ConfigType): Date => {
  const date = dayjs(value).startOf('day');
  const daysSinceMonday = (date.day() + 6) % 7;
  return date.subtract(daysSinceMonday, 'day').toDate();
};

export const addLocalDays = (value: ConfigType, amount: number): Date =>
  dayjs(value).add(amount, 'day').toDate();

export const isSameLocalDay = (left: ConfigType, right: ConfigType): boolean =>
  dayjs(left).isSame(dayjs(right), 'day');

type DateTimeLocales = string | string[] | undefined;

const formatLocalDateTime = (
  value: ConfigType,
  locales: DateTimeLocales,
  options: Intl.DateTimeFormatOptions
): string => new Intl.DateTimeFormat(locales, options).format(dayjs(value).toDate());

/** Display-only formatting follows the device locale and its 12/24-hour preference. */
export const formatMonthYear = (value: ConfigType, locales?: DateTimeLocales): string =>
  formatLocalDateTime(value, locales, { month: 'long', year: 'numeric' });

export const formatCalendarDate = (value: ConfigType, locales?: DateTimeLocales): string =>
  formatLocalDateTime(value, locales, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export const formatTime = (value: ConfigType, locales?: DateTimeLocales): string =>
  formatLocalDateTime(value, locales, { hour: 'numeric', minute: '2-digit' });

export const formatDateTime = (value: ConfigType, locales?: DateTimeLocales): string =>
  formatLocalDateTime(value, locales, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export const minuteOfLocalDay = (value: ConfigType): number => {
  const date = dayjs(value);
  return date.hour() * 60 + date.minute();
};

export const combineLocalDayAndTime = (day: ConfigType, time: ConfigType): Date => {
  const clock = dayjs(time);
  return dayjs(day).hour(clock.hour()).minute(clock.minute()).second(0).millisecond(0).toDate();
};

export const ceilToLocalMinute = (value: ConfigType): Date => {
  const exact = dayjs(value);
  const minute = exact.second(0).millisecond(0);
  return (minute.isBefore(exact) ? minute.add(1, 'minute') : minute).toDate();
};

export const addMinutes = (value: ConfigType, minutes: number): Date =>
  dayjs(value).add(minutes, 'minute').toDate();

export const differenceInMinutes = (later: ConfigType, earlier: ConfigType): number =>
  dayjs(later).diff(dayjs(earlier), 'minute', true);

export const isBefore = (left: ConfigType, right: ConfigType): boolean =>
  dayjs(left).isBefore(dayjs(right));

export const isAfter = (left: ConfigType, right: ConfigType): boolean =>
  dayjs(left).isAfter(dayjs(right));

export const isSameOrBeforeDateTime = (left: ConfigType, right: ConfigType): boolean =>
  dayjs(left).isSameOrBefore(dayjs(right));

export const isSameOrAfterDateTime = (left: ConfigType, right: ConfigType): boolean =>
  dayjs(left).isSameOrAfter(dayjs(right));

export const parseLegacyPathDate = (value: string): Dayjs => dayjs(value, 'D-MMMM-YYYY', true);
