import { S3ServiceException } from '@aws-sdk/client-s3';

/** True when S3 answered 404 (`NoSuchKey` from GET, `NotFound` from HEAD). */
export const isS3NotFoundError = (error: unknown): error is S3ServiceException =>
  error instanceof S3ServiceException &&
  (error.name === 'NoSuchKey' ||
    error.name === 'NotFound' ||
    error.$metadata.httpStatusCode === 404);
