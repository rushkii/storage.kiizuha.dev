# Data Model

This document lists the app tables. Better Auth tables live in `src/lib/server/db/auth.schema.ts`; app tables live in `src/lib/server/db/schema.ts`. Every schema change follows the migration steps in `CLAUDE.md` (never `db:push`).

All tables have `userId` (FK → `user.id`, cascade delete) so every query is scoped to the signed-in user, and `createdAt` / `updatedAt` timestamps.

## category

| Column | Notes |
| ------ | ----- |
| `id` | PK |
| `name` | unique per user |
| `position` | sidebar order |

## folder

| Column | Notes |
| ------ | ----- |
| `id` | PK |
| `parentId` | FK → `folder.id`, null for root folders |
| `categoryId` | FK → `category.id`, set only for root folders |
| `name` | unique among siblings (same category or same parent) |
| `deletedAt` | null unless in the bin |

## file

| Column | Notes |
| ------ | ----- |
| `id` | PK |
| `folderId` | FK → `folder.id` |
| `name` | display name; duplicates allowed |
| `key` | R2 object key, `userObjectKey(userId, fileId)`. Built from the id, not the name, so rename and move only touch the DB. |
| `size` | bytes |
| `contentType` | |
| `deletedAt` | null unless in the bin |

## upload_session

One row per unfinished multipart upload. See [upload-flow.md](upload/upload-flow.md).

| Column | Notes |
| ------ | ----- |
| `id` | PK |
| `folderId` | target folder |
| `key`, `uploadId` | R2 multipart upload |
| `fileName`, `size`, `lastModified`, `contentType` | used to verify a re-selected file |
| `partSize` | fixed for the whole upload (R2 requires equal part sizes) |
| `completedParts` | jsonb `{ partNumber, etag }[]` |
| `status` | `uploading` \| `paused` |
| `lastActivityAt` | updated on every completed part; drives the 7-day cleanup |

## share

| Column | Notes |
| ------ | ----- |
| `id` | PK |
| `token` | unique, random, URL-safe (≥ 128 bits) |
| `kind` | `file` (single file, raw download) \| `listing` (folder or multi-item share) |
| `title` | shown on the public page and in What I shared |
| `rootFolderId` | set when a single folder was shared |
| `expiresAt` | null = until unshared |
| `revokedAt` | set on unshare |

## share_item

| Column | Notes |
| ------ | ----- |
| `shareId` | FK → `share.id`, cascade delete |
| `fileId` | FK → `file.id`, cascade delete |

Files are the only shared unit. Subfolders on the public page are derived from the shared files' folders.

## item_access

Tracks opens for Recent. See [recent-page.md](recent/recent-page.md).

| Column | Notes |
| ------ | ----- |
| `itemType` | `file` \| `folder` |
| `itemId` | |
| `openCount` | |
| `lastOpenedAt` | |

Unique on `(userId, itemType, itemId)`.

## Scheduled jobs

| Job | Rule |
| --- | ---- |
| Purge bin | Items with `deletedAt` older than 30 days: delete R2 objects, then rows. |
| Abort stale uploads | `upload_session` with `lastActivityAt` older than 7 days: `abortMultipartUpload`, then delete the row. |
| Expire shares | No job needed: expired shares are filtered at read time. |

TODO(decide): how jobs are scheduled (in-process interval, system cron, or Cloudflare Cron Trigger).
