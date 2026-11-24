import * as v from 'valibot';
import { invalid } from '@sveltejs/kit';
import { command, form, query, requested } from '$app/server';
import { requireUser, requireUserForCommand } from '#server/guard.ts';
import {
  categoryNameSchema,
  idSchema,
  itemNameSchema,
  fileNameSchema,
  itemTypeSchema,
  newCategorySchema,
  newFolderSchema,
  recentQuerySchema,
  selectionSchema,
  tableQuerySchema
} from '#lib/schemas/storage.ts';
import * as library from '#server/storage/library.ts';
import { listRecent, recordOpen } from '#server/storage/recent.ts';
import { UserFacingError } from '#server/storage/errors.ts';
import { userFacing } from '#server/storage/remote-helpers.ts';

/** The signed-in user's categories and their root folders, for the sidebar. */
export const getSidebar = query(async () => {
  const user = requireUser();
  return library.getSidebar(user.id);
});

/** One page of a folder's contents plus its breadcrumb. `null` when the folder is gone or binned. */
export const getFolderView = query(
  v.object({ folderId: idSchema, table: tableQuerySchema }),
  async ({ folderId, table }) => {
    const user = requireUser();
    return library.getFolderView(user.id, folderId, table);
  }
);

/** Every live folder as a tree under its category, for the "Move to…" picker. */
export const getFolderTree = query(async () => {
  const user = requireUser();
  return library.getFolderTree(user.id);
});

/** Recently opened files and folders, with the Recent page's Type and Last opened filters. */
export const getRecent = query(recentQuerySchema, async (table) => {
  const user = requireUser();
  return listRecent(user.id, table);
});

// The client names the queries to refresh with `.updates(getFolderView, getRecent)`; without that
// these yield nothing.
const refreshFolderViews = () => requested(getFolderView, 4).refreshAll();
const refreshLists = () =>
  Promise.all([refreshFolderViews(), requested(getRecent, 2).refreshAll()]);

/** Form: adds a category and refreshes the sidebar. A taken name becomes a field error on `name`. */
export const createCategory = form(newCategorySchema, async ({ name }, issue) => {
  const user = requireUser();
  try {
    const created = await library.createCategory(user.id, name);
    void getSidebar().refresh();
    return created;
  } catch (cause) {
    if (cause instanceof UserFacingError) invalid(issue.name(cause.message));
    throw cause;
  }
});

/** Renames a category; refreshes the sidebar and any open folder views (their breadcrumbs). */
export const renameCategory = command(
  v.object({ categoryId: idSchema, name: categoryNameSchema }),
  async ({ categoryId, name }) => {
    const user = requireUserForCommand();
    await userFacing(() => library.renameCategory(user.id, categoryId, name));
    void getSidebar().refresh();
    await refreshFolderViews();
  }
);

/** Deletes an empty category and refreshes the sidebar. */
export const deleteCategory = command(idSchema, async (categoryId) => {
  const user = requireUserForCommand();
  await userFacing(() => library.deleteCategory(user.id, categoryId));
  void getSidebar().refresh();
});

/**
 * Form: creates a folder in a category or parent folder. A taken name becomes a field error
 * on `name`. Refreshes the sidebar and open folder views.
 */
export const createFolder = form(newFolderSchema, async (input, issue) => {
  const user = requireUser();
  try {
    const created = await library.createFolder(user.id, input);
    void getSidebar().refresh();
    await refreshFolderViews();
    return created;
  } catch (cause) {
    if (cause instanceof UserFacingError) invalid(issue.name(cause.message));
    throw cause;
  }
});

/** Renames a file or folder; refreshes open folder views and Recent. */
export const renameItem = command(
  v.variant('type', [
    v.object({ type: v.literal('folder'), id: idSchema, name: itemNameSchema }),
    v.object({ type: v.literal('file'), id: idSchema, name: fileNameSchema })
  ]),
  async (input) => {
    const user = requireUserForCommand();
    await userFacing(() => library.renameItem(user.id, input));
    if (input.type === 'folder') void getSidebar().refresh();
    await refreshLists();
  }
);

/** Moves the selection into another folder. Returns how many moved and why any failed. */
export const moveItems = command(
  v.object({ selection: selectionSchema, targetFolderId: idSchema }),
  async ({ selection, targetFolderId }) => {
    const user = requireUserForCommand();
    const result = await userFacing(() => library.moveItems(user.id, selection, targetFolderId));
    void getSidebar().refresh();
    await refreshLists();
    return result;
  }
);

/** Moves the selection to the bin without confirmation. Returns how many moved and why any failed. */
export const moveToBin = command(selectionSchema, async (selection) => {
  const user = requireUserForCommand();
  const result = await userFacing(() => library.moveToBin(user.id, selection));
  void getSidebar().refresh();
  await refreshLists();
  return result;
});

/** Called when a folder page is visited; feeds Recent. */
export const recordItemOpen = command(
  v.object({ type: itemTypeSchema, id: idSchema }),
  async ({ type, id }) => {
    const user = requireUserForCommand();
    await recordOpen(user.id, type, id);
  }
);
