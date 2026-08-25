import type { FontSizeData } from '../types';

/**
 * ⚠️ COMPARISON SWITCH — pick a scale, then delete the other and this flag.
 *
 * It answers ONE question: which numbers should Gurbani be read at?
 *
 *   `true`  → this app's own steps, 12/18/24/30/36
 *   `false` → the steps shared across our apps, 18/24/30/36/42
 *
 * Nothing else changes. **Both modes are the global font system**: one setting
 * moves the reader and every screen together, so Medium → Large grows the whole
 * app either way. The switch is not old-app-versus-new-app — the app-wide
 * behaviour is settled, and only the reader's five numbers are still open.
 *
 * That matters for judging it: the old numbers were chosen when the reader was
 * the only thing this setting touched. Whether they still hold up now that they
 * sit beside interface text that moves with them is exactly what to look for.
 *
 * One caveat on the shared numbers: point sizes only compare across apps when
 * the typeface does. The reader here is Baloo Paaji 2, so the same number will
 * not render at the same visual size as it does in an app using a different
 * Gurmukhi face.
 */
export const USE_LEGACY_FONT_SCALE = true;

/** What the app shipped with before the realignment. */
export const LEGACY_READER_SCALE = [12, 18, 24, 30, 36] as const;
/**
 * The shared scale, with its top step brought back into line.
 *
 * Every step here is 6pt. The shared numbers end 36 → 48, a double jump, which
 * is why Extra Large read as disproportionate against interface text that tops
 * out at 26: scripture at 48 was nearly twice the largest heading on screen,
 * while every other setting sat in proportion.
 */
export const SHARED_READER_SCALE = [18, 24, 30, 36, 42] as const;

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

/** Paragraph mode packs whole shabads together, so it sets its own. */
export const PARAGRAPH_LINE_HEIGHT_RATIO = 1.8;

/** Leading for a line of Gurbani in the reader. */
export const readerLineHeight = (fontSize: number): number =>
  Math.round(fontSize * READER_LINE_HEIGHT_RATIO);

/** Leading for a shabad rendered as a paragraph. */
export const paragraphLineHeight = (fontSize: number): number =>
  Math.round(fontSize * PARAGRAPH_LINE_HEIGHT_RATIO);

/** The five choices offered in Settings, and the size the reader uses for each. */
export const FontSizes: readonly FontSizeData[] = [
  { fontSize: 'Extra Small', number: READER_SCALE[0] },
  { fontSize: 'Small (Default)', number: READER_SCALE[1] },
  { fontSize: 'Medium', number: READER_SCALE[2] },
  { fontSize: 'Large', number: READER_SCALE[3] },
  { fontSize: 'Extra Large', number: READER_SCALE[4] },
];

/** The option a new installation starts on. */
export const DEFAULT_FONT_SIZE_INDEX = 1;
export const DEFAULT_FONT_SIZE = FontSizes[DEFAULT_FONT_SIZE_INDEX];

/**
 * How far each kind of text travels compared with Gurbani.
 *
 * A row is one base size — what its stylesheets already ask for — plus the share
 * of Gurbani's growth it takes on. Scripture is what is being read, so it takes
 * all of it; a caption takes least, because a caption blown up to reading size
 * stops being a caption.
 *
 * `reader` sits in this table as the row whose share is 1. That is not a
 * formality: it makes every size in the app a function of one number, the
 * Gurbani size, rather than of which of the five settings happens to be picked.
 */
const TextRoles = {
  /** Gurbani itself — takes all of the growth, by definition. */
  reader: { base: 24, share: 1 },
  /** A screen's one big title. Never inferred — ask for it by name. */
  hero: { base: 48, share: 0.5 },
  display: { base: 28, share: 0.28 },
  headline: { base: 24, share: 0.33 },
  title: { base: 20, share: 0.4 },
  /** Body text asked to carry weight: buttons, nav labels, card titles. */
  callout: { base: 18, share: 0.44 },
  /** Ordinary running text — most of the app. */
  body: { base: 16, share: 0.5 },
  label: { base: 14, share: 0.45 },
  caption: { base: 12, share: 0.35 },
} as const;

