import { error } from '@sveltejs/kit';
import { makeZip, predictLength } from 'client-zip';
import type { RequestHandler } from './$types';
import { getObject, assertUserKey } from '#server/s3/index.ts';
import { ZIP_PART_MAX_BYTES } from '#lib/schemas/storage.ts';
import { dedupePaths, expandSelection } from '#server/storage/downloads.ts';
import { toContentDisposition } from '#server/s3/index.ts';

const ID = /^[A-Za-z0-9-]{1,64}$/;

const readIds = (form: FormData, field: string) => {
  const values = form.getAll(field).map(String);
  if (values.length > 5000 || values.some((value) => !ID.test(value)))
    error(400, 'Invalid request.');
  return values;
};

const safeZipName = (value: FormDataEntryValue | null) => {
  const name = [...String(value ?? 'download')]
    .map((char) => (char.charCodeAt(0) < 0x20 || '\\/:*?"<>|'.includes(char) ? '_' : char))
    .join('')
    .trim()
    .slice(0, 150);
  return `${name || 'download'}.zip`;
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) error(401, 'Sign in again to download.');

  const form = await request.formData();
  const selection = {
    fileIds: readIds(form, 'selectionFileIds'),
    folderIds: readIds(form, 'selectionFolderIds')
  };
  const wanted = new Set(readIds(form, 'ids'));
  if (!wanted.size) error(400, 'Choose at least one file.');

  // Resolve ids to rows owned by this user; never accept keys or paths from the client.
  const files = dedupePaths(
    (await expandSelection(user.id, selection)).filter((f) => wanted.has(f.id))
  );
  if (files.length !== wanted.size)
    error(404, 'Some files no longer exist. Refresh and try again.');

  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > ZIP_PART_MAX_BYTES) error(413, 'This zip would be larger than 100 MB.');

  for (const f of files) assertUserKey(user.id, f.key);

  const entries = async function* () {
    for (const f of files) {
      const object = await getObject(f.key);
      if (!object) throw new Error(`Missing object for file ${f.id}`);
      yield { name: f.zipPath, lastModified: f.updatedAt, size: f.size, input: object.body };
    }
  };

  const length = predictLength(files.map((f) => ({ name: f.zipPath, size: f.size })));
  const filename = safeZipName(form.get('name'));

  return new Response(makeZip(entries()), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': toContentDisposition(filename, 'attachment'),
      'Content-Length': length.toString(),
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': 'sandbox',
      'Cache-Control': 'private, no-store'
    }
  });
};
