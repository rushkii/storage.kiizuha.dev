<script lang="ts">
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { APP_NAME } from '$app/env/public';
  import * as Avatar from '#ui/avatar';
  import { Button } from '#ui/button';
  import { getUserInitials } from '#lib/utils.ts';

  import HardDriveIcon from '@lucide/svelte/icons/hard-drive';
  import LogInIcon from '@lucide/svelte/icons/log-in';

  // Full-screen frame shared by every error page: dotted backdrop, brand header,
  // centred content, and the requested path in the footer.

  let { children }: { children: Snippet } = $props();

  const viewer = $derived(page.data.viewer as { name: string } | null | undefined);
  const signInHref = $derived(
    resolve(`/login?redirectTo=${encodeURIComponent(page.url.pathname + page.url.search)}`)
  );
</script>

<div class="relative isolate flex min-h-svh flex-col overflow-hidden bg-background text-foreground">
  <div
    aria-hidden="true"
    class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(color-mix(in_oklch,var(--foreground)_14%,transparent)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_35%,#000_20%,transparent_75%)] bg-size-[22px_22px]"
  ></div>

  <header class="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
    <a href={resolve('/(app)')} class="flex items-center gap-2 rounded-md text-foreground">
      <span
        class="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground"
      >
        <HardDriveIcon class="size-3.5" />
      </span>
      <span class="text-sm font-semibold">{APP_NAME}</span>
    </a>

    {#if viewer}
      <Avatar.Root>
        <Avatar.Fallback class="text-xs font-semibold"
          >{getUserInitials(viewer.name)}</Avatar.Fallback
        >
      </Avatar.Root>
    {:else}
      <Button variant="outline" href={signInHref} class="max-sm:h-9">
        <LogInIcon data-icon="inline-start" />
        Sign in
      </Button>
    {/if}
  </header>

  <main class="flex flex-1 flex-col items-center justify-center px-4 pt-4 pb-10 sm:px-6">
    <div
      class="flex w-full max-w-xl flex-col items-center text-center motion-safe:animate-in motion-safe:duration-500 motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
    >
      {@render children()}
    </div>
  </main>

  <footer
    class="flex items-center justify-between gap-4 border-t px-4 py-3.5 text-[0.6875rem] text-muted-foreground sm:px-6"
  >
    <span class="min-w-0 truncate font-mono">{page.url.pathname}</span>
    <span class="shrink-0">{page.url.host}</span>
  </footer>
</div>
