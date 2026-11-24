import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { safeRedirectPath } from '#server/guard.ts';

// Signed-in users never see the login page.
export const load: PageServerLoad = ({ locals, url }) => {
  if (locals.user) redirect(303, safeRedirectPath(url.searchParams.get('redirectTo')));
  return { redirectTo: safeRedirectPath(url.searchParams.get('redirectTo')) };
};
