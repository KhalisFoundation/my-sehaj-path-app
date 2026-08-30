# Sehaj Path Group Reading Schema

## Agreed direction

Personal and group reading use the same `SehajPath` model. There is no separate
`SharedSehajPath` table.

The former Accountability, Together and Role modes are not stored as separate
modes. The path supports live following and scheduled reading through sessions
and slots.

## Primary-key change and released-app compatibility

### What the API uses today

The production `sehaj_paths` table currently uses two columns as its primary
key:

```prisma
model SehajPath {
  userId String @map("user_id")
  pathId String @map("path_id")

  @@id([userId, pathId])
}
```

That is the first, compatibility-only migration shape. When group support and
account-deletion handling are deployed, `userId` becomes nullable and uses
`ON DELETE SET NULL` so deleting the creator cannot cascade-delete a public
group. Existing, non-deleted personal paths continue to have a `userId`.

`pathId` is the UUID generated and persisted by the app as `serverPathId`.
Every existing API operation combines it with the authenticated account ID.

The same `pathId` can therefore exist under two accounts. This remains important
for released app versions that still have the account-copy flow.

### What will change

Add a new internal UUID and make it the database primary key. Keep the existing
pair as a compound unique key:

```prisma
model SehajPath {
  // New canonical identity for cross-account relations.
  id String @id @default(uuid()) @db.Uuid

  // Existing released-app identity.
  userId String @map("user_id")
  pathId String @map("path_id")

  @@unique([userId, pathId])
  @@index([userId])
}
```

This solves both requirements:

| Requirement | How it is handled |
| --- | --- |
| Existing apps need account-scoped `pathId` | `UNIQUE(userId, pathId)` preserves the current identity and idempotency. |
| Members, slots and sessions need one path identity | They reference the new globally unique `SehajPath.id`. |
| One path is accessible to several accounts | Membership rows point to the same internal `id`. |
| Old Add Copy clients may reuse a UUID in another account | The UUID remains unique only within its account, so it does not collide. |
| Future sharing must not duplicate path progress | One `SehajPath.id` remains the single source of truth. |

Changing which database constraint is the primary key does not require changing
the existing API contract. Prisma still generates the `userId_pathId` compound
selector from `@@unique([userId, pathId])`, so existing service queries can keep
using:

```ts
where: {
  userId_pathId: {
    userId: authenticatedUser.id,
    pathId: submittedPathId,
  },
}
```

### Existing APIs that remain unaffected

All released Sehaj Path APIs retain their current URLs, request bodies, response
bodies, status codes and ownership rules:

| Existing API | Current behaviour after migration |
| --- | --- |
| `GET /sehaj-path/paths` | Returns the authenticated user's existing owner-scoped paths using `userId`. |
| `POST /sehaj-path/paths` | Continues using `userId + pathId` for idempotent creation and retries. |
| `GET /sehaj-path/paths/:pathId` | Continues resolving the legacy `pathId` inside the authenticated account. |
| `PATCH /sehaj-path/paths/:pathId` | Continues updating the authenticated owner's matching legacy path. |
| `DELETE /sehaj-path/paths/:pathId` | Continues soft-deleting the authenticated owner's matching legacy path. |
| `POST /sehaj-path/sync` | Continues merging and returning legacy `pathId` values and `deletedPathIds`. |
| `GET /sehaj-path/settings` | Unaffected; settings remain keyed by `userId`. |
| `PUT /sehaj-path/settings` | Unaffected; settings remain keyed by `userId`. |

The new internal `id` must not replace `pathId` in any existing request or
response. Old apps continue knowing only their legacy `pathId`; the API uses the
internal ID only for new group-reading relations and endpoints.

### Safe migration order

