# Data Table User Interface

This document describes the shared `data-table` component.

## Specifications

Component name `data-table`, placed in `src/lib/components/table` (`#table/*`). Built on shadcn-svelte components and TanStack Table (`@tanstack/table-core`). Table state that belongs in the URL (search, filters, sorts, page) is synced to search params with `runed`.

Dependencies to install: `@tanstack/table-core`, `runed`. Check the reference repo for anything else it needs (it uses `svelte-dnd-action` for drag reordering).

Features:

- Column pinning.
- Search bar.
- Filters ("Filter list" mode, see note).
- Sorts (multiple).
- Column reordering.
- Column visibility.
- Pagination.
- Row selection that follows the Drive-like selection rules in [folder-page.md](../folder/folder-page.md#selection-and-toolbar). No checkbox column.
- Grouped rows (needed by the Recent page: rows grouped under date headings).
- Empty state and loading skeleton.

> [!note]
> The reference demo uses "Filter menu" by default; this project uses "Filter list" mode instead.
> In the reference demo (https://svelte-tablecn.vercel.app), multiple sorts and filters cannot swap positions. In this project, sorts and filters MUST be reorderable by drag in "Filter list" mode.

## Data loading (hybrid client + server)

Goal: keep load off the server.

- Data comes from a remote `query` that accepts `{ search, filters, sorts, page, pageSize }` and does the filtering, sorting and pagination in Postgres.
- If the query reports that the whole result set fits in one response (total rows ≤ 500), the table switches to client-side mode: further search/filter/sort/page changes run in the browser with no new request.
- Above that, every change re-runs the server query (debounced 300 ms for search).

## References

Demo: https://svelte-tablecn.vercel.app (Data Table Demo)
Link: https://github.com/itisyb/svelte-tablecn
Local findings: ~/Kiizuha/coding/github/itisyb/svelte-tablecn
