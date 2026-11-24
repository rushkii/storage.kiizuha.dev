import { and, asc, desc, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm';
import { db } from '#server/db/index.ts';
import { file, itemAccess } from '#server/db/schema.ts';
import { RECENT_LIMIT, type RecentQuery } from '#lib/schemas/storage.ts';
import { fileKindOf, type FileKind } from '#lib/file-kind.ts';
import { loadFolderIndex } from './folder-index.ts';
import { loadCategoryNames, locationOf } from './library.ts';
import {
  applyTableQuery,
  compareDate,
  compareNumber,
  compareText,
  type TablePage
} from './table-query.ts';

/**
 * An "open" is visiting a folder page or downloading a file. The list keeps at most 1000 items:
 * when it is full, the item opened longest ago makes room. Items never expire for age alone.
 */
export const recordOpen = async (userId: string, itemType: 'file' | 'folder', itemId: string) => {
  await db
    .insert(itemAccess)
    .values({ userId, itemType, itemId, openCount: 1, lastOpenedAt: new Date() })
    .onConflictDoUpdate({
      target: [itemAccess.userId, itemAccess.itemType, itemAccess.itemId],
      set: { openCount: sql`${itemAccess.openCount} + 1`, lastOpenedAt: new Date() }
    });

  const keep = db
    .select({ id: itemAccess.id })
    .from(itemAccess)
    .where(eq(itemAccess.userId, userId))
    .orderBy(desc(itemAccess.lastOpenedAt))
    .limit(RECENT_LIMIT);
  await db
    .delete(itemAccess)
    .where(and(eq(itemAccess.userId, userId), notInArray(itemAccess.id, keep)));
};

export type RecentRow = {
  type: 'file' | 'folder';
  id: string;
  name: string;
  kind: FileKind;
  size: number | null;
  lastOpenedAt: Date;
  location: { type: 'folder' | 'category'; id: string; name: string } | null;
};

/** Binned items are hidden. Rows come newest first; the page groups them by date. */
export const listRecent = async (
  userId: string,
  query: RecentQuery
): Promise<TablePage<RecentRow>> => {
  const [index, categoryNames, accesses] = await Promise.all([
    loadFolderIndex(userId),
    loadCategoryNames(userId),
    db
      .select()
      .from(itemAccess)
      .where(eq(itemAccess.userId, userId))
      .orderBy(desc(itemAccess.lastOpenedAt), asc(itemAccess.id))
  ]);

  const fileIds = accesses.filter((a) => a.itemType === 'file').map((a) => a.itemId);
  const files = new Map(
    (fileIds.length
      ? await db
          .select({ id: file.id, name: file.name, size: file.size, folderId: file.folderId })
          .from(file)
          .where(and(eq(file.userId, userId), inArray(file.id, fileIds), isNull(file.deletedAt)))
      : []
    ).map((row) => [row.id, row])
  );

  const rows: RecentRow[] = [];
  for (const access of accesses) {
    if (access.itemType === 'folder') {
      const node = index.get(access.itemId);
      if (!node || index.isBinned(node.id)) continue;
      rows.push({
        type: 'folder',
        id: node.id,
        name: node.name,
        kind: 'folder',
        size: null,
        lastOpenedAt: access.lastOpenedAt,
        location: locationOf(index, { type: 'folder', id: node.id }, categoryNames)
      });
    } else {
      const row = files.get(access.itemId);
      if (!row || index.isBinned(row.folderId)) continue;
      rows.push({
        type: 'file',
        id: row.id,
        name: row.name,
        kind: fileKindOf(row.name),
        size: row.size,
        lastOpenedAt: access.lastOpenedAt,
        location: locationOf(index, { type: 'file', folderId: row.folderId }, categoryNames)
      });
    }
  }

  // Filters narrow the set before the table query, so client mode works on the filtered set.
  const kinds = new Set(query.kinds);
  const filtered = rows.filter(
    (row) =>
      (!kinds.size || kinds.has(row.kind)) &&
      (query.openedFrom === undefined || row.lastOpenedAt.getTime() >= query.openedFrom) &&
      (query.openedTo === undefined || row.lastOpenedAt.getTime() < query.openedTo)
  );

  return applyTableQuery(filtered, query, {
    searchText: (row) => row.name,
    comparators: {
      name: (a, b) => compareText(a.name, b.name),
      lastOpenedAt: (a, b) => compareDate(a.lastOpenedAt, b.lastOpenedAt),
      size: (a, b) => compareNumber(a.size ?? -1, b.size ?? -1),
      location: (a, b) => compareText(a.location?.name ?? '', b.location?.name ?? '')
    },
    defaultSort: (a, b) => compareDate(b.lastOpenedAt, a.lastOpenedAt)
  });
};
