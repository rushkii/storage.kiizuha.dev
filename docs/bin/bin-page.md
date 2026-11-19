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
- Empty state when the bin is empty.

## Permanent delete confirmation

- `alert-dialog` stating how many items will be deleted and that this cannot be undone.
- The user MUST type `permanent delete` exactly into an input. The Delete button stays disabled until it matches.
- Deletes the R2 objects first, then the rows. Their shares stop listing them (`share_item` cascades).
