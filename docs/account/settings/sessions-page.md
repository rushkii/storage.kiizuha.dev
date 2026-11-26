# Sessions Settings

This document describes the Sessions tab of the settings dialog (`?settings=sessions`, see [README.md](README.md)).

## Intro text

Shown above the table:

> Each browser signed in to this account. How long a session lasts depends on the option chosen when it logged in. Changing your password signs out every session except this one.

## Table

A shadcn `table` of active (not expired) sessions. The current session comes first, the rest by last activity, newest first.

| Column | Content |
| ------ | ------- |
| Device | Browser and OS parsed from the user agent, e.g. "Firefox on Linux". The current session has a "This browser" badge. Below it, a small description of how the session ends (see below). |
| IP address | `session.ipAddress`, or "—" when unknown (always unknown in local dev, see [security.md](../../security/security.md#3-rate-limit-and-client-ip-behind-a-proxy)). |
| Last activity | Relative time ("5 minutes ago"), see [Times](#times). |
| (no header) | "Sign out" button. Not shown on the current session's row. |

Description under the device, by `loginMode` (see [login-page.md](../../authentication/login-page.md#session-length)):

| Mode | Description |
| ---- | ----------- |
| `idle_1h` | Signed out after an hour without use |
| `fixed_days` | Signed out on <date> (the expiry date) |
| `until_logout` | Kept until signed out, or 90 days without use |

## Row details

Each row is collapsible. Expanded, it shows:

- the full user agent
- signed in at (`createdAt`) and the login option, e.g. "Keep me logged in for 7 days"
- expires at (`expiresAt`)
- IP address

## Signing out

- **Sign out** (row): asks for the password (see [Password confirmation](README.md#password-confirmation)), then revokes that session. The row disappears and a toast says "Session signed out".
- **Sign out all other sessions** (button below the table): asks for the password, then revokes every session except the current one. Disabled when there are no other sessions.
- A revoked browser is sent to `/login` on its next request.

## Times

- Times are stored in UTC (`timestamptz`) and sent to the browser as ISO strings.
- They are formatted in the browser's own timezone with `Intl.DateTimeFormat` (no fixed `timeZone`), never on the server: the server's timezone would differ and cause a hydration mismatch. Render them after hydration.
- Last activity shows relative time; hovering (tooltip) shows the exact local date and time with the zone, e.g. "26 Nov 2026, 15:19 GMT+7". Row details always show the exact time.

## Acceptance criteria

- Signing out a session from here logs that browser out on its next request.
- "Sign out all other sessions" leaves only the current session.
- The same session shows the same instant in different local times on devices set to different timezones.
