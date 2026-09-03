import {
  FontSizes,
  resolveFontSize,
  DEFAULT_FONT_SIZE_INDEX,
  FontScale,
  normalizeFontSize,
  fontSizeIndexOf,
  fontSizeFor,
  roleForBase,
  scaleFontSize,
  INTERFACE_ANCHOR_PT,
  readerLineHeight,
  paragraphLineHeight,
  READER_LINE_HEIGHT_RATIO,
  PARAGRAPH_LINE_HEIGHT_RATIO,
} from '@constants/FontSize';

/** What the app shipped with before the scale was realigned. */
const PREVIOUS_SCALE = [
  { fontSize: 'Extra Small', number: 12 },
  { fontSize: 'Small (Default)', number: 18 },
  { fontSize: 'Medium', number: 24 },
  { fontSize: 'Large', number: 30 },
  { fontSize: 'Extra Large', number: 36 },
];

describe('upgrading a device that already has a saved font size', () => {
  // The app is in production. Someone who updates must not find their
  // scripture a different size, and must not find Settings showing nothing
  // selected. These cover every value a previous version could have written.

  it.each(PREVIOUS_SCALE.filter((s) => s.number !== 12))(
    'keeps the exact size for a saved $fontSize ($number pt)',
    (saved) => {
      expect(normalizeFontSize(saved).number).toBe(saved.number);
    }
  );

  it('gives the old smallest size the new smallest, since 12pt no longer exists', () => {
    // The only value that cannot be honoured exactly. Someone who asked for the
    // smallest still gets the smallest, rather than being dropped to the default
    // and finding their text much larger than they set it.
    const migrated = normalizeFontSize({ number: 12 });
    expect(migrated).toBe(FontSizes[0]);
    expect(migrated.fontSize).toBe('Extra Small');
  });

  it('always lands on a real option, so Settings can never show a blank selection', () => {
    // The dropdown matches by LABEL. A value carrying a name that is no longer
    // on the scale would leave nothing highlighted and the setting looking lost.
    for (const saved of PREVIOUS_SCALE) {
      const migrated = normalizeFontSize(saved);
      expect(FontSizes).toContain(migrated);
      expect(FontSizes.some((option) => option.fontSize === migrated.fontSize)).toBe(true);
    }
  });

  it('falls back to the default rather than crashing on a corrupt value', () => {
    expect(normalizeFontSize(undefined)).toBe(FontSizes[DEFAULT_FONT_SIZE_INDEX]);
    expect(normalizeFontSize({} as { number: number })).toBe(FontSizes[DEFAULT_FONT_SIZE_INDEX]);
    expect(normalizeFontSize({ number: Number.NaN })).toBe(FontSizes[DEFAULT_FONT_SIZE_INDEX]);
  });

  it('is idempotent, so re-running it on every launch changes nothing', () => {
    for (const saved of PREVIOUS_SCALE) {
      const once = normalizeFontSize(saved);
      expect(normalizeFontSize(once)).toBe(once);
    }
  });
});

describe('a value arriving from the account', () => {
  // Someone who already picked a size must not have it reset because another
  // device — or an older app version — wrote something we cannot read.

  it('refuses an unusable value instead of falling back to the default', () => {
    expect(resolveFontSize(undefined)).toBeUndefined();
    expect(resolveFontSize({} as { number: number })).toBeUndefined();
    expect(resolveFontSize({ number: Number.NaN })).toBeUndefined();
    expect(resolveFontSize({ number: Number.POSITIVE_INFINITY })).toBeUndefined();
  });

  it('still maps a value written under a different scale', () => {
    // An older device syncing 30pt may have called it Large where this build
    // calls it something else. The size is what the person chose, so the size is
    // what carries over — the label is only ever what the active scale calls it.
    const resolved = resolveFontSize({ number: 30 });
    expect(FontSizes).toContain(resolved);
    expect(resolved?.number).toBe(30);
  });
});

describe('the scale the reader is offered', () => {
  it('is the shared five steps, and nothing else', () => {
    expect(FontSizes.map((option) => option.number)).toEqual([18, 24, 30, 36, 42]);
    expect([...FontScale.reader]).toEqual([18, 24, 30, 36, 42]);
  });

  it('is anchored to its own default, so declared sizes render as declared', () => {
    // Interface sizes are measured against a fixed Gurbani size. Retuning the
    // scale without moving the anchor with it would put every interface size
    // below what its stylesheet asks for — 16pt body at 14, 20pt titles at 18 —
    // for every user who never opened Settings.
    expect(INTERFACE_ANCHOR_PT).toBe(FontScale.reader[DEFAULT_FONT_SIZE_INDEX]);
  });
});

