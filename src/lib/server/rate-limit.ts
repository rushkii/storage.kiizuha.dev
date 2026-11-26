import { getRequestEvent } from '$app/server';

/**
 * In-memory fixed-window limiter for password checks. Better Auth rate-limits only requests that
 * reach it over HTTP; `auth.api.*` calls made from remote functions skip its limiter, so every
 * remote function that checks a password limits itself here. Fine for a single instance.
 */
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;
const buckets = new Map<string, { count: number; resetAt: number }>();

const sweep = (now: number) => {
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
};

/** Client IP as Better Auth sees it (`x-real-ip`, set by Caddy). Empty in local dev. */
const clientIp = () => getRequestEvent().request.headers.get('x-real-ip') ?? '';

/**
 * Counts one attempt for `action` from this client and returns `false` once the client is over
 * the limit. Keyed by IP and, when given, by user, so one IP cannot lock out other users.
 */
export const takeAttempt = (action: string, userId = '') => {
  const now = Date.now();
  if (buckets.size > 10_000) sweep(now);

  const key = `${action}:${clientIp()}:${userId}`;
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= MAX_ATTEMPTS;
};
