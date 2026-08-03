import type { SehajPath } from '@api/generated/types.gen';
import type { DateData, PathData } from '../../types';
import type { SyncMeta } from '../../store/slices/syncSlice';
import {
  fromServerPath,
  toCreateBody,
  toPatchBody,
  toSyncPath,
  type LocalPath,
} from '../../store/syncAdapters';

const UUID = '11111111-2222-4333-8444-555555555555';

const path: PathData = {
  pathId: 1,
  saveData: { angNumber: 120, verseId: 4501 },
  progress: 8.39,
  startDate: '1-January-2026',
  completionDate: '',
  pathName: '  Morning Path  ',
};

const date: DateData = {
  pathid: 1,
  dates: [{ date: '1-January-2026' }, { date: 'garbage' }, { date: '2-January-2026' }],
  scrollPosition: 340,
};

const meta: SyncMeta = {
  serverPathId: UUID,
  serverUpdatedAt: 0,
  localUpdatedAt: 1700000000001,
  startDate: Date.UTC(2026, 0, 1),
  deletedAt: null,
  onServer: false,
};

const local = (overrides: Partial<LocalPath> = {}): LocalPath => ({
  path,
  date,
  meta,
  ...overrides,
});

describe('toCreateBody', () => {
  it('sends the UUID, trims the name, and never leaks progress', () => {
    const body = toCreateBody(local());
    expect(body.pathId).toBe(UUID);
    expect(body.name).toBe('Morning Path');
    expect(body.startDate).toBe(Date.UTC(2026, 0, 1));
    expect(body.scrollPosition).toBe(340);
    expect('progress' in body).toBe(false);
  });

  it('converts reading days to ISO and skips malformed ones', () => {
    expect(toCreateBody(local()).readDates).toEqual(['2026-01-01', '2026-01-02']);
  });
});

/**
 * The server validates these fields; a rejected body is a permanent 400 that can
 * never succeed on retry, so the client normalizes what it safely can (P0 #5).
 */
describe('request value normalization', () => {
  it('rounds a fractional scroll offset and clamps a negative one to 0', () => {
    expect(toCreateBody(local({ date: { ...date, scrollPosition: 340.7 } })).scrollPosition).toBe(
      341
    );
    expect(toCreateBody(local({ date: { ...date, scrollPosition: -5 } })).scrollPosition).toBe(0);
  });

  it('clamps a corrupt scroll offset to the API database maximum', () => {
    const brokenDate = { ...date, scrollPosition: Number.MAX_SAFE_INTEGER };
    expect(toCreateBody(local({ date: brokenDate })).scrollPosition).toBe(2_147_483_647);
    expect(toPatchBody(local({ date: brokenDate })).scrollPosition).toBe(2_147_483_647);
    expect(toSyncPath(local({ date: brokenDate })).scrollPosition).toBe(2_147_483_647);
  });

  it('clamps a corrupt out-of-range ang/verse to the API maximum', () => {
    // Legacy records were never range-checked; the API @Max-validates these, and
    // a 400 would park the path in the outbox forever.
    const broken = { ...path, saveData: { angNumber: 99999, verseId: 999999 } };
    const body = toCreateBody(local({ path: broken }));
    expect(body.angNumber).toBe(1430);
    expect(body.verseId).toBe(60403);
    expect(toPatchBody(local({ path: broken })).angNumber).toBe(1430);
    expect(toSyncPath(local({ path: broken })).verseId).toBe(60403);
  });

  it('caps read dates at the API maximum, keeping the most recent days', () => {
    const many: DateData = {
      ...date,
      // 4001 distinct days → one over the server's ArrayMaxSize.
      dates: Array.from({ length: 4001 }, (_, i) => ({
        date: `${(i % 28) + 1}-January-${2000 + Math.floor(i / 28)}`,
      })),
    };
    const sent = toCreateBody(local({ date: many })).readDates ?? [];
    expect(sent).toHaveLength(4000);
    // Oldest day is dropped, newest retained.
    expect(sent[sent.length - 1] > sent[0]).toBe(true);
  });

  it('replaces a non-finite ang/verse with 0 instead of sending NaN', () => {
    const broken = { ...path, saveData: { angNumber: NaN, verseId: Infinity } };
    const body = toCreateBody(local({ path: broken }));
    expect(body.angNumber).toBe(0);
    expect(body.verseId).toBe(0);
  });

  it('trims the name and caps it at the server maximum of 100 characters', () => {
    const body = toCreateBody(local({ path: { ...path, pathName: `  ${'x'.repeat(150)}  ` } }));
    expect(body.name).toHaveLength(100);
  });

  it('de-duplicates reading days', () => {
    const dupes: DateData = {
      ...date,
      dates: [{ date: '1-January-2026' }, { date: '1-January-2026' }],
    };
    expect(toCreateBody(local({ date: dupes })).readDates).toEqual(['2026-01-01']);
  });

  it('normalizes the PATCH and /sync bodies the same way', () => {
    const messy = local({
      path: { ...path, pathName: '  Trimmed  ' },
      date: { ...date, scrollPosition: 12.4 },
    });
    expect(toPatchBody(messy).name).toBe('Trimmed');
    expect(toPatchBody(messy).scrollPosition).toBe(12);
    expect(toSyncPath(messy).name).toBe('Trimmed');
    expect(toSyncPath(messy).scrollPosition).toBe(12);
  });
});

