// Offline reading database (Sri Guru Granth Sahib, angs 1–1430).
//
// The DB is downloaded on first launch and read via @sikhi-ui/banidb + op-sqlite.

/**
 * Direct download link to the `.db` file (the ~181 MB SGGS database).

 */
export const SEHAJ_DB_REMOTE_URL =
  'https://drive.usercontent.google.com/download?id=1yVuh3v050Td9LbQNrB0pVDHk5VORRxph&export=download&confirm=t';

/**
 * Link to the DB's `.md5` file, used later for update checks
 * (`bani.checkForUpdate`). Blank = no update check.
 *
 */
export const SEHAJ_DB_MD5_URL =
  'https://drive.usercontent.google.com/download?id=1FblMtkHkDRl_Hsg8c2Zg6YHv8DqF57Tp&export=download&confirm=t';

/** On-disk filename for the downloaded database. */
export const DB_FILE_NAME = 'banidb-sehajpath.db';
