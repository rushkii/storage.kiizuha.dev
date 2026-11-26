# Login Page

This document describes the login page.

## Route

`/login`. Unauthenticated users on any other app route are redirected here with `?redirectTo=<path>`. Authenticated users visiting `/login` are redirected to `/`.

Public share pages (`/s/[token]`, see [share.md](../sharing/share.md)) never require login.

## Specifications

- Admin-only. Sign-up is disabled (`disableSignUp: true`); the admin account is created with the admin plugin's `auth.api.createUser` from a server-side script (see [security.md](../security/security.md)). There is no sign-up UI.
- One "Username or email" input and one password input.
  - If the value contains `@`, sign in with email; otherwise sign in with username. Usernames match `USERNAME_CHARSET_PATTERN` (`src/lib/server/constants.ts`), so they never contain `@`.
- Submit through a remote `form` function (`src/lib/remotes/`), not `+page.server.ts` actions.
- States:
  - idle
  - submitting: button shows a spinner, inputs are disabled
  - invalid credentials: one generic message; never reveal which field is wrong
  - banned user (admin plugin)
  - rate-limited
- Call `signInEmail` / `signInUsername` with `headers: getRequestEvent().request.headers`, or Better Auth skips rate limiting (see [security.md](../security/security.md)).
- How long the session lasts is chosen at login (see [Session length](#session-length)).

## Session length

A radio group below the password input. The chosen option is stored on the session (`loginMode`, `loginDays`, see [data-model.md](../data-model.md#session)) and decides when that session ends.

| Option | Label | Rule |
| ------ | ----- | ---- |
| `idle_1h` (default) | Log out after an hour without use | Ends 1 hour after the last request. Every request pushes the expiry forward. Description below the label: "Best on a shared or public computer." |
| `fixed_days` | Keep me logged in for [n] days | Ends `n` days after login, whatever happens. Use does not extend it. `n` is a number input inside the label, prefilled with 7, integer 1–90. |
| `until_logout` | Keep me logged in until I log out | Ends after 90 days without use. Every request pushes the expiry forward. |

- The server validates the option and `n` (1–90); the client value is never trusted.
- Activity (`lastActiveAt`, and the sliding expiry for `idle_1h` / `until_logout`) is written at most once per minute per session, so not every request hits the database.
- The session cookie's lifetime follows the session's expiry.
- This replaces the fixed 7-day session (`SESSION_EXPIRES_IN_SEC` with `disableSessionRefresh: true`).
- Every session also ends on sign-out, on revoke from the [Sessions](../account/settings/sessions-page.md) tab, and when the password changes (all but the current one).

## Acceptance criteria

- Signing in with the username and with the email both work.
- After login the user lands on `redirectTo` (only same-origin paths) or `/`.
- With "Log out after an hour without use", a session left unused for an hour is signed out; one used every few minutes stays signed in.
- With "Keep me logged in for 3 days", the session ends 3 days after login even when used continuously.
- `n` outside 1–90 or not an integer is rejected by the server.
