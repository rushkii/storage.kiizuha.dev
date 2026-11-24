import { and, eq, lt, sql } from 'drizzle-orm';
import { db } from '#server/db/index.ts';
import { file, folder, uploadSession, type CompletedPart } from '#server/db/schema.ts';
import {
  abortMultipartUpload,
  assertUserKey,
  completeMultipartUpload,
  createPartUploadUrl,
  getMultipartPartSize,
  startMultipartUpload,
  userObjectKey
} from '#server/s3/index.ts';
import { UserFacingError } from './errors.ts';
import { loadFolderIndex } from './folder-index.ts';

// Resumable uploads. Each file is an S3 multipart upload tracked by an `upload_session` row:
// the browser asks for one presigned URL per part, reports each finished part, and the server
// completes the upload and creates the file row. The session survives reloads until it is
// completed, aborted, or abandoned for 7 days.

const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

const partCountOf = (size: number, partSize: number) => Math.max(1, Math.ceil(size / partSize));

/** The session row, only when it belongs to `userId`. Never trusts a key or uploadId from the client. */
const loadSession = async (userId: string, sessionId: string) => {
  const [row] = await db
    .select()
    .from(uploadSession)
    .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.userId, userId)));
  if (!row) throw new UserFacingError('This upload no longer exists. Start it again.', 404);
  assertUserKey(userId, row.key);
  return row;
};

/**
 * Opens a multipart upload for one file in a live folder and stores its session. The object key
 * is generated here from the user id and a new file id, never taken from the client.
 * @returns The session id plus the part size and part count the browser must slice the file into.
 * @throws {UserFacingError} 404 when the destination folder is gone or in the bin.
 */
export const startUpload = async (
  userId: string,
  input: {
    folderId: string;
    fileName: string;
    size: number;
    lastModified: number;
    contentType: string;
  }
) => {
  const index = await loadFolderIndex(userId);
  if (!index.get(input.folderId) || index.isBinned(input.folderId)) {
    throw new UserFacingError('The destination folder no longer exists.', 404);
  }

  const fileId = crypto.randomUUID();
  const key = userObjectKey(userId, fileId);
  const partSize = getMultipartPartSize(input.size);
  const { uploadId } = await startMultipartUpload(key);

  const [row] = await db
    .insert(uploadSession)
    .values({
      userId,
      folderId: input.folderId,
      fileId,
      key,
      uploadId,
      fileName: input.fileName,
      size: input.size,
      lastModified: input.lastModified,
      contentType: input.contentType || 'application/octet-stream',
      partSize
    })
    .returning({ id: uploadSession.id });

  return { sessionId: row.id, partSize, partCount: partCountOf(input.size, partSize) };
};

/** Requested right before each part is sent; URLs expire after 15 minutes. */
export const getPartUploadUrl = async (userId: string, sessionId: string, partNumber: number) => {
  const session = await loadSession(userId, sessionId);
  if (partNumber > partCountOf(session.size, session.partSize)) {
    throw new UserFacingError('This part is outside the file.');
  }
  return createPartUploadUrl(session.key, session.uploadId, partNumber);
};

/**
 * Records one finished part. Parts of the same file finish in parallel, so the row is updated
 * in one statement instead of read-modify-write.
 */
export const recordPart = async (userId: string, sessionId: string, part: CompletedPart) => {
  const entry = JSON.stringify([{ partNumber: part.partNumber, etag: part.etag }]);
  const rows = await db
    .update(uploadSession)
    .set({
      completedParts: sql`coalesce((
        select jsonb_agg(e) from jsonb_array_elements(${uploadSession.completedParts}) e
        where (e->>'partNumber')::int <> ${part.partNumber}
      ), '[]'::jsonb) || ${entry}::jsonb`,
      status: 'uploading',
      lastActivityAt: new Date()
    })
    .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.userId, userId)))
    .returning({ id: uploadSession.id });
  if (!rows.length) throw new UserFacingError('This upload no longer exists. Start it again.', 404);
};

/**
 * Marks a session as uploading or paused and refreshes its activity time, so a paused upload
 * is not treated as abandoned. Does nothing when the session is not the user's.
 */
export const setUploadStatus = async (
  userId: string,
  sessionId: string,
  status: 'uploading' | 'paused'
) => {
  await db
    .update(uploadSession)
    .set({ status, lastActivityAt: new Date() })
    .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.userId, userId)));
};

/** Completes the multipart upload, then creates the file row and drops the session in one transaction. */
export const completeUpload = async (userId: string, sessionId: string) => {
  const session = await loadSession(userId, sessionId);
  const expected = partCountOf(session.size, session.partSize);
  const parts = [...new Map(session.completedParts.map((p) => [p.partNumber, p])).values()];
  if (parts.length !== expected) {
    throw new UserFacingError(
      `Only ${parts.length} of ${expected} parts arrived. Resume the upload to send the rest.`
    );
  }

  await completeMultipartUpload(session.key, session.uploadId, parts);

  const [{ name: folderName }] = await db
    .select({ name: folder.name })
    .from(folder)
    .where(eq(folder.id, session.folderId));

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(file)
      .values({
        id: session.fileId,
        userId,
        folderId: session.folderId,
        name: session.fileName,
        key: session.key,
        size: session.size,
        contentType: session.contentType
      })
      .returning({ id: file.id, name: file.name, folderId: file.folderId });
    await tx.delete(uploadSession).where(eq(uploadSession.id, session.id));
    return row;
  });

  return { ...created, folderName };
};

/** No undo: aborts the R2 upload (dropping stored parts) and deletes the session. */
export const abortUpload = async (userId: string, sessionId: string) => {
  const session = await loadSession(userId, sessionId);
  await abortMultipartUpload(session.key, session.uploadId);
  await db.delete(uploadSession).where(eq(uploadSession.id, session.id));
};

/** Unfinished uploads, shown after a reload as "paused (page reloaded)". */
export const listPendingUploads = async (userId: string) => {
  const rows = await db
    .select({
      id: uploadSession.id,
      folderId: uploadSession.folderId,
      folderName: folder.name,
      fileName: uploadSession.fileName,
      size: uploadSession.size,
      lastModified: uploadSession.lastModified,
      partSize: uploadSession.partSize,
      completedParts: uploadSession.completedParts,
      lastActivityAt: uploadSession.lastActivityAt
    })
    .from(uploadSession)
    .innerJoin(folder, eq(folder.id, uploadSession.folderId))
    .where(eq(uploadSession.userId, userId));

  return rows.map((row) => ({
    ...row,
    partCount: partCountOf(row.size, row.partSize),
    uploadedBytes: Math.min(row.size, row.completedParts.length * row.partSize)
  }));
};

/**
 * Scheduled job: aborts multipart uploads with no activity for 7 days and deletes their
 * sessions, so abandoned parts stop taking up storage.
 */
export const abortStaleUploads = async (now = new Date()) => {
  const stale = await db
    .select()
    .from(uploadSession)
    .where(lt(uploadSession.lastActivityAt, new Date(now.getTime() - STALE_AFTER_MS)));
  for (const session of stale) {
    assertUserKey(session.userId, session.key);
    await abortMultipartUpload(session.key, session.uploadId).catch(() => undefined);
    await db.delete(uploadSession).where(eq(uploadSession.id, session.id));
  }
  return stale.length;
};
