# Sidebar Footer

This document describes the sidebar footer.

## Trigger

The footer shows the user identity: avatar (or initials), name and email. Clicking it opens a dropdown menu.

## Menu items (top to bottom)

1. **User identity**: avatar, name and email, as a label (not clickable).
2. **Settings**: opens the settings dialog on the Profile tab (`?settings=profile`). See [settings](../account/settings/README.md).
3. **Theme** ▸ submenu with a radio group: Light, Dark, System. The current mode is checked. Uses `mode-watcher` (`setMode`); the choice is remembered per browser.
4. Separator, then **Log out**: signs out this session only (no password prompt), shows a toast, and goes to `/login`.
