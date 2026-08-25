interface Constant {
  [key: string]: any;
}
export const Constants: Constant = {
  SEHAJ_PATH: 'ਸਹਿਜ ਪਾਠ ',
  BUILDING_THE_HABIT: 'Building the habit',
  OF_READING_GURBANI: 'of reading Gurbani.',
  SEHAJ: 'Sehaj',
  ITS_FINE_DAY_FOR: "It's a Fine Day for",
  SEHAJ_PATH_ENGLISH: 'Sehaj Path',
  START_NEW: 'Start New',
  DELETE_PATH: 'Delete Path',
  PATH_DELETED: 'Path deleted',
  DELETE_PATH_TITLE: 'Delete this path?',
  DELETE_PATH_MESSAGE_BEFORE: 'Your saved progress for ',
  DELETE_PATH_MESSAGE_AFTER:
    ' will be removed from this device and your account. This cannot be undone.',
  DELETE: 'Delete',
  DELETING: 'Deleting…',
  SEHAJ_PATH_IN_PROGRESS: 'Sehaj Paths in Progress',
  SEHAJ_PATH_COMPLETED: 'Sehaj Paths Completed',
  ANG: 'Ang',
  SEE_ALL_PATH: 'See all paths',
  PATH: 'Path',
  WAHEGURU_JI_KA_KHALSA_WAHEGURU_JI_KI_FATEH: 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ॥ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ ॥ 🙏🏽 ',
  YOU_ARE_ON_ANG_NUMBER: 'You are on ang number  ',
  HAVE_COMPLETED: ' and have completed ',
  SRI_SEHAJ_PATH: ' of your Sehaj Path. 🎉 ',
  STARTED_PATH: 'You started this path ',
  AVERAGE_ABOUT: 'ago. You average about ',
  COMPLETION_SEHAJ_PATH: 'With your current speed, you will complete this Sehaj Path on ',
  HERE_YOURS_STREAK_CHART: "Here's your streak chart so far: ⚡",
  CONTINUE: 'Continue',
  COMPLETE_10_ANGS:
    'Awesome, you have started the sehaj path, once you complete 10 angs you will see more details here.',
  DISPLAY_OPTIONS: 'Display Options',
  BANI_OPTIONS: 'Bani Options',
  SELECT_A_PANKTEE_TO_SAVE_PROGRESS: 'Select a panktee to save progress.',
  SAVING_THE_HIGHLIGHTED_PANKTEE: 'Saving …',
  SAVED_THE_HIGHLIGHTED_PANKTEE: 'Saved the highlighted panktee!',
  RESUMING_SAVED_PROGRESS: 'Resuming saved progress',
  SELECT_YOUR_FONT_SIZE: 'Select your font size',
  LARIVAAR: 'Larivaar',
  PARAGRAPH_MODE: 'Paragraph Mode',
  SETTINGS: 'Settings',
  SELECT_YOUR_ANG_FORMAT: 'Select your ang format',
  ANGS: 'Angs',
  ANG_NUMBERING: 'Ang Numbering',
  GO_TO_NEXT_ANG: 'Go To Next Ang',
  ALERT_TEXT_LOADING: 'Loading ... ',
  VISHRAAM: 'Vishraam',
  ANALYTICS: 'Collect Analytics',
  FONT_SIZE: 'Font-Size',
  DEFAULT_VISHRAAM_SOURCE: 'sttm',
  KHALIS_SEHAJ_PATH: 'Khalis Sehaj Path',
  DONATE: 'Donate',
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  LOGGING_OUT: 'Signing out…',
  WELCOME: 'Welcome',
  SYNC_PROGRESS_PROMPT: 'Do you want to sync your progress now?',
  OK: 'OK',
  /**
   * Two different reasons sync cannot run, deliberately kept apart.
   *
   * UNAVAILABLE is for a build with no server configured at all
   * (`!isApiConfigured()`), where nothing the user does will help — telling them
   * to check their connection would send them chasing a fault that isn't there.
   * OFFLINE is for a device that simply has no connection, where checking it is
   * exactly the right advice.
   */
  SYNC_UNAVAILABLE_TITLE: 'Sync is unavailable',
  SYNC_UNAVAILABLE_MESSAGE:
    "We can't reach the sync server right now, so your progress can't be backed up to your account. Everything you read is still saved safely on this device.",
  SYNC_OFFLINE_TITLE: 'No internet connection',
  SYNC_OFFLINE_MESSAGE:
    "Please check your internet connection. Your progress can't be backed up to your account until you reconnect, but everything you read is still saved safely on this device.",
  SYNC_NOW: 'Sync now',
  SYNCING: 'Syncing…',
  NOT_NOW: 'Not now',
  CONTINUE_OFFLINE: 'Continue offline',

  /**
   * Shown when signing in could not reach the account.
   *
   * After a logout that cleared this device the account's copy is the only one,
   * so an empty screen reads as "my reading is gone". Say plainly that it is
   * safe and that this is a connection problem, and offer the retry.
   */
  RESTORE_FAILED_TITLE: 'Unable to load your progress',
  RESTORE_FAILED_MESSAGE:
    "We couldn't reach your account. Your saved reading is safe — check your internet connection and try again.",
  RESTORE_OFFLINE_MESSAGE:
    'You are offline. Your saved reading is safe and will load automatically as soon as you reconnect.',
  RETRY: 'Retry',
  DATABASE: 'Database',

  // --- login/sync decision flow -------------------------------------------
  // Every dialog below has at most two main buttons; anything destructive is a
  // text link behind its own confirmation.

  /** Case 3 — unowned progress on the device and an account just signed in. */
  SYNC_LOCAL_TITLE: 'Save this progress?',
  SYNC_LOCAL_ACTION: 'Sync to my account',
  DISCARD_LOCAL_LINK: 'Discard this device’s progress',

  /** Case 3 → Discard confirmation. */
  DISCARD_CONFIRM_TITLE: 'Discard this device’s progress?',
  DISCARD_CONFIRM_MESSAGE:
    'This permanently removes the progress saved only on this device and loads your account’s progress instead. If your account has no saved progress, this device will start empty. This cannot be undone.',
  DISCARD_CONFIRM_ACTION: 'Discard',
  DISCARDING: 'Discarding…',
  CANCEL: 'Cancel',

  /**
   * Case 5 — the previous account has work that never reached its cloud.
   * Only this one may mention unsynced progress; the others describe a switch
   * that is fine, so reusing this title would alarm the user for no reason.
   */
  ACCOUNT_SWITCH_TITLE: 'Unsaved progress',
  /** Case 4 — a backed-up account is being replaced, nothing is at risk. */
  SWITCHING_ACCOUNT_TITLE: 'Switching account',
  /** Shown after a silent switch, so the user learns where A's reading went. */
  SWITCHED_ACCOUNT_TITLE: 'Switched account',
  LOADING_PROGRESS: 'Loading your progress…',
  /** The switch could not complete; the previous account is still safe. */
  ACCOUNT_SWITCH_FAILED_TITLE: 'Could not switch',
  /** Recovery blocks the switch until the previous account signs in. */
  ACCOUNT_SWITCH_BLOCKED_TITLE: 'Sign in to continue',
  KEEP_FOR_PREVIOUS: 'Keep it safe',
  ADD_COPY_TO_ACCOUNT: 'Add a copy',

  /** Case 4 — a fully backed-up account was replaced silently. */
  SWITCHED_ACCOUNT_NOTICE: 'progress is saved on this device and returns when you sign in again.',
  SIGNED_IN_AS: 'Signed in as',
  SYNC_ACCOUNT_PROMPT: 'Sync this device with this account?',
  LOGIN_SYNC_TITLE: 'Save your progress',
  LOGIN_SYNC_PROMPT:
    'Log in to sync your paths and settings across your devices, so you never lose your progress.',
  SESSION_EXPIRED_TITLE: 'Session expired',
  /**
   * Two messages, chosen by `isFullyBackedUp` — the same gate logout uses.
   *
   * The difference is not decoration. Signing out stops the outbox, so anything
   * the server has not already confirmed stays on this device alone for as long
   * as the user keeps reading signed out. Telling everyone "your progress is
   * still saved on this device" reads as reassurance in exactly the case where
   * it should read as a warning.
   */
  SESSION_EXPIRED_MESSAGE:
    'Your session has expired. Your reading is saved to your account — log in again to keep syncing across your devices.',
  SESSION_EXPIRED_UNSYNCED_MESSAGE:
    'Your session has expired. Some of your reading is not saved to your account yet — log in again to back it up.',
  CLOSE_MENU: 'Close menu',
  ALL_PATHS: 'All Paths',
  PROGRESS: 'Progress',
  STREAKS: 'Streaks',
  GO_TO_ANG: 'Go To Ang',
  SAVE: 'Save',
  BACK_TO_PATH: 'Back to path',
};
