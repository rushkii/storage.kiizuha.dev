/**
 * Presigned multipart upload, for files too large for a single PUT (> 5 GB) or that should be
 * resumable. Flow:
 *
 * 1. Server: `startMultipartUpload` → `uploadId`
 * 2. Server: `createPartUploadUrl` for each part (1-based, every part but the last ≥ 5 MiB)
 * 3. Browser: PUT each part to its URL and keep the `ETag` response header
 *    (the bucket CORS config must expose `ETag`)
 * 4. Server: `completeMultipartUpload` with every `{ partNumber, etag }`,
 *    or `abortMultipartUpload` to discard the parts already stored.
 */
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PRESIGNED_URL_EXPIRES_IN_SEC } from '#server/constants.ts';
import { s3, bucket } from './client.ts';
import { STORED_CONTENT_DISPOSITION, STORED_CONTENT_TYPE } from './content-type.ts';

/** S3 minimum for every part except the last. */
export const MULTIPART_MIN_PART_SIZE = 5 * 1024 * 1024;
/** S3 maximum number of parts per upload. */
export const MULTIPART_MAX_PARTS = 10_000;

export type UploadedPart = { partNumber: number; etag: string };

/** Smallest part size (≥ 5 MiB) that fits `fileSize` within the 10,000-part limit. */
export const getMultipartPartSize = (fileSize: number, preferred = 16 * 1024 * 1024) =>
  Math.max(MULTIPART_MIN_PART_SIZE, preferred, Math.ceil(fileSize / MULTIPART_MAX_PARTS));

/**
 * The uploader's file type is ignored: every object is stored as `application/octet-stream`
 * with `Content-Disposition: attachment` (see `content-type.ts`).
 */
export const startMultipartUpload = async (
  key: string,
  { metadata }: { metadata?: Record<string, string> } = {}
) => {
  const result = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: STORED_CONTENT_TYPE,
      ContentDisposition: STORED_CONTENT_DISPOSITION,
      Metadata: metadata
    })
  );
  if (!result.UploadId) throw new Error(`S3 returned no UploadId for "${key}"`);
  return { key, uploadId: result.UploadId };
};

/**
 * Presigned PUT URL for one part of a multipart upload.
 * @param partNumber 1-based, at most `MULTIPART_MAX_PARTS`.
 * @param expiresIn Seconds until the URL expires.
 * @throws {Error} When `partNumber` is not an integer in range.
 */
export const createPartUploadUrl = (
  key: string,
  uploadId: string,
  partNumber: number,
  expiresIn = PRESIGNED_URL_EXPIRES_IN_SEC
) => {
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > MULTIPART_MAX_PARTS) {
    throw new Error(`partNumber must be an integer between 1 and ${MULTIPART_MAX_PARTS}`);
  }
  const command = new UploadPartCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber
  });
  return getSignedUrl(s3, command, { expiresIn });
};

/**
 * Joins the uploaded parts into the final object. Parts may be passed in any order; they are
 * sorted before sending, as S3 requires.
 */
export const completeMultipartUpload = async (
  key: string,
  uploadId: string,
  parts: UploadedPart[]
) => {
  const result = await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        // S3 requires parts in ascending order.
        Parts: [...parts]
          .sort((a, b) => a.partNumber - b.partNumber)
          .map(({ partNumber, etag }) => ({ PartNumber: partNumber, ETag: etag }))
      }
    })
  );
  return { key, etag: result.ETag };
};

/** Cancels a multipart upload and discards any parts S3 has already stored. */
export const abortMultipartUpload = async (key: string, uploadId: string) => {
  await s3.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }));
};
