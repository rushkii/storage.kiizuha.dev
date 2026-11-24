import { redirect } from '@sveltejs/kit';
import { isAPIError } from 'better-auth/api';
import { form, getRequestEvent } from '$app/server';
import { auth } from '#lib/server/auth.ts';
import { safeRedirectPath } from '#server/guard.ts';
import { signInSchema, type SignInFailure } from '#lib/schemas/storage.ts';

const failureOf = (cause: unknown): SignInFailure | null => {
  if (!isAPIError(cause)) return null;
  const code = (cause.body as { code?: string } | undefined)?.code;
  if (code === 'BANNED_USER') return 'banned';
  if (cause.statusCode === 429 || cause.status === 'TOO_MANY_REQUESTS') return 'rateLimited';
  if (cause.statusCode === 401 || cause.statusCode === 400 || cause.status === 'UNAUTHORIZED') {
    return 'invalid';
  }
  return null;
};

/**
 * Admin-only sign in; there is no sign-up. A value with `@` is an email,
 * anything else a username. Request headers are passed so Better Auth applies rate limiting.
 * One generic message for wrong credentials: never say which field was wrong.
 */
export const signIn = form(signInSchema, async ({ identifier, _password, redirectTo }) => {
  const { request } = getRequestEvent();
  const headers = request.headers;

  try {
    if (identifier.includes('@')) {
      await auth.api.signInEmail({ body: { email: identifier, password: _password }, headers });
    } else {
      await auth.api.signInUsername({
        body: { username: identifier, password: _password },
        headers
      });
    }
  } catch (cause) {
    const failure = failureOf(cause);
    if (failure) return { failure };
    throw cause;
  }

  redirect(303, safeRedirectPath(redirectTo));
});

/** Form: ends the session and clears `locals.user` and `locals.session` for the rest of the request. */
export const signOut = form(async () => {
  const event = getRequestEvent();
  await auth.api.signOut({ headers: event.request.headers });

  event.locals.user = undefined;
  event.locals.session = undefined;

  return { success: true };
});
