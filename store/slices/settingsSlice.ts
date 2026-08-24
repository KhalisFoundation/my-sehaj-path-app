import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AngsFormat, FontSizeData, VishraamsSource } from '../../types';

export interface SettingsState {
  fontSize: FontSizeData;
  larivaar: boolean;
  paragraphMode: boolean;
  vishraam: boolean;
  vishraamsSource: VishraamsSource;
  angsFormat: AngsFormat;
  analyticsConsent: boolean;
}

/**
 * These MUST stay byte-identical to the fallbacks the pre-Redux `useLocal`
 * returned when a legacy AsyncStorage key was missing. A user who never set a
 * value must observe exactly the same behaviour after the Redux release.
 *
 * `vishraamsSource` mirrors `Constants.DEFAULT_VISHRAAM_SOURCE` ('sttm').
 * It is written as a literal because `Constants` is typed `{[key: string]: any}`,
 * so importing it would erase the `VishraamsSource['source']` union. The
 * settingsSlice test asserts these values to catch drift.
 */
export const SETTINGS_DEFAULTS: SettingsState = {
  fontSize: { fontSize: 'Small (Default)', number: 24 },
  larivaar: false,
  paragraphMode: false,
  vishraam: false,
  vishraamsSource: { source: 'sttm' },
  angsFormat: { format: 'Punjabi' },
  analyticsConsent: true,
};

export const settingsSlice = createSlice({
  name: 'settings',
  initialState: SETTINGS_DEFAULTS,
  reducers: {
    /** Boot hydration. Only keys present on disk are applied; the rest keep defaults. */
    hydrateSettings: (state, action: PayloadAction<Partial<SettingsState>>) => {
      return { ...state, ...action.payload };
    },
    setFontSize: (state, action: PayloadAction<FontSizeData>) => {
      state.fontSize = action.payload;
    },
    setLarivaar: (state, action: PayloadAction<boolean>) => {
      state.larivaar = action.payload;
    },
    setParagraphMode: (state, action: PayloadAction<boolean>) => {
      state.paragraphMode = action.payload;
    },
    setVishraam: (state, action: PayloadAction<boolean>) => {
      state.vishraam = action.payload;
    },
    setVishraamsSource: (state, action: PayloadAction<VishraamsSource>) => {
      state.vishraamsSource = action.payload;
    },
    setAngsFormat: (state, action: PayloadAction<AngsFormat>) => {
      state.angsFormat = action.payload;
    },
    setAnalyticsConsent: (state, action: PayloadAction<boolean>) => {
      state.analyticsConsent = action.payload;
    },
  },
});

export const {
  hydrateSettings,
  setFontSize,
  setLarivaar,
  setParagraphMode,
  setVishraam,
  setVishraamsSource,
  setAngsFormat,
  setAnalyticsConsent,
} = settingsSlice.actions;
