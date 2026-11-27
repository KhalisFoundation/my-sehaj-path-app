/**
 * Shared data models for the app.
 *
 * These describe the shapes persisted in AsyncStorage under the legacy keys
 * (`pathDetails`, `pathDateDetails`, `fontSize`, ...) as well as the BaniDB
 * response shapes. This module intentionally has no imports so it can be
 * consumed from anywhere without creating import cycles.
 */

export interface PathData {
  pathId: number;
  saveData: { angNumber: number; verseId: number };
  progress: number;
  startDate: string;
  completionDate: string;
  pathName: string;
}
export interface DateData {
  pathid: number;
  dates: PathDate[];
  scrollPosition: number;
}
export interface PathDate {
  date: string;
}
export interface FontSizeData {
  fontSize: string;
  number: number;
}
export interface AngsFormat {
  format: 'Punjabi' | 'English';
}

export interface VishraamsSource {
  source: 'sttm' | 'igurbani' | 'sttm2';
}

export interface VishraamsMarker {
  p: number;
  t: string;
}

export interface Visraams {
  sttm2: VishraamsMarker[];
  sttm: VishraamsMarker[];
  igurbani: VishraamsMarker[];
}

export interface Verse {
  verseId: number;
  shabadId: number;
  verse: {
    unicode: string;
  };
  larivaar: {
    unicode: string;
  };
  visraam: Visraams;
}

export interface PathContent {
  page: Verse[];
  source: {
    pageNo: number;
  };
}
