import type { Ang } from '@khalisfoundation/banidb';
import { BaniDB, recordError } from '@utils';
import type { PathContent, VishraamsMarker } from '../types';
import { getBani } from './connection';
import { isDatabaseInstalled } from './downloadDatabase';

/**
 * Single read entry point for an ang's content.
 *
 * When the offline DB is installed AND readable it serves the ang from there
 * (offline, instant) — no network, no internet check. If the DB is missing OR a
 * read fails (e.g. a corrupted DB), it falls back to the BaniDB API, which needs
 * the network — so the caller's connectivity handling only kicks in then.
 * Returns the same `{ success, data }` shape the reader already consumes;
 * `@khalisfoundation/banidb.getAng` already returns the API response shape, so mapping
 * it to the app's `PathContent` is a field pick.
 */
export interface AngContentResult {
  success: boolean;
  data?: PathContent;
  /** Which source produced this result; useful for diagnostics and tests. */
  source: 'db' | 'api';
}

// The package's visraam mark allows `p: string` and optional `t` (its
// VisraamMark type is not exported, so it's typed structurally here); the app's
// VishraamsMarker is `{ p: number; t: string }`. Normalize at the boundary.
const normalizeMarks = (
  marks: Array<{ p: number | string; t?: string }> | undefined
): VishraamsMarker[] =>
  (marks ?? []).map((mark) => ({
    p: typeof mark.p === 'number' ? mark.p : Number(mark.p),
    t: mark.t ?? '',
  }));

const toPathContent = (ang: Ang, angNumber: number): PathContent => ({
  source: { pageNo: ang.source?.pageNo ?? angNumber },
  page: ang.page.map((verse) => ({
    verseId: verse.verseId,
    shabadId: verse.shabadId,
    verse: { unicode: verse.verse.unicode },
    larivaar: { unicode: verse.larivaar.unicode },
    visraam: {
      sttm2: normalizeMarks(verse.visraam?.sttm2),
      sttm: normalizeMarks(verse.visraam?.sttm),
      igurbani: normalizeMarks(verse.visraam?.igurbani),
    },
  })),
});

export const getAngContent = async (angNumber: number): Promise<AngContentResult> => {
  // DB present → read fully offline. No connectivity check is needed before
  // this read. A missing or broken DB deliberately falls through to the API.
  if (await isDatabaseInstalled()) {
    try {
      const bani = await getBani();
      const ang = await bani.getAng(angNumber);
      // A single page has `page`; a MultiAng has `pages`. We only ask for one
      // ang, so anything else is unexpected — fall back to the API.
      if (ang && 'page' in ang) {
        return { success: true, data: toPathContent(ang, angNumber), source: 'db' };
      }
      recordError(
        new Error(`offline getAng returned no single ang for ${angNumber}`),
        'db: getAng miss; falling back to API'
      );
    } catch (error) {
      recordError(error, 'db: getAng failed; falling back to API');
    }
  }

  // Missing/corrupt DB → API mode. The caller checks connectivity only if this
  // fallback fails, so downloaded content is never delayed by a network check.
  const api = await BaniDB(angNumber);
  return { ...api, source: 'api' };
};
