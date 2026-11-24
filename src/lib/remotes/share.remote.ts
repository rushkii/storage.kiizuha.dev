import * as v from 'valibot';
import { command, query, requested } from '$app/server';
import { requireUser, requireUserForCommand } from '#server/guard.ts';
import {
  SHARE_EXPIRY_OPTIONS,
  idSchema,
  selectionSchema,
  tableQuerySchema
} from '#lib/schemas/storage.ts';
import * as shares from '#server/storage/shares.ts';
import { userFacing } from '#server/storage/remote-helpers.ts';

// Share links: creating and revoking them, the "What I shared" list, and the public listing.

/** The selection as a folder tree, for ticking which files to share. */
export const getShareTree = query(selectionSchema, async (selection) => {
  const user = requireUser();
  return shares.getShareTree(user.id, selection);
});

/** Active share links (not revoked or expired), for the "What I shared" page. */
export const getShares = query(tableQuerySchema, async (table) => {
  const user = requireUser();
  return shares.listShares(user.id, table);
});

/** Creates a share link and refreshes the shares list. Returns the token, expiry and file count. */
export const createShare = command(
  v.object({
    selection: selectionSchema,
    tickedFileIds: v.pipe(v.array(idSchema), v.maxLength(5000)),
    title: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter a title.'), v.maxLength(200)),
    expiry: v.picklist(SHARE_EXPIRY_OPTIONS)
  }),
  async (input) => {
    const user = requireUserForCommand();
    const created = await userFacing(() => shares.createShare(user.id, input));
    await requested(getShares, 2).refreshAll();
    return created;
  }
);

/**
 * Public, no login: the listing of a share page. `null` for expired, revoked or unknown tokens,
 * and for shares whose files were all binned or deleted.
 */
export const getPublicListing = query(v.pipe(v.string(), v.maxLength(64)), async (token) => {
  const resolved = await shares.resolvePublicShare(token);
  return resolved?.kind === 'listing' ? resolved.listing : null;
});

/**
 * Revokes share links and refreshes the shares list. The client names the list with
 * `.updates(...)`; without it nothing is refreshed. Returns how many were revoked.
 */
export const unshare = command(
  v.pipe(v.array(idSchema), v.minLength(1), v.maxLength(500)),
  async (shareIds) => {
    const user = requireUserForCommand();
    const revoked = await userFacing(() => shares.unshare(user.id, shareIds));
    await requested(getShares, 2).refreshAll();
    return revoked;
  }
);
