# Base User Interface

This document describes which UI building blocks to use.

## Rules

- ALWAYS use shadcn-svelte as the base components. Look a component up with the `shadcn-svelte` skill before writing one by hand.
- ALWAYS use animations and transitions, but respect the user's reduced-motion setting:
  - Tailwind: `motion-safe:` / `motion-reduce:` variants.
  - Svelte transitions: read `prefersReducedMotion` from `svelte/motion` and use `duration: 0` when it is on.
- Icons: `@lucide/svelte`. Toasts: `svelte-sonner`. Light/dark theme: `mode-watcher`.
- Confirmations use `alert-dialog`; empty states use `empty`.

## Component Placement

| Kind | Location | Import alias |
| ---- | -------- | ------------ |
| shadcn-svelte components | `src/lib/components/ui` | `#ui/*` |
| App-specific components | `src/lib/components/customs` | `#components/customs/*` |
| Data table | `src/lib/components/data-table` | `#data-table/*` |