| Phase | Change | Why it is safe |
| --- | --- | --- |
| 1 | Add nullable `id` and backfill every existing path with a UUID. | Existing API versions ignore the extra column. |
| 2 | Add a unique index on `id`, a unique index on `(user_id, path_id)`, and an index on `user_id`. | No request or response behaviour changes. |
| 3 | Deploy Prisma/API code containing `id` while existing endpoints continue using `userId_pathId`. | Old and new API instances can operate during a rolling deployment. |
| 4 | Promote `id` to the primary key and preserve `(user_id, path_id)` as `UNIQUE`. | Existing compound lookups and create idempotency remain available. |
| 5 | Create and backfill owner membership rows. | It adds group authorization without modifying existing path data. |
| 6 | Deploy new accessible-path, membership, slot and session APIs. | Only the new app calls them; released APIs stay unchanged. |

Before the primary-key swap, verify that every row has a non-null, unique
internal ID. Do not drop the compound unique key later; it is the compatibility
contract for released clients.

## Sharing types

| Sharing type | Meaning | Membership |
| --- | --- | --- |
| `PERSONAL` | The path is private to its owner. | Only the creator/owner has access. |
| `PUBLIC` | The path supports group reading. People find it through an invite link, request access, and an admin approves or denies them. | Active admins and members can access it. |

`PUBLIC` means group-enabled; it does not make the path searchable or allow
anonymous access. A valid invite reveals only enough information to request
access, and membership status still controls access to the path itself. A
future browse/search feature can reuse the same request-and-approval flow
without changing the path or membership models.

## Member roles

| Role | Responsibilities |
| --- | --- |
| `ADMIN` | Approves or denies requests, manages members, creates or cancels slots, grants admin access and manages the path. The creator starts as an admin. |
| `MEMBER` | Participates in the path, follows active reading and can read during an assigned slot. |

Admin and reader are separate concepts. An admin manages the group, but the
active reader can be any eligible member, including an admin.

## Member statuses

| Status | Meaning |
| --- | --- |
| `REQUESTED` | The user asked to join and is waiting for an admin decision. |
| `ACTIVE` | The user was approved and can access the path. |
| `DENIED` | An admin denied the join request. |
| `REMOVED` | The user previously had access but an admin removed it. |

## Slot statuses

| Status | Meaning |
| --- | --- |
| `SCHEDULED` | A future reading slot is assigned to a member. |
| `ACTIVE` | The scheduled member is currently reading. |
| `COMPLETED` | The slot finished successfully. |
| `CANCELLED` | The slot was cancelled and cannot be started. |

## Session statuses

| Status | Meaning |
| --- | --- |
| `WAITING` | A reading session exists but has not started. |
| `LIVE` | The assigned reader is driving the path and other participants follow. |
| `ENDED` | The live reading session finished normally. |
| `CANCELLED` | The session was cancelled before normal completion. |

## Reading behaviour

Scheduling and live following are behaviours inside one public sharing type;
they are not separate path modes.

| Situation | Reader | Other active members |
| --- | --- | --- |
| No live session | Nobody is driving shared progress. | Members can open the path normally, subject to product permissions. |
| Scheduled slot starts | The member assigned to the slot becomes the active reader. | They follow the active reader's Ang, panktee and scroll position. |
| Admin is assigned a slot | The admin is the active reader for that session. | Other members follow exactly as they would follow any member. |
| Member has no slot while another session is live | The scheduled member remains the reader. | The unscheduled member joins as a follower and cannot drive progress. |
| Session ends | The final durable checkpoint is saved to the shared path. | Everyone sees the updated shared progress. |

## Prisma schema

