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