describe('toPatchBody', () => {
  it('omits baseUpdatedAt on the first patch (no server clock yet)', () => {
    const body = toPatchBody(local());
    expect('baseUpdatedAt' in body).toBe(false);
    expect('progress' in body).toBe(false);
    expect(body.scrollPosition).toBe(340);
  });

  it('sends baseUpdatedAt once a server clock exists', () => {
    const body = toPatchBody(local({ meta: { ...meta, serverUpdatedAt: 999 } }));
    expect(body.baseUpdatedAt).toBe(999);
  });
});

describe('toSyncPath', () => {
  it('includes the localUpdatedAt clock, deletedAt, and completionDate (ms)', () => {
    const body = toSyncPath(
      local({
        path: { ...path, completionDate: '3-March-2026' },
        meta: { ...meta, deletedAt: 555 },
      })
    );
    expect(body.updatedAt).toBe(1700000000001);
    expect(body.deletedAt).toBe(555);
    expect(body.completionDate).toBe(Date.UTC(2026, 2, 3));
    expect(body.pathId).toBe(UUID);
  });

  it('sends completionDate null when the path is not complete', () => {
    expect(toSyncPath(local()).completionDate).toBeNull();
  });
});

describe('fromServerPath', () => {
  const server: SehajPath = {
    angNumber: 200,
    verseId: 7000,
    scrollPosition: 999,
    startDate: Date.UTC(2026, 0, 1),
    completionDate: null,
    createdAt: Date.UTC(2026, 0, 1),
    updatedAt: 1700000005000,
    pathId: UUID,
    name: 'From Server',
    progress: 14,
    readDates: ['2026-01-01', '2026-01-05'],
  };

  it('produces legacy date strings and the matching server scroll checkpoint', () => {
    const applied = fromServerPath(server);
    expect(applied.datePatch.dates).toEqual([
      { date: '1-January-2026' },
      { date: '5-January-2026' },
    ]);
    expect(applied.datePatch.scrollPosition).toBe(999);
  });

  it('maps meta and path fields; marks the path on-server', () => {
    const applied = fromServerPath(server);
    expect(applied.meta).toEqual({
      serverUpdatedAt: 1700000005000,
      onServer: true,
      startDate: Date.UTC(2026, 0, 1),
    });
    expect(applied.pathPatch.saveData).toEqual({ angNumber: 200, verseId: 7000 });
    expect(applied.pathPatch.progress).toBe(14);
    expect(applied.pathPatch.completionDate).toBe('');
  });

  it('converts a completed server date to a legacy string', () => {
    const applied = fromServerPath({ ...server, completionDate: Date.UTC(2026, 2, 3) });
    expect(applied.pathPatch.completionDate).toBe('3-March-2026');
  });
});