```prisma
enum SehajPathSharing {
  PERSONAL
  PUBLIC
}

enum SehajPathMemberRole {
  ADMIN
  MEMBER
}

enum SehajPathMemberStatus {
  REQUESTED
  ACTIVE
  DENIED
  REMOVED
}

enum SehajPathSlotStatus {
  SCHEDULED
  ACTIVE
  COMPLETED
  CANCELLED
}

enum SehajPathSessionStatus {
  WAITING
  LIVE
  ENDED
  CANCELLED
}

enum DevicePlatform {
  IOS
  ANDROID
}

model SehajPath {
  // Canonical internal identity used by memberships, slots and sessions.
  id String @id @default(uuid()) @db.Uuid

  // Existing released-app identity. userId is nullable only so a PUBLIC path
  // can survive its creator deleting their account.
  userId String? @map("user_id")
  pathId String  @map("path_id")

  name           String
  angNumber      Int     @default(0) @map("ang_number")
  verseId        Int     @default(0) @map("verse_id")
  progress       Float   @default(0)
  scrollPosition Int     @default(0) @map("scroll_position")
  readDates      Json    @map("read_dates")
  startDate      BigInt  @map("start_date")
  completionDate BigInt? @map("completion_date")
  createdAt      BigInt  @map("created_at")
  updatedAt      BigInt  @map("updated_at")
  deletedAt      BigInt? @map("deleted_at")

  sharing                SehajPathSharing @default(PERSONAL)
  collaborationEnabledAt DateTime?        @map("collaboration_enabled_at")
  stateVersion            Int              @default(0) @map("state_version")

  owner    User?              @relation("SehajPathLegacyOwner", fields: [userId], references: [id], onDelete: SetNull)
  members  SehajPathMember[]
  invites  SehajPathInvite[]
  slots    SehajPathSlot[]
  sessions SehajPathSession[]

  // Keeps existing app/API identity and account-scoped idempotency.
  @@unique([userId, pathId])
  @@index([userId])
  @@index([sharing, deletedAt])
  @@map("sehaj_paths")
}

model SehajPathMember {
  id String @id @default(uuid()) @db.Uuid

  sehajPathId String @map("sehaj_path_id") @db.Uuid
  // Keep the membership/history row if the account is deleted. Account
  // deletion sets this to null and anonymizes displayLabel.
  userId      String? @map("user_id")
  displayLabel String @default("Member") @map("display_label")

  inviteId String? @map("invite_id") @db.Uuid

  role   SehajPathMemberRole   @default(MEMBER)
  status SehajPathMemberStatus @default(REQUESTED)

  requestedAt DateTime  @default(now()) @map("requested_at")
  reviewedAt  DateTime? @map("reviewed_at")
  reviewedByMemberId String? @map("reviewed_by_member_id") @db.Uuid
  joinedAt    DateTime? @map("joined_at")
  removedAt   DateTime? @map("removed_at")

  path SehajPath @relation(fields: [sehajPathId], references: [id], onDelete: Cascade)
  user User?     @relation("SehajPathMemberUser", fields: [userId], references: [id], onDelete: SetNull)
  invite SehajPathInvite? @relation("MembershipInvite", fields: [inviteId], references: [id], onDelete: SetNull)
  reviewedByMember SehajPathMember? @relation("MembershipReviews", fields: [reviewedByMemberId], references: [id], onDelete: SetNull)
  reviewedMembers SehajPathMember[] @relation("MembershipReviews")

  scheduledSlots  SehajPathSlot[]
  readingSessions SehajPathSession[]
  createdInvites  SehajPathInvite[] @relation("InviteCreator")
  readingDays     SehajPathMemberReadingDay[]

  @@unique([sehajPathId, userId])
  @@index([userId, status])
  @@index([sehajPathId, role, status])
  @@map("sehaj_path_members")
}

model SehajPathMemberReadingDay {
  id String @id @default(uuid()) @db.Uuid

  memberId String   @map("member_id") @db.Uuid
  localDate DateTime @map("local_date") @db.Date
  timezone  String

  // Time is accumulated from meaningful reader/follower participation, not
  // merely from opening the screen.
  readingSeconds Int      @default(0) @map("reading_seconds")
  lastReadAt     DateTime @map("last_read_at")

  member SehajPathMember @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@unique([memberId, localDate])
  @@index([localDate])
  @@map("sehaj_path_member_reading_days")
}

model SehajPathInvite {
  id String @id @default(uuid()) @db.Uuid

  sehajPathId      String  @map("sehaj_path_id") @db.Uuid
  createdByMemberId String? @map("created_by_member_id") @db.Uuid

  // The URL contains a high-entropy raw token. Store only its hash.
  tokenHash String @unique @map("token_hash")

  expiresAt DateTime? @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  createdAt DateTime  @default(now()) @map("created_at")

  path SehajPath @relation(fields: [sehajPathId], references: [id], onDelete: Cascade)
  createdBy SehajPathMember? @relation("InviteCreator", fields: [createdByMemberId], references: [id], onDelete: SetNull)
  memberships SehajPathMember[] @relation("MembershipInvite")

  @@index([sehajPathId, revokedAt])
  @@map("sehaj_path_invites")
}

model SehajPathSlot {
  id String @id @default(uuid()) @db.Uuid

  sehajPathId   String @map("sehaj_path_id") @db.Uuid
  readerMemberId String? @map("reader_member_id") @db.Uuid
  readerLabel    String  @default("Member") @map("reader_label")

  startsAt DateTime @map("starts_at")
  endsAt   DateTime @map("ends_at")
  status   SehajPathSlotStatus @default(SCHEDULED)

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  path   SehajPath       @relation(fields: [sehajPathId], references: [id], onDelete: Cascade)
  reader SehajPathMember? @relation(fields: [readerMemberId], references: [id], onDelete: SetNull)

  sessions SehajPathSession[]

  @@index([sehajPathId, startsAt])
  @@index([readerMemberId, startsAt])
  @@map("sehaj_path_slots")
}

model SehajPathSession {
  id String @id @default(uuid()) @db.Uuid

  sehajPathId    String  @map("sehaj_path_id") @db.Uuid
  slotId         String? @map("slot_id") @db.Uuid
  readerMemberId String? @map("reader_member_id") @db.Uuid
  readerLabel    String  @default("Member") @map("reader_label")

  status SehajPathSessionStatus @default(WAITING)

  startedAt DateTime? @map("started_at")
  endedAt   DateTime? @map("ended_at")

  currentAng     Int       @default(0) @map("current_ang")
  currentVerseId Int       @default(0) @map("current_verse_id")
  scrollPosition Int       @default(0) @map("scroll_position")
  sequence       BigInt    @default(0)
  checkpointedAt DateTime? @map("checkpointed_at")

  path   SehajPath       @relation(fields: [sehajPathId], references: [id], onDelete: Cascade)
  slot   SehajPathSlot?  @relation(fields: [slotId], references: [id], onDelete: SetNull)
  reader SehajPathMember? @relation(fields: [readerMemberId], references: [id], onDelete: SetNull)

  @@index([sehajPathId, status])
  @@index([readerMemberId, status])
  @@map("sehaj_path_sessions")
}

model DeviceToken {
  id String @id @default(uuid()) @db.Uuid

  userId   String         @map("user_id")
  deviceId String         @map("device_id")
  token    String         @unique
  platform DevicePlatform

  // IANA name such as Asia/Kolkata. Slots remain UTC; this controls display,
  // reminders and the member's local reading day.
  timezone String?

  revokedAt DateTime? @map("revoked_at")
  lastSeenAt DateTime @default(now()) @map("last_seen_at")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, deviceId, platform])
  @@index([userId, revokedAt])
  @@map("device_tokens")
}

// Add these reverse relations to the existing User model. Do not create a
// second User model.
model User {
  // ...existing fields and relations...
  ownedSehajPaths       SehajPath[]       @relation("SehajPathLegacyOwner")
  sehajPathMemberships SehajPathMember[] @relation("SehajPathMemberUser")
  deviceTokens          DeviceToken[]
}
```

