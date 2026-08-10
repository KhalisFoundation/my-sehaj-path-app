#!/usr/bin/env node
/**
 * Sehaj sync — live server contract test.
 *
 * The app's 384 unit tests cover the CLIENT half (adapters, outbox, merge
 * guards) against a mocked SDK. What they structurally cannot cover is how the
 * real server actually answers. This script closes that gap: it drives the live
 * API over HTTP and asserts the exact contract the client depends on.
 *
 * Every check here maps to a client behaviour that silently breaks if the server
 * disagrees — most importantly the 201-vs-200 create distinction, which is what
 * stops an idempotent retry from overwriting newer local progress.
 *
 * Usage (server must be running with DEV_AUTH_BYPASS=1, NODE_ENV != production):
 *   SEHAJ_API_URL=http://localhost:3500 node scripts/syncContractTest.mjs
 *
 * Safe to re-run: every path uses a fresh UUID and is deleted at the end.
 * Point this at a throwaway database — it creates and deletes rows.
 */

const BASE = (process.env.SEHAJ_API_URL ?? 'http://localhost:3500').replace(/\/+$/, '');

/**
 * Tokens are read from the environment and never written to disk or logged —
 * export them in your shell, don't put them in a file.
 *
 * With DEV_AUTH_BYPASS=1 any token works, but every request maps to ONE
 * hardcoded user, so the account-isolation section is skipped. Supplying two
 * real SSO tokens (SEHAJ_TOKEN_A / SEHAJ_TOKEN_B) enables it.
 */
const TOKEN = process.env.SEHAJ_TOKEN_A ?? process.env.SEHAJ_TEST_TOKEN ?? 'dev-bypass-token';
const TOKEN_B = process.env.SEHAJ_TOKEN_B ?? null;

// Limits the client clamps to. Kept in step with sehaj-path.constants.ts.
const LAST_ANG = 1430;
const LAST_VERSE = 60403;
const MAX_SCROLL = 2_147_483_647;
const MAX_READ_DATES = 4000;

let passed = 0;
let failed = 0;
const createdPathIds = new Set();

