import { and, asc, count, eq, inArray, isNull, max } from 'drizzle-orm';
import { db } from '#server/db/index.ts';
import { category, file, folder, itemAccess } from '#server/db/schema.ts';
import { fileKindOf, type FileKind } from '#lib/file-kind.ts';
import type { Selection, TableQuery } from '#lib/schemas/storage.ts';
import { UserFacingError, isForeignKeyViolation, isUniqueViolation } from './errors.ts';
import { loadFolderIndex, type FolderIndex } from './folder-index.ts';
import {
  applyTableQuery,
  compareDate,
  compareNumber,
  compareText,
  type TablePage
} from './table-query.ts';

// ---------------------------------------------------------------------------------------------
// Sidebar and categories
// ---------------------------------------------------------------------------------------------

export type SidebarData = {
  showRecent: boolean;
  categories: {
    id: string;
    name: string;
    folders: { id: string; name: string }[];
  }[];
};

/**
 * Sidebar data: the user's categories in their saved order, each with its live root folders
 * sorted by name. `showRecent` is true once the user has opened at least one item.
 */
export const getSidebar = async (userId: string): Promise<SidebarData> => {
  const [categories, roots, [{ opened }]] = await Promise.all([
    db
      .select({ id: category.id, name: category.name })
      .from(category)
      .where(eq(category.userId, userId))
      .orderBy(asc(category.position), asc(category.name)),
    db
      .select({ id: folder.id, name: folder.name, categoryId: folder.categoryId })
      .from(folder)
      .where(and(eq(folder.userId, userId), isNull(folder.parentId), isNull(folder.deletedAt))),
    db.select({ opened: count() }).from(itemAccess).where(eq(itemAccess.userId, userId))
  ]);

  return {
    showRecent: opened > 0,
    categories: categories.map((cat) => ({
      ...cat,
      folders: roots
        .filter((root) => root.categoryId === cat.id)
        .map(({ id, name }) => ({ id, name }))
        .sort((a, b) => compareText(a.name, b.name))
    }))
  };
};

/**
 * Appends a category after the user's last one.
 * @throws {UserFacingError} When the user already has a category with this name.
 */
export const createCategory = async (userId: string, name: string) => {
  const [{ last }] = await db
    .select({ last: max(category.position) })
    .from(category)
    .where(eq(category.userId, userId));
  try {
    const [row] = await db
      .insert(category)
      .values({ userId, name, position: (last ?? -1) + 1 })
      .returning({ id: category.id, name: category.name });
    return row;
  } catch (error) {
    if (isUniqueViolation(error))
      throw new UserFacingError(`A category named “${name}” already exists.`);
    throw error;
  }
};

/**
 * Renames one of the user's categories.
 * @throws {UserFacingError} 404 when the category is gone or not the user's; 400 when the name
 * is already used by another of their categories.
 */
export const renameCategory = async (userId: string, categoryId: string, name: string) => {
  try {
    const rows = await db
      .update(category)
      .set({ name })
      .where(and(eq(category.id, categoryId), eq(category.userId, userId)))
      .returning({ id: category.id });
    if (!rows.length) throw new UserFacingError('This category no longer exists.', 404);
  } catch (error) {
    if (isUniqueViolation(error))
      throw new UserFacingError(`A category named “${name}” already exists.`);
    throw error;
  }
};

/**
 * Deletes a category. Only an empty category can be deleted: folders in the bin still count,
 * so the user has to empty those first.
 * @throws {UserFacingError} 404 when the category is gone; 400 when it still has folders.
 */
export const deleteCategory = async (userId: string, categoryId: string) => {
  try {
    const rows = await db
      .delete(category)
      .where(and(eq(category.id, categoryId), eq(category.userId, userId)))
      .returning({ id: category.id });
    if (!rows.length) throw new UserFacingError('This category no longer exists.', 404);
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw new UserFacingError(
        'This category still has folders. Move or delete them first, including any in the bin.'
      );
    }
    throw error;
  }
};

// ---------------------------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------------------------

