const USERS_ROOT = 'users';

/**
 * Joins path segments into an object key. Splits on `/`, drops empty segments and
 * rejects `.`/`..` so user-supplied names cannot escape their prefix.
 *
 * `joinKey('users', 'abc', '/photos/', 'cat.png')` → `users/abc/photos/cat.png`
 */
export const joinKey = (...segments: string[]) => {
  const parts = segments.flatMap((segment) => segment.split('/')).filter(Boolean);
  if (parts.some((part) => part === '.' || part === '..')) {
    throw new Error(`Invalid S3 key segment in "${segments.join('/')}"`);
  }
  return parts.join('/');
};

/** Turns a folder path into a list prefix with a trailing slash. Empty path → bucket root. */
export const toPrefix = (...segments: string[]) => {
  const key = joinKey(...segments);
  return key ? `${key}/` : '';
};

/**
 * Checks that `userId` is one plain key segment. Without this, an id like `a/b` or `..` would
 * point into another user's space.
 */
const assertUserId = (userId: string) => {
  if (!userId || userId.includes('/') || userId === '.' || userId === '..') {
    throw new Error(`Invalid user id for an S3 key: "${userId}"`);
  }
};

/**
 * Key of a file inside a user's private space: `users/<userId>/<...path>`.
 * Throws when `path` is empty, since `users/<userId>` without a trailing slash is a prefix of
 * every id that starts with the same characters; use `userPrefix` for the space itself.
 */
export const userObjectKey = (userId: string, ...path: string[]) => {
  assertUserId(userId);
  const key = joinKey(USERS_ROOT, userId, ...path);
  if (key === joinKey(USERS_ROOT, userId)) {
    throw new Error('userObjectKey needs a path; use userPrefix for the whole user space');
  }
  return key;
};

/** Prefix of a folder inside a user's private space: `users/<userId>/<...path>/`. */
export const userPrefix = (userId: string, ...path: string[]) => {
  assertUserId(userId);
  return toPrefix(USERS_ROOT, userId, ...path);
};

/**
 * True when `key` is a normalized object key inside `userId`'s space. Use it on any key that did
 * not come straight from `userObjectKey` in this request (DB rows, client input).
 */
export const isUserKey = (userId: string, key: string) => {
  const prefix = userPrefix(userId);
  try {
    return key.startsWith(prefix) && key.length > prefix.length && joinKey(key) === key;
  } catch {
    return false;
  }
};

/** Throws unless `key` is inside `userId`'s space (see `isUserKey`). */
export const assertUserKey = (userId: string, key: string) => {
  if (!isUserKey(userId, key)) {
    throw new Error(`S3 key "${key}" is outside the user's space`);
  }
};

/**
 * Throws unless `prefix` ends with `/`. A prefix without it also matches siblings, e.g.
 * `users/abc` matches `users/abcd/...`. `''` (bucket root) is allowed only when `allowRoot` is set.
 */
export const assertFolderPrefix = (prefix: string, { allowRoot = false } = {}) => {
  if (prefix === '' && allowRoot) return;
  if (!prefix.endsWith('/')) {
    throw new Error(`S3 folder prefix must end with "/", got "${prefix}"; use userPrefix/toPrefix`);
  }
};

/** Last segment of a key, e.g. `users/abc/photos/cat.png` → `cat.png`. */
export const basename = (key: string) => key.replace(/\/+$/, '').split('/').pop() ?? '';

/** Percent-encodes each segment of a key, keeping `/` (needed for `CopySource`). */
export const encodeKey = (key: string) => key.split('/').map(encodeURIComponent).join('/');