const check = (label, condition, detail = '') => {
  if (condition) {
    passed += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failed += 1;
    console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? `\n      → ${detail}` : ''}`);
  }
};

const section = (name) => console.log(`\n\x1b[1m${name}\x1b[0m`);

/**
 * Order-insensitive comparison. Settings are stored in a Postgres `jsonb`
 * column, which does NOT preserve key insertion order — so a plain
 * JSON.stringify comparison reports a false mismatch on identical data. The
 * client reads settings by key name, so order is irrelevant to correctness.
 */
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => ({ ...acc, [key]: canonical(value[key]) }), {});
  }
  return value;
};
const deepEqual = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

const api = async (method, path, body, token = TOKEN) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: res.status, data };
};

/** A create body shaped exactly like the client's `toCreateBody`. */
const createBody = (pathId, over = {}) => ({
  pathId,
  name: 'Contract Test Path',
  angNumber: 10,
  verseId: 100,
  scrollPosition: 250,
  readDates: ['2026-01-01'],
  startDate: Date.UTC(2026, 0, 1),
  ...over,
});

/** A `/sync` path entry shaped exactly like the client's `toSyncPath`. */
const syncPath = (pathId, over = {}) => ({
  pathId,
  name: 'Sync Test Path',
  angNumber: 20,
  verseId: 200,
  scrollPosition: 300,
  readDates: ['2026-02-01'],
  startDate: Date.UTC(2026, 0, 1),
  completionDate: null,
  updatedAt: Date.now(),
  deletedAt: null,
  ...over,
});

const newPathId = () => {
  const id = crypto.randomUUID();
  createdPathIds.add(id);
  return id;
};

async function main() {
  console.log(`\nSehaj sync contract test → ${BASE}\n${'='.repeat(60)}`);

  // Fail fast with a useful message rather than 20 confusing errors.
  try {
    const probe = await api('GET', '/sehaj-path/paths');
    if (probe.status === 401) {
      console.error(
        '\n✗ Server returned 401. Start it with DEV_AUTH_BYPASS=1 (and NODE_ENV not "production"),\n' +
          '  or set SEHAJ_TEST_TOKEN to a real SSO token.\n'
      );
      process.exit(1);
    }
    if (probe.status !== 200) {
      console.error(`\n✗ Unexpected ${probe.status} from GET /sehaj-path/paths.\n`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n✗ Cannot reach ${BASE} — is the server running?\n  ${error.message}\n`);
    process.exit(1);
  }

  // ---------------------------------------------------------------- creates
  section('A. Create contract (201 vs 200 — protects against overwriting newer local progress)');
  const pathA = newPathId();
  const created = await api('POST', '/sehaj-path/paths', createBody(pathA));
  check('new UUID → 201 Created', created.status === 201, `got ${created.status}`);
  check('response echoes the submitted body', created.data?.name === 'Contract Test Path');
  check('server derives progress', typeof created.data?.progress === 'number');
  const createdUpdatedAt = created.data?.updatedAt;

  // THE critical one: a retry must not apply the resent body.
  const replay = await api(
    'POST',
    '/sehaj-path/paths',
    createBody(pathA, { name: 'REPLAYED NAME', angNumber: 999 })
  );
  check('duplicate UUID → 200 OK (not 201)', replay.status === 200, `got ${replay.status}`);
  check(
    'replayed body is NOT applied (client relies on this)',
    replay.data?.name === 'Contract Test Path' && replay.data?.angNumber === 10,
    `name=${replay.data?.name} ang=${replay.data?.angNumber}`
  );

  // ---------------------------------------------------------------- updates
  section('B. Update + optimistic concurrency');
  const patched = await api('PATCH', `/sehaj-path/paths/${pathA}`, {
    angNumber: 50,
    verseId: 500,
    scrollPosition: 400,
    readDates: ['2026-01-02'],
    baseUpdatedAt: createdUpdatedAt,
  });
  check('PATCH with fresh baseUpdatedAt → 200', patched.status === 200, `got ${patched.status}`);
  check('values applied', patched.data?.angNumber === 50 && patched.data?.verseId === 500);
  check(
    'updatedAt strictly advances',
    patched.data?.updatedAt > createdUpdatedAt,
    `${createdUpdatedAt} → ${patched.data?.updatedAt}`
  );
  check(
    'readDates UNION, not replace (a stale device cannot wipe days)',
    Array.isArray(patched.data?.readDates) &&
      patched.data.readDates.includes('2026-01-01') &&
      patched.data.readDates.includes('2026-01-02'),
    JSON.stringify(patched.data?.readDates)
  );

  const stale = await api('PATCH', `/sehaj-path/paths/${pathA}`, {
    angNumber: 60,
    baseUpdatedAt: createdUpdatedAt, // now stale
  });
  check('PATCH with stale baseUpdatedAt → 409 Conflict', stale.status === 409, `got ${stale.status}`);

  // --------------------------------------------------------------- validation
  section('C. Validation limits (proves the client-side clamps are both needed and sufficient)');
  const maxOk = newPathId();
  const atLimits = await api(
    'POST',
    '/sehaj-path/paths',
    createBody(maxOk, {
      angNumber: LAST_ANG,
      verseId: LAST_VERSE,
      scrollPosition: MAX_SCROLL,
      readDates: Array.from({ length: MAX_READ_DATES }, (_, i) => {
        const d = new Date(Date.UTC(2000, 0, 1) + i * 86_400_000);
        return d.toISOString().slice(0, 10);
      }),
    })
  );
  check(
    'exact client clamp values are ACCEPTED (ang/verse/scroll/4000 dates)',
    atLimits.status === 201,
    `got ${atLimits.status}: ${JSON.stringify(atLimits.data).slice(0, 160)}`
  );

  const overAng = await api('POST', '/sehaj-path/paths', createBody(crypto.randomUUID(), { angNumber: LAST_ANG + 1 }));
  check('ang above max → 400 (so the clamp is required)', overAng.status === 400, `got ${overAng.status}`);

  const overScroll = await api(
    'POST',
    '/sehaj-path/paths',
    createBody(crypto.randomUUID(), { scrollPosition: MAX_SCROLL + 1 })
  );
  check('scroll above int32 → 400, not a 500', overScroll.status === 400, `got ${overScroll.status}`);

  const overDates = await api(
    'POST',
    '/sehaj-path/paths',
    createBody(crypto.randomUUID(), {
      readDates: Array.from({ length: MAX_READ_DATES + 1 }, (_, i) => {
        const d = new Date(Date.UTC(2000, 0, 1) + i * 86_400_000);
        return d.toISOString().slice(0, 10);
      }),
    })
  );
  check('readDates above max → 400', overDates.status === 400, `got ${overDates.status}`);

  // -------------------------------------------------------------------- sync
  section('D. Bulk /sync');
  const syncA = newPathId();
  const bulk = await api('POST', '/sehaj-path/sync', {
    paths: [syncPath(syncA)],
    lastSyncedAt: 0,
  });
  check('POST /sync → 200', bulk.status === 200, `got ${bulk.status}`);
  check('returns the authoritative path set', Array.isArray(bulk.data?.paths));
  check('returns deletedPathIds', Array.isArray(bulk.data?.deletedPathIds));
  check('returns a numeric syncedAt', typeof bulk.data?.syncedAt === 'number');

  // The watermark fix: the client stores syncedAt as its cursor, so it must
  // cover every clock in this response or fast-forward silently stops working.
  const maxReturned = Math.max(0, ...(bulk.data?.paths ?? []).map((p) => p.updatedAt));
  check(
    'syncedAt >= newest returned updatedAt (cursor covers the response)',
    bulk.data?.syncedAt >= maxReturned,
    `syncedAt=${bulk.data?.syncedAt} maxUpdatedAt=${maxReturned}`
  );

  // A skewed device must not poison ordering for everyone else.
  const skewed = newPathId();
  const oneYearAhead = Date.now() + 365 * 24 * 60 * 60 * 1000;
  const skewSync = await api('POST', '/sehaj-path/sync', {
    paths: [syncPath(skewed, { updatedAt: oneYearAhead })],
    lastSyncedAt: 0,
  });
  const skewedRow = (skewSync.data?.paths ?? []).find((p) => p.pathId === skewed);
  check(
    'far-future client clock is normalized, not stored',
    skewedRow !== undefined && skewedRow.updatedAt < oneYearAhead,
    `stored updatedAt=${skewedRow?.updatedAt} vs sent=${oneYearAhead}`
  );

  // ------------------------------------------------------- delete / tombstone
  section('E. Delete + tombstone propagation');
  const del = await api('DELETE', `/sehaj-path/paths/${pathA}`);
  check('DELETE → 204 No Content', del.status === 204, `got ${del.status}`);
  createdPathIds.delete(pathA);

  const afterDelete = await api('GET', '/sehaj-path/paths');
  check(
    'deleted path is absent from GET /paths',
    !(afterDelete.data ?? []).some((p) => p.pathId === pathA)
  );

  const delAgain = await api('DELETE', `/sehaj-path/paths/${pathA}`);
  check(
    'second DELETE → 404 (client treats this as already-gone success)',
    delAgain.status === 404,
    `got ${delAgain.status}`
  );

  const tombstoneSync = await api('POST', '/sehaj-path/sync', { paths: [], lastSyncedAt: 0 });
  check(
    'tombstone surfaces in /sync deletedPathIds (other devices learn of it)',
    (tombstoneSync.data?.deletedPathIds ?? []).includes(pathA),
    JSON.stringify(tombstoneSync.data?.deletedPathIds)
  );

  // ---------------------------------------------------------------- settings
  section('F. Settings round-trip');
  // These tokens may belong to real accounts, and PUT replaces the whole
  // settings document. Capture whatever is there so it can be put back.
  const originalSettings = await api('GET', '/sehaj-path/settings');
  const hadSettings = originalSettings.status === 200;
  const settingsBody = {
    settings: {
      fontSize: { fontSize: 'Large', number: 30 },
      larivaar: true,
      paragraphMode: false,
      vishraam: true,
      vishraamsSource: { source: 'igurbani' },
      angsFormat: { format: 'English' },
      consent: false,
    },
  };
  const put = await api('PUT', '/sehaj-path/settings', settingsBody);
  check('PUT /settings → 200', put.status === 200, `got ${put.status}`);
  const get = await api('GET', '/sehaj-path/settings');
  check('GET /settings → 200', get.status === 200, `got ${get.status}`);
  check(
    'settings round-trip by value (second device receives them)',
    deepEqual(get.data?.settings, settingsBody.settings),
    JSON.stringify(get.data?.settings)
  );

  // ------------------------------------------------------------ two devices
  section('G. Two-device visibility (same account)');
  const deviceAPath = newPathId();
  await api('POST', '/sehaj-path/paths', createBody(deviceAPath, { name: 'From device A' }));
  const deviceBView = await api('GET', '/sehaj-path/paths');
  check(
    "device B's GET sees the path device A created",
    (deviceBView.data ?? []).some((p) => p.pathId === deviceAPath && p.name === 'From device A')
  );

  // ------------------------------------------------------- account isolation
  section('H. Account isolation (needs two real SSO tokens)');
  if (!TOKEN_B) {
    console.log(
      '  \x1b[33m•\x1b[0m skipped — set SEHAJ_TOKEN_A and SEHAJ_TOKEN_B to two different\n' +
        '    accounts. DEV_AUTH_BYPASS maps every token to one user, so it cannot\n' +
        '    prove isolation.'
    );
  } else {
    const aOnlyPath = newPathId();
    const aCreate = await api(
      'POST',
      '/sehaj-path/paths',
      createBody(aOnlyPath, { name: 'A private path' })
    );
    check("account A creates a path", aCreate.status === 201, `got ${aCreate.status}`);

    // The whole account model rests on this: every endpoint scopes by the JWT's
    // user, never by anything the client sends.
    const bList = await api('GET', '/sehaj-path/paths', undefined, TOKEN_B);
    check(
      "account B's GET /paths does NOT contain A's path",
      !(bList.data ?? []).some((p) => p.pathId === aOnlyPath),
      `B saw ${(bList.data ?? []).length} paths`
    );

    const bSync = await api('POST', '/sehaj-path/sync', { paths: [], lastSyncedAt: 0 }, TOKEN_B);
    check(
      "account B's /sync does NOT return A's path",
      !(bSync.data?.paths ?? []).some((p) => p.pathId === aOnlyPath)
    );

    // Same UUID under a different JWT must create B's OWN row, never touch A's.
    const bClaim = await api(
      'POST',
      '/sehaj-path/paths',
      createBody(aOnlyPath, { name: 'B attempts same UUID' }),
      TOKEN_B
    );
    check(
      "B reusing A's UUID creates B's own row (201), not a collision",
      bClaim.status === 201,
      `got ${bClaim.status}`
    );
    const aStillIntact = await api('GET', `/sehaj-path/paths/${aOnlyPath}`);
    check(
      "A's path is untouched by B's write",
      aStillIntact.status === 200 && aStillIntact.data?.name === 'A private path',
      `A now sees name=${aStillIntact.data?.name}`
    );

    const bSettings = await api('GET', '/sehaj-path/settings', undefined, TOKEN_B);
    check(
      "B's settings are separate from A's (404 or different document)",
      bSettings.status === 404 || !deepEqual(bSettings.data?.settings, settingsBody.settings),
      `B settings status=${bSettings.status}`
    );

    // Clean up B's row under B's token.
    await api('DELETE', `/sehaj-path/paths/${aOnlyPath}`, undefined, TOKEN_B);
  }

  // ----------------------------------------------------------------- cleanup
  section('Cleanup');
  let cleaned = 0;
  for (const id of createdPathIds) {
    const res = await api('DELETE', `/sehaj-path/paths/${id}`);
    if (res.status === 204 || res.status === 404) cleaned += 1;
  }
  console.log(`  removed ${cleaned}/${createdPathIds.size} test paths`);

  // Put the account's real settings back; never leave a live account holding
  // this harness's test preferences.
  if (hadSettings) {
    const restore = await api('PUT', '/sehaj-path/settings', {
      settings: originalSettings.data.settings,
    });
    console.log(
      restore.status === 200
        ? '  restored the original settings document'
        : `  \x1b[31mWARNING: could not restore settings (${restore.status}) — original was: ` +
            `${JSON.stringify(originalSettings.data.settings)}\x1b[0m`
    );
  } else {
    console.log('  account had no settings before the run; left as-is');
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`\x1b[1m${passed} passed, ${failed} failed\x1b[0m\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`\nHarness crashed: ${error.stack}\n`);
  process.exit(1);
});
