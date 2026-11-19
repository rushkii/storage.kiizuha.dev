
# Personal Storage

| Field | Value |
| ----- | ----- |
| Client | |
| Status | active |
| Stack | Refer to package.json |
| Started | 2026-11-19 |
| Repo | |

## Overview

> [!abstract]
> storage.kiizuha.dev is a personal storage built for myself to solve my device lack of free space.

## Goals

- [ ] Upload large files reliably: resumable, survives navigation and reloads.
- [ ] Organize files into categories and nested folders.
- [ ] Share files or chosen parts of folders through expiring public links.
- [ ] Recover from mistakes through a 30-day bin.

## Scope

**In**
- Single admin account (no sign-up).
- Upload, download (single file, or zip archives of up to 100 MB each with larger files downloaded separately), rename, move, bin, restore, permanent delete.
- Categories, nested folders, Recent, What I shared, Bin.
- Public share links with expiry.

**Out**
- Multi-user accounts and sign-up.
- File previews and video streaming.
- Collaborative editing.

## Architecture

> [!note]
> High-level design. Link ADRs and diagrams.

- Key decisions:
  - SvelteKit with remote functions for data fetching and mutations; `+page.server.ts` / `+layout.server.ts` only for session state and redirects (see `CLAUDE.md`).
  - Postgres + Drizzle ORM, schema changes only through migrations. See [data-model.md](data-model.md).
  - Cloudflare R2 (S3 API) for file bytes; uploads go browser → R2 directly through presigned multipart URLs.
  - Better Auth (admin + username plugins) for authentication.
  - shadcn-svelte for UI.
- Diagrams:

## Docs index

| Area | Doc |
| ---- | --- |
| Data model and scheduled jobs | [data-model.md](data-model.md) |
| Login | [authentication/login-page.md](authentication/login-page.md) |
| Sidebar | [sidebar/sidebar-main-items.md](sidebar/sidebar-main-items.md) |
| Folder page, selection, move to bin | [folder/folder-page.md](folder/folder-page.md) |
| Upload | [upload/upload-flow.md](upload/upload-flow.md) |
| Sharing and public pages | [sharing/share.md](sharing/share.md) |
| What I shared | [sharing/what-i-shared.md](sharing/what-i-shared.md) |
| Recent | [recent/recent-page.md](recent/recent-page.md) |
| Bin | [bin/bin-page.md](bin/bin-page.md) |
| Base UI rules | [user-interface/base-ui.md](user-interface/base-ui.md) |
| Data table | [user-interface/table-ui.md](user-interface/table-ui.md) |

## Milestones

| Milestone | Target | Status |
| --------- | ------ | ------ |
|           |        |        |

## Sprints

> [!note]
> Linked sprint notes for this project.

-

## Risks & Notes

- Zip download uses a streaming `+server.ts` endpoint (`src/routes/api/download/zip/+server.ts`). Approved as the only exception to the remote-functions rule; do not add other API routes without asking.
- R2's default lifecycle rule aborts incomplete multipart uploads 7 days after start; it must be relaxed (see [upload-flow.md](upload/upload-flow.md)).
