import { MonthConstant } from '@constants';

/**
 * Legacy dates are written as `` `${d.getDate()}-${MonthConstant[d.getMonth()]}-${d.getFullYear()}` ``
 * → e.g. "2-July-2026": no zero-padding, FULL month name (see store/commands.ts).
 * The server speaks ISO "YYYY-MM-DD". These converters are the single bridge and
 * never throw — a malformed value returns null so the caller can skip it.
 */
const MONTHS = Object.values(MonthConstant) as string[]; // index 0 = January

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** Rejects impossible calendar dates (e.g. 31-February) instead of silently rolling over. */
const isRealDate = (year: number, month: number, day: number): boolean => {
  const date = new Date(Date.UTC(year, month, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day
  );
};

/** `"2-July-2026"` → `"2026-07-02"`, or null when malformed/impossible. */
export const legacyToIso = (legacy: string): string | null => {
  const match = legacy.trim().match(/^(\d{1,2})-([A-Za-z]+)-(\d{4})$/);
  if (!match) {
    return null;
  }
  const day = Number(match[1]);
  const month = MONTHS.indexOf(match[2]);
  const year = Number(match[3]);
  if (month < 0 || day < 1 || day > 31 || !isRealDate(year, month, day)) {
    return null;
  }
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
};

/** `"2026-07-02"` → `"2-July-2026"`, or null when malformed/impossible. */
export const isoToLegacy = (iso: string): string | null => {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const monthName = MONTHS[month];
  if (!monthName || !isRealDate(year, month, day)) {
    return null;
  }
  return `${day}-${monthName}-${year}`;
};

/** Epoch ms → legacy `"2-July-2026"` (UTC), for refreshing a display string from a server clock. */
export const msToLegacy = (ms: number): string => {
  const date = new Date(ms);
  const iso = `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
  return isoToLegacy(iso) ?? '';
};

/** Legacy `"2-July-2026"` → epoch ms (UTC midnight), or null when malformed. */
export const legacyToMs = (legacy: string): number | null => {
  const iso = legacyToIso(legacy);
  return iso === null ? null : Date.parse(`${iso}T00:00:00.000Z`);
};
