# Contributing

storage.kiizuha.dev is a personal project with a single admin account. Bug reports and small fixes are welcome. Features outside the scope in the [README](README.md) (sign-up, multiple users, file previews, video streaming, collaborative editing) won't be merged, so open an issue first if you want to propose something bigger.

## Setup

Follow [Getting started](README.md#getting-started) in the README. You need Node.js, pnpm, Docker (for the local Postgres), and an S3-compatible bucket with the CORS policy described there.

## Before you write code

Read the spec for the area you're changing in [`docs/`](docs/README.md). The specs describe the intended behaviour; if your change alters it, update the spec in the same pull request.

## Conventions

### Data fetching

- Heavy data fetching and mutations go through SvelteKit remote functions (`*.remote.ts`).
- `+page.server.ts`, `+layout.server.ts`, `+page.ts`, `+layout.ts` and `+server.ts` only share non-sensitive session state, redirect, and similar light work.
- The streaming zip download (`src/routes/api/download/zip/+server.ts`) is the only API route. Ask before adding another one.

### Svelte

- Svelte 5 with runes. No legacy `export let`, `$:` or stores for component state.
- UI is built from shadcn-svelte components in `src/lib/components/ui/`. Add new ones with the shadcn-svelte CLI rather than writing them by hand.
- Use the import aliases in `package.json` (`#ui/*`, `#components/*`, `#server/*`, `#lib/*`) instead of long relative paths.

### Database

Never run `pnpm db:push`. It changes the database without leaving a migration behind. Every schema change goes through a migration:

1. Update the schema in `src/lib/server/db/` (for Better Auth tables, run `pnpm auth:schema` first).
2. Run `pnpm db:generate` to create the migration in `drizzle/`.
3. Run `pnpm db:migrate` to apply it.

Commit the generated SQL and the `drizzle/meta` snapshot together with the schema change.

### Comments

JSDoc explains what a function does and why in plain words. Don't point readers to `docs/*.md` files from code comments.

### Security

Read [`docs/security/security.md`](docs/security/security.md) before touching auth, sessions, share links or uploads. Report vulnerabilities privately to the maintainer instead of opening a public issue.

## Checks

Run these before opening a pull request. All of them should pass:

```sh
pnpm check
```

```sh
pnpm lint
```

If `pnpm lint` reports formatting problems, run `pnpm format` and commit the result. Prettier uses 2-space indentation, single quotes, no trailing commas and a 100-character line width.

There is no automated test suite yet, so describe how you tested the change by hand (pages visited, signed-in and guest, light and dark theme, phone width where it matters).

## Commits

Commits follow [Conventional Commits](https://www.conventionalcommits.org):

```
<type>(<scope>): <summary>
```

- Types used in this repo: `feat`, `fix`, `docs`, `style`, `refactor`, `chore`.
- The scope is optional and names the area, e.g. `auth`, `storage`, `ui`, `deploy`, `account`, `errors`.
- Keep the summary in the imperative mood, lowercase, without a trailing period.
- Use the body to explain why, when the summary doesn't make it obvious.

Examples from the history:

```
feat(account): add settings dialog and login session length
fix(deploy): give the prod stack its own compose project
docs: align account specs with implementation
```

## Pull requests

- Branch off `main` and keep each pull request focused on one change.
- Add an entry under `[Unreleased]` in [CHANGELOG.md](CHANGELOG.md) for anything a user of the app would notice.
- Include screenshots for UI changes.
- Mention any new environment variables and add them to `.env.example` and the README tables.
