import {
  SETTINGS_DEFAULTS,
  settingsSlice,
  hydrateSettings,
  setAngsFormat,
  setAnalyticsConsent,
  setFontSize,
  setLarivaar,
  setParagraphMode,
  setVishraam,
  setVishraamsSource,
  type SettingsState,
} from '../../store/slices/settingsSlice';

const { reducer } = settingsSlice;
const initial = (): SettingsState => reducer(undefined, { type: '@@INIT' });

describe('settingsSlice initial state', () => {
  /**
   * Landmine #6: these defaults are the contract with every existing user who
   * never explicitly set a value. Drift here silently changes their app.
   */
  it('matches the legacy useLocal fallbacks field-for-field', () => {
    expect(initial()).toEqual({
      fontSize: { fontSize: 'Small (Default)', number: 18 },
      larivaar: false,
      paragraphMode: false,
      vishraam: false,
      vishraamsSource: { source: 'sttm' },
      angsFormat: { format: 'Punjabi' },
      analyticsConsent: true,
    });
  });

  it('defaults vishraamsSource to sttm, not sttm2', () => {
    expect(initial().vishraamsSource.source).toBe('sttm');
  });

  it('defaults fontSize number to 18', () => {
    expect(initial().fontSize.number).toBe(18);
  });

  it('defaults analyticsConsent to true', () => {
    expect(initial().analyticsConsent).toBe(true);
  });

  it('exports defaults that equal the reducer initial state', () => {
    expect(initial()).toEqual(SETTINGS_DEFAULTS);
  });
});

describe('settingsSlice setters', () => {
  // Each setter must touch only its own field.
  const cases: Array<{
    name: keyof SettingsState;
    action: any;
    expected: unknown;
  }> = [
    {
      name: 'fontSize',
      action: setFontSize({ fontSize: 'Large', number: 30 }),
      expected: { fontSize: 'Large', number: 30 },
    },
    { name: 'larivaar', action: setLarivaar(true), expected: true },
    { name: 'paragraphMode', action: setParagraphMode(true), expected: true },
    { name: 'vishraam', action: setVishraam(true), expected: true },
    {
      name: 'vishraamsSource',
      action: setVishraamsSource({ source: 'igurbani' }),
      expected: { source: 'igurbani' },
    },
    {
      name: 'angsFormat',
      action: setAngsFormat({ format: 'English' }),
      expected: { format: 'English' },
    },
    { name: 'analyticsConsent', action: setAnalyticsConsent(false), expected: false },
  ];

  it.each(cases)('$name setter updates only its own field', ({ name, action, expected }) => {
    const before = initial();
    const after = reducer(before, action);

    expect(after[name]).toEqual(expected);

    // every other field is untouched
    (Object.keys(before) as Array<keyof SettingsState>)
      .filter((key) => key !== name)
      .forEach((key) => {
        expect(after[key]).toEqual(before[key]);
      });
  });
});

describe('settingsSlice hydrateSettings', () => {
  it('applies only the provided keys and leaves the rest at defaults', () => {
    const after = reducer(initial(), hydrateSettings({ larivaar: true, analyticsConsent: false }));

    expect(after.larivaar).toBe(true);
    expect(after.analyticsConsent).toBe(false);
    // untouched
    expect(after.fontSize).toEqual({ fontSize: 'Small (Default)', number: 18 });
    expect(after.vishraamsSource).toEqual({ source: 'sttm' });
    expect(after.angsFormat).toEqual({ format: 'Punjabi' });
  });

  it('is a no-op for an empty payload', () => {
    expect(reducer(initial(), hydrateSettings({}))).toEqual(initial());
  });

  it('can hydrate false values (not skipped as falsy)', () => {
    const after = reducer(initial(), hydrateSettings({ analyticsConsent: false }));
    expect(after.analyticsConsent).toBe(false);
  });
});
