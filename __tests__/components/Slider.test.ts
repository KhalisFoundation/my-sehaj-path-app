import { getActiveSliderPage } from '../../components/Slider';

describe('Slider page indicator', () => {
  it('activates the final dot when the final partial page reaches the end', () => {
    // Six cards, two per page. At the end, the actual offset can be a little
    // beyond two nominal page widths because of the remaining partial content.
    expect(getActiveSliderPage(844, 430, 3)).toBe(2);
  });

  it('uses the next dot after passing a page boundary', () => {
    expect(getActiveSliderPage(431, 430, 3)).toBe(2);
  });

  it('handles a narrow viewport without division by zero', () => {
    expect(getActiveSliderPage(0, 0, 3)).toBe(0);
  });
});
