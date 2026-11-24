import { and, eq, inArray, isNotNull, lt, or } from 'drizzle-orm';
import { db } from '#server/db/index.ts';
import { file, folder, uploadSession } from '#server/db/schema.ts';
import { abortMultipartUpload, assertUserKey, deleteObjects } from '#server/s3/index.ts';
import { BIN_RETENTION_DAYS, type Selection, type TableQuery } from '#lib/schemas/storage.ts';
import { fileKindOf, type FileKind } from '#lib/file-kind.ts';
import { isUniqueViolation } from './errors.ts';
import { loadFolderIndex } from './folder-index.ts';
import { loadCategoryNames, locationOf, type BatchResult } from './library.ts';
import { applyTableQuery, compareDate, compareText, type TablePage } from './table-query.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

export type BinRow = {
  type: 'file' | 'folder';
  id: string;
  name: string;
  kind: FileKind;
  location: { type: 'folder' | 'category'; id: string; name: string } | null;
  deletedAt: Date;
  /** Whole days until the item is deleted permanently; 0 means today. */
  daysLeft: number;
};

const daysLeft = (deletedAt: Date, now = Date.now()) =>
  Math.max(0, BIN_RETENTION_DAYS - Math.floor((now - deletedAt.getTime()) / DAY_MS));

/**
 * Items with `deletedAt` set. A binned folder is listed once; anything inside it (binned on its
 * own or not) is not listed separately.
 */
export const listBin = async (userId: string, query: TableQuery): Promise<TablePage<BinRow>> => {
  const [index, categoryNames, files] = await Promise.all([
    loadFolderIndex(userId),
    loadCategoryNames(userId),
    db
      .select({ id: file.id, name: file.name, folderId: file.folderId, deletedAt: file.deletedAt })
      .from(file)
      .where(and(eq(file.userId, userId), isNotNull(file.deletedAt)))
  ]);

  const rows: BinRow[] = [];
  for (const node of index.byId.values()) {
    if (!node.deletedAt || index.hasBinnedAncestor(node.id)) continue;
    rows.push({
      type: 'folder',
      id: node.id,
      name: node.name,
      kind: 'folder',
      location: locationOf(index, { type: 'folder', id: node.id }, categoryNames),
      deletedAt: node.deletedAt,
      daysLeft: daysLeft(node.deletedAt)
    });
  }
  for (const f of files) {
    if (index.isBinned(f.folderId)) continue;
    rows.push({
      type: 'file',
      id: f.id,
      name: f.name,
      kind: fileKindOf(f.name),
      location: locationOf(index, { type: 'file', folderId: f.folderId }, categoryNames),
      deletedAt: f.deletedAt!,
      daysLeft: daysLeft(f.deletedAt!)
    });
  }

  return applyTableQuery(rows, query, {
    searchText: (row) => row.name,
    comparators: {
      name: (a, b) => compareText(a.name, b.name),
      location: (a, b) => compareText(a.location?.name ?? '', b.location?.name ?? ''),
      deletedAt: (a, b) => compareDate(a.deletedAt, b.deletedAt),
      daysLeft: (a, b) => a.daysLeft - b.daysLeft
    },
    defaultSort: (a, b) => compareDate(b.deletedAt, a.deletedAt)
  });
};

