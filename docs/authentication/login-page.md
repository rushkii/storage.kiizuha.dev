# Login Page

This document describes the login page.

## Route

`/login`. Unauthenticated users on any other app route are redirected here with `?redirectTo=<path>`. Authenticated users visiting `/login` are redirected to `/`.

Public share pages (`/s/[token]`, see [share.md](../sharing/share.md)) never require login.

## Specifications

- Admin-only. The admin account is registered with the Better Auth CLI; there is no sign-up UI.
- One "Username or email" input and one password input.
  - If the value contains `@`, sign in with email; otherwise sign in with username. Usernames match `USERNAME_CHARSET_PATTERN` (`src/lib/server/constants.ts`), so they never contain `@`.
- Submit through a remote `form` function (`src/lib/remotes/`), not `+page.server.ts` actions.
- States:
  - idle
  - submitting: button shows a spinner, inputs are disabled
  - invalid credentials: one generic message; never reveal which field is wrong
  - banned user (admin plugin)
  - rate-limited
- Sessions last 7 days without refresh (`SESSION_EXPIRES_IN_SEC`).
- Remove `src/routes/demo/better-auth` once this page works.

## Acceptance criteria

- Signing in with the username and with the email both work.
- After login the user lands on `redirectTo` (only same-origin paths) or `/`.
