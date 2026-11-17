# Svelte tooling

Use the official Svelte MCP server for Svelte 5 and SvelteKit work.

- Start with `list-sections`, then use `get-documentation` for the sections relevant to the task.
- Run `svelte-autofixer` whenever writing or editing Svelte components or modules. Address its findings before finishing.
- The MCP server may run outside the repository. Pass absolute file paths to `svelte-autofixer`, or pass the code directly.
- Only call `playground-link` after the user asks for or agrees to a link, and never for code already written to project files.

Tool names differ per agent (for example `mcp__plugin_svelte_svelte__<tool>` in Claude Code, sanitized names in OMP). Discover the actual names through the tool inventory rather than assuming them.
