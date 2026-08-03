import type { SyncPathDto, SyncSehajPathDto } from '@api/generated/types.gen';
import type { RootState } from './index';
import type { SettingsState } from './slices/settingsSlice';
import { toSyncPath } from './syncAdapters';

/** The app-owned settings document sent to the server (stored verbatim). */
export const toSettingsBody = (settings: SettingsState) => ({
  settings: {
    fontSize: settings.fontSize,
    larivaar: settings.larivaar,
    paragraphMode: settings.paragraphMode,
    vishraam: settings.vishraam,
    vishraamsSource: settings.vishraamsSource,
    angsFormat: settings.angsFormat,
    consent: settings.analyticsConsent,
  },
});

/**
 * Builds a full `POST /sehaj-path/sync` body from the current store: every local
 * path that has sync metadata (via the Step 4 adapter), the server-issued
 * `lastSyncedAt` (omitted on a first sync so the server treats it as 0), and the
 * settings snapshot only when a local settings edit is pending.
 */
export const buildSyncRequest = (state: RootState, includeSettings = true): SyncSehajPathDto => {
  const paths = state.paths.paths
    .map((path): SyncPathDto | null => {
      const meta = state.sync.meta[path.pathId];
      if (!meta) {
        return null;
      }
      const date = state.paths.dates.find((entry) => entry.pathid === path.pathId);
      return toSyncPath({ path, date, meta });
    })
    .filter((entry): entry is SyncPathDto => entry !== null);

  const body: SyncSehajPathDto = { paths };
  if (state.sync.lastSyncedAt > 0) {
    body.lastSyncedAt = state.sync.lastSyncedAt;
  }
  if (includeSettings && state.sync.pendingSettingsUpdatedAt != null) {
    body.settings = toSettingsBody(state.settings).settings;
  }
  return body;
};
