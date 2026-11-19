# Folder Page

This document describes the folder page: the view of one folder's contents.

## Route

`/f/[folderId]`. Folders can be nested; a breadcrumb shows the path from the root folder.

## Layout

- Header: breadcrumb, view toggle (table | grid), info button.
  - Table view is the default. The chosen view is stored in the URL search params (`runed`).
- Action buttons: "New folder" (creates a subfolder here) and "Upload".
- Content: subfolders first, then files. Columns: Name, Date modified, File size, row ⋮ menu (see the Google Drive layout in the reference screenshot).
  - Table view uses [data-table](../user-interface/table-ui.md).
- Empty state (`empty` component) when the folder has no items, with Upload and New folder actions.
- Opening an item (double-click, or Enter on a selected row): a folder navigates into it; a file downloads. No preview or streaming.

## Selection and toolbar

Selection follows Google Drive and works the same in table and grid view.

- Click an item: select only that item.
- Ctrl/Cmd + click: add or remove that item, keeping the rest.
- Shift + click: select the range from the last clicked item (the anchor) to this item.
- Ctrl/Cmd + Shift + click: add that range to the current selection.
- Ctrl/Cmd + A: select every item in the current view. Esc or clicking empty space: clear selection.
- Touch devices: tap opens; long-press selects and enters selection mode, where taps toggle items.

While at least one item is selected, the header is replaced by a selection toolbar:

| Control | Behavior |
| ------- | -------- |
| ✕ + "N selected" | Clears the selection. |
| Share | Opens the share dialog for the selection, see [share.md](../sharing/share.md). |
| Download | One file: direct download through a presigned URL. Several items or any folder: see [Download](#download). |
| Move to bin | See below. |
| ⋮ More | Rename (only when exactly one item is selected), Move to… (folder picker). |

The row ⋮ menu offers the same actions for that single row.

## Download

- **One file selected**: direct download through a presigned URL (`Content-Disposition: attachment`), no zip.
- **Several items or any folder**: folders are expanded to their files (binned items skipped), then split:
  - **Large files** (> 100 MB each) are never zipped. Each one is downloaded separately by the browser through its own presigned URL, triggered one after another.
  - **The other files** are packed into zip archives of at most 100 MB each. If they fit in 100 MB there is one zip; otherwise they are split into as many zips as needed. Folders keep their structure inside each zip.
  - Each zip is streamed from R2 by `POST /api/download/zip` (form field `ids`, submitted as a regular form so the browser handles the download natively). The server rejects a request whose files exceed 100 MB in total.
- **Dialog before downloading**: when the selection produces more than one download (any large file, or more than one zip), show a dialog before anything starts:
  - what will happen, e.g. "3 files are larger than 100 MB and will download separately. The other 12 files will download as 2 zip archives (100 MB max each)."
  - the list of the separate files with their sizes
  - a note that the browser may ask to allow multiple downloads
  - Cancel and Download buttons
- When everything fits in one zip, the download starts right away with no dialog.
- Zip names: `<folder or "download">-<YYYYMMDD-HHmm>[-<n>].zip`.

## Move to bin

- No confirmation before the action. Selected items get `deletedAt` set (see [data-model.md](../data-model.md)); R2 objects are untouched.
- After all items are processed, show a dialog: "N items moved to bin. Items in the bin are deleted permanently after 30 days." with a "Go to bin" link.
- If some items failed, the same dialog lists the failed items and the reason.
- Binned items disappear from folder pages, Recent and public share pages. See [bin-page.md](../bin/bin-page.md).

## Upload

See [upload-flow.md](../upload/upload-flow.md). The Upload button opens the upload dialog targeting this folder.

## Acceptance criteria

- Ctrl/Cmd + click and Shift + click produce the same selections as Google Drive.
- Uploads started here keep running after navigating to another folder.