## Main flows

### Creating a path

| Step | Database action |
| --- | --- |
| Create the path | Insert one `SehajPath`, initially `PERSONAL`. |
| Create owner access | Insert one `SehajPathMember` with `ADMIN` and `ACTIVE`. |
| Enable group reading | Update the same path to `PUBLIC`; do not create another path. |

### Joining a public path

| Step | Database action |
| --- | --- |
| Admin shares a link | Create or reuse a `SehajPathInvite`; put the opaque raw token in the link and store only its hash. |
| User opens the link | Resolve an unexpired, non-revoked invite and show limited path information. This does not grant access. |
| User requests access | Insert or reactivate one member row with `REQUESTED` and associate the invite used. |
| Admin approves | Update the same row to `ACTIVE`, set `reviewedAt` and `joinedAt`. |
| Admin denies | Update the same row to `DENIED`. |
| Admin removes a member | Update the same row to `REMOVED` and set `removedAt`. |

Approving a request never inserts another `SehajPath` row.

When a `DENIED` or `REMOVED` member requests again, the update must explicitly
set `requestedAt = now()`, clear `reviewedAt`, `reviewedByMemberId`, `joinedAt`
and `removedAt`, and reset the role to `MEMBER`. `@default(now())` runs only on
insert and cannot refresh a reactivated request by itself.

