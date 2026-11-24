import { command, query, requested } from '$app/server';
import { requireUser, requireUserForCommand } from '#server/guard.ts';
import { selectionSchema, tableQuerySchema } from '#lib/schemas/storage.ts';
import * as bin from '#server/storage/bin.ts';
import { userFacing } from '#server/storage/remote-helpers.ts';
import { getFolderView, getSidebar } from './library.remote.ts';

// Bin page: list, restore, preview and permanently delete binned items.

/** One page of binned items, each with days left before automatic deletion. */
export const getBin = query(tableQuerySchema, async (table) => {
  const user = requireUser();
  return bin.listBin(user.id, table);
});

/** Restores items to their original location; refreshes the bin, sidebar and folder views. */
export const restoreItems = command(selectionSchema, async (selection) => {
  const user = requireUserForCommand();
  const result = await userFacing(() => bin.restoreItems(user.id, selection));
  void getSidebar().refresh();
  await Promise.all([requested(getBin, 2).refreshAll(), requested(getFolderView, 4).refreshAll()]);
  return result;
});

/** What a permanent delete would remove, listed in the confirmation dialog. */
export const getDeletePreview = query(selectionSchema, async (selection) => {
  const user = requireUser();
  return bin.previewPermanentDelete(user.id, selection);
});

/** The UI asks the user to type "delete permanently" first; this only runs after that. */
export const deletePermanently = command(selectionSchema, async (selection) => {
  const user = requireUserForCommand();
  const result = await userFacing(() => bin.deletePermanently(user.id, selection));
  await requested(getBin, 2).refreshAll();
  return result;
});
