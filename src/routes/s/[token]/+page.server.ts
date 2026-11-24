import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { peekPublicShare } from '#server/storage/shares.ts';

// Public share page. No login. A file share redirects straight to a
// fresh presigned URL. A listing share renders the page, which loads the listing through the
// `getPublicListing` remote query. Expired, revoked and unknown tokens look the same.
export const load: PageServerLoad = async ({ params, setHeaders }) => {
  setHeaders({ 'X-Robots-Tag': 'noindex', 'Cache-Control': 'private, no-store' });

  const share = await peekPublicShare(params.token);
  // The presigned URL is built on the server, so the external redirect is safe.
  if (share?.kind === 'file') redirect(302, share.url, { external: true });
  return { available: share !== null };
};