### Invite-link APIs

| API | Purpose |
| --- | --- |
| `POST /sehaj-path/paths/:id/invites` | An active admin creates or reuses a share link. |
| `GET /sehaj-path/invites/:token` | Resolves a valid link to limited path metadata; it does not grant membership. |
| `POST /sehaj-path/invites/:token/request` | Creates or reactivates the caller's `REQUESTED` membership. |
| `DELETE /sehaj-path/paths/:id/invites/:inviteId` | An active admin revokes a link without changing existing memberships. |

There is deliberately no `INVITED` member status. The invite finds the path;
`REQUESTED` records the user's access request. Tokens must be high entropy,
compared by hash, revocable, and optionally expiring.

## How one Sehaj Path row is shared

Suppose User A creates a path and Users B and C later join it. The database does
not create three copies of the path.

`sehaj_paths` contains one row:

| id | user_id (owner) | path_id (legacy UUID) | name | sharing | ang_number |
| --- | --- | --- | --- | --- | --- |
| `path-100` | `user-a` | `legacy-uuid-a` | Family Sehaj Path | `PUBLIC` | 125 |

`sehaj_path_members` contains the access records:

| id | sehaj_path_id | user_id | role | status |
| --- | --- | --- | --- | --- |
| `member-1` | `path-100` | `user-a` | `ADMIN` | `ACTIVE` |
| `member-2` | `path-100` | `user-b` | `MEMBER` | `ACTIVE` |
| `member-3` | `path-100` | `user-c` | `MEMBER` | `REQUESTED` |

This means:

- User A owns and administers `path-100`.
- User B reads the same `path-100` row.
- User C cannot access it until an admin approves the request.
- The shared progress remains once on `sehaj_paths`; it is not copied into each
  account.

When User C requests access, the only new row is their membership row with
`REQUESTED`. Approval updates that same row to `ACTIVE`:

```sql
UPDATE sehaj_path_members
SET status = 'ACTIVE',
    reviewed_at = NOW(),
    reviewed_by_member_id = :admin_member_id,
    joined_at = NOW()
WHERE sehaj_path_id = :sehaj_path_id
  AND user_id = :requesting_user_id
  AND status = 'REQUESTED';
```

The approval transaction must also verify that the acting user has an active
`ADMIN` membership for the same path. The update should affect exactly one row;
otherwise the request was already handled or does not exist.

No `INSERT` or `UPDATE` is needed in `sehaj_paths` when a request is approved.
The path changes only when its actual metadata or reading progress changes.

### Account deletion without destroying a group

