# Settings

This document describes the settings dialog and the rules shared by its tabs.

## Opening

- "Settings" item in the sidebar footer menu, below the user identity (see [sidebar-footer.md](../../sidebar/sidebar-footer.md)). It opens on the Profile tab.
- Settings is a dialog over the current page, not a page of its own. Layout follows the shadcn-svelte `sidebar-13` block: a dialog with a sidebar nav on the left, a breadcrumb header ("Settings › Profile") and the tab content on the right.
- On small screens the sidebar nav is hidden (as in `sidebar-13`); the tabs are switched from a select or tabs row at the top of the dialog instead.

## Tabs and URL

The open tab lives in the URL search param `settings`:

| Tab | Param | Doc |
| --- | ----- | --- |
| Profile | `?settings=profile` | [profile-settings-page.md](profile-settings-page.md) |
| Security | `?settings=security` | [security-page.md](security-page.md) |
| Sessions | `?settings=sessions` | [sessions-page.md](sessions-page.md) |

- Opening the dialog adds the param and pushes a history entry; the browser Back button closes the dialog.
- Switching tabs replaces the param (no new history entry).
- Closing the dialog (✕, Esc, click outside) removes the param. Other search params of the page are kept.
- A link or reload with the param opens the dialog on that tab over whatever page it is on. An unknown value opens Profile.
- There are no `/settings/*` routes.

## Password confirmation

- Every settings change and every sign-out of a session asks for the account password first. It is asked on every action, with no grace period.
- The prompt is an `alert-dialog`: title "Confirm it's you", a password input, Cancel and Confirm.
  - Wrong password: inline error under the input, the dialog stays open and the change is not applied.
  - Rate-limited: inline error with the retry message.
  - Confirm shows a spinner and disables the input while the request runs.
- The password is sent with the change itself, in the same remote function call, and checked on the server before anything is written. There is no separate "password verified" step whose result a later request could reuse.
- Change password is the one exception: its form already has a "Current password" field, so it shows no extra prompt (see [security-page.md](security-page.md)).
- Password checks go through Better Auth's `verifyPassword` and are rate-limited like login: 5 attempts per minute per client IP and user (`takeAttempt('password', userId)`, `src/lib/server/rate-limit.ts`).
