# Sharing

This document describes sharing files and folders publicly.

## Share dialog

Opened from the selection toolbar or the row ⋮ menu (see [folder-page.md](../folder/folder-page.md#selection-and-toolbar)).

- **One file selected**: no item picker. The link serves the raw file.
- **A folder, or several items**: the dialog shows an accordion tree of the selection. The owner MUST tick the files to share; nothing is pre-selected and at least one file is required.
  - A subfolder is an accordion section listing its files. Ticking the subfolder header selects all its files; the subfolder is shared only through the files ticked inside it.
  - Files added to a folder later are NOT shared automatically.
- **Expiry** (select): 1 day, 3 days, **7 days (default)**, Until I unshare. Counted from creation.
- After creating, the dialog shows the link with a Copy button.

All shares are 100% public: anyone with the link can download, no login.

## Public page

Route `/s/[token]`. No sidebar, no app chrome, `noindex`.

- **File share**: the server load validates the share and redirects (302) to a fresh presigned URL with `Content-Disposition: attachment`. Share URLs are stable app URLs; presigned URLs are never handed out as share links.
- **Listing share**: a simple data table (Name, Size, Download). Files in subfolders are grouped under accordion sections per subfolder. Each Download goes through `/s/[token]/f/[fileId]`, which checks the file belongs to the share, then redirects like a file share. No preview or video streaming.
- Files in the bin are hidden. If nothing remains, the page shows the unavailable state.
- Expired, revoked or unknown token: an "This link has expired or was removed" page (same response for all three).

## Acceptance criteria

- A file not ticked in the dialog cannot be downloaded through the share, even by guessing its id.
- After expiry or unshare, both the page and every download URL stop working.
