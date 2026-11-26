import { createHash } from 'node:crypto';
import { and, desc, eq, gt, ne } from 'drizzle-orm';
import { isAPIError } from 'better-auth/api';
import { getRequestEvent } from '$app/server';
import { auth } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { session as sessionTable, user as userTable } from '#lib/server/db/schema.ts';
import {
  assertUserKey,
  createDownloadUrl,
  deleteObject,
  isUserKey,
  putObject,
  userObjectKey
} from '#lib/server/s3/index.ts';
import { generateId } from '#lib/id.ts';
import { describeUserAgent } from '#lib/user-agent.ts';
import { AVATAR_SOURCE_MAX_BYTES, type LoginMode } from '#lib/schemas/account.ts';
import { AVATAR_URL_EXPIRES_IN_SEC } from './constants.ts';
import { takeAttempt } from './rate-limit.ts';

export type PasswordCheck = 'ok' | 'invalid' | 'rateLimited';

/**
 * Checks the signed-in user's password with Better Auth, limited like login. Every settings
 * change calls this in the same request as the change itself.
 */
export const checkPassword = async (userId: string, password: string): Promise<PasswordCheck> => {
  if (!takeAttempt('password', userId)) return 'rateLimited';
  try {
    await auth.api.verifyPassword({
      body: { password },
      headers: getRequestEvent().request.headers
    });
    return 'ok';
  } catch (cause) {
    if (isAPIError(cause) && cause.statusCode === 400) return 'invalid';
    throw cause;
  }
};

const gravatarUrl = (email: string) => {
  const hash = createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  return `https://gravatar.com/avatar/${hash}?s=512&d=404`;
};

const avatarFilename = (key: string) => (key.endsWith('.jpg') ? 'avatar.jpg' : 'avatar.webp');

/** Fresh profile from the database, with a short-lived avatar URL. */
export const getProfile = async (userId: string) => {
  const [row] = await db
    .select({
      name: userTable.name,
      email: userTable.email,
      username: userTable.username,
      image: userTable.image,
      useGravatar: userTable.useGravatar
    })
    .from(userTable)
    .where(eq(userTable.id, userId));
  if (!row) return null;

  const hasAvatar = !!row.image && isUserKey(userId, row.image);
  let avatarUrl: string | null = null;
  if (hasAvatar && row.image) {
    avatarUrl = await createDownloadUrl(row.image, {
      filename: avatarFilename(row.image),
      disposition: 'inline',
      expiresIn: AVATAR_URL_EXPIRES_IN_SEC
    });
  } else if (row.useGravatar) {
    avatarUrl = gravatarUrl(row.email);
  }

  return {
    name: row.name,
    email: row.email,
    username: row.username ?? '',
    useGravatar: row.useGravatar ?? false,
    hasAvatar,
    avatarUrl
  };
};

/** Sniffs the cropped avatar's bytes; the declared type is never trusted. */
const avatarExtension = (bytes: Uint8Array) => {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes.length > 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  return null;
};

export type ProfileUpdate = {
  username: string;
  email: string;
  useGravatar: boolean;
  removeAvatar: boolean;
  avatar?: File;
};

export type ProfileConflict = 'username' | 'email' | 'avatar';

/**
 * Applies a profile change after the password check. Returns the field that blocked it, or
 * `null` when saved. A new avatar is written to R2 first and the old object deleted last, so a
 * failure never leaves the profile pointing at a missing object.
 */
export const updateProfile = async (
  userId: string,
  input: ProfileUpdate
): Promise<ProfileConflict | null> => {
  const [current] = await db
    .select({ image: userTable.image })
    .from(userTable)
    .where(eq(userTable.id, userId));
  if (!current) return null;

  const [usernameTaken] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(and(eq(userTable.username, input.username), ne(userTable.id, userId)));
  if (usernameTaken) return 'username';
  const [emailTaken] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(and(eq(userTable.email, input.email), ne(userTable.id, userId)));
  if (emailTaken) return 'email';

  let image = current.image;
  const upload = input.avatar && input.avatar.size > 0 ? input.avatar : null;
  if (upload) {
    if (upload.size > AVATAR_SOURCE_MAX_BYTES) return 'avatar';
    const bytes = new Uint8Array(await upload.arrayBuffer());
    const extension = avatarExtension(bytes);
    if (!extension) return 'avatar';
    image = userObjectKey(userId, 'avatars', `${generateId({ length: 16 })}.${extension}`);
    await putObject(image, bytes, { contentLength: bytes.byteLength });
  } else if (input.removeAvatar) {
    image = null;
  }

  await db
    .update(userTable)
    .set({ username: input.username, email: input.email, useGravatar: input.useGravatar, image })
    .where(eq(userTable.id, userId));

  if (current.image && current.image !== image && isUserKey(userId, current.image)) {
    assertUserKey(userId, current.image);
    await deleteObject(current.image).catch(() => {
      // An orphaned avatar object costs a few KB; the profile is already saved.
    });
  }
  return null;
};

/** Active sessions, the current one first, then by last activity. */
export const listSessions = async (userId: string, currentSessionId: string) => {
  const rows = await db
    .select()
    .from(sessionTable)
    .where(and(eq(sessionTable.userId, userId), gt(sessionTable.expiresAt, new Date())))
    .orderBy(desc(sessionTable.lastActiveAt), desc(sessionTable.createdAt));

  return rows
    .map((row) => ({
      id: row.id,
      current: row.id === currentSessionId,
      device: describeUserAgent(row.userAgent),
      userAgent: row.userAgent,
      ipAddress: row.ipAddress,
      loginMode: (row.loginMode as LoginMode | null) ?? null,
      loginDays: row.loginDays,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      lastActiveAt: (row.lastActiveAt ?? row.createdAt).toISOString()
    }))
    .sort((a, b) => Number(b.current) - Number(a.current));
};

/** Ends one session (never the current one), or every session but the current one. */
export const revokeSessions = async (
  userId: string,
  currentSessionId: string,
  target: 'others' | string
) => {
  const scope = and(eq(sessionTable.userId, userId), ne(sessionTable.id, currentSessionId));
  const deleted = await db
    .delete(sessionTable)
    .where(target === 'others' ? scope : and(scope, eq(sessionTable.id, target)))
    .returning({ id: sessionTable.id });
  return deleted.length;
};

export type PasswordChangeFailure = 'invalid' | 'rateLimited' | 'rejected';

/**
 * Changes the password and signs out every other session. Better Auth replaces the current
 * session with a new one, so the old session's login option and expiry are carried over to it.
 */
export const changePassword = async (
  userId: string,
  previous: { loginMode?: string | null; loginDays?: number | null; expiresAt: Date },
  currentPassword: string,
  newPassword: string
): Promise<PasswordChangeFailure | null> => {
  if (!takeAttempt('password', userId)) return 'rateLimited';
  let token: string | null;
  try {
    const result = await auth.api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions: true },
      headers: getRequestEvent().request.headers
    });
    token = result.token;
  } catch (cause) {
    if (isAPIError(cause)) {
      const code = (cause.body as { code?: string } | undefined)?.code;
      return code === 'INVALID_PASSWORD' ? 'invalid' : 'rejected';
    }
    throw cause;
  }

  if (token) {
    await db
      .update(sessionTable)
      .set({
        loginMode: previous.loginMode ?? null,
        loginDays: previous.loginDays ?? null,
        expiresAt: previous.expiresAt,
        lastActiveAt: new Date()
      })
      .where(eq(sessionTable.token, token));
  }
  return null;
};
