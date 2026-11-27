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

## Deploying with Docker

`compose.prod.yaml` runs Postgres, a one-off migration job, and the app (adapter-node). HTTPS is handled by Caddy installed on the host. The app binds to `127.0.0.1` only, so public traffic reaches it through Caddy alone. That is required because Better Auth trusts the `x-real-ip` header Caddy sets for rate limiting (see `docs/security/security.md`).

1. Point the domain's DNS `A`/`AAAA` record at the server (DNS only, no proxy).
2. On the server, clone the repo and create `.env` from `.env.example`. Besides the app variables, fill in:

    | Variable | Purpose |
    | --- | --- |
    | `ORIGIN` | The public URL, e.g. `https://storage.kiizuha.dev` |
    | `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Database credentials. Use a URL-safe password (`openssl rand -hex 24`) |
    | `APP_PORT` | Host port the app binds on `127.0.0.1` (default `3000`); pick a free one |

    `DATABASE_URL` is ignored here; the stack builds it from the `POSTGRES_*` values. `APP_NAME` is inlined at build time, so rebuild after changing it.

3. Build and start:

    ```sh
    docker compose -f compose.prod.yaml up -d --build
    ```

    The `migrate` service applies pending migrations and exits before `app` starts.

4. Copy the site block from `Caddyfile` into the host's `/etc/caddy/Caddyfile` (keep the port in sync with `APP_PORT`) and reload Caddy:

    ```sh
    sudo systemctl reload caddy
    ```

    Keep `header_up X-Real-IP {client_ip}` in the block; without it the rate limiter has no client IP.

To update, pull and run the same command again. Logs: `docker compose -f compose.prod.yaml logs -f app`.

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

## License

[MIT](LICENSE)
