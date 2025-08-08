import { PunjabiNumbers } from '../constants/Number';

export interface NumberFormat {
  number: number;
  format: 'Punjabi' | 'English';
}

export const convertToPunjabiNumber = (number: number): string => {
  return (
    number
      .toString()
      .split('')
      .map((num: string) => PunjabiNumbers[num])
      .join('') || '0'
  );
};

export const convertNumberToFormat = (numberFormat: NumberFormat): string => {
  if (numberFormat.format === 'Punjabi') {
    return convertToPunjabiNumber(numberFormat.number);
  } else {
    return numberFormat.number.toString();
  }
};
