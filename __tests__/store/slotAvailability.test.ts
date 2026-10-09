import {
  availabilityForSelectedTime,
  hasMinimumGapBeforeNextTurn,
  planWindowFor,
  turnAt,
} from '../../store/slotAvailability';
import type { SehajPathSlot } from '@api/generated/types.gen';

/**
 * The picker's arithmetic. Every case here is one a real group hits within a
 * week of using this — back-to-back turns, a cancelled booking, a day that has
 * already started.
 */

const at = (day: Date, hours: number, minutes = 0): Date =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes, 0, 0);

const booked = (
  day: Date,
  fromHour: number,
  toHour: number,
  status: SehajPathSlot['status'] = 'SCHEDULED'
): SehajPathSlot =>
  ({
    id: `slot-${fromHour}`,
    sehajPathId: 'p1',
    readerMemberId: 'm1',
    readerLabel: 'Inder Singh',
    createdByMemberId: 'm1',
    status,
    startsAt: at(day, fromHour).toISOString(),
    endsAt: at(day, toHour).toISOString(),
    isMine: true,
    assignedByOther: false,
  } as unknown as SehajPathSlot);

/** A day well in the future, so "already passed" never interferes. */
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d;
};

describe('availabilityForSelectedTime', () => {
  it('accepts the exact selected range when it is free', () => {
    const day = tomorrow();
    const result = availabilityForSelectedTime({
      startsAt: at(day, 7, 15),
      durationMinutes: 45,
      slots: [],
    });

    expect(result.available).toBe(true);
    if (result.available) {
      expect(result.slot.startsAt.getTime()).toBe(at(day, 7, 15).getTime());
      expect(result.slot.endsAt.getTime()).toBe(at(day, 8).getTime());
    }
  });

  it('allows one continuous turn to finish after local midnight', () => {
    const day = tomorrow();
    const result = availabilityForSelectedTime({
      startsAt: at(day, 23, 50),
      durationMinutes: 15,
      slots: [],
      now: at(day, 20),
    });

    expect(result.available).toBe(true);
    if (result.available) {
      expect(result.slot.endsAt.getDate()).not.toBe(result.slot.startsAt.getDate());
      expect(result.slot.endsAt.getHours()).toBe(0);
      expect(result.slot.endsAt.getMinutes()).toBe(5);
    }
  });

  it('rejects an exact range that overlaps an existing turn', () => {
    const day = tomorrow();
    expect(
      availabilityForSelectedTime({
        startsAt: at(day, 7, 45),
        durationMinutes: 30,
        slots: [booked(day, 8, 9)],
      })
    ).toEqual({ available: false, reason: 'overlap' });
  });

  it('allows back-to-back exact ranges', () => {
    const day = tomorrow();
    expect(
      availabilityForSelectedTime({
        startsAt: at(day, 7),
        durationMinutes: 60,
        slots: [booked(day, 8, 9)],
      }).available
    ).toBe(true);
  });

  it('does not treat the slot being edited as its own overlap', () => {
    const day = tomorrow();
    const existing = booked(day, 8, 9);

    expect(
      availabilityForSelectedTime({
        startsAt: at(day, 8),
        durationMinutes: 60,
        slots: [existing],
        excludeSlotId: existing.id,
      }).available
    ).toBe(true);
  });

  it('requires a fifteen-minute lead with a one-minute transport tolerance', () => {
    const day = tomorrow();
    const now = at(day, 10);

    expect(
      availabilityForSelectedTime({
        startsAt: at(day, 10, 13),
        durationMinutes: 15,
        slots: [],
        now,
      })
    ).toEqual({ available: false, reason: 'too-soon' });

    expect(
      availabilityForSelectedTime({
        startsAt: at(day, 10, 14),
        durationMinutes: 15,
        slots: [],
        now,
      }).available
    ).toBe(true);

    expect(
      availabilityForSelectedTime({
        startsAt: at(day, 10, 15),
        durationMinutes: 15,
        slots: [],
        now,
      }).available
    ).toBe(true);
  });

  it('does not apply the lead when editing an existing booking', () => {
    const day = tomorrow();
    const now = at(day, 10);
    expect(
      availabilityForSelectedTime({
        startsAt: at(day, 10, 14),
        durationMinutes: 15,
        slots: [],
        now,
        enforceLeadTime: false,
      }).available
    ).toBe(true);
  });
});

describe('planWindowFor', () => {
  it('reaches a day either side of the one shown', () => {
    const day = new Date(2026, 7, 12);
    const { from, to } = planWindowFor(day);

    // `GET /plan` filters on slots falling ENTIRELY inside the range, so a turn
    // running 11:30pm to 12:30am would be dropped by an exact midnight-to-
    // midnight window — and its time then offered as free.
    expect(from.getDate()).toBe(11);
    expect(to.getDate()).toBe(14);
  });
});

describe('turn eligibility', () => {
  it("requires fifteen full minutes before anybody else's next turn", () => {
    const day = new Date(2026, 8, 8);
    const now = at(day, 10, 0);
    const inTenMinutes = { ...booked(day, 10, 11), startsAt: at(day, 10, 10).toISOString() };
    const inFifteenMinutes = {
      ...booked(day, 10, 11),
      startsAt: at(day, 10, 15).toISOString(),
    };

    expect(hasMinimumGapBeforeNextTurn([inTenMinutes], now)).toBe(false);
    expect(hasMinimumGapBeforeNextTurn([inFifteenMinutes], now)).toBe(true);
  });

  it('identifies the booked turn currently in progress', () => {
    const day = new Date(2026, 8, 8);
    const slot = booked(day, 10, 11);

    expect(turnAt([slot], at(day, 10, 30))?.id).toBe(slot.id);
    expect(turnAt([slot], at(day, 11, 0))).toBeNull();
  });
});
