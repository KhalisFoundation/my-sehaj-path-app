import { PATH_DATA } from '@constants';

export const isPathCompleted = (angNumber: number, verseId: number, completionDate: string) => {
  if (
    angNumber === PATH_DATA.LAST_ANG_NUMBER &&
    verseId === PATH_DATA.LAST_VERSE_ID &&
    completionDate !== ''
  ) {
    return true;
  } else {
    return false;
  }
};
export const isPathNotCompleted = (angNumber: number, verseId: number) => {
  if (angNumber <= PATH_DATA.LAST_ANG_NUMBER && verseId !== PATH_DATA.LAST_VERSE_ID) {
    return true;
  } else {
    return false;
  }
};
