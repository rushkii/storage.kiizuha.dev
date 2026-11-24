import { randomBytes } from 'node:crypto';
import { and, count, desc, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import { db } from '#server/db/index.ts';
import { file, share, shareItem } from '#server/db/schema.ts';
import { assertUserKey, createDownloadUrl } from '#server/s3/index.ts';
import type { Selection, ShareExpiry, TableQuery } from '#lib/schemas/storage.ts';
import { UserFacingError } from './errors.ts';
import { expandSelection } from './downloads.ts';
import { loadFolderIndex } from './folder-index.ts';
import {
  applyTableQuery,
  compareDate,
  compareNumber,
  compareText,
  type TablePage
} from './table-query.ts';

// Share links: creating them, the owner's "What I shared" list, and the public /s/[token] pages.

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRY_DAYS: Record<ShareExpiry, number | null> = { '1d': 1, '3d': 3, '7d': 7, never: null };

/** 24 random bytes → 32 URL-safe characters (192 bits, above the 128-bit minimum for unguessable links). */
const newToken = () => randomBytes(24).toString('base64url');

const isActive = (now: Date) =>
  and(isNull(share.revokedAt), or(isNull(share.expiresAt), gt(share.expiresAt, now)));

export type ShareTreeNode = {
  id: string;
  name: string;
  folders: ShareTreeNode[];
  files: { id: string; name: string; size: number }[];
};

/**
 * The selection as a tree, for the dialog's accordion. Nothing is pre-ticked: the dialog shows
 * this and the owner ticks the files to share.
 */
export const getShareTree = async (userId: string, selection: Selection) => {
  const index = await loadFolderIndex(userId);
  const files = await expandSelection(userId, selection, index);
  const fileFolder = new Map(
    (files.length
      ? await db
          .select({ id: file.id, folderId: file.folderId })
          .from(file)
          .where(
            inArray(
              file.id,
              files.map((f) => f.id)
            )
          )
      : []
    ).map((row) => [row.id, row.folderId])
  );

  const build = (folderId: string): ShareTreeNode => {
    const node = index.get(folderId)!;
    return {
      id: node.id,
      name: node.name,
      folders: (index.children.get(folderId) ?? [])
        .filter((child) => child.deletedAt === null)
        .sort((a, b) => compareText(a.name, b.name))
        .map((child) => build(child.id)),
      files: files
        .filter((f) => fileFolder.get(f.id) === folderId && !selection.fileIds.includes(f.id))
        .map(({ id, name, size }) => ({ id, name, size }))
        .sort((a, b) => compareText(a.name, b.name))
    };
  };

  return {
    folders: selection.folderIds.filter((id) => index.get(id) && !index.isBinned(id)).map(build),
    files: files
      .filter((f) => selection.fileIds.includes(f.id))
      .map(({ id, name, size }) => ({ id, name, size }))
  };
};

/**
 * Creates a share link with a fresh random token. A single selected file is shared as-is;
 * any other selection shares only the ticked files, which must all belong to the selection.
 * A selection of exactly one folder remembers it as the share's root.
 * @throws {UserFacingError} When nothing is ticked or a ticked file left the selection.
 */
export const createShare = async (
  userId: string,
  input: { selection: Selection; tickedFileIds: string[]; title: string; expiry: ShareExpiry }
) => {
  const { selection } = input;
  const single = selection.fileIds.length === 1 && selection.folderIds.length === 0;
  const available = new Set((await expandSelection(userId, selection)).map((f) => f.id));

  // A single file is shared as-is; otherwise only ticked files that belong to the selection.
  const fileIds = single
    ? selection.fileIds.filter((id) => available.has(id))
    : input.tickedFileIds;
  if (!fileIds.length) throw new UserFacingError('Tick at least one file to share.');
  if (fileIds.some((id) => !available.has(id))) {
    throw new UserFacingError('Some ticked files are no longer in this selection.');
  }

  const days = EXPIRY_DAYS[input.expiry];
  const now = new Date();
  const token = newToken();

  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(share)
      .values({
        userId,
        token,
        kind: single ? 'file' : 'listing',
        title: input.title,
        rootFolderId:
          selection.folderIds.length === 1 && selection.fileIds.length === 0
            ? selection.folderIds[0]
            : null,
        expiresAt: days === null ? null : new Date(now.getTime() + days * DAY_MS)
      })
      .returning({ id: share.id });
    await tx.insert(shareItem).values(fileIds.map((fileId) => ({ shareId: row.id, fileId })));
  });

  const [created] = await db
    .select({ expiresAt: share.expiresAt })
    .from(share)
    .where(eq(share.token, token));
  return { token, expiresAt: created.expiresAt, fileCount: fileIds.length };
};

