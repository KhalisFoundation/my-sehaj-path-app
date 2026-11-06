import { useMemo } from 'react';
import { DEFAULT_FONT_SIZE_INDEX, fontSizeFor, fontSizeIndexOf } from '@constants/FontSize';
import { useAppSelector } from '../store/hooks';

/**
 * Keeps semantic interface icons in step with the app's own font-size setting.
 *
 * Icons use the `title` row because they usually sit beside navigation labels,
 * settings values, and button text. Artwork such as logos and decorative lines
 * deliberately does not use this hook. An explicit width or height supplied by
 * a caller remains fixed; those cases already size an icon for a visual control
 * or against the reader's independently calculated text size.
 */
export const useAppIconScale = (): number => {
  const fontSize = useAppSelector((state) => state.settings.fontSize);

  return useMemo(
    () =>
      fontSizeFor('title', fontSizeIndexOf(fontSize)) /
      fontSizeFor('title', DEFAULT_FONT_SIZE_INDEX),
    [fontSize]
  );
};

export const scaledIconSize = (baseSize: number, scale: number): number =>
  Math.round(baseSize * scale);
