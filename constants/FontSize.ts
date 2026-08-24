import type { FontSizeData } from '../types';

/**
 * ⚠️ COMPARISON SWITCH — set back to `false` before release.
 *
 * `true`  → the sizes this app shipped with before the scale was realigned.
 * `false` → the shared scale used across our apps.
 *
 * Flip it, reload, and read the same ang both ways. The two are one step apart:
 * the shared scale's Small is this app's old Medium, which is why the reader
 * looks a size larger than it used to at the same setting.
 *
 * Point sizes only compare across apps when the typeface does. The reader here
 * is Baloo Paaji 2, so the same number will not render at the same visual size
 * as it does in an app using a different Gurmukhi face — which is the real
 * question this switch exists to answer.
 */
export const USE_LEGACY_FONT_SCALE = false;

/** What the app shipped with before the realignment. */
const LEGACY_READER_SCALE = [12, 18, 24, 30, 36] as const;
/**
 * The shared scale, with its top step brought back into line.
 *
 * Every step here is 6pt. The shared numbers end 36 → 48, a double jump, which
 * is why Extra Large read as disproportionate against interface text that tops
 * out at 26: scripture at 48 was nearly twice the largest heading on screen,
 * while every other setting sat in proportion.
 */
const SHARED_READER_SCALE = [18, 24, 30, 36, 42] as const;

const READER_SCALE = USE_LEGACY_FONT_SCALE ? LEGACY_READER_SCALE : SHARED_READER_SCALE;

/**
 * Leading for Gurbani, as a multiple of the size.
 *
 * Gurmukhi carries matras above and below the glyph, so it needs far more room
 * than Latin — hence numbers that look extravagant next to interface text.
 *
 * These are the ratios the app has always shipped. The two reading modes do NOT
 * agree with each other, and that is left as it is rather than quietly unified:
 * changing either one changes how every existing reader's page looks, which is
 * a decision to take deliberately and not as a side effect of tidying. Retune
 * here if that decision gets made.
 */
export const READER_LINE_HEIGHT_RATIO = 2.2;

/** Paragraph mode packs whole shabads together, so it has always set its own. */
export const PARAGRAPH_LINE_HEIGHT_RATIO = 1.8;

/** Leading for a line of Gurbani in the reader. */
export const readerLineHeight = (fontSize: number): number =>
  Math.round(fontSize * READER_LINE_HEIGHT_RATIO);

/** Leading for a shabad rendered as a paragraph. */
export const paragraphLineHeight = (fontSize: number): number =>
  Math.round(fontSize * PARAGRAPH_LINE_HEIGHT_RATIO);

/** The five choices offered in Settings, and the size the reader uses for each. */
export const FontSizes: FontSizeData[] = [
  { fontSize: 'Extra Small', number: READER_SCALE[0] },
  { fontSize: 'Small (Default)', number: READER_SCALE[1] },
  { fontSize: 'Medium', number: READER_SCALE[2] },
  { fontSize: 'Large', number: READER_SCALE[3] },
  { fontSize: 'Extra Large', number: READER_SCALE[4] },
];

/** The option a device starts on, and the column interface text is sized against. */
export const DEFAULT_FONT_SIZE_INDEX = 1;

/**
 * The whole app's typography, in one table.
 *
 * Columns are the five settings in {@link FontSizes}; rows are the kinds of text
 * the app renders. **The reader is not special** — it is one row among the rest,
 * driven by the same setting, so there is no second font system to keep in step.
 *
 * Scripture needs a far wider range than interface text: it is the thing being
 * read, while a caption runs 10→14 because a 48pt caption is not a caption. One
 * offset applied to everything cannot do both, which is why each row carries its
 * own numbers.
 *
 * Every size in the app comes from here. To retune the app, edit this table.
 */