export type SharedRow = {
  id: string;
  token: string;
  title: string;
  type: 'File' | 'Folder' | 'Multiple items';
  items: number;
  createdAt: Date;
  expiresAt: Date | null;
};

/** Only active shares: not revoked and not expired. */
export const listShares = async (
  userId: string,
  query: TableQuery
): Promise<TablePage<SharedRow>> => {
  const now = new Date();
  const rows = await db
    .select({
      id: share.id,
      token: share.token,
      title: share.title,
      kind: share.kind,
      rootFolderId: share.rootFolderId,
      createdAt: share.createdAt,
      expiresAt: share.expiresAt,
      items: count(file.id)
    })
    .from(share)
    .leftJoin(shareItem, eq(shareItem.shareId, share.id))
    .leftJoin(file, and(eq(file.id, shareItem.fileId), isNull(file.deletedAt)))
    .where(and(eq(share.userId, userId), isActive(now)))
    .groupBy(share.id)
    .orderBy(desc(share.createdAt));

  const shaped: SharedRow[] = rows.map((row) => ({
    id: row.id,
    token: row.token,
    title: row.title,
    type: row.kind === 'file' ? 'File' : row.rootFolderId ? 'Folder' : 'Multiple items',
    items: row.items,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt
  }));

  const expiry = (row: SharedRow) => row.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
  return applyTableQuery(shaped, query, {
    searchText: (row) => row.title,
    comparators: {
      title: (a, b) => compareText(a.title, b.title),
      type: (a, b) => compareText(a.type, b.type),
      items: (a, b) => compareNumber(a.items, b.items),
      createdAt: (a, b) => compareDate(a.createdAt, b.createdAt),
      expiresAt: (a, b) => expiry(a) - expiry(b)
    },
    defaultSort: (a, b) => compareDate(b.createdAt, a.createdAt)
  });
};

/**
 * Revokes shares by setting `revokedAt`; their links stop working at once. The rows are kept.
 * Ids that are not the user's or already revoked are skipped.
 * @returns How many shares were revoked.
 * @throws {UserFacingError} 404 when none of the shares could be revoked.
 */
export const unshare = async (userId: string, shareIds: string[]) => {
  const rows = await db
    .update(share)
    .set({ revokedAt: new Date() })
    .where(and(inArray(share.id, shareIds), eq(share.userId, userId), isNull(share.revokedAt)))
    .returning({ id: share.id });
  if (!rows.length) {
    throw new UserFacingError(
      shareIds.length === 1
        ? 'This share was already removed.'
        : 'These shares were already removed.',
      404
    );
  }
  return rows.length;
};

// ---------------------------------------------------------------------------------------------
// Public pages (/s/[token]). Expired, revoked and unknown tokens all look the same: `null`.
// ---------------------------------------------------------------------------------------------

const loadActiveShare = async (token: string) => {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const [row] = await db
    .select()
    .from(share)
    .where(and(eq(share.token, token), isActive(new Date())));
  return row ?? null;
};