const folderNameTaken = (name: string) =>
  new UserFacingError(`A folder named “${name}” already exists here.`);

/**
 * Creates a folder either at the root of a category or inside a parent folder. Exactly one of
 * `categoryId` and `parentId` must be set, and the parent must be live (not in the bin).
 * @throws {UserFacingError} When the location is missing or gone, or the name is taken there.
 */
export const createFolder = async (
  userId: string,
  input: { name: string; categoryId?: string; parentId?: string }
) => {
  if (Boolean(input.categoryId) === Boolean(input.parentId)) {
    throw new UserFacingError('Choose where to create the folder.');
  }

  if (input.categoryId) {
    const [owned] = await db
      .select({ id: category.id })
      .from(category)
      .where(and(eq(category.id, input.categoryId), eq(category.userId, userId)));
    if (!owned) throw new UserFacingError('This category no longer exists.', 404);
  } else {
    const index = await loadFolderIndex(userId);
    if (!index.get(input.parentId!) || index.isBinned(input.parentId!)) {
      throw new UserFacingError('The parent folder no longer exists.', 404);
    }
  }

  try {
    const [row] = await db
      .insert(folder)
      .values({
        userId,
        name: input.name,
        categoryId: input.categoryId ?? null,
        parentId: input.parentId ?? null
      })
      .returning({ id: folder.id, name: folder.name });
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) throw folderNameTaken(input.name);
    throw error;
  }
};

export type FolderRow = {
  type: 'folder' | 'file';
  id: string;
  name: string;
  kind: FileKind;
  /** Bytes; null for folders. */
  size: number | null;
  updatedAt: Date;
};

export type FolderView = {
  folder: { id: string; name: string };
  /** Category first, then folders from the root down to this one. */
  breadcrumb: { id: string; name: string; type: 'category' | 'folder' }[];
  page: TablePage<FolderRow>;
};

const folderRowComparators = {
  name: (a: FolderRow, b: FolderRow) => compareText(a.name, b.name),
  updatedAt: (a: FolderRow, b: FolderRow) => compareDate(a.updatedAt, b.updatedAt),
  size: (a: FolderRow, b: FolderRow) => compareNumber(a.size ?? -1, b.size ?? -1)
};

/** `null` when the folder does not exist, belongs to someone else, or is (inside) the bin. */
export const getFolderView = async (
  userId: string,
  folderId: string,
  query: TableQuery
): Promise<FolderView | null> => {
  const index = await loadFolderIndex(userId);
  const current = index.get(folderId);
  if (!current || index.isBinned(folderId)) return null;

  const path = index.path(folderId);
  const root = path[0];
  const [cat] = root.categoryId
    ? await db
        .select({ id: category.id, name: category.name })
        .from(category)
        .where(eq(category.id, root.categoryId))
    : [];

  const files = await db
    .select({ id: file.id, name: file.name, size: file.size, updatedAt: file.updatedAt })
    .from(file)
    .where(and(eq(file.userId, userId), eq(file.folderId, folderId), isNull(file.deletedAt)));

  const folders = await db
    .select({ id: folder.id, name: folder.name, updatedAt: folder.updatedAt })
    .from(folder)
    .where(and(eq(folder.userId, userId), eq(folder.parentId, folderId), isNull(folder.deletedAt)));

  const rows: FolderRow[] = [
    ...folders.map((f) => ({ ...f, type: 'folder' as const, kind: 'folder' as const, size: null })),
    ...files.map((f) => ({ ...f, type: 'file' as const, kind: fileKindOf(f.name) }))
  ];

  return {
    folder: { id: current.id, name: current.name },
    breadcrumb: [
      ...(cat ? [{ ...cat, type: 'category' as const }] : []),
      ...path.map((node) => ({ id: node.id, name: node.name, type: 'folder' as const }))
    ],
    page: applyTableQuery(rows, query, {
      searchText: (row) => row.name,
      comparators: folderRowComparators,
      defaultSort: folderRowComparators.name,
      pinFirst: (row) => row.type === 'folder'
    })
  };
};

