import { open, type DB } from '@op-engineering/op-sqlite';
import { createBaniDB, type BaniDB } from '@khalisfoundation/banidb';
import { DB_FILE_NAME } from '@constants';
import { DB_DIRECTORY } from './paths';

/**
 * Opens the downloaded SQLite DB with op-sqlite and wraps it in the one-method
 * adapter `@khalisfoundation/banidb` needs. `getBani()` is a lazy singleton so the file
 * is opened once and shared. Adapter shape mirrors the package's RN example.
 */

let sqlite: DB | null = null;
let baniPromise: Promise<BaniDB> | null = null;

const init = async (): Promise<BaniDB> => {
  const handle = open({ name: DB_FILE_NAME, location: DB_DIRECTORY });
  sqlite = handle;
  return createBaniDB({
    db: {
      // op-sqlite is strictly typed (Scalar params, Record<string, Scalar> rows)
      // while the adapter is generic over T — cast at the driver boundary.
      query: async <T>(sql: string, params: unknown[] = []): Promise<T[]> => {
        const res = await handle.execute(sql, params as never[]);
        return (res.rows ?? []) as T[];
      },
    },
  });
};

/** Lazily opens the DB and returns the shared BaniDB client. */
export const getBani = (): Promise<BaniDB> => {
  if (!baniPromise) {
    baniPromise = init().catch((error) => {
      baniPromise = null; // allow a retry after a failed open
      throw error;
    });
  }
  return baniPromise;
};

/**
 * Drops the cached connection so the next `getBani()` reopens the file. Call
 * after a fresh download swaps a new DB in, so we don't keep reading the old
 * handle.
 */
export const resetBani = (): void => {
  try {
    sqlite?.close();
  } catch {
    // already closed or never opened
  }
  sqlite = null;
  baniPromise = null;
};
