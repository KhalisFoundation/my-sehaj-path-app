import { VishraamsSource } from '@hooks/useLocal';

export const VishraamsSourceArray: VishraamsSource[] = [
  { source: 'sttm' },
  { source: 'igurbani' },
  { source: 'sttm2' },
];

export const VishraamsSourceLabels: Record<string, string> = {
  sttm: 'STTM (Default)',
  igurbani: 'iGurbani',
  sttm2: 'STTM Legacy',
};
