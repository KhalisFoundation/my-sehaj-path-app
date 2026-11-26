export const PATH_DATA = {
  LAST_ANG_NUMBER: 1430,
  LAST_VERSE_ID: 60403,
  /**
   * The longest path name the server accepts (it validates a name of 1-100
   * characters). A longer one is refused with a 400, which the sync outbox
   * treats as permanent, so the path would never sync and the person would only
   * ever see a "rejected" sync error. Stop it at the keyboard instead.
   */
  MAX_NAME_LENGTH: 100,
};
