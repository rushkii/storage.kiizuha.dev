import { error, redirect } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';

/**
 * The signed-in user, for `query` and `form` handlers. Redirects to `/login` otherwise.
 * Remote functions are reachable from any page, so every one of them checks this itself
 * (see "Implications for authentication" in the remote functions docs).
 */
export const requireUser = () => {
  const { locals } = getRequestEvent();
  if (!locals.user) redirect(303, '/login');
  return locals.user;
};

/** Same as `requireUser`, for `command` handlers, which cannot redirect. */
export const requireUserForCommand = () => {
  const { locals } = getRequestEvent();
  if (!locals.user) error(401, 'Sign in again to continue.');
  return locals.user;
};

/** Only same-origin paths are allowed as a post-login destination. */
export const safeRedirectPath = (value: string | null | undefined) => {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return '/';
  }
  return value;
};
