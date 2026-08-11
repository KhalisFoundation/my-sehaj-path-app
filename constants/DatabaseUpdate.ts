// User-facing copy for the Database update screen (screens/DatabaseUpdate.tsx).

export const DatabaseUpdateText = {
  navTitle: 'Database',
  back: 'Back',
  subtitle: 'Database helps you to read path even without internet',
  checkAgain: 'Check again',
  checkUpdateA11y: 'Check for database update',
  updateNow: 'Update now',
  updateAvailableTitle: 'Update available',
  updateAvailableMessage: 'A newer reading database is available. Update now to get the latest.',
  updatingTitle: 'Updating database',
  updatingStartMessage: 'Starting the update…',
  checkingTitle: 'Checking database',
  checkingMessage: 'Looking for the latest reading database.',
  downloadingTitle: 'Downloading database',
  downloadInProgressTitle: 'Database download in progress',
  downloadInProgressMessage:
    'A database download is already in progress. Please keep the app open.',

  /** Shared progress line for the checking/downloading states. */
  progressMessage: (percent: number): string => `${percent}% complete. Please keep the app open.`,
  upToDateTitle: 'Database is up to date',
  upToDateMessage: 'You already have the latest reading database.',
  updatedTitle: 'Database updated',
  updatedMessage: 'The latest reading database is ready to use.',
  unavailableTitle: 'Update unavailable',
  unavailableMessage: 'Database updates are not configured in this app.',
  checkFailedTitle: 'Unable to check for updates',
  checkFailedMessage: 'Check your internet connection and try again.',
  failedTitle: 'Unable to update database',
  failedMessage: 'Something went wrong while updating. Please try again.',
} as const;
