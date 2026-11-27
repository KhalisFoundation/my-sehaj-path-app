import { createContext, useContext } from 'react';
import { fontSizeFor, fontSizeIndexOf } from '@constants/FontSize';
import { useAppSelector } from '../store/hooks';

/**
 * A size imposed on the reader for the length of one shared reading.
 *
 * Null means "use this device's own setting", which is every case except
 * following somebody else's turn. It is a context rather than a prop because
 * the verse components read their size directly from this hook — passing it
 * down would mean threading it through every one of them, and missing a single
 * consumer is exactly the bug this replaces: `PathReader` applied the reader's
 * size to its line height while the verses carried on reading the store, so a
 * follower matched the reader's layout in every respect except the one most
 * visible on screen.
 *
 * Never written to settings. The follower's own size is theirs, and returns the
 * moment the reading ends.
 */
export const ReaderFontSizeOverride = createContext<number | null>(null);

/**
 * The size Gurbani is rendered at, from the app's one typography table.
 *
 * The reader is a row in that table like any other text, so it moves with the
 * same setting as the rest of the app. Read it through here rather than off
 * `settings.fontSize.number`, so there stays exactly one place a size is decided.
 */
export const useReaderFontSize = (): number => {
  const override = useContext(ReaderFontSizeOverride);
  const savedSize = useAppSelector((state) => state.settings.fontSize);
  return override ?? fontSizeFor('reader', fontSizeIndexOf(savedSize));
};