The account-deletion service must handle paths before deleting the `User` row:

| Situation | Required action |
| --- | --- |
| The user owns a `PERSONAL` path | Apply the existing personal-path deletion policy. No other account depends on it. |
| The user created a `PUBLIC` path and another active admin exists | Set the path's legacy `userId` to null and remove/anonymize the departing user's membership. The group continues. |
| The user created a `PUBLIC` path, with active members but no other admin | Promote one member in the same transaction, then clear `userId` and remove/anonymize the departing member. Product should allow manual transfer first; deterministic oldest-active-member promotion is the safety fallback. |
| The user created a `PUBLIC` path with no other active member | Delete the abandoned path and its group records. |
| Any member deletes their account | Set their membership `userId` to null, change it to `REMOVED`, clear personal data, and retain only an anonymous history label. |

Slots and sessions use nullable `readerMemberId` with `ON DELETE SET NULL` and
store `readerLabel`, so historical reading remains understandable without
blocking account deletion. This removes the invalid Cascade-to-Restrict chain.
Deleting a path itself still cascades to its group-only records.

The existing delete and sync APIs remain the deletion contract. This design
does **not** add a restore endpoint, Recently Deleted endpoint, retention API or
automatic restoration flow.

### Scheduling and reading

| Step | Database action |
| --- | --- |
| Member schedules a slot | Insert `SehajPathSlot` for that active member. |
| Slot begins | Mark the slot `ACTIVE` and create a `LIVE` session. |
| Reader scrolls | Broadcast through WebSocket/Redis; periodically checkpoint the session. |
| Other members join | Treat them as followers; no additional Sehaj Path is created. |
| Session finishes | Mark the session and slot completed, then update the original path's durable progress. |

### Who receives a reading day

Shared path progress and a person's streak are different data:

| Participant behaviour | Reading-day result |
| --- | --- |
| Active reader makes meaningful progress | Record/accumulate that member's local reading day. |
| Follower remains connected and meaningfully follows the live reading | Record/accumulate that follower's local reading day. |
| Member only opens the screen or immediately leaves | Do not award a reading day. |
| Member is not present during the session | Do not award a reading day. |

`SehajPathMemberReadingDay` stores this per-person history without copying the
shared path. The server should accumulate bounded participation heartbeats and
use the IANA timezone captured for that activity. The exact minimum meaningful
duration is a product constant, not a schema rule. `SehajPath.readDates` remains
for the released personal-path contract; new public-path streaks use member
reading-day rows rather than mutating one group-level JSON array concurrently.

### Push notifications and timezone

`DeviceToken` is required for join-request alerts, approvals, slot reminders
and "your turn" notifications. Register or refresh it after authentication,
revoke it on logout or invalid-token feedback, and update `lastSeenAt` and the
device's IANA timezone when the app becomes active. Slot/session timestamps stay
in UTC; timezone is used for display, reminders and personal reading days.

## Fetching personal and joined paths

### Keep the released endpoint unchanged

Released apps currently treat every item returned by `GET /sehaj-path/paths` as
a path owned by the signed-in user. Returning joined paths from that endpoint
would let an old app treat shared progress as personal progress and attempt an
owner-only update or delete.

Keep this endpoint owner-scoped:

```http
GET /sehaj-path/paths
```

```ts
where: {
  userId: authenticatedUser.id,
  deletedAt: null,
}
```

### Add one endpoint for the new app

The new app should fetch every accessible path through a new endpoint:

```http
GET /sehaj-path/paths/accessible
```

It returns:

- Paths owned by the authenticated user.
- Public paths where the authenticated user has an `ACTIVE` membership.
- Each physical `SehajPath` only once, even when its owner also has an owner
  membership row.
- The caller's role and relationship alongside the path.

Conceptual Prisma query:

