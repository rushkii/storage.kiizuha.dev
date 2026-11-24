import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PRESIGNED_URL_EXPIRES_IN_SEC } from '#server/constants.ts';
import { s3, bucket } from './client.ts';
import {
  STORED_CONTENT_DISPOSITION,
  STORED_CONTENT_TYPE,
  getInlineContentType
} from './content-type.ts';

/**
 * Builds a `Content-Disposition` value that works with non-ASCII filenames (RFC 6266).
 * `attachment` forces a download; `inline` lets the browser preview it.
 */
export const toContentDisposition = (
  filename: string,
  type: 'attachment' | 'inline' = 'attachment'
) => {
  const fallback = filename.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
};

export type CreateUploadUrlOptions = {
  /** Exact byte size. When set, S3 rejects uploads of any other size. */
  contentLength?: number;
  expiresIn?: number;
};

/**
 * Presigned PUT URL for uploading one object straight from the browser.
 * The client must send the returned `headers` with the request, or the signature won't match.
 *
 * The uploader's file type is ignored: every object is stored as `application/octet-stream`
 * with `Content-Disposition: attachment` (see `content-type.ts`).
 */
export const createUploadUrl = async (
  key: string,
  { contentLength, expiresIn = PRESIGNED_URL_EXPIRES_IN_SEC }: CreateUploadUrlOptions = {}
) => {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: STORED_CONTENT_TYPE,
    ContentDisposition: STORED_CONTENT_DISPOSITION,
    ContentLength: contentLength
  });
  // The presigner leaves `content-type` unsigned by default, which would let the browser store
  // any type. Signing it makes S3 reject a PUT with a different `Content-Type`.
  const url = await getSignedUrl(s3, command, {
    expiresIn,
    signableHeaders: new Set(['content-type', 'content-disposition'])
  });

  const headers: Record<string, string> = {
    'Content-Type': STORED_CONTENT_TYPE,
    'Content-Disposition': STORED_CONTENT_DISPOSITION
  };

  return {
    url,
    method: 'PUT' as const,
    headers,
    expiresAt: new Date(Date.now() + expiresIn * 1000)
  };
};

export type CreateDownloadUrlOptions = {
  /**
   * Filename the browser saves the file as (the DB name; keys hold ids, not names).
   * Also decides whether `inline` is allowed, by its extension.
   */
  filename?: string;
  /**
   * `inline` lets the browser open the file instead of downloading it. Honored only for the
   * types in `content-type.ts` (raster images, PDF, video, audio); anything else, including
   * HTML and SVG, is still served as an `application/octet-stream` attachment.
   */
  disposition?: 'attachment' | 'inline';
  expiresIn?: number;
};

/**
 * Presigned GET URL so the browser downloads straight from S3, not through this server.
 * `Content-Type` and `Content-Disposition` are always set here, never taken from the stored object.
 */
export const createDownloadUrl = async (
  key: string,
  {
    filename,
    disposition = 'attachment',
    expiresIn = PRESIGNED_URL_EXPIRES_IN_SEC
  }: CreateDownloadUrlOptions = {}
) => {
  const inlineType = disposition === 'inline' && filename ? getInlineContentType(filename) : null;
  const type = inlineType ? 'inline' : 'attachment';

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentType: inlineType ?? STORED_CONTENT_TYPE,
    ResponseContentDisposition: filename ? toContentDisposition(filename, type) : type
  });
  return getSignedUrl(s3, command, { expiresIn });
};
