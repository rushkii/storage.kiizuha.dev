# Security Settings

This document describes the Security tab of the settings dialog (`?settings=security`, see [README.md](README.md)).

## Change password

A form with three password inputs and a "Change password" button:

| Field | Rules |
| ----- | ----- |
| Current password | Required. Checked on the server; this field is the password confirmation, so no extra prompt is shown. |
| New password | Required, Better Auth's password length rules, must differ from the current password. |
| Confirm new password | Must equal New password (checked in the browser and on the server). |

- Submit through a remote `form` function calling Better Auth `changePassword` with `revokeOtherSessions: true`.
- Every other session is signed out; this browser stays signed in.
- On success: the form clears and a toast says "Password changed. Other sessions were signed out."
- Wrong current password: inline error under that field, nothing changes.
- Rate-limited like login.

## Acceptance criteria

- After a password change, the old password no longer logs in and the new one does.
- After a password change, every session except the current one is gone from the Sessions tab.
