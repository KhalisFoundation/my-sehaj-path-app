import { fontSizeFor, fontSizeIndexOf } from '@constants/FontSize';
import { useAppSelector } from '../store/hooks';

/**
 * The size Gurbani is rendered at, from the app's one typography table.
 *
 * The reader is a row in that table like any other text, so it moves with the
 * same setting as the rest of the app. Read it through here rather than off
 * `settings.fontSize.number`, so there stays exactly one place a size is decided.
 */
export const useReaderFontSize = (): number => {
  const savedSize = useAppSelector((state) => state.settings.fontSize);
  return fontSizeFor('reader', fontSizeIndexOf(savedSize));
};
