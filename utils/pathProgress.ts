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

/**
 * What the screen must do once the server has answered a shared-path save.
 *
 * The screen has already moved its own highlight, saved ang and "saved" message
 * before asking, so every answer other than "accepted" leaves it showing
 * something the group does not have.
 */
export type GroupSaveFollowUp =
  | { action: 'keep' }
  | { action: 'adopt'; angNumber: number; verseId: number }
  | { action: 'revert' };

export const followUpToGroupSave = (
  result:
    | { status: 'saved'; angNumber: number; verseId: number }
    | { status: 'behind'; angNumber: number; verseId: number }
    | { status: 'offline' }
    | { status: 'failed' }
): GroupSaveFollowUp => {
  switch (result.status) {
    case 'saved':
      return { action: 'keep' };
    case 'behind':
      // The group is already past this line; the server's position stands.
      return { action: 'adopt', angNumber: result.angNumber, verseId: result.verseId };
    default:
      // Refused, or never reached: the store has been rolled back, and the
      // reader must see that rather than a line marked saved that nobody has.
      return { action: 'revert' };
  }
};
