export interface VishraamsStyle {
  style: 'colored-words' | 'gradient-bg';
}

export const VishraamsStyleArray: VishraamsStyle[] = [
  { style: 'colored-words' },
  { style: 'gradient-bg' },
];

export const VishraamsStyleLabels: Record<string, string> = {
  'colored-words': 'Colored Words',
  'gradient-bg': 'Gradient Background',
};
