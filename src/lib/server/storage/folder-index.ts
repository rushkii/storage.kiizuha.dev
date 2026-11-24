import { eq } from 'drizzle-orm';
import { db } from '#server/db/index.ts';
import { folder } from '#server/db/schema.ts';

export type FolderNode = {
  id: string;
  parentId: string | null;
  categoryId: string | null;
  name: string;
  deletedAt: Date | null;
};

/**
 * Every folder of one user, loaded once per request. This is a single-account personal storage,
 * so the folder count stays small enough to walk in memory, which keeps breadcrumbs, "is an
 * ancestor binned?", descendants and relative paths out of recursive SQL.
 */
export class FolderIndex {
  readonly byId: Map<string, FolderNode>;
  readonly children: Map<string | null, FolderNode[]>;

  constructor(nodes: FolderNode[]) {
    this.byId = new Map(nodes.map((node) => [node.id, node]));
    this.children = new Map();
    for (const node of nodes) {
      const list = this.children.get(node.parentId) ?? [];
      list.push(node);
      this.children.set(node.parentId, list);
    }
  }

  get(id: string) {
    return this.byId.get(id);
  }

  /** Root first, `id` last. Empty when the folder does not exist. */
  path(id: string): FolderNode[] {
    const result: FolderNode[] = [];
    const seen = new Set<string>();
    let current = this.byId.get(id);
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      result.unshift(current);
      current = current.parentId ? this.byId.get(current.parentId) : undefined;
    }
    return result;
  }

  /** The root folder of `id` (itself when it is a root folder). */
  root(id: string) {
    return this.path(id)[0];
  }

  /** True when the folder or any ancestor is in the bin. */
  isBinned(id: string) {
    const path = this.path(id);
    return path.length === 0 || path.some((node) => node.deletedAt !== null);
  }

  /** True when an ancestor (not the folder itself) is in the bin. */
  hasBinnedAncestor(id: string) {
    return this.path(id)
      .slice(0, -1)
      .some((node) => node.deletedAt !== null);
  }

  /** `id` and every folder below it, binned ones included. */
  subtree(id: string): FolderNode[] {
    const start = this.byId.get(id);
    if (!start) return [];
    const result: FolderNode[] = [];
    const stack = [start];
    while (stack.length) {
      const node = stack.pop()!;
      result.push(node);
      stack.push(...(this.children.get(node.id) ?? []));
    }
    return result;
  }

  /** True when `candidate` is `id` itself or one of its descendants. */
  isInSubtree(id: string, candidate: string) {
    return this.path(candidate).some((node) => node.id === id);
  }

  /** Folder names from just below `base` down to `id`, e.g. `['Drone', 'Raw']`. */
  relativeNames(id: string, base: string | null) {
    const names = this.path(id).map((node) => node.name);
    if (!base) return names;
    const basePath = this.path(base);
    return names.slice(basePath.length);
  }
}

/**
 * Loads all of the user's folders, binned ones included, into an in-memory index. Load it once
 * per request and use it for parent/child lookups instead of querying the tree level by level.
 */
export const loadFolderIndex = async (userId: string) =>
  new FolderIndex(
    await db
      .select({
        id: folder.id,
        parentId: folder.parentId,
        categoryId: folder.categoryId,
        name: folder.name,
        deletedAt: folder.deletedAt
      })
      .from(folder)
      .where(eq(folder.userId, userId))
  );