/**
 * The Gurbani size every other size is measured against.
 *
 * Interface text follows the READER SIZE, not the position of the selected
 * setting. Measuring from each scale's own default instead is what made 30pt
 * Gurbani render 18pt body text under one scale and 21pt under the other: the
 * same page as two different apps, purely because the scales sit a step apart.
 *
 * This intentionally stays at 24pt even while comparing the legacy scale:
 * shared Medium and legacy Large both render Gurbani at 30pt, so their UI text
 * must match too. It is a visual anchor, not the Settings default.
 *
 * ⚠️ ON MIGRATION: once a scale is chosen and {@link USE_LEGACY_FONT_SCALE} is
 * deleted, this MUST equal that scale's default step. It already does for the
 * shared scale. Choosing the legacy scale and leaving this at 24 would render
 * every interface size below the one its stylesheet asks for — 16pt body text
 * at 14, 20pt titles at 18 — for every user who never opened Settings. The
 * test "is anchored to the default of the scale it ships" enforces it.
 */
export const INTERFACE_ANCHOR_PT = TextRoles.reader.base;

const rowFor = (
  readerScale: readonly number[],
  { base, share }: { base: number; share: number }
): number[] =>
  readerScale.map((readerPt) =>
    Math.round(base * (1 + (readerPt / INTERFACE_ANCHOR_PT - 1) * share))
  );

/**
 * The whole app's typography, in one table.
 *
 * Columns are the five settings in {@link FontSizes}; rows are the kinds of text
 * the app renders. **The reader is not special** — it is one row among the rest,
 * so there is no second font system to keep in step.
 *
 * Derived rather than typed out, so a row cannot drift away from the scale it
 * belongs to. To retune the app, edit {@link TextRoles}.
 */
const createFontScale = (readerScale: readonly number[]) =>
  ({
    reader: rowFor(readerScale, TextRoles.reader),
    hero: rowFor(readerScale, TextRoles.hero),
    display: rowFor(readerScale, TextRoles.display),
    headline: rowFor(readerScale, TextRoles.headline),
    title: rowFor(readerScale, TextRoles.title),
    callout: rowFor(readerScale, TextRoles.callout),
    body: rowFor(readerScale, TextRoles.body),
    label: rowFor(readerScale, TextRoles.label),
    caption: rowFor(readerScale, TextRoles.caption),
  } as const);

/** Both candidates are exported so the comparison relationship has direct tests. */
export const LEGACY_FONT_SCALE = createFontScale(LEGACY_READER_SCALE);
export const SHARED_FONT_SCALE = createFontScale(SHARED_READER_SCALE);

/** The candidate selected by the temporary comparison switch. */
export const FontScale = USE_LEGACY_FONT_SCALE ? LEGACY_FONT_SCALE : SHARED_FONT_SCALE;

type TextRole = keyof typeof FontScale;

/**
 * Which row a style belongs to, from the size it already declares.
 *
 * Lets existing style sheets keep their numbers and still be driven by the
 * table: a style asking for 16pt is body text and the 48pt path heading is a
 * hero. Anything larger than the table covers — a 72pt streak number — is left
 * alone rather than being squeezed into a row it does not belong to.
 */
export const roleForBase = (base: number): TextRole | undefined => {
  if (base > TextRoles.hero.base) {
    return undefined;
  }
  const roles: TextRole[] = [
    'caption',
    'label',
    'body',
    'callout',
    'title',
    'headline',
    'display',
    'hero',
  ];
  return roles.reduce((best, role) =>
    Math.abs(TextRoles[role].base - base) < Math.abs(TextRoles[best].base - base) ? role : best
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
 * value quantised twelve distinct sizes down to five — an 18pt heading rendered
 * at 16 and a 24pt one at 20.
 *
 * At the 24pt reader anchor the ratio is exactly 1. Above and below it, text
 * travels along its row's curve, which is why a caption and a heading grow at
 * different rates.
 */
export const scaleFontSize = (base: number, role: TextRole, index: number): number =>
  Math.round(base * (FontScale[role][stepFor(role, index)] / TextRoles[role].base));

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
  resolveFontSize(stored) ?? DEFAULT_FONT_SIZE;

/** Position of a saved setting in {@link FontSizes}, or the default. */
export const fontSizeIndexOf = (size: { number: number } | undefined): number => {
  const index = FontSizes.findIndex((option) => option.number === size?.number);
  return index === -1 ? DEFAULT_FONT_SIZE_INDEX : index;
};
