import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// Session gate plus the signed-in user's public profile for the sidebar.
// Data comes from remote functions, which check auth themselves too.
export const load: LayoutServerLoad = ({ locals, url }) => {
  if (!locals.user) {
    const redirectTo = `${url.pathname}${url.search}`;
    redirect(303, `/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  const { name, email, username } = locals.user;
  return { user: { name, email, username: username ?? null } };
};
