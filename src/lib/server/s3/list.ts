import { ListObjectsV2Command, paginateListObjectsV2, type _Object } from '@aws-sdk/client-s3';
import { s3, bucket } from './client.ts';
import { assertFolderPrefix } from './keys.ts';

export type S3ObjectSummary = {
  key: string;
  size: number;
  etag?: string;
  lastModified?: Date;
};

export type ListObjectsOptions = {
  prefix?: string;
  /** Pass `'/'` to list one folder level: sub-folders come back in `folders`. */
  delimiter?: string;
  /** Page size, max 1000. */
  limit?: number;
  /** `nextCursor` from the previous page. */
  cursor?: string;
};

export type ListObjectsResult = {
  objects: S3ObjectSummary[];
  folders: string[];
  nextCursor?: string;
};

const toSummary = (object: _Object): S3ObjectSummary => ({
  key: object.Key ?? '',
  size: object.Size ?? 0,
  etag: object.ETag,
  lastModified: object.LastModified
});

/** Lists one page of objects. Use `nextCursor` to fetch the next page. */
export const listObjects = async ({
  prefix,
  delimiter,
  limit = 1000,
  cursor
}: ListObjectsOptions = {}): Promise<ListObjectsResult> => {
  const result = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      Delimiter: delimiter,
      MaxKeys: limit,
      ContinuationToken: cursor
    })
  );

  return {
    objects: (result.Contents ?? []).map(toSummary),
    folders: (result.CommonPrefixes ?? []).flatMap((p) => (p.Prefix ? [p.Prefix] : [])),
    nextCursor: result.IsTruncated ? result.NextContinuationToken : undefined
  };
};

/** Lists one folder level: direct files plus sub-folder prefixes. `prefix` must end with `/`. */
export const listFolder = (
  prefix: string,
  options: Omit<ListObjectsOptions, 'prefix' | 'delimiter'> = {}
) => {
  assertFolderPrefix(prefix, { allowRoot: true });
  return listObjects({ ...options, prefix, delimiter: '/' });
};

/** Yields every object under `prefix` (recursively), fetching pages as needed. */
export async function* iterateObjects(prefix?: string): AsyncGenerator<S3ObjectSummary> {
  for await (const page of paginateListObjectsV2(
    { client: s3 },
    { Bucket: bucket, Prefix: prefix }
  )) {
    for (const object of page.Contents ?? []) yield toSummary(object);
  }
}

/** Total object count and byte size under `prefix`, e.g. a user's storage usage. */
export const getPrefixUsage = async (prefix: string) => {
  assertFolderPrefix(prefix);
  let count = 0;
  let size = 0;
  for await (const object of iterateObjects(prefix)) {
    count += 1;
    size += object.size;
  }
  return { count, size };
};
