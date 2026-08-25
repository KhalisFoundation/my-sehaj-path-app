import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { fontSizeIndexOf, roleForBase, scaleFontSize } from '@constants/FontSize';
import { useAppSelector } from '../store/hooks';

/**
 * Resizes a style against the app's font setting.
 *
 * Shared by every primitive below, so `Text` and `TextInput` can never drift
 * into sizing themselves differently.
 */
const useSizedStyle = (style: StyleProp<TextStyle>): StyleProp<TextStyle> => {
  const savedSize = useAppSelector((state) => state.settings.fontSize);

  return useMemo(() => {
    const index = fontSizeIndexOf(savedSize);
    const flattened = StyleSheet.flatten(style) as TextStyle | undefined;
    const base = flattened?.fontSize;

    const resolved = typeof base === 'number' ? roleForBase(base) : undefined;
    // Nothing to place: either the style declares no size, or it declares one
    // larger than the table reaches — the streak numeral and the lightning glyph
    // beside it, which are drawn objects rather than text being read. Leaving
    // those alone is deliberate; forcing them into a row would resize artwork
    // nobody asked us to touch.
    if (typeof base !== 'number' || !resolved) {
      return style;
    }

    // The style's own number is the design intent at the default setting, so it
    // is carried to other settings by its row's ratio rather than replaced.
    const fontSize = scaleFontSize(base, resolved, index);
    // A style that pins `lineHeight` to a number chose that number for the size
    // it was written against. Changing the size and keeping the leading is what
    // makes text look cramped at the larger settings and loose at the smaller
    // ones — and at the top of the scale the line box is shorter than the glyphs,
    // so descenders clip. Carry the ratio across instead of the number.
    const lineHeight =
      typeof flattened?.lineHeight === 'number'
        ? Math.round((flattened.lineHeight / base) * fontSize)
        : undefined;

    return [style, lineHeight === undefined ? { fontSize } : { fontSize, lineHeight }];
  }, [style, savedSize]);
};

/**
 * The app's text primitive. Use this instead of React Native's `Text`.
 *
 * Every size in the app comes from one table (`FontScale`), driven by one
 * setting. The reader is a row in that same table rather than a separate
 * system — so changing the setting moves the whole app together, and there is
 * no second place where a font size can be decided.
 *
 * The device's own font setting is ignored: `allowFontScaling` is off, so the
 * OS accessibility slider cannot multiply against the app's setting. A caller
 * can pass `allowFontScaling` explicitly to opt back in.
 */
export const AppText = ({ style, allowFontScaling = false, ...rest }: TextProps) => (
  <RNText style={useSizedStyle(style)} allowFontScaling={allowFontScaling} {...rest} />
);

/**
 * The app's text-input primitive. Use this instead of React Native's `TextInput`.
 *
 * A `TextInput` is not a `Text`, so it inherits nothing from {@link AppText} and
 * had to be given the setting explicitly — which is how the ang-number and
 * rename fields ended up as the last text in the app fixed at one size while
 * everything around them moved. The placeholder follows the same size, since it
 * is drawn by the input itself.
 */
export const AppTextInput = ({ style, allowFontScaling = false, ...rest }: TextInputProps) => (
  <RNTextInput style={useSizedStyle(style)} allowFontScaling={allowFontScaling} {...rest} />
);
