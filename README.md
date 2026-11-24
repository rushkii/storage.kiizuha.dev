# storage.kiizuha.dev

A personal cloud storage app I built for myself because my devices keep running out of space. Files live in an S3-compatible bucket (Cloudflare R2), metadata lives in Postgres, and a single admin account manages everything.

## Features

- Upload large files straight from the browser to the bucket with presigned multipart URLs.
- Organize files into categories and nested folders.
- Rename, move, download single files, or download a selection as zip archives (up to 100 MB each; larger files download separately).
- Recent files and a "What I shared" view.
- Public share links with expiry dates, served under `/s/[token]`.
- A 30-day bin with restore and permanent delete.

Out of scope: sign-up and multiple users, file previews, video streaming, and collaborative editing.

## Stack

- [SvelteKit](https://svelte.dev/docs/kit) with Svelte 5 and remote functions
- [Better Auth](https://www.better-auth.com) with the admin and username plugins
- Postgres with [Drizzle ORM](https://orm.drizzle.team)
- S3 API via `@aws-sdk/client-s3` (Cloudflare R2 or any S3-compatible service)
- [shadcn-svelte](https://www.shadcn-svelte.com) and Tailwind CSS 4
- Valibot for validation

## Getting started

Requirements: Node.js, pnpm, and Docker (for the local Postgres).

1. Install dependencies:

    ```sh
    pnpm install
    ```

2. Copy the environment template and fill it in:

    ```sh
    cp .env.example .env
    ```

    | Variable | Purpose |
    | --- | --- |
    | `APP_NAME` | Display name of the app |
    | `DATABASE_URL` | Postgres connection string (the default matches `compose.yaml`) |
    | `ORIGIN` | Public origin of the app, e.g. `http://localhost:5173` |
    | `BETTER_AUTH_SECRET` | 32+ character random secret |
    | `S3_ENDPOINT` | S3 endpoint URL (for R2: `https://<account-id>.r2.cloudflarestorage.com`) |
    | `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Bucket credentials |
    | `S3_BUCKET` | Bucket name |
    | `S3_REGION` | `auto` for R2 |

3. Start Postgres and apply the migrations:

    ```sh
    pnpm db:start
    pnpm db:migrate
    ```

4. Create the admin account. Sign-up is disabled, so the account has to be created from a server-side script with the admin plugin's `auth.api.createUser`. No such script ships with the repo yet; see `docs/security/security.md` for the call.

5. Start the dev server:

    ```sh
    pnpm dev
    ```

### Bucket setup

- The bucket's CORS policy must allow `PUT` from the app origin and expose the `ETag` header, otherwise multipart uploads fail.
- R2 buckets have a default lifecycle rule that aborts incomplete multipart uploads 7 days after they start. Raise it (for example to 30 days) so the app's own cleanup rule applies instead.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` / `pnpm preview` | Build and preview a production build |
| `pnpm check` | Type-check with `svelte-check` |
| `pnpm lint` | Run Prettier and ESLint checks |
| `pnpm format` | Format the codebase |
| `pnpm db:start` | Start Postgres with Docker Compose |
| `pnpm db:generate` | Generate a migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm auth:schema` | Regenerate the Better Auth schema |

## Database changes

Never use `pnpm db:push`. Every schema change goes through a migration:

1. Update the schema in `src/lib/server/db/` (for Better Auth tables, run `pnpm auth:schema` first).
2. Run `pnpm db:generate` to create the migration in `drizzle/`.
3. Run `pnpm db:migrate` to apply it.

## Project layout

```
src/
  lib/
    components/     UI components (shadcn-svelte in ui/)
    server/
      auth.ts       Better Auth config
      db/           Drizzle schema
      s3/           S3 client and multipart helpers
      storage/      Storage services
  routes/
    (app)/          Authenticated pages: home, folders (f), recent, shared, bin
    login/          Login page
    s/[token]/      Public share pages
    api/download/   Streaming zip download endpoint
drizzle/            SQL migrations
docs/               Feature specs, data model, and security notes
```

Data fetching and mutations use SvelteKit remote functions. `+page.server.ts` and `+layout.server.ts` only handle session state and redirects. The zip download endpoint is the one API route.

## Documentation

Feature specs, the data model, and security notes live in [`docs/`](docs/README.md).