```ts
const rows = await prisma.sehajPath.findMany({
  where: {
    deletedAt: null,
    OR: [
      { userId: authenticatedUser.id },
      {
        sharing: 'PUBLIC',
        members: {
          some: {
            userId: authenticatedUser.id,
            status: 'ACTIVE',
          },
        },
      },
    ],
  },
  include: {
    members: {
      where: {
        userId: authenticatedUser.id,
        status: 'ACTIVE',
      },
      select: {
        role: true,
        status: true,
      },
    },
  },
  orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
});
```

SQL/Prisma returns a Sehaj Path row once even if both sides of the `OR` match.
The API then adds access information to the response:

```json
{
  "id": "path-100",
  "legacyPathId": "legacy-uuid-a",
  "name": "Family Sehaj Path",
  "sharing": "PUBLIC",
  "access": {
    "relationship": "OWNER",
    "role": "ADMIN"
  },
  "progress": {
    "angNumber": 125,
    "verseId": 20,
    "scrollPosition": 480
  }
}
```

For User B, the same path is returned with:

```json
{
  "id": "path-100",
  "legacyPathId": "legacy-uuid-a",
  "name": "Family Sehaj Path",
  "sharing": "PUBLIC",
  "access": {
    "relationship": "JOINED",
    "role": "MEMBER"
  }
}
```

Both responses represent the same database row and therefore the same shared
progress.

### Requests awaiting approval

Pending requests should not be mixed into the accessible-path response. The new
app can fetch them separately:

```http
GET /sehaj-path/join-requests/mine
```

Admins can fetch requests for a path through:

```http
GET /sehaj-path/paths/:id/join-requests
```

Only an active `ADMIN` member of that same path may call the admin endpoint.

### API identity rules

| API family | Path identifier | Purpose |
| --- | --- | --- |
| Existing personal APIs | Legacy `pathId`, scoped by authenticated owner | Keeps released apps working. |
| New accessible/group APIs | Internal `SehajPath.id` | Stable identity shared by owner, admins and members. |
| Membership, slot and session APIs | Internal `SehajPath.id` | Prevents account-specific copies and ambiguous relations. |

The app should keep the legacy local mapping for existing personal sync and add
the internal ID to its new group-path state. It must not overwrite an existing
`serverPathId` with the internal group ID.

## Required database constraints

Prisma cannot express every PostgreSQL constraint required for this flow. Add
the following through reviewed SQL migrations. The one-live-session rule is a
partial unique index, not a normal compound unique constraint:

```sql
CREATE UNIQUE INDEX sehaj_path_one_live_session
  ON sehaj_path_sessions (sehaj_path_id)
  WHERE status = 'LIVE';

ALTER TABLE sehaj_path_slots
  ADD CONSTRAINT sehaj_path_slot_time_order
  CHECK (ends_at > starts_at);
```

Also enforce these transaction rules:

- Active slots for the same path must not overlap. Use a PostgreSQL exclusion
  constraint or serialize slot creation for that path.
- A slot/session reader must be an `ACTIVE` member of that same path. Enforce it
  in the write transaction (or with a database trigger), because a foreign key
  to member ID alone cannot prove same-path membership and active status.
- Only an active admin of that same path can approve/deny requests, manage
  invites, remove members, grant admin access or create/cancel slots.
- Approval must use `WHERE status = 'REQUESTED'` and affect exactly one row.
- Account deletion and fallback-admin promotion must be one transaction, so a
  public path is never left with members but no active admin.

Live scrolling should not write every event to PostgreSQL. Use WebSocket/Redis
for transient events and write throttled recovery checkpoints to
`SehajPathSession`.

## Compatibility with released apps

Existing APIs continue to use authenticated `userId + pathId`. New public-path
APIs use the internal `SehajPath.id`.

The internal ID must never replace the existing `pathId` in old request or
response bodies. Keeping `@@unique([userId, pathId])` preserves existing create,
update, delete and sync behavior, including older app versions that still have
the account-copy option.
