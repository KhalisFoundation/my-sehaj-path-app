import type { SehajPathSlot } from '@api/generated/types.gen';

/**
 * Whether a turn belongs to a repeating series.
 *
 * Edit and delete both ask this to decide whether to offer "this turn" or
 * "this and following turns". They must ask the same question: when each read
 * a different flag, a turn could offer the series choice in one and not the
 * other. A series turn arrives as projected (`isVirtual`) and/or marked as part
 * of a series (`isRecurring`); either means it repeats.
 */
export const isRecurringTurn = (slot: Pick<SehajPathSlot, 'isRecurring' | 'isVirtual'>): boolean =>
  slot.isRecurring === true || slot.isVirtual === true;
