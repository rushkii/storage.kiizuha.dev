# Svelte tooling

Use the official Svelte MCP server for Svelte 5 and SvelteKit work.

- Start with `list-sections`, then use `get-documentation` for the sections relevant to the task.
- Run `svelte-autofixer` whenever writing or editing Svelte components or modules. Address its findings before finishing.
- The MCP server may run outside the repository. Pass absolute file paths to `svelte-autofixer`, or pass the code directly.
- Only call `playground-link` after the user asks for or agrees to a link, and never for code already written to project files.

Tool names differ per agent (for example `mcp__plugin_svelte_svelte__<tool>` in Claude Code, sanitized names in OMP). Discover the actual names through the tool inventory rather than assuming them.

# Context

@AGENTS.md and @CLAUDE.md are the same, any edits in these files should be the same.

# Conventions

Never use `+*.server.ts`, `+server.ts`, `+page.ts`, `+layout.ts` for heavy data fetching, they should only share a non-sensitive server/session state, redirect, and so on.
Heavy data fetching always rely on remote functions, use API only when I ask to.

# Database migrations

Never run `pnpm db:push` (`drizzle-kit push`). It applies schema changes straight to the database without a migration file.

Every schema change goes through a migration:

1. Update the schema in `src/lib/server/db/` (for Better Auth tables, run `pnpm auth:schema` first).
2. Run `pnpm db:generate` to create the migration in `drizzle/`.
3. Run `pnpm db:migrate` to apply it.

# References

For more documentations, please refer to @docs/.