describe("updating the app must not resize anybody's text", () => {
  // Every size any stylesheet in the app declares. The app is in production: a
  // person who never opens Settings must see the screen they saw yesterday.
  const DECLARED_SIZES = [12, 13, 14, 15, 16, 18, 20, 21, 22, 24, 26, 28];

  it('renders every declared size exactly as declared, at the default setting', () => {
    // The failure this guards against: the rows cannot hold all twelve sizes, so
    // snapping each style to its nearest row value quantised them down to a
    // handful — an 18pt heading came out at 16 and a 24pt one at 20, on a screen
    // nobody had touched. A row supplies a ratio instead, which is 1 at the
    // default because the interface anchor IS the default reader size.
    for (const size of DECLARED_SIZES) {
      const role = roleForBase(size);
      expect(role).toBeDefined();
      expect(scaleFontSize(size, role!, DEFAULT_FONT_SIZE_INDEX)).toBe(size);
    }
  });

  it('starts every row at exactly the size the stylesheets ask for', () => {
    // Rows are derived, so this is the guard that a tuning change can never
    // resize a screen for somebody who has not touched the setting.
    expect(FontScale.caption[DEFAULT_FONT_SIZE_INDEX]).toBe(12);
    expect(FontScale.label[DEFAULT_FONT_SIZE_INDEX]).toBe(14);
    expect(FontScale.body[DEFAULT_FONT_SIZE_INDEX]).toBe(16);
    expect(FontScale.callout[DEFAULT_FONT_SIZE_INDEX]).toBe(18);
    expect(FontScale.title[DEFAULT_FONT_SIZE_INDEX]).toBe(20);
    expect(FontScale.headline[DEFAULT_FONT_SIZE_INDEX]).toBe(24);
    expect(FontScale.display[DEFAULT_FONT_SIZE_INDEX]).toBe(28);
    expect(FontScale.hero[DEFAULT_FONT_SIZE_INDEX]).toBe(48);
  });

  it('keeps two different sizes apart instead of collapsing them together', () => {
    // Snapping made 18, 21, 22 and 24 all render at 20, flattening a hierarchy
    // the designs rely on.
    FontSizes.forEach((_, step) => {
      const rendered = DECLARED_SIZES.map((size) => scaleFontSize(size, roleForBase(size)!, step));
      for (let i = 1; i < rendered.length; i += 1) {
        expect(rendered[i]).toBeGreaterThanOrEqual(rendered[i - 1]);
      }
      expect(new Set(rendered).size).toBeGreaterThanOrEqual(DECLARED_SIZES.length - 2);
    });
  });

  it('moves every declared size in the right direction away from the default', () => {
    for (const size of DECLARED_SIZES) {
      const role = roleForBase(size)!;
      expect(scaleFontSize(size, role, 0)).toBeLessThan(size);
      expect(scaleFontSize(size, role, FontSizes.length - 1)).toBeGreaterThan(size);
    }
  });

  it('clamps a setting index that is out of range rather than throwing', () => {
    expect(scaleFontSize(18, 'callout', -5)).toBe(scaleFontSize(18, 'callout', 0));
    expect(scaleFontSize(18, 'callout', 99)).toBe(
      scaleFontSize(18, 'callout', FontSizes.length - 1)
    );
  });
});

describe('leading for Gurbani', () => {
  it('holds the chosen ratios, at every setting', () => {
    // The reader is in production and people are mid-path. Leading decides how a
    // page looks as much as the size does, so these change only when somebody
    // decides to change them — never as a side effect of other work. Retuning
    // one is a deliberate act that updates this test with it.
    //
    // Line mode is the 2.2 the app has always shipped. Paragraph mode shipped at
    // 1.6 and was raised to 1.8. Leading is set here and nowhere else, so these
    // move only when somebody decides to move them.
    expect(FontScale.reader.map(readerLineHeight)).toEqual(
      FontScale.reader.map((size) => Math.round(size * 2.2))
    );
    expect(FontScale.reader.map(paragraphLineHeight)).toEqual(
      FontScale.reader.map((size) => Math.round(size * 1.8))
    );
  });

  it('clears the matras above and below the glyph', () => {
    // Gurmukhi needs more room than Latin. Too tight and the matras of one line
    // meet the next. Checked on the ratios themselves — rounding a line box to a
    // whole point can take an individual size a fraction under.
    expect(READER_LINE_HEIGHT_RATIO).toBeGreaterThanOrEqual(1.6);
    expect(PARAGRAPH_LINE_HEIGHT_RATIO).toBeGreaterThanOrEqual(1.6);
    for (const size of FontScale.reader) {
      expect(readerLineHeight(size)).toBeGreaterThan(size);
      expect(paragraphLineHeight(size)).toBeGreaterThan(size);
    }
  });

  it('scales with the size rather than staying put', () => {
    // A fixed leading is what leaves the largest settings clipped.
    for (let i = 1; i < FontScale.reader.length; i += 1) {
      expect(readerLineHeight(FontScale.reader[i])).toBeGreaterThan(
        readerLineHeight(FontScale.reader[i - 1])
      );
    }
  });
});

