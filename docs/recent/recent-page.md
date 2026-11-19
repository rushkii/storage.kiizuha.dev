# Recent Page

This document describes the Recent page.

## Route

`/recent`, linked from the top of the sidebar. The sidebar item is hidden until at least one item has been opened.

## What counts

- An "open" is visiting a folder page or downloading a file. Each open increments `item_access.openCount` and sets `lastOpenedAt` (see [data-model.md](../data-model.md)).
- An item is listed as soon as it is opened once (`openCount ≥ 1`), with no time window.
- At most 1000 items. When a new item is opened and the list is full, the item with the oldest `lastOpenedAt` is removed. Items are never removed for age alone.
- Binned items are hidden.

## Layout

Follows the Google Drive Recent page (see the reference screenshot).

- Filters: Type (folder, document, image, video, archive, other), Last opened (date range).
- Rows grouped under headings by `lastOpenedAt`: Today, Yesterday, Earlier this week, Last week, Earlier this month, Earlier this year, Older.
- Columns: Name (with type icon), Last opened ("17 Nov • Opened by me"), File size, Location (parent folder, clickable).
- Table view by default, grid view available. Selection and toolbar work like the folder page.
- Uses [data-table](../user-interface/table-ui.md) with grouped rows.
