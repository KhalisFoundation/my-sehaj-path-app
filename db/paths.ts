import { DocumentDirectoryPath } from '@dr.pogodin/react-native-fs';
import { DB_FILE_NAME } from '@constants';

/**
 * Where the database lives on device. `DocumentDirectoryPath` is app-private,
 * persists across launches, and is the directory op-sqlite opens from (via
 * `open({ name, location })`) once the file is in place.
 */
export const DB_DIRECTORY = DocumentDirectoryPath;

/** The live database file the reader opens. */
export const LOCAL_DB_PATH = `${DB_DIRECTORY}/${DB_FILE_NAME}`;

/**
 * The download target. We download here first and only `moveFile` it onto
 * `LOCAL_DB_PATH` once it is fully written and verified, so a partial/failed
 * download can never be opened as the real DB.
 */
export const TEMP_DB_PATH = `${LOCAL_DB_PATH}.download`;
