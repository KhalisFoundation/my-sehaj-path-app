import { PATH_DATA } from '@constants';

export const isPathCompleted = (angNumber: number, verseId: number) => {
  return angNumber === PATH_DATA.LAST_ANG_NUMBER && verseId === PATH_DATA.LAST_VERSE_ID;
};
