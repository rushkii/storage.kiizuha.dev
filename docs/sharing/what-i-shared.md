# What I Shared

This document describes the page listing the owner's active shares.

## Route

`/shared`, linked from the sidebar ("What I shared").

## Specifications

- Lists only active shares: not revoked and not expired.
- Columns: Title, Type (File / Folder / Multiple items), Items (number of shared files), Created, Expires (date, or "Until unshared").
- Row actions:
  - Copy link
  - Unshare: confirmation via `alert-dialog`, then sets `revokedAt`.
- Empty state when there are no active shares.
- Uses [data-table](../user-interface/table-ui.md).
