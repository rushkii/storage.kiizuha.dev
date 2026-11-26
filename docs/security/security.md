# Security

This document tracks security findings and how each one is handled.

## Principle: stored files are untrusted content

Every stored file is untrusted content uploaded by a user. The app server and the app owner take no responsibility for what a file contains.

**The server never executes a stored file.** File bytes are opaque data: they may be moved, copied, zipped and sent back to a browser, but never run.

- Never run a stored file in any way: no `import()`/`require()`, `eval`/`new Function`, `child_process` or shell, `vm`, Worker or WASM instantiation, and no handing it to an interpreter or tool that runs code (Node, Python, `sh`, LibreOffice, ImageMagick/Ghostscript, `ffmpeg`, archive extraction).
- Never write file bytes to the server's disk, especially not under `static/`, `src/` or `build/`. Files live in R2 only, and reach the server only as an in-memory stream (`getObject`, for the zip download).
- Never put a file's name, metadata or content into a shell command, a file path on the server, SQL built by string concatenation, or HTML rendered with `{@html}`.
- When the server sends file bytes to a browser (the zip download), the browser must not run them either. Every response that carries file bytes from the app origin has fixed headers, never taken from the stored object:

  ```
  Content-Type: application/zip
  Content-Disposition: attachment; filename="<name>.zip"
  X-Content-Type-Options: nosniff
  Content-Security-Policy: sandbox
  Cache-Control: private, no-store
  ```

  Single-file downloads and inline opens go through presigned R2 URLs with the same rule (see section 4).
