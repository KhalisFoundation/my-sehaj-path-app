import {
  addLocalDays,
  dayjs,
  ceilToLocalMinute,
  combineLocalDayAndTime,
  endOfLocalDayExclusive,
  formatCalendarDate,
  formatDateTime,
  formatTime,
  isSameLocalDay,
  parseLegacyPathDate,
  startOfLocalWeek,
} from '../../utils/dateTime';

describe('shared Day.js date utilities', () => {
  it('keeps the existing calendar label format', () => {
    expect(formatCalendarDate(new Date(2026, 8, 23, 12), 'en-US')).toBe('Wed, Sep 23, 2026');
  });

  it('uses locale-aware 12-hour and 24-hour display formats', () => {
    const date = new Date(2026, 8, 23, 17, 42);

    expect(formatTime(date, 'en-US')).toBe('5:42 PM');
    expect(formatTime(date, 'en-GB')).toBe('17:42');
    expect(formatDateTime(date, 'en-GB')).toContain('17:42');
  });

  it('starts weeks on Monday without changing the local calendar day', () => {
    const monday = startOfLocalWeek(new Date(2026, 8, 24, 18, 30));

    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(21);
    expect(monday.getHours()).toBe(0);
  });

  it('combines a selected local day with a selected local clock time', () => {
    const result = combineLocalDayAndTime(
      new Date(2026, 8, 23, 0, 0),
      new Date(2020, 0, 1, 17, 42, 59, 999)
    );

    expect(result).toEqual(new Date(2026, 8, 23, 17, 42, 0, 0));
  });

  it('rounds booking lead times up to the next complete minute', () => {
    expect(ceilToLocalMinute(new Date(2026, 8, 23, 10, 14, 0, 0))).toEqual(
      new Date(2026, 8, 23, 10, 14, 0, 0)
    );
    expect(ceilToLocalMinute(new Date(2026, 8, 23, 10, 14, 0, 1))).toEqual(
      new Date(2026, 8, 23, 10, 15, 0, 0)
    );
  });

  it('uses calendar-day boundaries instead of fixed 24-hour offsets', () => {
    const day = new Date(2026, 8, 23, 18, 30);

    expect(isSameLocalDay(addLocalDays(day, 1), new Date(2026, 8, 24, 18, 30))).toBe(true);
    expect(endOfLocalDayExclusive(day)).toEqual(new Date(2026, 8, 24, 0, 0, 0, 0));
  });

  it('handles the spring DST jump as one elapsed hour', () => {
    const before = dayjs.tz('2026-03-08 01:30', 'America/New_York');
    const after = dayjs.tz('2026-03-08 03:30', 'America/New_York');

    expect(before.utcOffset()).toBe(-300);
    expect(after.utcOffset()).toBe(-240);
    expect(after.diff(before, 'minute')).toBe(60);
  });

  it('handles the autumn DST repetition as three elapsed hours', () => {
    const before = dayjs.tz('2026-11-01 00:30', 'America/New_York');
    const after = dayjs.tz('2026-11-01 02:30', 'America/New_York');

    expect(before.utcOffset()).toBe(-240);
    expect(after.utcOffset()).toBe(-300);
    expect(after.diff(before, 'minute')).toBe(180);
  });

  it('does not invent a DST change in Asia/Kolkata', () => {
    const before = dayjs.tz('2026-03-08 01:30', 'Asia/Kolkata');
    const after = dayjs.tz('2026-03-08 03:30', 'Asia/Kolkata');

    expect(before.utcOffset()).toBe(330);
    expect(after.utcOffset()).toBe(330);
    expect(after.diff(before, 'minute')).toBe(120);
  });

  it('strictly parses legacy path dates', () => {
    expect(parseLegacyPathDate('2-July-2026').format('YYYY-MM-DD')).toBe('2026-07-02');
    expect(parseLegacyPathDate('31-February-2026').isValid()).toBe(false);
  });
});