/** Live folders as a tree, for the "Move to…" picker. */
export const getFolderTree = async (userId: string) => {
  const [index, categories] = await Promise.all([
    loadFolderIndex(userId),
    db
      .select({ id: category.id, name: category.name })
      .from(category)
      .where(eq(category.userId, userId))
      .orderBy(asc(category.position), asc(category.name))
  ]);

  type TreeNode = { id: string; name: string; children: TreeNode[] };
  const build = (parentId: string): TreeNode[] =>
    (index.children.get(parentId) ?? [])
      .filter((node) => node.deletedAt === null)
      .sort((a, b) => compareText(a.name, b.name))
      .map((node) => ({ id: node.id, name: node.name, children: build(node.id) }));

  return categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    folders: (index.children.get(null) ?? [])
      .filter((node) => node.categoryId === cat.id && node.deletedAt === null)
      .sort((a, b) => compareText(a.name, b.name))
      .map((node) => ({ id: node.id, name: node.name, children: build(node.id) }))
  }));
};

// ---------------------------------------------------------------------------------------------
// Rename, move, move to bin
// ---------------------------------------------------------------------------------------------

/**
 * Renames a live file or folder. Files may share a name; folder names must be unique among
 * their siblings.
 * @throws {UserFacingError} 404 when the item is gone or binned; 400 when a sibling folder
 * already has the name.
 */
export const renameItem = async (
  userId: string,
  input: { type: 'file' | 'folder'; id: string; name: string }
) => {
  if (input.type === 'file') {
    const rows = await db
      .update(file)
      .set({ name: input.name })
      .where(and(eq(file.id, input.id), eq(file.userId, userId), isNull(file.deletedAt)))
      .returning({ id: file.id });
    if (!rows.length) throw new UserFacingError('This file no longer exists.', 404);
    return;
  }

  try {
    const rows = await db
      .update(folder)
      .set({ name: input.name })
      .where(and(eq(folder.id, input.id), eq(folder.userId, userId), isNull(folder.deletedAt)))
      .returning({ id: folder.id });
    if (!rows.length) throw new UserFacingError('This folder no longer exists.', 404);
  } catch (error) {
    if (isUniqueViolation(error)) throw folderNameTaken(input.name);
    throw error;
  }
};

export type BatchResult = {
  done: number;
  failed: { name: string; reason: string }[];
};

/** Live files of `selection` that belong to the user, with their names. */
const loadSelectedFiles = (userId: string, ids: string[]) =>
  ids.length
    ? db
        .select({ id: file.id, name: file.name, folderId: file.folderId })
        .from(file)
        .where(and(eq(file.userId, userId), inArray(file.id, ids), isNull(file.deletedAt)))
    : Promise.resolve([]);

const missing = (requested: string[], found: { id: string }[]) =>
  requested.length - new Set(found.map((row) => row.id)).size;

/**
 * Moves the selected files and folders into `targetFolderId`. Items are handled one by one,
 * so a single failure (gone, moved into itself, name clash) is reported in `failed` instead
 * of aborting the whole batch. A moved folder leaves its category and becomes a subfolder.
 * @throws {UserFacingError} 404 when the destination folder is gone or in the bin.
 */
