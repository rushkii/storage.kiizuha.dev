import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { command, query, requested } from '$app/server';
import { requireUser, requireUserForCommand } from '#server/guard.ts';
import { MULTIPART_MAX_PARTS } from '#server/s3/index.ts';
import { fileNameSchema, idSchema, selectionSchema } from '#lib/schemas/storage.ts';
import * as uploads from '#server/storage/uploads.ts';
import * as downloads from '#server/storage/downloads.ts';
import { recordOpen } from '#server/storage/recent.ts';
import { userFacing } from '#server/storage/remote-helpers.ts';
import { getFolderView } from './library.remote.ts';

// Resumable multipart uploads and download planning (direct links or browser-built zips).

const partNumberSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(1),
  v.maxValue(MULTIPART_MAX_PARTS)
);

/** Opens a resumable upload session for one file and returns its part size and count. */
export const startUpload = command(
  v.object({
    folderId: idSchema,
    fileName: fileNameSchema,
    size: v.pipe(v.number(), v.integer(), v.minValue(0)),
    lastModified: v.pipe(v.number(), v.integer(), v.minValue(0)),
    contentType: v.pipe(v.string(), v.maxLength(255))
  }),
  async (input) => {
    const user = requireUserForCommand();
    return userFacing(() => uploads.startUpload(user.id, input));
  }
);

/** Presigned URL for one part of an upload session. */
export const getPartUploadUrl = command(
  v.object({ sessionId: idSchema, partNumber: partNumberSchema }),
  async ({ sessionId, partNumber }) => {
    const user = requireUserForCommand();
    return userFacing(() => uploads.getPartUploadUrl(user.id, sessionId, partNumber));
  }
);

/** Saves a finished part's ETag so the upload can resume after a reload. */
export const recordUploadedPart = command(
  v.object({
    sessionId: idSchema,
    partNumber: partNumberSchema,
    etag: v.pipe(v.string(), v.minLength(1), v.maxLength(128))
  }),
  async ({ sessionId, partNumber, etag }) => {
    const user = requireUserForCommand();
    await userFacing(() => uploads.recordPart(user.id, sessionId, { partNumber, etag }));
  }
);

/** Pauses or resumes an upload session; keeps it from being treated as abandoned. */
export const setUploadPaused = command(
  v.object({ sessionId: idSchema, paused: v.boolean() }),
  async ({ sessionId, paused }) => {
    const user = requireUserForCommand();
    await uploads.setUploadStatus(user.id, sessionId, paused ? 'paused' : 'uploading');
  }
);

/** Finishes an upload, creates the file row, and refreshes open folder views. */
export const completeUpload = command(idSchema, async (sessionId) => {
  const user = requireUserForCommand();
  const created = await userFacing(() => uploads.completeUpload(user.id, sessionId));
  await requested(getFolderView, 4).refreshAll();
  return created;
});

/** Cancels an upload and discards its stored parts. */
export const abortUpload = command(idSchema, async (sessionId) => {
  const user = requireUserForCommand();
  await userFacing(() => uploads.abortUpload(user.id, sessionId));
});

/** Unfinished uploads to show as "paused (page reloaded)" after a reload. */
export const getPendingUploads = query(async () => {
  const user = requireUser();
  return uploads.listPendingUploads(user.id);
});

/** What a download of the selection will do, so the UI can ask before starting several. */
export const planDownload = command(selectionSchema, async (selection) => {
  const user = requireUserForCommand();
  const plan = await userFacing(() => downloads.planDownload(user.id, selection));
  for (const fileId of selection.fileIds) await recordOpen(user.id, 'file', fileId);
  return plan;
});

/** Presigned URL for one file; counts as an open for Recent. */
export const getFileDownloadUrl = command(idSchema, async (fileId) => {
  const user = requireUserForCommand();
  const result = await downloads.fileDownloadUrl(user.id, fileId);
  if (!result) error(404, 'This file no longer exists.');
  await recordOpen(user.id, 'file', fileId);
  return result;
});
