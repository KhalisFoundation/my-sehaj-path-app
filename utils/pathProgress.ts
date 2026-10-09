import { Constants } from '@constants';

/** Message shown after saving or while a verse selection is being persisted. */
export const getPathSavingMessage = (
  isSaved: boolean,
  hasPendingVerseSelection: boolean
): string => {
  if (isSaved) {
    return Constants.SAVED_THE_HIGHLIGHTED_PANKTEE;
  }
  return hasPendingVerseSelection
    ? Constants.SAVING_THE_HIGHLIGHTED_PANKTEE
    : Constants.SELECT_A_PANKTEE_TO_SAVE_PROGRESS;
};

/** A saved verse is valid only on the ang where it was saved. */
export const getDurableSavedVerseId = (
  saveData: { angNumber: number; verseId: number } | undefined,
  displayedAng: number
): number => (saveData?.angNumber === displayedAng ? saveData.verseId : 0);