describe('the reader sits in proportion to the rest of the app', () => {
  // The legacy scale is a historical record, not a design this test can hold to
  // account: it started at 12pt, below the app's own body text.
  it('steps by the same amount every time', () => {
    // The shared numbers ended 36 → 48 while every earlier step was 6. That one
    // double jump is what made Extra Large look wrong when the other settings
    // looked right.
    const steps = FontScale.reader.slice(1).map((size, i) => size - FontScale.reader[i]);
    expect(new Set(steps).size).toBe(1);
  });

  it('always reads larger than the running text around it', () => {
    // Scripture is the thing being read. It is deliberately NOT held above the
    // display row — at the smaller settings a heading may exceed it, which is
    // the point of choosing a small size — but it must always lead body text.
    FontSizes.forEach((_, step) => {
      expect(fontSizeFor('reader', step)).toBeGreaterThan(fontSizeFor('body', step) * 1.25);
    });
  });

  it('never runs away from the largest interface text on the same screen', () => {
    // At the top of the scale scripture was 48 against a 26pt heading — nearly
    // twice — which is what made Extra Large look broken rather than large.
    FontSizes.forEach((_, step) => {
      expect(fontSizeFor('reader', step) / fontSizeFor('display', step)).toBeLessThanOrEqual(1.3);
    });
  });
});

describe('one table for the whole app', () => {
  it('keeps the reader row identical to the settings options', () => {
    // The reader is a row in the same table, not a separate system.
    expect(FontScale.reader).toEqual(FontSizes.map((option) => option.number));
  });

  it('never lets a smaller kind of text overtake a larger one', () => {
    // Rows are derived from shares now, so a share that is out of step silently
    // collapses two kinds of text into the same size at one end of the scale.
    const order = ['caption', 'label', 'body', 'callout', 'title', 'headline', 'display'] as const;
    FontSizes.forEach((_, step) => {
      for (let i = 1; i < order.length; i += 1) {
        expect(fontSizeFor(order[i], step)).toBeGreaterThan(fontSizeFor(order[i - 1], step));
      }
    });
  });

  it('grows every kind of text as the setting goes up', () => {
    for (const row of Object.values(FontScale)) {
      for (let i = 1; i < row.length; i += 1) {
        expect(row[i]).toBeGreaterThan(row[i - 1]);
      }
    }
  });

  it('keeps interface text readable at both ends', () => {
    expect(Math.min(...FontScale.caption)).toBeGreaterThanOrEqual(10);
    expect(Math.max(...FontScale.display)).toBeLessThanOrEqual(40);
  });

  it('places an existing style in a sensible row from its size', () => {
    expect(roleForBase(16)).toBe('body');
    expect(roleForBase(20)).toBe('title');
    expect(roleForBase(12)).toBe('caption');
    expect(roleForBase(28)).toBe('display');
    // Both have their own row now: 18 and 24 are common enough in the app that
    // folding them into a neighbour flattened a hierarchy the designs rely on.
    expect(roleForBase(18)).toBe('callout');
    expect(roleForBase(24)).toBe('headline');
    expect(roleForBase(48)).toBe('hero');
    // Beyond the table — a splash numeral — belongs to no row.
    expect(roleForBase(72)).toBeUndefined();
  });

  it('clamps a setting index that is out of range', () => {
    expect(fontSizeFor('body', -1)).toBe(FontScale.body[0]);
    expect(fontSizeFor('body', 99)).toBe(FontScale.body[FontScale.body.length - 1]);
  });

  it('treats an unknown size as the default rather than shrinking everything', () => {
    expect(fontSizeIndexOf(undefined)).toBe(DEFAULT_FONT_SIZE_INDEX);
    expect(fontSizeIndexOf({ number: 999 })).toBe(DEFAULT_FONT_SIZE_INDEX);
  });
});
