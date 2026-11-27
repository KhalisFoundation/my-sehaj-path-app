import { MonthConstant } from '@constants';
import { isoToLegacy, legacyToIso, legacyToMs, msToLegacy } from '../../store/syncDateUtils';

const MONTHS = Object.values(MonthConstant) as string[];

describe('legacyToIso / isoToLegacy round-trip', () => {
  it('round-trips day 1 for all 12 months', () => {
    MONTHS.forEach((month) => {
      const legacy = `1-${month}-2026`;
      const iso = legacyToIso(legacy);
      expect(iso).not.toBeNull();
      expect(isoToLegacy(iso as string)).toBe(legacy);
    });
  });

  it('round-trips day 31 for a 31-day month', () => {
    expect(isoToLegacy(legacyToIso('31-January-2026') as string)).toBe('31-January-2026');
  });

  it('converts to the expected ISO form (no zero-pad in, padded out)', () => {
    expect(legacyToIso('2-July-2026')).toBe('2026-07-02');
    expect(isoToLegacy('2026-07-02')).toBe('2-July-2026');
  });
});

describe('legacyToIso rejects malformed / impossible input', () => {
  it.each(['', 'bad', '2-Foo-2026', '31-February-2026', '32-January-2026', '2026-02-02'])(
    'returns null for %p',
    (input) => {
      expect(legacyToIso(input)).toBeNull();
    }
  );
});

describe('isoToLegacy rejects malformed / impossible input', () => {
  it.each(['', 'bad', '2026-13-01', '2026-02-31', '2-July-2026'])(
    'returns null for %p',
    (input) => {
      expect(isoToLegacy(input)).toBeNull();
    }
  );
});

describe('ms converters', () => {
  it('legacyToMs → msToLegacy round-trips', () => {
    const ms = legacyToMs('2-July-2026');
    expect(ms).toBe(Date.UTC(2026, 6, 2));
    expect(msToLegacy(ms as number)).toBe('2-July-2026');
  });

  it('legacyToMs returns null for malformed input', () => {
    expect(legacyToMs('nope')).toBeNull();
  });
});
