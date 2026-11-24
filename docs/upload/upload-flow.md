# Upload Flow

This document describes uploading files, which works like Google Drive.

## Upload manager

- One global upload manager mounted in the root layout (`src/routes/+layout.svelte` / `app-root.svelte`), not in the folder page.
- Uploads keep running across client-side navigation. Only a full page reload or closing the tab stops them.
- Concurrency: 3 files at a time, 4 parts in parallel per file.

## Upload dialog

- Opened from the folder page's Upload button; uploads go to that folder.
- Drag and drop plus a file picker, multiple files.
- Any file type is accepted. Files are stored as untrusted content (`application/octet-stream`, `attachment`); see [security.md](../security/security.md#principle-stored-files-are-untrusted-content).
- A short disclaimer under the drop zone: "Files are stored as-is and never run or checked by the server. You are responsible for what you upload."

## Floating progress panel

- Small panel fixed at the bottom-right, collapsible.
- Lists each file with name, progress bar, speed / time left, state, and Pause / Resume / Cancel controls.
- Visible while any upload exists; dismissible once every upload is completed, failed or cancelled.

## States

`queued`, `preparing`, `uploading`, `paused (by user)`, `paused (offline)`, `paused (page reloaded)`, `resuming`, `completing`, `completed`, `failed` (with Retry), `cancelling`, `cancelled`.

Every state has its own visual treatment in the panel.

## Mechanism

Uses R2 multipart through presigned URLs (`src/lib/server/s3/multipart.ts`):

1. A remote `command` starts the upload and creates an `upload_session` row (see [data-model.md](../data-model.md)).
2. The browser requests a presigned URL per part right before sending it (URLs expire after 15 min), PUTs the part and records the `ETag`.
3. After each part, progress is saved to IndexedDB and `upload_session.completedParts`.
4. A remote `command` completes the upload and creates the `file` row in one transaction, then deletes the session.

## Pause, offline and reload

- User pause: stop sending new parts; in-flight parts finish.
- Offline (`offline` event or failed fetch): auto-pause. Back online: auto-resume.
- While uploads are active, show the browser `beforeunload` warning.
- After a reload, unfinished uploads appear in the panel as `paused (page reloaded)`. Resuming asks the user to re-select the file; it must match name, size and `lastModified`, then only the missing parts are sent.

## Cancel

- Cancel calls `abortMultipartUpload`, deletes the session, and marks the item `cancelled`. There is no undo.

## Cleanup

- A paused upload that is not resumed for 7 days is aborted (`lastActivityAt`, see the scheduled jobs in [data-model.md](../data-model.md)).

## Cloudflare R2 notes

- Every part except the last MUST have the same size; keep `partSize` fixed per upload (`getMultipartPartSize`).
- The bucket CORS policy must allow `PUT` from the app origin and expose the `ETag` header.
- R2 buckets come with a default lifecycle rule that aborts incomplete multipart uploads 7 days after they **start**, not after the last activity. Change it to a longer period (e.g. 30 days) so the app's 7-days-since-last-activity rule is the one that applies.
