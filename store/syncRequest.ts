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
 * Stable identity of a settings document.
 *
 * Keys are sorted so the string depends only on the VALUES — two objects that
 * mean the same thing must produce the same fingerprint regardless of how they
 * were built, since one side comes from local state and the other from a server
 * response. Comparing object references, or `JSON.stringify` on unsorted keys,
 * would report a difference that is not one.
 */
export const settingsFingerprint = (settings: SettingsState): string => {
  const body = toSettingsBody(settings).settings as Record<string, unknown>;
  return JSON.stringify(
    Object.keys(body)
      .sort()
      .map((key) => [key, body[key]])
  );
};

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

/** The server rejects a body above either of these, permanently. */
export const MAX_SYNC_PATHS = 1000;
export const MAX_SYNC_BODY_BYTES = 2 * 1024 * 1024;

/**
 * Identity of a bulk `/sync` body, used to stop an unbounded retry loop.
 *
 * A bulk request has no single offending operation to blame, so a permanent 4xx
 * leaves nothing blocked and the identical body is rescheduled forever. Any local
 * edit advances a `localUpdatedAt` and therefore changes this fingerprint, so a
 * genuine change is retried naturally.
 */
export const syncRequestFingerprint = (body: SyncSehajPathDto): string => {
  const paths = body.paths
    .map((path) => `${path.pathId}:${path.updatedAt}`)
    .sort()
    .join(',');
  return `${body.lastSyncedAt ?? 0}|${body.settings ? 'S' : '-'}|${paths}`;
};

/**
 * UTF-8 byte length of a string, counted directly from code points.
 *
 * `TextEncoder` is NOT available on Hermes and this app ships no polyfill, so
 * using it would throw a `ReferenceError` on device while passing under Jest,
 * where Node provides one. `Blob`/`Buffer` are equally unavailable.
 *
 * `JSON.stringify(...).length` is not a substitute either: it counts UTF-16 code
 * units and undercounts every non-ASCII character. Path names here are routinely
 * Gurmukhi at three UTF-8 bytes each, so a body "measuring" 1.9 MB can exceed
 * 3 MB on the wire and be rejected by the guard that just approved it.
 */
export const utf8ByteLength = (value: string): number => {
  let bytes = 0;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // High surrogate: a well-formed pair is one 4-byte code point. Consume the
      // low surrogate so it is not counted a second time.
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i += 1;
      } else {
        bytes += 3; // lone surrogate — encoders emit the 3-byte replacement char
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
};

/** Byte length of the serialized body, as the server will receive it. */
export const syncRequestByteLength = (body: SyncSehajPathDto): number =>
  utf8ByteLength(JSON.stringify(body));

export interface SyncSizeCheck {
  ok: boolean;
  paths: number;
  bytes: number;
}

/** Checks a body against both server limits before it is sent. */
export const checkSyncRequestSize = (body: SyncSehajPathDto): SyncSizeCheck => {
  const paths = body.paths.length;
  const bytes = syncRequestByteLength(body);
  return { ok: paths <= MAX_SYNC_PATHS && bytes <= MAX_SYNC_BODY_BYTES, paths, bytes };
};
