import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { db } from '#server/db/index.ts';
import { file } from '#server/db/schema.ts';
import { assertUserKey, createDownloadUrl } from '#server/s3/index.ts';
import { ZIP_PART_MAX_BYTES, type Selection } from '#lib/schemas/storage.ts';
import { UserFacingError } from './errors.ts';
import { loadFolderIndex, type FolderIndex } from './folder-index.ts';

// Downloads. One file is a direct presigned link; anything else is split into zips the browser
// builds itself, each kept under ZIP_PART_MAX_BYTES, with files too large for a zip linked
// separately.

export type ExpandedFile = {
  id: string;
  name: string;
  size: number;
  key: string;
  updatedAt: Date;
  /** Path inside a zip, e.g. `Drone/clip.mp4`. Folders keep their structure. */
  zipPath: string;
};

/**
 * The live files of a selection: files as they are, folders expanded to everything under them.
 * Binned items are skipped. Zip paths start at the selected item, so selecting `Drone` gives
 * `Drone/...` and selecting a file gives just its name.
 */
export const expandSelection = async (
  userId: string,
  selection: Selection,
  index?: FolderIndex
): Promise<ExpandedFile[]> => {
  const folders = index ?? (await loadFolderIndex(userId));

  const folderBase = new Map<string, string>();
  for (const folderId of selection.folderIds) {
    const node = folders.get(folderId);
    if (!node || folders.isBinned(folderId)) continue;
    for (const child of folders.subtree(folderId)) {
      if (child.deletedAt) continue;
      if (folders.path(child.id).some((n) => n.deletedAt)) continue;
      // Path from the selected folder (inclusive) down to `child`.
      const names = folders.relativeNames(child.id, node.parentId);
      folderBase.set(child.id, names.join('/'));
    }
  }

  const conditions = [
    selection.fileIds.length ? inArray(file.id, selection.fileIds) : undefined,
    folderBase.size ? inArray(file.folderId, [...folderBase.keys()]) : undefined
  ].filter((condition) => condition !== undefined);
  if (!conditions.length) return [];

  const rows = await db
    .select({
      id: file.id,
      name: file.name,
      size: file.size,
      key: file.key,
      updatedAt: file.updatedAt,
      folderId: file.folderId
    })
    .from(file)
    .where(and(eq(file.userId, userId), isNull(file.deletedAt), or(...conditions)));

  const seen = new Set<string>();
  const result: ExpandedFile[] = [];
  for (const row of rows) {
    if (seen.has(row.id) || folders.isBinned(row.folderId)) continue;
    seen.add(row.id);
    const base = folderBase.get(row.folderId);
    const zipPath = base && !selection.fileIds.includes(row.id) ? `${base}/${row.name}` : row.name;
    result.push({
      id: row.id,
      name: row.name,
      size: row.size,
      key: row.key,
      updatedAt: row.updatedAt,
      zipPath
    });
  }
  return result;
};

/** Makes zip paths unique by suffixing duplicates: `a.txt`, `a (2).txt`. */
export const dedupePaths = (files: ExpandedFile[]) => {
  const used = new Set<string>();
  return files.map((f) => {
    let path = f.zipPath;
    if (used.has(path)) {
      const dot = path.lastIndexOf('.');
      const slash = path.lastIndexOf('/');
      const [stem, ext] = dot > slash + 1 ? [path.slice(0, dot), path.slice(dot)] : [path, ''];
      let n = 2;
      while (used.has(`${stem} (${n})${ext}`)) n++;
      path = `${stem} (${n})${ext}`;
    }
    used.add(path);
    return { ...f, zipPath: path };
  });
};

export type DownloadPlan =
  | { kind: 'single'; url: string; name: string }
  | {
      kind: 'split';
      /** Files over 100 MB, downloaded one by one through their own presigned URLs. */
      large: { id: string; name: string; size: number; url: string }[];
      /** Each entry is one zip of at most 100 MB, as file ids. */
      zips: { fileIds: string[]; size: number }[];
      /** Name stem for the zips, e.g. `Bromo trip 2026-20261120-0128`. */
      zipName: string;
      totalFiles: number;
    };

const timestamp = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
};

/** First-fit decreasing: fewest zips under the size cap. */
const packZips = (files: ExpandedFile[]) => {
  const bins: { fileIds: string[]; size: number }[] = [];
  for (const f of [...files].sort((a, b) => b.size - a.size)) {
    const bin = bins.find((b) => b.size + f.size <= ZIP_PART_MAX_BYTES);
    if (bin) {
      bin.fileIds.push(f.id);
      bin.size += f.size;
    } else {
      bins.push({ fileIds: [f.id], size: f.size });
    }
  }
  return bins;
};

/**
 * Plans how the browser downloads a selection. A single file gives a direct presigned URL.
 * Any other selection gives a `split` plan: files bigger than one zip part get their own
 * URL, the rest are packed into zip groups. The zip name uses the folder name when exactly
 * one folder is selected.
 * @throws {UserFacingError} When the file is gone or the selection has no live files.
 */
export const planDownload = async (userId: string, selection: Selection): Promise<DownloadPlan> => {
  const index = await loadFolderIndex(userId);

  // One file selected: direct download, no zip.
  if (selection.fileIds.length === 1 && selection.folderIds.length === 0) {
    const [single] = await expandSelection(userId, selection, index);
    if (!single) throw new UserFacingError('This file no longer exists.', 404);
    assertUserKey(userId, single.key);
    return {
      kind: 'single',
      name: single.name,
      url: await createDownloadUrl(single.key, { filename: single.name })
    };
  }

  const files = await expandSelection(userId, selection, index);
  if (!files.length) throw new UserFacingError('There is nothing to download in this selection.');

  const largeFiles = files.filter((f) => f.size > ZIP_PART_MAX_BYTES);
  const large = await Promise.all(
    largeFiles.map(async (f) => {
      assertUserKey(userId, f.key);
      return {
        id: f.id,
        name: f.name,
        size: f.size,
        url: await createDownloadUrl(f.key, { filename: f.name })
      };
    })
  );

  const onlyFolder =
    selection.folderIds.length === 1 && selection.fileIds.length === 0
      ? index.get(selection.folderIds[0])?.name
      : undefined;

  return {
    kind: 'split',
    large,
    zips: packZips(files.filter((f) => f.size <= ZIP_PART_MAX_BYTES)),
    zipName: `${onlyFolder ?? 'download'}-${timestamp(new Date())}`,
    totalFiles: files.length
  };
};

/** Presigned URL for one file (row action, share redirects). `null` when missing or binned. */
export const fileDownloadUrl = async (userId: string, fileId: string) => {
  const index = await loadFolderIndex(userId);
  const [row] = await db
    .select({ name: file.name, key: file.key, folderId: file.folderId })
    .from(file)
    .where(and(eq(file.id, fileId), eq(file.userId, userId), isNull(file.deletedAt)));
  if (!row || index.isBinned(row.folderId)) return null;
  assertUserKey(userId, row.key);
  return { name: row.name, url: await createDownloadUrl(row.key, { filename: row.name }) };
};
