import { asUtcDateTime } from '../utils/dateTime';

/**
 * Legacy dates are written as `` `${d.getDate()}-${MonthConstant[d.getMonth()]}-${d.getFullYear()}` ``
 * → e.g. "2-July-2026": no zero-padding, FULL month name (see store/commands.ts).
 * The server speaks ISO "YYYY-MM-DD". These converters are the single bridge and
 * never throw — a malformed value returns null so the caller can skip it.
 */
/** `"2-July-2026"` → `"2026-07-02"`, or null when malformed/impossible. */
export const legacyToIso = (legacy: string): string | null => {
  const parsed = asUtcDateTime(legacy.trim(), 'D-MMMM-YYYY', true);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : null;
};

/** `"2026-07-02"` → `"2-July-2026"`, or null when malformed/impossible. */
export const isoToLegacy = (iso: string): string | null => {
  const parsed = asUtcDateTime(iso, 'YYYY-MM-DD', true);
  return parsed.isValid() ? parsed.format('D-MMMM-YYYY') : null;
};

/** Epoch ms → legacy `"2-July-2026"` (UTC), for refreshing a display string from a server clock. */
export const msToLegacy = (ms: number): string => {
  const parsed = asUtcDateTime(ms);
  return parsed.isValid() ? parsed.format('D-MMMM-YYYY') : '';
};

/** Legacy `"2-July-2026"` → epoch ms (UTC midnight), or null when malformed. */
export const legacyToMs = (legacy: string): number | null => {
  const iso = legacyToIso(legacy);
  return iso === null ? null : asUtcDateTime(iso, 'YYYY-MM-DD', true).valueOf();
};
