import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { resolvePublicFile } from '#server/storage/shares.ts';

// One file of a listing share. Checks the file belongs to the share, then redirects to a
// fresh presigned URL. Share links are stable app URLs; presigned URLs are never handed out.
export const load: PageServerLoad = async ({ params, setHeaders }) => {
  setHeaders({ 'X-Robots-Tag': 'noindex', 'Cache-Control': 'private, no-store' });
  const url = await resolvePublicFile(params.token, params.fileId);
  if (!url) error(404, 'This link has expired or was removed');
  // Presigned storage URL built on the server, so the external redirect is safe.
  redirect(302, url, { external: true });
};
