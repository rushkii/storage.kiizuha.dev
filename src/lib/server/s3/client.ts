import { S3Client } from '@aws-sdk/client-s3';
import {
  S3_ENDPOINT,
  S3_REGION,
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
  S3_BUCKET
} from '$app/env/private';

if (!S3_BUCKET) throw new Error('S3_BUCKET is not set');
if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
  throw new Error('S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set');
}

export const bucket = S3_BUCKET;

export const s3 = new S3Client({
  region: S3_REGION ?? 'auto',
  endpoint: S3_ENDPOINT,
  credentials: {
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY
  },
  // The SDK adds CRC32 checksums to every request by default, which R2, MinIO and
  // other S3-compatible providers may reject, and which breaks presigned browser uploads.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED'
});
