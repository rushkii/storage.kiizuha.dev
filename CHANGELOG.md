# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Settings dialog (opened with `?settings=`) with Profile, Security and Sessions tabs.
  - Profile: change username and email, upload a cropped avatar, or use Gravatar.
  - Security: change password.
  - Sessions: list signed-in browsers with device, IP and last activity, and sign out any other session.
  - Changing the password signs out every other session.
  - Every change is confirmed with the current password in the same request.
- Session length choice on the login page: 1 hour of inactivity, a number of days, or until logout. Expiry and last activity are tracked per session.
- Settings entry, Theme submenu, avatar and Log out in the sidebar footer.
- Error pages for 404, 403, 410, 5xx and 503, each with signed-in and guest variants. Unexpected errors get a short ID shown on the page and in the server log.
- Radio group UI component.
- GitLab CI/CD on git.gnuweeb.net: checks every branch, builds the production image with crane, pushes it to the project's registry and deploys it to the server over SSH.

### Changed

- The production image now runs migrations itself (`node scripts/migrate.js`) with drizzle-orm's migrator, so the separate `migrate` image with the full dependency tree is gone. `drizzle-orm` and `postgres` moved to `dependencies`.
- `compose.prod.yaml` runs `app` and `migrate` from the registry image (`APP_TAG`, default `latest`) and can still build it on the server with `--build`.

- Share links that fail with a server error now show the server error page instead of the link-unavailable page. The link-unavailable page is redesigned on the same shell as the other error pages.

### Security

- Sign-in and password checks are rate-limited in the app, since Better Auth's limiter skips `auth.api` calls.
- Account endpoints are closed over HTTP so they can't bypass the password prompt.

### Database

- Migration `0004_session_length_and_gravatar` adds session login fields and `user.use_gravatar`.

## [0.0.1] - 2026-11-24

First deployed version.

### Added

- Single admin account with Better Auth (admin and username plugins). Sign-up is disabled.
- Direct browser-to-bucket uploads with presigned multipart URLs, for S3-compatible storage such as Cloudflare R2.
- Categories and nested folders, with rename and move.
- Single-file download, and zip download of a selection in archives of up to 100 MB each (larger files download separately).
- Recent and What I shared pages.
- Public share links with expiry dates under `/s/[token]`.
- 30-day bin with restore and permanent delete.
- shadcn-svelte UI with light and dark themes.
- Validation and normalization of environment variables, including `APP_NAME` and `ORIGIN`.
- Docker production stack (`compose.prod.yaml`) with a one-off migration job, served through Caddy on the host.
- Feature specs, data model and security notes in `docs/`.

### Fixed

- The production stack runs as its own Compose project so it no longer clashes with the local Postgres container.

[Unreleased]: https://github.com/rushkii/storage.kiizuha.dev/compare/f9fba0e...HEAD
[0.0.1]: https://github.com/rushkii/storage.kiizuha.dev/compare/600461c...f9fba0e