export const moveItems = async (
  userId: string,
  selection: Selection,
  targetFolderId: string
): Promise<BatchResult> => {
  const index = await loadFolderIndex(userId);
  if (!index.get(targetFolderId) || index.isBinned(targetFolderId)) {
    throw new UserFacingError('The destination folder no longer exists.', 404);
  }

  const result: BatchResult = { done: 0, failed: [] };

  for (const folderId of selection.folderIds) {
    const node = index.get(folderId);
    if (!node || index.isBinned(folderId)) {
      result.failed.push({ name: node?.name ?? 'A folder', reason: 'It no longer exists.' });
      continue;
    }
    if (index.isInSubtree(folderId, targetFolderId)) {
      result.failed.push({ name: node.name, reason: 'A folder can’t be moved into itself.' });
      continue;
    }
    try {
      await db
        .update(folder)
        .set({ parentId: targetFolderId, categoryId: null })
        .where(and(eq(folder.id, folderId), eq(folder.userId, userId)));
      result.done++;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      result.failed.push({
        name: node.name,
        reason: 'The destination has a folder with this name.'
      });
    }
  }

  const files = await loadSelectedFiles(userId, selection.fileIds);
  if (files.length) {
    await db
      .update(file)
      .set({ folderId: targetFolderId })
      .where(
        and(
          eq(file.userId, userId),
          inArray(
            file.id,
            files.map((f) => f.id)
          )
        )
      );
    result.done += files.length;
  }
  for (let i = 0; i < missing(selection.fileIds, files); i++) {
    result.failed.push({ name: 'A file', reason: 'It no longer exists.' });
  }

  return result;
};

/**
 * No confirmation; sets `deletedAt` only. R2 objects stay until the bin is purged.
 * A folder's contents are not marked separately: they are hidden through the folder.
 */
export const moveToBin = async (userId: string, selection: Selection): Promise<BatchResult> => {
  const index = await loadFolderIndex(userId);
  const now = new Date();
  const result: BatchResult = { done: 0, failed: [] };

  const folderIds: string[] = [];
  for (const folderId of selection.folderIds) {
    const node = index.get(folderId);
    if (!node) {
      result.failed.push({ name: 'A folder', reason: 'It no longer exists.' });
    } else if (index.isBinned(folderId)) {
      result.failed.push({ name: node.name, reason: 'It was already moved to the bin.' });
    } else {
      folderIds.push(folderId);
    }
  }
  if (folderIds.length) {
    await db
      .update(folder)
      .set({ deletedAt: now })
      .where(and(eq(folder.userId, userId), inArray(folder.id, folderIds)));
    result.done += folderIds.length;
  }

  const files = selection.fileIds.length
    ? await db
        .select({
          id: file.id,
          name: file.name,
          deletedAt: file.deletedAt,
          folderId: file.folderId
        })
        .from(file)
        .where(and(eq(file.userId, userId), inArray(file.id, selection.fileIds)))
    : [];
  const live = files.filter((f) => f.deletedAt === null && !index.isBinned(f.folderId));
  for (const f of files) {
    if (!live.includes(f))
      result.failed.push({ name: f.name, reason: 'It was already moved to the bin.' });
  }
  for (let i = 0; i < missing(selection.fileIds, files); i++) {
    result.failed.push({ name: 'A file', reason: 'It no longer exists.' });
  }
  if (live.length) {
    await db
      .update(file)
      .set({ deletedAt: now })
      .where(
        and(
          eq(file.userId, userId),
          inArray(
            file.id,
            live.map((f) => f.id)
          )
        )
      );
    result.done += live.length;
  }

  return result;
};

/** Where an item lives, as shown in Recent ("Location") and the bin ("Original location"). */
export const locationOf = (
  index: FolderIndex,
  item: { type: 'file'; folderId: string } | { type: 'folder'; id: string },
  categoryNames: Map<string, string>
) => {
  if (item.type === 'file') {
    const parent = index.get(item.folderId);
    return parent ? { type: 'folder' as const, id: parent.id, name: parent.name } : null;
  }
  const node = index.get(item.id);
  if (!node) return null;
  if (node.parentId) {
    const parent = index.get(node.parentId);
    return parent ? { type: 'folder' as const, id: parent.id, name: parent.name } : null;
  }
  const name = node.categoryId ? categoryNames.get(node.categoryId) : undefined;
  return name ? { type: 'category' as const, id: node.categoryId!, name } : null;
};

/** Map of category id to name for every category the user owns, for location lookups. */
export const loadCategoryNames = async (userId: string) =>
  new Map(
    (
      await db
        .select({ id: category.id, name: category.name })
        .from(category)
        .where(eq(category.userId, userId))
    ).map((row) => [row.id, row.name])
  );
