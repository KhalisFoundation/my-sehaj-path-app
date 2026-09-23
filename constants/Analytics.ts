/**
 * Shared-path analytics deliberately describe the action, never the person or
 * path. Keeping this in one map prevents a screen from inventing a near-match
 * event name that splits the same action into separate Firebase reports.
 */
export const SharedPathAnalytics = {
  INVITE_CREATE: { category: 'SharedPathInvite', label: 'create new link' },
  INVITE_COPY: { category: 'SharedPathInvite', label: 'copy link' },
  INVITE_SHARE: { category: 'SharedPathInvite', label: 'share link' },
  JOIN: { category: 'SharedPathJoin', label: 'join path' },
  MEMBER_ADD: { category: 'SharedPathMember', label: 'add member' },
  MEMBER_REMOVE: { category: 'SharedPathMember', label: 'remove member' },
  MEMBER_MAKE_ADMIN: { category: 'SharedPathMember', label: 'make admin' },
  MEMBER_REMOVE_ADMIN: { category: 'SharedPathMember', label: 'remove admin' },
  MEMBER_LEAVE: { category: 'SharedPathMember', label: 'leave path' },
  TURN_ADD: { category: 'SharedPathTurn', label: 'add turn' },
  TURN_DELETE: { category: 'SharedPathTurn', label: 'delete turn' },
  READ_ALONG: { category: 'SharedPathReading', label: 'read along' },
  TAKEOVER: { category: 'SharedPathReading', label: 'take over reading' },
  FINISH: { category: 'SharedPathReading', label: 'finish reading' },
} as const;

export type SharedPathAnalyticsEvent = keyof typeof SharedPathAnalytics;