/** Restores a folder, renaming it when a live sibling took its name meanwhile. */
const restoreFolderRow = async (userId: string, id: string, name: string) => {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate =
      attempt === 0 ? name : `${name} (restored${attempt > 1 ? ` ${attempt}` : ''})`;
    try {
      await db
        .update(folder)
        .set({ deletedAt: null, name: candidate })
        .where(and(eq(folder.id, id), eq(folder.userId, userId)));
      return;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new Error(`Could not find a free name to restore folder ${id}`);
};

/**
 * Back to the original location. If the original parent folder is also in the bin, it is
 * restored too.
 */
export const restoreItems = async (userId: string, selection: Selection): Promise<BatchResult> => {
  const index = await loadFolderIndex(userId);
  const result: BatchResult = { done: 0, failed: [] };

  const restoreAncestors = async (folderId: string) => {
    for (const node of index.path(folderId)) {
      if (node.deletedAt) {
        await restoreFolderRow(userId, node.id, node.name);
        node.deletedAt = null;
      }
    }
  };

  for (const folderId of selection.folderIds) {
    const node = index.get(folderId);
    if (!node) {
      result.failed.push({ name: 'A folder', reason: 'It no longer exists.' });
      continue;
    }
    await restoreAncestors(folderId);
    result.done++;
  }

  const files = selection.fileIds.length
    ? await db
        .select({ id: file.id, folderId: file.folderId })
        .from(file)
        .where(and(eq(file.userId, userId), inArray(file.id, selection.fileIds)))
    : [];
  for (const f of files) {
    await restoreAncestors(f.folderId);
    await db.update(file).set({ deletedAt: null }).where(eq(file.id, f.id));
    result.done++;
  }
  const missingFiles = selection.fileIds.length - files.length;
  for (let i = 0; i < missingFiles; i++) {
    result.failed.push({ name: 'A file', reason: 'It no longer exists.' });
  }

  return result;
};

/**
 * Deletes the R2 objects first, then the rows: if a step fails, the rows are still there to
 * retry from, instead of objects nothing points to. Folder rows cascade to
 * their subfolders, files, upload sessions and share items; open multipart uploads inside them
 * are aborted so R2 does not keep their parts.
 */
const destroy = async (userId: string, folderIds: string[], fileIds: string[]) => {
  const index = await loadFolderIndex(userId);
  const subtreeIds = [...new Set(folderIds.flatMap((id) => index.subtree(id).map((n) => n.id)))];

  const conditions = [
    fileIds.length ? inArray(file.id, fileIds) : undefined,
    subtreeIds.length ? inArray(file.folderId, subtreeIds) : undefined
  ].filter((condition) => condition !== undefined);
  const files = conditions.length
    ? await db
        .select({ id: file.id, key: file.key })
        .from(file)
        .where(and(eq(file.userId, userId), or(...conditions)))
    : [];

  const sessions = subtreeIds.length
    ? await db
        .select({ key: uploadSession.key, uploadId: uploadSession.uploadId })
        .from(uploadSession)
        .where(and(eq(uploadSession.userId, userId), inArray(uploadSession.folderId, subtreeIds)))
    : [];

  for (const f of files) assertUserKey(userId, f.key);
  if (files.length) await deleteObjects(files.map((f) => f.key));
  for (const s of sessions) {
    assertUserKey(userId, s.key);
    await abortMultipartUpload(s.key, s.uploadId).catch(() => undefined);
  }

  if (files.length) {
    await db.delete(file).where(
      and(
        eq(file.userId, userId),
        inArray(
          file.id,
          files.map((f) => f.id)
        )
      )
    );
  }
  if (folderIds.length) {
    await db.delete(folder).where(and(eq(folder.userId, userId), inArray(folder.id, folderIds)));
  }
  return files.length;
};

/** Only items that are in the bin can be deleted permanently. */
export const deletePermanently = async (
  userId: string,
  selection: Selection
): Promise<BatchResult> => {
  const binnedFolders = selection.folderIds.length
    ? await db
        .select({ id: folder.id })
        .from(folder)
        .where(
          and(
            eq(folder.userId, userId),
            inArray(folder.id, selection.folderIds),
            isNotNull(folder.deletedAt)
          )
        )
    : [];
  const binnedFiles = selection.fileIds.length
    ? await db
        .select({ id: file.id })
        .from(file)
        .where(
          and(
            eq(file.userId, userId),
            inArray(file.id, selection.fileIds),
            isNotNull(file.deletedAt)
          )
        )
    : [];

  await destroy(
    userId,
    binnedFolders.map((f) => f.id),
    binnedFiles.map((f) => f.id)
  );

  const done = binnedFolders.length + binnedFiles.length;
  const skipped = selection.folderIds.length + selection.fileIds.length - done;
  return {
    done,
    failed: Array.from({ length: skipped }, () => ({
      name: 'An item',
      reason: 'It is no longer in the bin.'
    }))
  };
};

export type DeletePreviewNode = {
  type: 'file' | 'folder';
  id: string;
  name: string;
  kind: FileKind;
  /** Files only. */
  size?: number;
  /** Folders only: what is inside, folders first. */
  children?: DeletePreviewNode[];
};

export type DeletePreview = {
  items: DeletePreviewNode[];
  totals: { folders: number; files: number; bytes: number };
  /** True when the tree was cut at `PREVIEW_NODE_LIMIT` entries; totals stay exact. */
  truncated: boolean;
};

const PREVIEW_NODE_LIMIT = 500;

/**
 * Everything a permanent delete of `selection` removes, as a tree, so the confirmation dialog can
 * list it. Only binned items count, matching `deletePermanently`.
 */
export const previewPermanentDelete = async (
  userId: string,
  selection: Selection
): Promise<DeletePreview> => {
  const index = await loadFolderIndex(userId);
  const folderIds = selection.folderIds.filter((id) => index.get(id)?.deletedAt);
  const subtreeIds = [...new Set(folderIds.flatMap((id) => index.subtree(id).map((n) => n.id)))];

  const conditions = [
    selection.fileIds.length
      ? and(inArray(file.id, selection.fileIds), isNotNull(file.deletedAt))
      : undefined,
    subtreeIds.length ? inArray(file.folderId, subtreeIds) : undefined
  ].filter((condition) => condition !== undefined);
  const files = conditions.length
    ? await db
        .select({ id: file.id, name: file.name, size: file.size, folderId: file.folderId })
        .from(file)
        .where(and(eq(file.userId, userId), or(...conditions)))
    : [];

  const filesByFolder = new Map<string, typeof files>();
  for (const f of files) {
    const list = filesByFolder.get(f.folderId) ?? [];
    list.push(f);
    filesByFolder.set(f.folderId, list);
  }
  const byName = (a: { name: string }, b: { name: string }) => compareText(a.name, b.name);

  let budget = PREVIEW_NODE_LIMIT;
  let truncated = false;
  const take = () => {
    if (budget <= 0) {
      truncated = true;
      return false;
    }
    budget--;
    return true;
  };
  const fileNode = (f: (typeof files)[number]): DeletePreviewNode => ({
    type: 'file',
    id: f.id,
    name: f.name,
    kind: fileKindOf(f.name),
    size: f.size
  });
  const folderNode = (id: string, name: string): DeletePreviewNode => {
    const children: DeletePreviewNode[] = [];
    for (const child of [...(index.children.get(id) ?? [])].sort(byName)) {
      if (take()) children.push(folderNode(child.id, child.name));
    }
    for (const f of [...(filesByFolder.get(id) ?? [])].sort(byName)) {
      if (take()) children.push(fileNode(f));
    }
    return { type: 'folder', id, name, kind: 'folder', children };
  };

  const items: DeletePreviewNode[] = [];
  for (const id of folderIds) {
    if (take()) items.push(folderNode(id, index.get(id)!.name));
  }
  const selectedFileIds = new Set(selection.fileIds);
  for (const f of files.filter((f) => selectedFileIds.has(f.id)).sort(byName)) {
    if (take()) items.push(fileNode(f));
  }

  return {
    items,
    totals: {
      folders: subtreeIds.length,
      files: files.length,
      bytes: files.reduce((sum, f) => sum + f.size, 0)
    },
    truncated
  };
};

/** Scheduled job: permanently deletes items that have been in the bin for more than 30 days. */
export const purgeExpiredBin = async (now = new Date()) => {
  const cutoff = new Date(now.getTime() - BIN_RETENTION_DAYS * DAY_MS);
  const [folders, files] = await Promise.all([
    db
      .select({ id: folder.id, userId: folder.userId })
      .from(folder)
      .where(lt(folder.deletedAt, cutoff)),
    db.select({ id: file.id, userId: file.userId }).from(file).where(lt(file.deletedAt, cutoff))
  ]);

  const users = new Set([...folders, ...files].map((row) => row.userId));
  let purged = 0;
  for (const userId of users) {
    purged += await destroy(
      userId,
      folders.filter((f) => f.userId === userId).map((f) => f.id),
      files.filter((f) => f.userId === userId).map((f) => f.id)
    );
  }
  return purged;
};
