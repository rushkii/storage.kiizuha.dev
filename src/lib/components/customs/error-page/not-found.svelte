<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { Button } from '#ui/button';
  import { BIN_NAV, RECENT_NAV, SHARED_NAV } from '#lib/constants/index.ts';
  import ErrorShell from './error-shell.svelte';
  import ErrorArt from './error-art.svelte';
  import ErrorChip from './error-chip.svelte';
  import ErrorIntro from './error-intro.svelte';

  import FolderIcon from '@lucide/svelte/icons/folder';
  import SearchIcon from '@lucide/svelte/icons/search';
  import CompassIcon from '@lucide/svelte/icons/compass';
  import FileTextIcon from '@lucide/svelte/icons/file-text';
  import ImageIcon from '@lucide/svelte/icons/image';
  import HouseIcon from '@lucide/svelte/icons/house';
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
  import LogInIcon from '@lucide/svelte/icons/log-in';
  import LinkIcon from '@lucide/svelte/icons/link';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';

  // 404. Signed in: links back into the library. Guest: sign in, plus a hint about
  // share links, since a cut-off share link is the usual way a guest lands here.

  const signedIn = $derived(Boolean(page.data.viewer));
  const signInHref = $derived(
    resolve(`/login?redirectTo=${encodeURIComponent(page.url.pathname + page.url.search)}`)
  );

  const QUICK_LINKS = [
    { nav: RECENT_NAV, hint: 'Files you opened lately' },
    { nav: SHARED_NAV, hint: 'Links you’ve shared' },
    { nav: BIN_NAV, hint: 'Maybe it was deleted' }
  ];
</script>

<ErrorShell>
  <ErrorArt>
    <div class="relative flex items-center gap-3 sm:gap-4">
      <span class="text-8xl leading-none font-bold tracking-tighter text-foreground/10 sm:text-9xl"
        >4</span
      >
      <div
        class="flex h-28 w-24 -rotate-4 flex-col overflow-hidden rounded-xl bg-card shadow-lg ring-1 shadow-foreground/10 ring-foreground/10 sm:h-36 sm:w-32"
      >
        <div class="flex items-center gap-1.5 border-b px-2.5 py-2">
          <FolderIcon class="size-3 text-muted-foreground" />
          <span class="h-1.5 flex-1 rounded-full bg-muted"></span>
        </div>
        <div
          class="m-2 flex flex-1 items-center justify-center rounded-lg border-[1.5px] border-dashed border-foreground/15 sm:m-2.5"
        >
          <span
            class="flex size-8 items-center justify-center rounded-full bg-primary/12 text-primary sm:size-10"
          >
            {#if signedIn}
              <SearchIcon class="size-4" />
            {:else}
              <CompassIcon class="size-4" />
            {/if}
          </span>
        </div>
      </div>
      <span class="text-8xl leading-none font-bold tracking-tighter text-foreground/10 sm:text-9xl"
        >4</span
      >
    </div>

    {#if signedIn}
      <ErrorChip class="top-6 left-0 -rotate-6 sm:left-6">
        <FileTextIcon class="text-destructive" /> report-final.pdf
      </ErrorChip>
      <ErrorChip class="right-0 bottom-6 rotate-5 sm:top-16 sm:right-4 sm:bottom-auto">
        <ImageIcon class="text-primary" /> IMG_0412.jpg
      </ErrorChip>
      <ErrorChip class="bottom-1 left-16 rotate-3 opacity-70 max-sm:hidden">
        <FolderIcon /> Projects / 2024
      </ErrorChip>
    {:else}
      <ErrorChip class="top-6 left-0 max-w-40 -rotate-6 font-mono sm:left-6">
        <span class="truncate">{page.url.pathname}</span>
      </ErrorChip>
      <ErrorChip class="right-0 bottom-6 rotate-5 font-mono sm:top-16 sm:right-4 sm:bottom-auto">
        /s/…
      </ErrorChip>
    {/if}
  </ErrorArt>

  {#if signedIn}
    <ErrorIntro code="404 · Not found" title="This page wandered off">
      The file or folder you’re looking for was moved, renamed, or never existed. Check the address,
      or head back to your files.
    </ErrorIntro>

    <div class="mt-5 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
      <Button size="lg" href={resolve('/(app)')} class="max-sm:h-11">
        <HouseIcon data-icon="inline-start" /> Go to My files
      </Button>
      <Button size="lg" variant="outline" onclick={() => history.back()} class="max-sm:h-11">
        <ArrowLeftIcon data-icon="inline-start" /> Go back
      </Button>
    </div>

    <div class="mt-8 flex w-full items-center gap-3 text-[0.6875rem] text-muted-foreground">
      <span class="h-px flex-1 bg-border"></span>
      or jump to
      <span class="h-px flex-1 bg-border"></span>
    </div>

    <nav
      aria-label="Library"
      class="mt-3 grid w-full overflow-hidden rounded-lg ring-1 ring-foreground/10 max-sm:bg-card sm:grid-cols-3 sm:gap-2 sm:overflow-visible sm:ring-0"
    >
      {#each QUICK_LINKS as { nav, hint } (nav.url)}
        <a
          href={resolve(nav.url)}
          class="group flex items-center gap-2.5 p-3 text-start text-foreground transition-colors not-last:border-b hover:bg-muted/60 max-sm:h-11 sm:flex-col sm:items-start sm:gap-1.5 sm:rounded-lg sm:bg-card sm:ring-1 sm:ring-foreground/10 sm:not-last:border-b-0"
        >
          <nav.icon class="size-3.5 shrink-0 text-primary" />
          <span class="flex-1 text-xs font-medium">{nav.title}</span>
          <span class="text-[0.6875rem] leading-snug text-muted-foreground max-sm:hidden"
            >{hint}</span
          >
          <ChevronRightIcon class="size-3.5 text-muted-foreground sm:hidden" />
        </a>
      {/each}
    </nav>
  {:else}
    <ErrorIntro code="404 · Not found" title="There’s nothing at this address">
      The link may be mistyped or out of date. If you were trying to sign in, use the button below.
      It always goes to the right page.
    </ErrorIntro>

    <div class="mt-5 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
      <Button size="lg" href={signInHref} class="max-sm:h-11">
        <LogInIcon data-icon="inline-start" /> Sign in
      </Button>
      <Button size="lg" variant="outline" onclick={() => history.back()} class="max-sm:h-11">
        <ArrowLeftIcon data-icon="inline-start" /> Go back
      </Button>
    </div>

    <div class="mt-8 flex w-full items-center gap-3 text-[0.6875rem] text-muted-foreground">
      <span class="h-px flex-1 bg-border"></span>
      opening a shared file?
      <span class="h-px flex-1 bg-border"></span>
    </div>

    <div
      class="mt-3 flex w-full max-w-md flex-col gap-2.5 rounded-lg bg-card p-3.5 text-start ring-1 ring-foreground/10"
    >
      <span class="text-xs font-medium">Share links look like this</span>
      <div
        class="flex h-8 items-center gap-2 overflow-hidden rounded-md bg-muted px-2.5 font-mono text-[0.6875rem] whitespace-nowrap"
      >
        <LinkIcon class="size-3 shrink-0 text-muted-foreground" />
        <span class="truncate text-muted-foreground">{page.url.host}</span><span
          class="font-medium text-primary">/s/</span
        ><span>…</span>
      </div>
      <span class="text-[0.6875rem] leading-relaxed text-muted-foreground">
        Make sure you copied the whole link, including the part after <code class="font-mono"
          >/s/</code
        >. Chat apps sometimes cut long links in half.
      </span>
    </div>
  {/if}
</ErrorShell>