export const FontScale = {
  /** Gurbani in the reader. Always identical to {@link FontSizes}. */
  reader: READER_SCALE,
  /**
   * A screen's one big title, well above ordinary headings.
   *
   * Never inferred from a style's size — {@link roleForBase} stops at `display`,
   * so a large number means "leave this alone" (a splash wordmark, a streak
   * numeral) rather than "make it a hero". Ask for this row by name.
   */
  hero: [42, 48, 54, 60, 66],
  display: [26, 28, 30, 32, 34],
  title: [18, 20, 22, 24, 26],
  body: [14, 16, 18, 20, 22],
  label: [12, 14, 16, 18, 20],
  caption: [10, 11, 12, 13, 14],
} as const;

export type TextRole = keyof typeof FontScale;

/**
 * Which row a style belongs to, from the size it already declares.
 *
 * Lets existing style sheets keep their numbers and still be driven by the
 * table: a style asking for 16pt is body text, one asking for 26pt is a display
 * heading. Anything larger than the table covers — a 72pt splash number — is
 * left alone rather than being squeezed into a row it does not belong to.
 */
export const roleForBase = (base: number): TextRole | undefined => {
  const atDefault = (role: TextRole) => FontScale[role][DEFAULT_FONT_SIZE_INDEX];
  if (base > atDefault('display')) {
    return undefined;
  }
  const roles: TextRole[] = ['caption', 'label', 'body', 'title', 'display'];
  return roles.reduce((best, role) =>
    Math.abs(atDefault(role) - base) < Math.abs(atDefault(best) - base) ? role : best
  );
};

const stepFor = (role: TextRole, index: number): number =>
  Math.min(Math.max(index, 0), FontScale[role].length - 1);

/** The size for a kind of text at a given setting, for text that declares none. */
export const fontSizeFor = (role: TextRole, index: number): number =>
  FontScale[role][stepFor(role, index)];

/**
 * Moves a size the style already declares to the chosen setting.
 *
 * The row supplies a RATIO, not a replacement. That matters because the rows
 * cannot hold every size the app uses: snapping each style to the nearest row
 * value quantised twelve distinct sizes down to five, so at the default setting
 * — where nothing should move at all — an 18pt heading rendered at 16 and a
 * 24pt one at 20. The app is in production; an update must not resize text for
 * someone who never opened Settings.
 *
 * At the default step the ratio is exactly 1, so every style renders at the size
 * it asks for. Above and below, it travels along its row's curve, which is why
 * a caption and a heading grow at different rates.
 */
export const scaleFontSize = (base: number, role: TextRole, index: number): number => {
  const row = FontScale[role];
  return Math.round(base * (row[stepFor(role, index)] / row[DEFAULT_FONT_SIZE_INDEX]));
};

export const resolveFontSize = (
  stored: { number: number } | undefined
): FontSizeData | undefined => {
  const size = stored?.number;
  // `Number.isFinite`, not `typeof` alone: NaN IS a number, and every comparison
  // against it is false — so a corrupt value would slip past the search below
  // and silently resolve to the first option.
  if (typeof size !== 'number' || !Number.isFinite(size)) {
    return undefined;
  }
  const exact = FontSizes.find((option) => option.number === size);
  if (exact) {
    return exact;
  }
  return FontSizes.reduce((closest, option) =>
    Math.abs(option.number - size) < Math.abs(closest.number - size) ? option : closest
  );
};

/**
 * As {@link resolveFontSize}, but falling back to the default.
 *
 * For reading from disk, where an unusable value leaves nothing else to show.
 * **Do not use this for a value arriving from the server** — there a local
 * setting already exists, and replacing someone's own choice with the default
 * because another device wrote something malformed is worse than ignoring it.
 */
export const normalizeFontSize = (stored: { number: number } | undefined): FontSizeData =>
  resolveFontSize(stored) ?? FontSizes[DEFAULT_FONT_SIZE_INDEX];

/** Position of a saved setting in {@link FontSizes}, or the default. */
export const fontSizeIndexOf = (size: { number: number } | undefined): number => {
  const index = FontSizes.findIndex((option) => option.number === size?.number);
  return index === -1 ? DEFAULT_FONT_SIZE_INDEX : index;
};
