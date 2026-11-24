import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type PutObjectCommandInput
} from '@aws-sdk/client-s3';
import { s3, bucket } from './client.ts';
import { STORED_CONTENT_DISPOSITION, STORED_CONTENT_TYPE } from './content-type.ts';
import { isS3NotFoundError } from './errors.ts';
import { assertFolderPrefix, encodeKey } from './keys.ts';
import { iterateObjects } from './list.ts';

/** S3 accepts at most 1000 keys per DeleteObjects request. */
const DELETE_BATCH_SIZE = 1000;

export type S3ObjectInfo = {
  key: string;
  size: number;
  contentType?: string;
  etag?: string;
  lastModified?: Date;
  metadata: Record<string, string>;
};

export type PutObjectOptions = {
  contentType?: string;
  /** Required by S3 when `body` is a stream of unknown length. */
  contentLength?: number;
  contentDisposition?: string;
  cacheControl?: string;
  /** Stored as `x-amz-meta-*` headers. Keys are lowercased by S3. */
  metadata?: Record<string, string>;
};

/**
 * Uploads a whole object in one request. For large browser uploads, use presigned multipart instead.
 * Defaults to `application/octet-stream` + `attachment` like browser uploads (see `content-type.ts`).
 */
export const putObject = async (
  key: string,
  body: NonNullable<PutObjectCommandInput['Body']>,
  options: PutObjectOptions = {}
) => {
  const result = await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: options.contentType ?? STORED_CONTENT_TYPE,
      ContentLength: options.contentLength,
      ContentDisposition: options.contentDisposition ?? STORED_CONTENT_DISPOSITION,
      CacheControl: options.cacheControl,
      Metadata: options.metadata
    })
  );
  return { key, etag: result.ETag };
};

/**
 * Reads an object as a web `ReadableStream`. Returns `null` when the key does not exist.
 *
 * `range` is an HTTP Range header value, e.g. `bytes=0-1023`.
 *
 * Stored files are untrusted content and the server never executes them: treat `body` as opaque bytes, never write it to disk or pass it to
 * anything that runs code. If you return it from the app origin, set fixed `Content-Type` /
 * `Content-Disposition: attachment` headers plus `X-Content-Type-Options: nosniff`; never copy
 * `info.contentType` into the response.
 */
export const getObject = async (key: string, { range }: { range?: string } = {}) => {
  try {
    const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: range }));
    if (!result.Body) return null;

    return {
      body: result.Body.transformToWebStream(),
      info: {
        key,
        size: result.ContentLength ?? 0,
        contentType: result.ContentType,
        etag: result.ETag,
        lastModified: result.LastModified,
        metadata: result.Metadata ?? {}
      } satisfies S3ObjectInfo,
      contentRange: result.ContentRange
    };
  } catch (error) {
    if (isS3NotFoundError(error)) return null;
    throw error;
  }
};

/** Reads an object's metadata without downloading it. Returns `null` when it does not exist. */
export const headObject = async (key: string): Promise<S3ObjectInfo | null> => {
  try {
    const result = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return {
      key,
      size: result.ContentLength ?? 0,
      contentType: result.ContentType,
      etag: result.ETag,
      lastModified: result.LastModified,
      metadata: result.Metadata ?? {}
    };
  } catch (error) {
    if (isS3NotFoundError(error)) return null;
    throw error;
  }
};

/** True when an object exists at `key`. */
export const objectExists = async (key: string) => (await headObject(key)) !== null;

/** Deletes one object. Succeeds even if the key does not exist. */
export const deleteObject = async (key: string) => {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
};

/**
 * Deletes many objects in batches of 1000. Throws if S3 reports any key it could not delete,
 * listing those keys in the error message.
 */
export const deleteObjects = async (keys: string[]) => {
  const failed: string[] = [];

  for (let i = 0; i < keys.length; i += DELETE_BATCH_SIZE) {
    const batch = keys.slice(i, i + DELETE_BATCH_SIZE);
    const result = await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true }
      })
    );
    for (const error of result.Errors ?? []) failed.push(`${error.Key} (${error.Code})`);
  }

  if (failed.length) throw new Error(`Failed to delete S3 objects: ${failed.join(', ')}`);
};

/** Deletes every object under `prefix`, e.g. a folder or a whole user space. Returns the count. */
export const deletePrefix = async (prefix: string) => {
  if (!prefix) throw new Error('Refusing to delete with an empty prefix (whole bucket)');
  assertFolderPrefix(prefix);

  let deleted = 0;
  let batch: string[] = [];

  for await (const object of iterateObjects(prefix)) {
    batch.push(object.key);
    if (batch.length === DELETE_BATCH_SIZE) {
      await deleteObjects(batch);
      deleted += batch.length;
      batch = [];
    }
  }
  if (batch.length) {
    await deleteObjects(batch);
    deleted += batch.length;
  }

  return deleted;
};

/** Server-side copy; the data never passes through this server. Limited to 5 GB by S3. */
export const copyObject = async (sourceKey: string, destinationKey: string) => {
  const result = await s3.send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: destinationKey,
      CopySource: `${bucket}/${encodeKey(sourceKey)}`
    })
  );
  return { key: destinationKey, etag: result.CopyObjectResult?.ETag };
};

/** Copies then deletes the source. S3 has no native rename. */
export const moveObject = async (sourceKey: string, destinationKey: string) => {
  const result = await copyObject(sourceKey, destinationKey);
  await deleteObject(sourceKey);
  return result;
};
