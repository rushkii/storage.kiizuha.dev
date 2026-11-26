import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { session as sessionTable } from '#lib/server/db/schema.ts';
import type { LoginMode } from '#lib/schemas/account.ts';
import {
  IDLE_LOGIN_SEC,
  LOGIN_DAY_SEC,
  SESSION_ACTIVITY_WRITE_SEC,
  UNTIL_LOGOUT_IDLE_SEC
} from './constants.ts';

type SessionRow = {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  loginMode?: string | null;
  lastActiveAt?: Date | null;
};

/** Idle window of a sliding login option, or `null` for a fixed one. */
const slidingWindowSec = (mode: string | null | undefined) => {
  if (mode === 'idle_1h') return IDLE_LOGIN_SEC;
  if (mode === 'until_logout') return UNTIL_LOGOUT_IDLE_SEC;
  return null;
};

/** Expiry of a session created now with this login option. */
export const initialExpiry = (mode: LoginMode, days: number | null, now = new Date()) => {
  const seconds =
    mode === 'fixed_days' ? (days ?? 1) * LOGIN_DAY_SEC : (slidingWindowSec(mode) ?? 0);
  return new Date(now.getTime() + seconds * 1000);
};

/** Writes the login option chosen at sign-in onto the session Better Auth just created. */
export const applyLoginMode = async (token: string, mode: LoginMode, days: number | null) => {
  const now = new Date();
  await db
    .update(sessionTable)
    .set({
      loginMode: mode,
      loginDays: mode === 'fixed_days' ? days : null,
      expiresAt: initialExpiry(mode, days, now),
      lastActiveAt: now
    })
    .where(eq(sessionTable.token, token));
};

/**
 * Records activity on the current session, at most once per `SESSION_ACTIVITY_WRITE_SEC`, and
 * pushes the expiry forward for sliding login options. Sessions without a login option (created
 * before login options existed) keep their fixed expiry.
 */
export const touchSession = async (session: SessionRow) => {
  const now = Date.now();
  const last = (session.lastActiveAt ?? session.createdAt).getTime();
  if (now - last < SESSION_ACTIVITY_WRITE_SEC * 1000) return;

  const window = slidingWindowSec(session.loginMode);
  await db
    .update(sessionTable)
    .set({
      lastActiveAt: new Date(now),
      ...(window ? { expiresAt: new Date(now + window * 1000) } : {})
    })
    .where(eq(sessionTable.id, session.id));
};
