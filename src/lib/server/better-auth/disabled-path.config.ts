/**
 * Better Auth routes closed over HTTP. Account changes go through remote functions, which ask
 * for the password first; leaving these open would let any signed-in browser skip that check.
 * Server-side `auth.api.*` calls are not affected.
 */
export const AUTH_DISABLED_PATHS = [
  '/is-username-available',
  '/admin/list-users',
  '/update-user',
  '/change-email',
  '/change-password',
  '/set-password',
  '/delete-user',
  '/verify-password',
  '/list-sessions',
  '/revoke-session',
  '/revoke-sessions',
  '/revoke-other-sessions'
] as const;