/** The shared files that still exist and are not (inside) the bin. */
const loadSharedFiles = async (row: NonNullable<Awaited<ReturnType<typeof loadActiveShare>>>) => {
  const index = await loadFolderIndex(row.userId);
  const files = await db
    .select({
      id: file.id,
      name: file.name,
      size: file.size,
      key: file.key,
      folderId: file.folderId
    })
    .from(shareItem)
    .innerJoin(file, eq(file.id, shareItem.fileId))
    .where(and(eq(shareItem.shareId, row.id), isNull(file.deletedAt)));
  return { index, files: files.filter((f) => !index.isBinned(f.folderId)) };
};

export type PublicListing = {
  title: string;
  expiresAt: Date | null;
  totalSize: number;
  /** Files directly in the shared root. */
  files: { id: string; name: string; size: number }[];
  /** Files in subfolders, one accordion section per subfolder path. */
  groups: { path: string; files: { id: string; name: string; size: number }[] }[];
};

/**
 * Light check for the page's `load`: whether the share is usable and, for a file share, the URL
 * to redirect to. The listing itself is fetched through a remote query.
 */
export const peekPublicShare = async (
  token: string
): Promise<{ kind: 'file'; url: string } | { kind: 'listing' } | null> => {
  const row = await loadActiveShare(token);
  if (!row) return null;
  const { files } = await loadSharedFiles(row);
  if (!files.length) return null;
  if (row.kind === 'listing') return { kind: 'listing' };
  const [f] = files;
  assertUserKey(row.userId, f.key);
  return { kind: 'file', url: await createDownloadUrl(f.key, { filename: f.name }) };
};

/** Resolves a share page. A `file` share returns the URL to redirect to instead of a listing. */
export const resolvePublicShare = async (
  token: string
): Promise<{ kind: 'file'; url: string } | { kind: 'listing'; listing: PublicListing } | null> => {
  const row = await loadActiveShare(token);
  if (!row) return null;
  const { index, files } = await loadSharedFiles(row);
  if (!files.length) return null;

  if (row.kind === 'file') {
    const [f] = files;
    assertUserKey(row.userId, f.key);
    return { kind: 'file', url: await createDownloadUrl(f.key, { filename: f.name }) };
  }

  // Subfolders are derived from the shared files' folders, relative to the shared root or,
  // for a multi-item share, to the deepest folder all files have in common.
  const paths = files.map((f) => index.path(f.folderId).map((n) => n.id));
  let common: string[] = row.rootFolderId
    ? index.path(row.rootFolderId).map((n) => n.id)
    : paths[0];
  if (!row.rootFolderId) {
    for (const p of paths) {
      let i = 0;
      while (i < common.length && i < p.length && common[i] === p[i]) i++;
      common = common.slice(0, i);
    }
  }
  const base = common.at(-1) ?? null;

  const root: PublicListing['files'] = [];
  const groups = new Map<string, PublicListing['files']>();
  for (const f of files) {
    const item = { id: f.id, name: f.name, size: f.size };
    const rel = index.relativeNames(f.folderId, base).join(' / ');
    if (!rel) root.push(item);
    else groups.set(rel, [...(groups.get(rel) ?? []), item]);
  }

  const byName = (a: { name: string }, b: { name: string }) => compareText(a.name, b.name);
  return {
    kind: 'listing',
    listing: {
      title: row.title,
      expiresAt: row.expiresAt,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      files: root.sort(byName),
      groups: [...groups.entries()]
        .sort(([a], [b]) => compareText(a, b))
        .map(([path, list]) => ({ path, files: list.sort(byName) }))
    }
  };
};

/** `/s/[token]/f/[fileId]`: only files that belong to the share, never by guessing an id. */
export const resolvePublicFile = async (token: string, fileId: string) => {
  const row = await loadActiveShare(token);
  if (!row) return null;
  const { files } = await loadSharedFiles(row);
  const f = files.find((candidate) => candidate.id === fileId);
  if (!f) return null;
  assertUserKey(row.userId, f.key);
  return createDownloadUrl(f.key, { filename: f.name });
};
