import { PunjabiNumbers } from '../constants/Number';

export const convertToPunjabiNumber = (number: number): string => {
  return (
    number
      .toString()
      .split('')
      .map((num: string) => PunjabiNumbers[num])
      .join('') || '0'
  );
};

export const convertNumberToFormat = (number: number, format: 'Punjabi' | 'English'): string => {
  if (format === 'Punjabi') {
    return convertToPunjabiNumber(number);
  } else {
    return number.toString() || '0';
  }
};
