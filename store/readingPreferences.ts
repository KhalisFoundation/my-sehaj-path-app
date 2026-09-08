import type { SettingsState } from './slices/settingsSlice';

/** Additional reader settings; the nine legacy storage keys remain unchanged. */
export const READING_PREFERENCES_KEY = 'sehajReadingPreferences_v1';

export const serializeReadingPreferences = (settings: SettingsState): string =>
  JSON.stringify({ larivaarAssist: settings.larivaarAssist });

/** Older installations and malformed optional preferences keep safe defaults. */
export const parseReadingPreferences = (raw: string | null | undefined): Partial<SettingsState> => {
  if (!raw) {
    return {};
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || !('larivaarAssist' in value)) {
      return {};
    }
    return typeof value.larivaarAssist === 'boolean'
      ? { larivaarAssist: value.larivaarAssist }
      : {};
  } catch {
    return {};
  }
};
