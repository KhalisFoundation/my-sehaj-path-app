import { Constants } from '../../constants';
import { getDurableSavedVerseId, getPathSavingMessage } from '../../screens/PathScreen';

describe('PathScreen saving message', () => {
  it('asks for a selection when restored progress exists but no verse was just tapped', () => {
    expect(getPathSavingMessage(false, false)).toBe(Constants.SELECT_A_PANKTEE_TO_SAVE_PROGRESS);
  });

  it('shows saving only for a fresh selection that is not yet durable', () => {
    expect(getPathSavingMessage(false, true)).toBe(Constants.SAVING_THE_HIGHLIGHTED_PANKTEE);
  });

  it('shows saved after the write is durable', () => {
    expect(getPathSavingMessage(true, false)).toBe(Constants.SAVED_THE_HIGHLIGHTED_PANKTEE);
  });
});

describe('PathScreen durable save highlight', () => {
  it('restores the previously-saved verse after a failed save on the same Ang', () => {
    expect(getDurableSavedVerseId({ angNumber: 42, verseId: 1234 }, 42)).toBe(1234);
  });

  it('does not show a saved verse from a different Ang', () => {
    expect(getDurableSavedVerseId({ angNumber: 42, verseId: 1234 }, 43)).toBe(0);
  });
});

/**
 * The auto-save and leave-screen save both derive the verse through this helper,
 * so an ang/verse pair can never describe two different pages (P0 #3). These
 * cover the exact navigation directions called out in the fix plan.
 */
describe('PathScreen ang/verse pairing after navigation', () => {
  const saved = { angNumber: 42, verseId: 1234 };

  it('keeps the verse when the user stays on the saved Ang', () => {
    expect(getDurableSavedVerseId(saved, 42)).toBe(1234);
  });

  it('drops the verse when moving forward (Ang + 1)', () => {
    expect(getDurableSavedVerseId(saved, 43)).toBe(0);
  });

  it('drops the verse when moving backward (Ang - 1)', () => {
    expect(getDurableSavedVerseId(saved, 41)).toBe(0);
  });

  it('drops the verse when there is no durable save yet', () => {
    expect(getDurableSavedVerseId(undefined, 42)).toBe(0);
  });

  it('uses the newly saved verse once the user saves on the new Ang', () => {
    expect(getDurableSavedVerseId({ angNumber: 43, verseId: 99 }, 43)).toBe(99);
  });
});
