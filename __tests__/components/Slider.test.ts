import { getActiveSliderPage, getSliderIndicators } from '../../components/Slider';

describe('Slider page indicator', () => {
  it('activates the final dot when the final partial page reaches the end', () => {
    // Six cards, two per page. At the end, the actual offset can be a little
    // beyond two nominal page widths because of the remaining partial content.
    expect(getActiveSliderPage(844, 430, 3)).toBe(2);
  });

  it('changes to the nearest page after crossing its halfway point', () => {
    expect(getActiveSliderPage(214, 430, 3)).toBe(0);
    expect(getActiveSliderPage(216, 430, 3)).toBe(1);
    expect(getActiveSliderPage(431, 430, 3)).toBe(1);
  });

  it('handles a narrow viewport without division by zero', () => {
    expect(getActiveSliderPage(0, 0, 3)).toBe(0);
  });
});

describe('getSliderIndicators', () => {
  it('shows every dot for six pages or fewer', () => {
    expect(getSliderIndicators(2, 5)).toEqual([0, 1, 2, 3, 4]);
    expect(getSliderIndicators(2, 6)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('compresses the beginning, middle, and end of a large carousel', () => {
    expect(getSliderIndicators(0, 24)).toEqual([0, 1, 2, 3, 4, 5, 'ellipsis']);
    expect(getSliderIndicators(1, 24)).toEqual([0, 1, 2, 3, 4, 5, 'ellipsis']);
    expect(getSliderIndicators(11, 24)).toEqual(['ellipsis', 9, 10, 11, 12, 13, 14, 'ellipsis']);
    expect(getSliderIndicators(22, 24)).toEqual(['ellipsis', 18, 19, 20, 21, 22, 23]);
    expect(getSliderIndicators(23, 24)).toEqual(['ellipsis', 18, 19, 20, 21, 22, 23]);
  });

  it('keeps the actual page number in each window so pages after five activate', () => {
    const indicators = getSliderIndicators(11, 24);
    expect(indicators).toContain(11);
    expect(indicators.indexOf(11)).not.toBe(11);
  });
});
