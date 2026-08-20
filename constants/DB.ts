// Offline reading database (Sri Guru Granth Sahib, angs 1–1430).
//
// The DB is downloaded on first launch and read via @sikhi-ui/banidb + op-sqlite.

/**
 * Azure Front Door CDN host for both files below.
 *
 * Serving the 181 MB first-launch download from an edge node gives the app a
 * stable direct-file endpoint and avoids depending on a file-sharing URL. The
 * CDN also supports byte-range responses, allowing resumable downloads to be
 * added later.
 */
const DB_CDN_BASE_URL = 'https://gurbani-audios-c4abhzghhnccd5gj.z01.azurefd.net/database';

/** Direct download link to the `.db` file (the ~181 MB SGGS database). */
export const SEHAJ_DB_REMOTE_URL = `${DB_CDN_BASE_URL}/banidb-sehajpath.db`;

/**
 * Link to the DB's `.md5` file, used for update checks
 * (`bani.checkForUpdate`). Blank = no update check.
 *
 * Note the name: `banidb-sehajpath.md5`, NOT `banidb-sehajpath.db.md5`. It is
 * the plain 32-character hex digest of the `.db` above, with a trailing newline
 * (`checkForUpdate` trims it).
 */
export const SEHAJ_DB_MD5_URL = `${DB_CDN_BASE_URL}/banidb-sehajpath.md5`;

/** On-disk filename for the downloaded database. */
export const DB_FILE_NAME = 'banidb-sehajpath.db';
