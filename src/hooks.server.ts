import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { auth } from '#lib/server/auth.ts';
import { touchSession } from '#lib/server/session-activity.ts';
import { svelteKitHandler } from 'better-auth/svelte-kit';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
  const session = await auth.api.getSession({ headers: event.request.headers });

  if (session) {
    event.locals.session = session.session;
    event.locals.user = session.user;
    await touchSession(session.session);
  }

  return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;

// App and framework errors are already safe to show. Unexpected ones get a short ID that
// the error page displays and the log line carries, so a report can be matched to its cause.
export const handleError: HandleServerError = ({ kind, error, event }) => {
  if (kind !== 'unknown') return error;

  const errorId = crypto.randomUUID().slice(0, 8);
  console.error(`[${errorId}] ${event.request.method} ${event.url.pathname}`, error);
  return { message: 'Internal Error', errorId };
};
