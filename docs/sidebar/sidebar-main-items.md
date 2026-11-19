# Sidebar Main Items

This document describes the sidebar.

## Structure (top to bottom)

1. **Recent**: links to `/recent`. Hidden until at least one item has been opened. See [recent-page.md](../recent/recent-page.md).
2. **What I shared**: links to `/shared`. Always visible. See [what-i-shared.md](../sharing/what-i-shared.md).
3. **Categories** with their folders (below).
4. **Bin**: links to `/bin`. Always visible, at the bottom. See [bin-page.md](../bin/bin-page.md).

## Categories and folders

- Categories group root folders, like Discord channel categories. Each category is collapsible; the collapsed state is remembered per browser.
- A `+` icon on the right of each category header opens the "New folder" dialog.
- Only root folders (no parent) appear in the sidebar. Subfolders are reached from the folder page.
- When no folder exists, the sidebar shows the default empty UI with a "New category" action.
- Categories can be created and renamed. Deleting a category is only allowed when it has no folders.

## New folder dialog

Inputs:

- Category target: select, pre-filled with the category whose `+` was clicked.
- Folder name: required, 1–100 characters, unique among the folders of the same category (or the same parent for subfolders). Cannot be `.` or `..` and cannot contain `/`.

## New category dialog

- Category name: required, 1–50 characters, unique.
