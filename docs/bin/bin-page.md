# Bin Page

This document describes the bin.

## Route

`/bin`, linked from the bottom of the sidebar.

## Specifications

- Lists items moved to the bin (`deletedAt` set). A binned folder is listed once; its contents are not listed separately.
- Columns: Name, Original location, Date binned, Days left (30 days after binning).
- Items are deleted permanently 30 days after binning (scheduled job, see [data-model.md](../data-model.md)).
- Selection works like the folder page. The selection toolbar here offers:
  - **Restore**: back to the original location. If the original parent folder is also in the bin, it is restored too.
  - **Delete permanently**: never "Move to bin" on this page.
- Each row also has a ⋮ menu with **Restore** and **Delete permanently** for that item alone; right-clicking the row opens the same menu, or Restore and Delete permanently for the whole selection when the row is part of a selection of two or more.
- Empty state when the bin is empty.

## Permanent delete confirmation

- `alert-dialog` stating how many items will be deleted and that this cannot be undone.
- Lists everything that will be deleted as a tree: each binned folder with all its subfolders and files (file sizes shown), plus the selected files. A summary shows the total folders, files and bytes. The tree is cut after 500 entries; the totals stay exact.
- The user MUST type `delete permanently` exactly into an input. The Delete button stays disabled until it matches.
- The dialog stays open with a spinner until the delete finishes.
- Deletes the R2 objects first, then the rows. Their shares stop listing them (`share_item` cascades).
