import { isRecurringTurn } from '../../store/recurringTurn';

describe('isRecurringTurn', () => {
  it('is true for a projected series turn', () => {
    expect(isRecurringTurn({ isVirtual: true, isRecurring: true })).toBe(true);
  });

  it('is true when either flag says the turn repeats, so edit and delete cannot disagree', () => {
    expect(isRecurringTurn({ isVirtual: true })).toBe(true);
    expect(isRecurringTurn({ isRecurring: true })).toBe(true);
    expect(isRecurringTurn({ isRecurring: true, isVirtual: false })).toBe(true);
  });

  it('is false for an ordinary one-time turn', () => {
    expect(isRecurringTurn({})).toBe(false);
    expect(isRecurringTurn({ isRecurring: false, isVirtual: false })).toBe(false);
  });
});
