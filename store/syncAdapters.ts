import type {
  CreateSehajPathDto,
  SehajPath,
  SyncPathDto,
  UpdateSehajPathDto,
} from '@api/generated/types.gen';
import { PATH_DATA } from '@constants';
import type { DateData, PathData } from '../types';
import type { SyncMeta } from './slices/syncSlice';
import { isoToLegacy, legacyToIso, legacyToMs, msToLegacy } from './syncDateUtils';

/**
 * Pure translation between the frozen legacy Redux shapes and the server DTOs.
 * No store access: the caller (the Step 7 coordinator) reads path/date/meta from
 * the store, calls these, and dispatches the result. `progress` and the derived
 * `completionDate` are never sent on create/update — the server owns them.
 */
export interface LocalPath {
  path: PathData;
  date: DateData | undefined;
  meta: SyncMeta;
}

/** Reverse-adapter output: patches the caller applies via reducers. */
export interface Applied {
  /** Written back into pathsSlice (never includes scrollPosition). */
  pathPatch: Partial<PathData>;
  /** Reading days and the saved scroll checkpoint. */
  datePatch: Partial<DateData>;
  /** serverUpdatedAt / onServer / startDate for sync.meta. */
  meta: Partial<SyncMeta>;
}

/**
 * Value normalization: the server validates these, and a rejected body is a
 * permanent 400 that can never succeed on retry. Anything the client can safely
 * clean up is cleaned up here rather than sent and bounced.
 */
/** Limits the API validates. Kept in sync with the server's sehaj-path constants. */
const NAME_MAX = 100;
const MAX_READ_DATES = 4000;
// PostgreSQL/Prisma `Int` is signed 32-bit. Clamp corrupt legacy offsets before
// they can turn into a permanent API rejection and block the path's outbox op.
const MAX_SCROLL_POSITION = 2_147_483_647;

/** A non-negative whole number (server rejects negatives/fractions/NaN). */
const toCount = (value: unknown, max = Number.MAX_SAFE_INTEGER): number => {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0;
  if (n < 0) {
    return 0;
  }
  return n > max ? max : n;
};

/**
 * Legacy path records were never range-checked, so a corrupted `saveData` can
 * hold an ang/verse beyond the scripture's real limits. The API validates these
 * (`@Max`), and a rejected body is a permanent 400 — which would park that path
 * in the outbox forever. Clamping to the shared limits keeps it syncable.
 */
const toAng = (value: unknown): number => toCount(value, PATH_DATA.LAST_ANG_NUMBER);
const toVerse = (value: unknown): number => toCount(value, PATH_DATA.LAST_VERSE_ID);

const toName = (name: string): string => name.trim().slice(0, NAME_MAX);

/**
 * Legacy reading days → ISO, dropping malformed entries and duplicates (the
 * server stores a distinct set; sending repeats risks a validation error).
 */
const toReadDates = (date: DateData | undefined): string[] => {
  const seen = new Set<string>();
  (date?.dates ?? []).forEach((entry) => {
    const iso = legacyToIso(entry.date);
    if (iso !== null) {
      seen.add(iso);
    }
  });
  // The API caps the array (`@ArrayMaxSize`); exceeding it is a permanent 400.
  // Keep the most recent days, which are the ones a streak actually needs.
  const all = [...seen].sort();
  return all.length > MAX_READ_DATES ? all.slice(-MAX_READ_DATES) : all;
};

/** Body for `POST /sehaj-path`. Sends the client UUID so retries are idempotent. */
export const toCreateBody = ({ path, date, meta }: LocalPath): CreateSehajPathDto => ({
  pathId: meta.serverPathId,
  name: toName(path.pathName),
  angNumber: toAng(path.saveData.angNumber),
  verseId: toVerse(path.saveData.verseId),
  scrollPosition: toCount(date?.scrollPosition, MAX_SCROLL_POSITION),
  readDates: toReadDates(date),
  startDate: toCount(meta.startDate),
});

/**
 * Body for `PATCH /sehaj-path/:pathId`. Carries `baseUpdatedAt` only once a
 * server clock exists (omitted on the first PATCH after create). Includes the
 * current scrollPosition because a PATCH is always a real update/checkpoint;
 * never sends `progress`.
 */
export const toPatchBody = ({ path, date, meta }: LocalPath): UpdateSehajPathDto => {
  const body: UpdateSehajPathDto = {
    name: toName(path.pathName),
    angNumber: toAng(path.saveData.angNumber),
    verseId: toVerse(path.saveData.verseId),
    scrollPosition: toCount(date?.scrollPosition, MAX_SCROLL_POSITION),
    readDates: toReadDates(date),
  };
  if (meta.serverUpdatedAt > 0) {
    body.baseUpdatedAt = meta.serverUpdatedAt;
  }
  return body;
};

/** One entry in a bulk `POST /sehaj-path/sync`, including delete tombstones. */
export const toSyncPath = ({ path, date, meta }: LocalPath): SyncPathDto => ({
  pathId: meta.serverPathId,
  name: toName(path.pathName),
  angNumber: toAng(path.saveData.angNumber),
  verseId: toVerse(path.saveData.verseId),
  scrollPosition: toCount(date?.scrollPosition, MAX_SCROLL_POSITION),
  readDates: toReadDates(date),
  startDate: toCount(meta.startDate),
  completionDate: legacyToMs(path.completionDate),
  updatedAt: meta.localUpdatedAt,
  deletedAt: meta.deletedAt,
});

/**
 * A `SehajPath` response → patches for the local slices. Matched to a local path
 * by `serverPathId` upstream. Callers decide whether this scroll checkpoint is
 * safe to apply (a closed, clean path) or must stay local (an active reader or
 * a direct write response).
 */
export const fromServerPath = (server: SehajPath): Applied => ({
  pathPatch: {
    pathName: server.name,
    progress: server.progress,
    saveData: { angNumber: server.angNumber, verseId: server.verseId },
    startDate: msToLegacy(server.startDate),
    completionDate: server.completionDate == null ? '' : msToLegacy(server.completionDate),
  },
  datePatch: {
    dates: server.readDates
      .map((iso) => isoToLegacy(iso))
      .filter((legacy): legacy is string => legacy !== null)
      .map((date) => ({ date })),
    scrollPosition: server.scrollPosition,
  },
  meta: {
    serverCreatedAt: server.createdAt,
    serverUpdatedAt: server.updatedAt,
    onServer: true,
    startDate: server.startDate,
  },
});
