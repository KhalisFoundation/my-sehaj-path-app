// User-facing copy for the Database update screen (screens/DatabaseUpdate.tsx).

export const DatabaseUpdateText = {
  NAV_TITLE: 'Database',
  BACK: 'Back',
  SUBTITLE: 'Database helps you to read path even without internet',
  CHECK_AGAIN: 'Check again',
  CHECK_UPDATE_A11Y: 'Check for database update',
  UPDATE_NOW: 'Update now',
  UPDATE_AVAILABLE_TITLE: 'Update available',
  UPDATE_AVAILABLE_MESSAGE: 'A newer reading database is available. Update now to get the latest.',
  UPDATING_TITLE: 'Updating database',
  UPDATING_START_MESSAGE: 'Starting the update…',
  CHECKING_TITLE: 'Checking database',
  CHECKING_MESSAGE: 'Looking for the latest reading database.',
  DOWNLOADING_TITLE: 'Downloading database',
  DOWNLOAD_IN_PROGRESS_TITLE: 'Database download in progress',
  DOWNLOAD_IN_PROGRESS_MESSAGE:
    'A database download is already in progress. Please keep the app open.',

  /** Shared progress line for the checking/downloading states. */
  PROGRESS_MESSAGE: (percent: number): string => `${percent}% complete. Please keep the app open.`,
  UP_TO_DATE_TITLE: 'Database is up to date',
  UP_TO_DATE_MESSAGE: 'You already have the latest reading database.',
  UPDATED_TITLE: 'Database updated',
  UPDATED_MESSAGE: 'The latest reading database is ready to use.',
  UNAVAILABLE_TITLE: 'Update unavailable',
  UNAVAILABLE_MESSAGE: 'Database updates are not configured in this app.',
  CHECK_FAILED_TITLE: 'Unable to check for updates',
  CHECK_FAILED_MESSAGE: 'Check your internet connection and try again.',
  FAILED_TITLE: 'Unable to update database',
  FAILED_MESSAGE: 'Something went wrong while updating. Please try again.',
} as const;
