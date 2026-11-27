import type { LayoutServerLoad } from './$types';

// Who is looking, for pages outside the (app) group: the root error page picks its
// signed-in or guest variant from this. Name only, nothing sensitive.
export const load: LayoutServerLoad = ({ locals }) => {
  return { viewer: locals.user ? { name: locals.user.name } : null };
};
