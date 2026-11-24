import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn
} from 'drizzle-orm/pg-core';
import { user } from './auth.schema.ts';

// App tables. Every table is scoped to its owner through `userId`.

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const owner = () =>
  text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' });

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull()
};

export const category = pgTable(
  'category',
  {
    id: id(),
    userId: owner(),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    ...timestamps
  },
  (t) => [uniqueIndex('category_user_name_uq').on(t.userId, t.name)]
);

export const folder = pgTable(
  'folder',
  {
    id: id(),
    userId: owner(),
    /** Null for root folders. */
    parentId: text('parent_id').references((): AnyPgColumn => folder.id, { onDelete: 'cascade' }),
    /** Set only for root folders. */
    categoryId: text('category_id').references(() => category.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps
  },
  (t) => [
    index('folder_user_parent_idx').on(t.userId, t.parentId),
    index('folder_user_category_idx').on(t.userId, t.categoryId),
    // Names are unique among live siblings: root folders per category, subfolders per parent.
    uniqueIndex('folder_root_name_uq')
      .on(t.userId, t.categoryId, t.name)
      .where(sql`${t.parentId} is null and ${t.deletedAt} is null`),
    uniqueIndex('folder_child_name_uq')
      .on(t.userId, t.parentId, t.name)
      .where(sql`${t.parentId} is not null and ${t.deletedAt} is null`)
  ]
);

export const file = pgTable(
  'file',
  {
    id: id(),
    userId: owner(),
    folderId: text('folder_id')
      .notNull()
      .references(() => folder.id, { onDelete: 'cascade' }),
    /** Display name; duplicates allowed. */
    name: text('name').notNull(),
    /** R2 object key, `userObjectKey(userId, fileId)`. */
    key: text('key').notNull().unique(),
    size: bigint('size', { mode: 'number' }).notNull(),
    contentType: text('content_type').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps
  },
  (t) => [index('file_user_folder_idx').on(t.userId, t.folderId)]
);

export type CompletedPart = { partNumber: number; etag: string };

export const uploadSession = pgTable(
  'upload_session',
  {
    id: id(),
    userId: owner(),
    folderId: text('folder_id')
      .notNull()
      .references(() => folder.id, { onDelete: 'cascade' }),
    /** Id of the `file` row created when the upload completes; also names the R2 key. */
    fileId: text('file_id').notNull(),
    key: text('key').notNull(),
    uploadId: text('upload_id').notNull(),
    fileName: text('file_name').notNull(),
    size: bigint('size', { mode: 'number' }).notNull(),
    lastModified: bigint('last_modified', { mode: 'number' }).notNull(),
    contentType: text('content_type').notNull(),
    partSize: integer('part_size').notNull(),
    completedParts: jsonb('completed_parts').$type<CompletedPart[]>().notNull().default([]),
    status: text('status', { enum: ['uploading', 'paused'] })
      .notNull()
      .default('uploading'),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow().notNull(),
    ...timestamps
  },
  (t) => [
    index('upload_session_user_idx').on(t.userId),
    index('upload_session_activity_idx').on(t.lastActivityAt)
  ]
);

export const share = pgTable(
  'share',
  {
    id: id(),
    userId: owner(),
    /** Random, URL-safe, ≥ 128 bits. */
    token: text('token').notNull().unique(),
    kind: text('kind', { enum: ['file', 'listing'] }).notNull(),
    title: text('title').notNull(),
    /** Set when a single folder was shared. */
    rootFolderId: text('root_folder_id').references(() => folder.id, { onDelete: 'set null' }),
    /** Null = until unshared. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps
  },
  (t) => [index('share_user_idx').on(t.userId)]
);

export const shareItem = pgTable(
  'share_item',
  {
    shareId: text('share_id')
      .notNull()
      .references(() => share.id, { onDelete: 'cascade' }),
    fileId: text('file_id')
      .notNull()
      .references(() => file.id, { onDelete: 'cascade' })
  },
  (t) => [
    uniqueIndex('share_item_pk').on(t.shareId, t.fileId),
    index('share_item_file_idx').on(t.fileId)
  ]
);

export const itemAccess = pgTable(
  'item_access',
  {
    id: id(),
    userId: owner(),
    itemType: text('item_type', { enum: ['file', 'folder'] }).notNull(),
    itemId: text('item_id').notNull(),
    openCount: integer('open_count').notNull().default(0),
    lastOpenedAt: timestamp('last_opened_at', { withTimezone: true }).defaultNow().notNull(),
    ...timestamps
  },
  (t) => [
    uniqueIndex('item_access_user_item_uq').on(t.userId, t.itemType, t.itemId),
    index('item_access_user_opened_idx').on(t.userId, t.lastOpenedAt)
  ]
);

export * from './auth.schema.ts';
