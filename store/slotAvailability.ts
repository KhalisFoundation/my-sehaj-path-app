import type { SehajPathSlot } from '@api/generated/types.gen';

/** Calendar availability rules shared by slot booking and live reading. */

/** A time somebody could take, as the picker shows it. */
export interface OpenSlot {
  startsAt: Date;
  endsAt: Date;
  /** The requested length, in minutes. Always exactly `durationMinutes`. */
  minutes: number;
}

export type SelectedSlotAvailability =
  | { available: true; slot: OpenSlot }
  | {
      available: false;
      reason: 'past' | 'too-soon' | 'next-day' | 'overlap' | 'invalid-duration';
    };

/** A spontaneous turn may only be booked when this much time remains before any scheduled turn. */
export const MINIMUM_TURN_GAP_MINUTES = 15;

/** A newly booked turn must begin at least this far in the future. */
export const MINIMUM_BOOKING_LEAD_MINUTES = 15;
/** Transport tolerance for a booking request reaching the server. */
export const BOOKING_LEAD_TOLERANCE_MINUTES = 1;

/** How far ahead Progress searches for the first scheduled turn. */
export const UPCOMING_TURN_LOOKAHEAD_DAYS = 30;

/** A slot the exclusion constraint would still refuse. */
const BLOCKING = new Set(['SCHEDULED', 'ACTIVE']);

const MINUTE = 60 * 1000;
/** Allows the current minute and small device/network clock drift. */
export const SLOT_PAST_TOLERANCE_MINUTES = 2;

/** Validate the exact time selected by the user, including its full duration. */
export const availabilityForSelectedTime = ({
  startsAt,
  durationMinutes,
  slots,
  excludeSlotId,
  now = new Date(),
  enforceLeadTime = true,
}: {
  startsAt: Date;
  durationMinutes: number;
  slots: SehajPathSlot[];
  /** Existing slot being edited; it must not conflict with itself. */
  excludeSlotId?: string;
  now?: Date;
  /** Edits retain the existing near-term booking and therefore skip this check. */
  enforceLeadTime?: boolean;
}): SelectedSlotAvailability => {
  if (durationMinutes <= 0) {
    return { available: false, reason: 'invalid-duration' };
  }

  if (startsAt.getTime() < now.getTime() - SLOT_PAST_TOLERANCE_MINUTES * MINUTE) {
    return { available: false, reason: 'past' };
  }

  if (enforceLeadTime) {
    const earliestStart =
      now.getTime() + (MINIMUM_BOOKING_LEAD_MINUTES - BOOKING_LEAD_TOLERANCE_MINUTES) * MINUTE;
    if (startsAt.getTime() < earliestStart) {
      return { available: false, reason: 'too-soon' };
    }
  }

  const endsAt = new Date(startsAt.getTime() + durationMinutes * MINUTE);
  const selectedDayEnd = new Date(
    startsAt.getFullYear(),
    startsAt.getMonth(),
    startsAt.getDate() + 1
  );
  if (endsAt.getTime() > selectedDayEnd.getTime()) {
    return { available: false, reason: 'next-day' };
  }

  const overlaps = slots.some(
    (slot) =>
      slot.id !== excludeSlotId &&
      BLOCKING.has(slot.status) &&
      startsAt.getTime() < new Date(slot.endsAt).getTime() &&
      endsAt.getTime() > new Date(slot.startsAt).getTime()
  );

  if (overlaps) {
    return { available: false, reason: 'overlap' };
  }

  return {
    available: true,
    slot: { startsAt, endsAt, minutes: durationMinutes },
  };
};

/** The scheduled turn that owns this exact moment, if there is one. */
export const turnAt = (slots: SehajPathSlot[], at = new Date()): SehajPathSlot | null => {
  const atMs = at.getTime();
  return (
    slots.find(
      (slot) =>
        BLOCKING.has(slot.status) &&
        new Date(slot.startsAt).getTime() <= atMs &&
        new Date(slot.endsAt).getTime() > atMs
    ) ?? null
  );
};

/** The earliest scheduled turn starting after this exact moment, regardless of its reader. */
export const nextTurnAfter = (slots: SehajPathSlot[], at = new Date()): SehajPathSlot | null => {
  const atMs = at.getTime();
  return (
    slots
      .filter((slot) => BLOCKING.has(slot.status) && new Date(slot.startsAt).getTime() > atMs)
      .sort((left, right) => left.startsAt.localeCompare(right.startsAt))[0] ?? null
  );
};

/** Whether an unscheduled reader has enough uninterrupted time before the next group's turn. */
export const hasMinimumGapBeforeNextTurn = (slots: SehajPathSlot[], at = new Date()): boolean => {
  const next = nextTurnAfter(slots, at);
  return (
    next === null ||
    new Date(next.startsAt).getTime() - at.getTime() >= MINIMUM_TURN_GAP_MINUTES * MINUTE
  );
};

const startOfDay = (day: Date): Date =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);

const endOfDay = (day: Date): Date =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, 0, 0, 0, 0);

/**
 * The window `GET /plan` should be asked for to render one day.
 *
 * A day either side of the one shown, because the query filters on slots
 * falling ENTIRELY inside the range: a turn running 11:30pm to 12:30am belongs
 * to the day on screen but starts and ends on different ones, and asking for
 * exactly midnight-to-midnight would drop it and offer its time as free.
 */
export const planWindowFor = (day: Date): { from: Date; to: Date } => ({
  from: new Date(startOfDay(day).getTime() - 24 * 60 * MINUTE),
  to: new Date(endOfDay(day).getTime() + 24 * 60 * MINUTE),
});