- **Users see a disclaimer** where files enter or leave the app: the upload dialog ([upload-flow.md](../upload/upload-flow.md#upload-dialog)) and the public share page ([share.md](../sharing/share.md#public-page)).

| # | Finding | Severity | Status |
| - | ------- | -------- | ------ |
| 1 | Open sign-up without email verification | Medium | Fixed |
| 2 | `ORIGIN` could be empty | Medium | Fixed |
| 3 | Rate limit and client IP behind a proxy | Medium | Fixed in code; deploy step pending |
| 4 | Uploaded HTML/SVG served inline | Medium | Fixed |
| 5 | S3 keys and prefixes outside the user's space | Medium | Fixed in `s3/`; rules for remote functions below |
| 6 | Rate limiting skipped for server-side auth calls | Medium | Fixed |
| 7 | Account endpoints skipped the password prompt | Medium | Fixed |

## 1. Open sign-up without email verification

**Problem.** `emailAndPassword` had `requireEmailVerification: false` and no `disableSignUp`. Anyone could create an account, use bucket quota, and register with someone else's email address.

**Fix.** `disableSignUp: true` in `src/lib/server/auth.ts`. Email verification stays off: the app has a single admin account and no email-sending server.

`disableSignUp` blocks `signUpEmail` everywhere, including server-side `auth.api.signUpEmail` calls. Create the admin account from a server-side script with the admin plugin instead:

```ts
await auth.api.createUser({
  body: { email, password, name, role: 'admin', data: { username } }
});
```

Called without `headers`, `createUser` runs as a trusted server call and needs no session. Never expose it through a route or remote function.

## 2. `ORIGIN` could be empty

**Problem.** Without a schema, SvelteKit requires `ORIGIN` to be set but accepts an empty string. With an empty value, `baseURL` and `trustedOrigins` were `undefined`, so Better Auth inferred the origin from request headers (`Host`, `X-Forwarded-*`), which weakens its origin/CSRF check.

**Fix.** `ORIGIN` in `src/env.ts` now has a schema. The app refuses to start unless `ORIGIN`:

- is set and non-empty,
- is a valid `http://` or `https://` URL,
- has no path, query, hash or credentials.

The value is normalized with `URL.origin` (no trailing slash, lowercase host, default port dropped). `trustedOrigins` is always `[ORIGIN]`.

## 3. Rate limit and client IP behind a proxy

**Problem.** Better Auth's rate limiter keys requests by client IP, read from `x-forwarded-for` by default. Without a trusted proxy in front of the app, a client can send any single-value `x-forwarded-for` and get a fresh rate-limit bucket on every request, which makes password brute-force possible.

The `sv add` demo login action (`src/routes/demo/better-auth/login/+page.server.ts`) called `auth.api.signInEmail` without `headers`, so the rate limiter was skipped there entirely.

**Fix.**

1. Done: `src/lib/server/auth.ts` reads the client IP from `x-real-ip` only. Caddy (`Caddyfile`) sets this header to the client IP on every proxied request and overwrites any value the client sent:

   ```ts
   advanced: {
     cookiePrefix: 'kz',
     ipAddress: { ipAddressHeaders: ['x-real-ip'] }
   }
   ```

2. Done: `src/routes/demo/` is deleted. Passing `headers` to `signInEmail` turned out not to be enough: Better Auth's limiter never runs for `auth.api.*` calls, with or without headers. See [finding 6](#6-rate-limiting-skipped-for-server-side-auth-calls).
3. Done: `compose.prod.yaml` binds the app to `127.0.0.1` only, so from outside the server it is reachable only through the host's Caddy. Never bind it to a public interface, or anyone can hit it directly with a forged `x-real-ip`. The DNS record is DNS only, so clients connect to Caddy directly and `{client_ip}` is their real address. If the record is ever switched to proxied (Cloudflare's orange cloud), add Cloudflare's ranges to Caddy's `trusted_proxies` and read `CF-Connecting-IP`, or every request is counted under a Cloudflare edge IP.

Notes:

- Better Auth's rate limiting is on in production only, and only covers requests to `/api/auth/*` over HTTP. In local dev there may be no `x-real-ip`, so sessions can store no IP address; that is expected.
- Optional: `rateLimit.storage: 'database'` keeps Better Auth's counters across restarts. The default in-memory storage is fine for a single instance.

## 4. Uploaded HTML/SVG served inline

**Problem.** The uploader chose the stored `Content-Type`, and `createDownloadUrl` allowed `disposition: 'inline'` for any file. An uploaded HTML or SVG file opened through a presigned URL renders as a page on the bucket's domain, which works for phishing. If the bucket gets a custom domain under `kiizuha.dev`, it also allows cookie tossing between subdomains. Any `+server.ts` that copies the stored `Content-Type` into its response would turn this into XSS on the app origin.

**Fix.** Any file type can still be uploaded; only how it is served changed (`src/lib/server/s3/content-type.ts`):

- **Stored:** every object is written as `application/octet-stream` with `Content-Disposition: attachment` (`createUploadUrl`, `startMultipartUpload`, `putObject` by default). The uploader's file type is ignored. A request with no response overrides, or a bucket that later becomes public, still downloads the file instead of rendering it.
- **Downloaded:** `createDownloadUrl` always sets `ResponseContentType` and `ResponseContentDisposition` itself:
  - `inline` is honored only when the `filename` extension is in the allowlist: raster images (`png`, `jpg`, `gif`, `webp`, `avif`, `bmp`), `pdf`, video (`mp4`, `webm`, `mov`, ...) and audio (`mp3`, `m4a`, `wav`, `flac`, `ogg`, ...). The `Content-Type` comes from that list.
  - Everything else, including HTML, SVG, XML, JS and plain text, is served as an `application/octet-stream` attachment even when `inline` is asked for.
  - The type is decided by extension only. An HTML file renamed to `x.png` is served as `image/png`; the browser decodes it as an image and never runs it as a page.
- Use `canOpenInline(filename)` in the UI to decide whether to show an "Open" action.

Rules:

- Pass the file name from the DB as `filename`; keys hold ids (`userObjectKey(userId, fileId)`), not names.
- A response from the app origin that carries file bytes (the zip download) uses the fixed headers from the principle above, never `info.contentType` from `getObject`.
- `createUploadUrl` now signs `Content-Type` and `Content-Disposition`. The browser must send both returned `headers`, and the R2 CORS policy must allow them in `AllowedHeaders`. Multipart part uploads do not send them.

## 5. S3 keys and prefixes outside the user's space

**Problem.** The `s3/` helpers accepted any key or prefix. A remote function that took a key from the client, or a prefix without a trailing slash (`users/abc` also matches `users/abcd/...`), could list, read or delete another user's files. A user id like `a/b` or `..` would also have pointed outside `users/<id>/`.

**Fix** (`src/lib/server/s3/keys.ts`):

- `userObjectKey` and `userPrefix` reject a user id that is empty, `.`, `..` or contains `/`.
- `userObjectKey` throws without a path, since `users/<id>` has no trailing slash.
- `isUserKey(userId, key)` / `assertUserKey(userId, key)` check that a key is normalized and inside `users/<userId>/`.
- `listFolder`, `getPrefixUsage` and `deletePrefix` reject a prefix that does not end with `/` (`assertFolderPrefix`). `listFolder` still allows `''` for the bucket root.

Rules for remote functions and endpoints:

- Take the user id from `locals.user.id` only, never from the request.
- Never accept an S3 key, prefix or `uploadId` from the client. Accept a DB id (`fileId`, `uploadSessionId`), load the row with `WHERE id = ? AND user_id = ?`, and use the key stored in that row.
- Call `assertUserKey(locals.user.id, row.key)` before any S3 call made with a stored key.
- `uploadId` is bound to its key by S3, so a checked key plus the `uploadId` from the same `upload_session` row is enough for `createPartUploadUrl`, `completeMultipartUpload` and `abortMultipartUpload`.
- The zip endpoint (`/api/download/zip`) and share pages follow the same rule: resolve ids to rows owned by the user (or by the share), never to raw keys.

## 6. Rate limiting skipped for server-side auth calls

**Problem.** Better Auth applies its rate limiter in its HTTP router (`onRequest`), so only requests that reach `/api/auth/*` over HTTP are counted. The login page signs in from a remote function through `auth.api.signInEmail` / `signInUsername`, which never pass through that router. Passing `headers` does not change this. Login attempts were therefore unlimited, and so would be every password check done through `auth.api.*`.

**Fix.** `src/lib/server/rate-limit.ts` is an in-memory, fixed-window limiter: 5 attempts per minute, keyed by action, client IP (`x-real-ip`) and, where known, user id. It is used by:

- sign-in (`takeAttempt('sign-in')` in `src/lib/remotes/auth.remote.ts`),
- every password check in settings (`checkPassword` and `changePassword` in `src/lib/server/account.ts`).

Rules:

- Any new remote function that checks a password calls `takeAttempt` first and returns a "too many attempts" result when it is over the limit.
- The limiter is per process. Running more than one app instance needs shared storage (Postgres or Redis) instead.

## 7. Account endpoints skipped the password prompt

**Problem.** Every settings change asks for the password (see [settings](../account/settings/README.md#password-confirmation)). Better Auth's own endpoints, such as `/update-user`, `/change-email`, `/change-password` and `/revoke-session`, were still open over HTTP, so any signed-in browser could change the username, email or sessions directly without that prompt.

**Fix.** `src/lib/server/better-auth/disabled-path.config.ts` closes them over HTTP:

`/update-user`, `/change-email`, `/change-password`, `/set-password`, `/delete-user`, `/verify-password`, `/list-sessions`, `/revoke-session`, `/revoke-sessions`, `/revoke-other-sessions`.

`disabledPaths` only affects the HTTP router; `auth.api.*` calls from the server still work. Account changes go through the remote functions in `src/lib/remotes/account.remote.ts`, which check the password in the same request as the change.

Rule: when a new Better Auth plugin or endpoint can change the account or its sessions, add its path here unless it is meant to be called from the browser.
