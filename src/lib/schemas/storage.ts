import * as v from 'valibot';
import { FILE_KINDS } from '#lib/file-kind.ts';

// Shared by remote functions (server validation) and forms (client `preflight`).
// Remote modules cannot export schemas, so they live here.

export const ZIP_PART_MAX_BYTES = 100 * 1024 * 1024;
export const BIN_RETENTION_DAYS = 30;
export const RECENT_LIMIT = 1000;
export const CLIENT_MODE_MAX_ROWS = 500;
export const SHARE_EXPIRY_OPTIONS = ['1d', '3d', '7d', 'never'] as const;
export type ShareExpiry = (typeof SHARE_EXPIRY_OPTIONS)[number];

export const idSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(64));

export const categoryNameSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1, 'Enter a category name.'),
  v.maxLength(50, 'Use 50 characters or fewer.')
);

export const itemNameSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1, 'Enter a name.'),
  v.maxLength(100, 'Use 100 characters or fewer.'),
  v.check((name) => name !== '.' && name !== '..', 'A name can’t be . or ..'),
  v.check((name) => !name.includes('/'), 'A name can’t contain /')
);

/** A file name may be longer than a folder name, but follows the same rules otherwise. */
export const fileNameSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1, 'Enter a name.'),
  v.maxLength(255, 'Use 255 characters or fewer.'),
  v.check((name) => name !== '.' && name !== '..', 'A name can’t be . or ..'),
  v.check((name) => !name.includes('/'), 'A name can’t contain /')
);

export const itemTypeSchema = v.picklist(['file', 'folder']);
export type ItemType = v.InferOutput<typeof itemTypeSchema>;

/** A selection of files and folders, as sent by the selection toolbar. */
export const selectionSchema = v.object({
  fileIds: v.pipe(v.array(idSchema), v.maxLength(5000)),
  folderIds: v.pipe(v.array(idSchema), v.maxLength(5000))
});
export type Selection = v.InferOutput<typeof selectionSchema>;

export const newCategorySchema = v.object({ name: categoryNameSchema });

export const newFolderSchema = v.object({
  name: itemNameSchema,
  /** Root folder: the category it belongs to. */
  categoryId: v.optional(idSchema),
  /** Subfolder: its parent. */
  parentId: v.optional(idSchema)
});

export type SignInFailure = 'invalid' | 'banned' | 'rateLimited';

export const signInSchema = v.object({
  identifier: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter your username or email.')),
  _password: v.pipe(v.string(), v.minLength(1, 'Enter your password.')),
  redirectTo: v.optional(v.string(), '/')
});

const sortSchema = v.object({ id: v.pipe(v.string(), v.maxLength(64)), desc: v.boolean() });

/** Arguments of a data-table query: search text, sorts, and the page to load. */
export const tableQuerySchema = v.object({
  search: v.optional(v.pipe(v.string(), v.maxLength(200)), ''),
  sorts: v.optional(v.pipe(v.array(sortSchema), v.maxLength(8)), []),
  page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
  pageSize: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(500)), 50)
});
export type TableQuery = v.InferOutput<typeof tableQuerySchema>;

/** Recent page: the table query plus its Type and Last opened filters. */
export const recentQuerySchema = v.object({
  ...tableQuerySchema.entries,
  kinds: v.optional(v.pipe(v.array(v.picklist(FILE_KINDS)), v.maxLength(FILE_KINDS.length)), []),
  /** Epoch ms, inclusive. */
  openedFrom: v.optional(v.pipe(v.number(), v.integer())),
  /** Epoch ms, exclusive. */
  openedTo: v.optional(v.pipe(v.number(), v.integer()))
});
export type RecentQuery = v.InferOutput<typeof recentQuerySchema>;
