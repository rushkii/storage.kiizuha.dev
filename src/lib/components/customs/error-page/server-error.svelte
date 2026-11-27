<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { toast } from 'svelte-sonner';
  import { Button } from '#ui/button';
  import ErrorShell from './error-shell.svelte';
  import ErrorArt from './error-art.svelte';
  import ErrorChip from './error-chip.svelte';
  import ErrorIntro from './error-intro.svelte';

  import CheckIcon from '@lucide/svelte/icons/check';
  import XIcon from '@lucide/svelte/icons/x';
  import CopyIcon from '@lucide/svelte/icons/copy';
  import RotateCwIcon from '@lucide/svelte/icons/rotate-cw';
  import HouseIcon from '@lucide/svelte/icons/house';
  import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';

  // Fallback for every status without its own page: 5xx, plus odd 4xx like 400, 405 or 413.

  const LABELS: Record<number, string> = {
    400: 'Bad request',
    405: 'Not allowed',
    413: 'Too large',
    429: 'Too many requests',
    500: 'Server error',
    502: 'Bad gateway',
    504: 'Timed out'
  };

  const status = $derived(page.status);
  const isServer = $derived(status >= 500);
  const label = $derived(LABELS[status] ?? 'Error');
  const errorId = $derived(page.error?.errorId);

  const copyId = async () => {
    if (!errorId) return;
    try {
      await navigator.clipboard.writeText(errorId);
      toast.success('Error ID copied.');
    } catch {
      toast.error('Couldn’t copy the error ID.');
    }
  };
</script>

<ErrorShell>
  <ErrorArt>
    <div
      class="relative w-64 -rotate-2 overflow-hidden rounded-xl bg-card text-start shadow-lg ring-1 shadow-foreground/10 ring-foreground/10 sm:w-72"
    >
      <div class="flex items-center gap-1.5 border-b px-3 py-2">
        <span class="size-2 rounded-full bg-muted"></span>
        <span class="size-2 rounded-full bg-muted"></span>
        <span class="size-2 rounded-full bg-muted"></span>
        <span class="ms-auto max-w-36 truncate font-mono text-[0.625rem] text-muted-foreground">
          {page.url.pathname}
        </span>
      </div>
      <div class="flex flex-col gap-1.5 p-3 font-mono text-[0.6875rem]">
        <div class="flex items-center gap-2 text-muted-foreground">
          <CheckIcon class="size-3 text-primary" /> request received
        </div>
        <div class="flex items-center gap-2 text-muted-foreground">
          <CheckIcon class="size-3 text-primary" /> route matched
        </div>
        <div
          class="-mx-1.5 flex items-center gap-2 rounded-md bg-destructive/10 px-1.5 py-1 text-destructive"
        >
          <XIcon class="size-3" /> handle request <span class="ms-auto">{status}</span>
        </div>
        <div class="flex items-center gap-2 text-muted-foreground/60">
          <span class="size-3 rounded-full border-[1.5px] border-dashed border-current"></span>
          send page
        </div>
      </div>
    </div>

    <ErrorChip class="top-5 right-2 rotate-6 font-mono text-destructive sm:right-6">
      <TriangleAlertIcon />
      {status}
    </ErrorChip>
  </ErrorArt>

  <ErrorIntro
    code="{status} · {label}"
    tone="destructive"
    title={isServer ? 'Something broke on our side' : 'That request didn’t work'}
  >
    {#if isServer}
      Your files are fine. The server just couldn’t finish this request. Try again in a moment, and
      if it keeps happening, quote the error ID below.
    {:else}
      {page.error?.message ?? 'The server couldn’t handle this request.'}
    {/if}
  </ErrorIntro>

  {#if errorId}
    <div
      class="mt-5 flex h-9 w-full max-w-sm items-center gap-2 rounded-lg bg-muted ps-3 pe-1 max-sm:h-11"
    >
      <span class="text-[0.6875rem] text-muted-foreground">Error ID</span>
      <code class="min-w-0 flex-1 truncate text-start font-mono text-[0.6875rem]">{errorId}</code>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Copy error ID"
        onclick={copyId}
        class="bg-background max-sm:size-9"
      >
        <CopyIcon />
      </Button>
    </div>
  {/if}

  <div class="mt-4 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
    <Button size="lg" onclick={() => location.reload()} class="max-sm:h-11">
      <RotateCwIcon data-icon="inline-start" /> Try again
    </Button>
    <Button size="lg" variant="outline" href={resolve('/(app)')} class="max-sm:h-11">
      <HouseIcon data-icon="inline-start" /> Go to My files
    </Button>
  </div>

  <details class="mt-5 w-full max-w-sm text-start text-[0.6875rem] text-muted-foreground">
    <summary class="cursor-pointer rounded-sm select-none">Technical details</summary>
    <dl
      class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-muted px-3 py-2.5 font-mono text-[0.625rem]"
    >
      <dt>status</dt>
      <dd class="text-foreground">{status}</dd>
      <dt>path</dt>
      <dd class="truncate text-foreground">{page.url.pathname}</dd>
      <dt>message</dt>
      <dd class="text-foreground">{page.error?.message ?? '—'}</dd>
    </dl>
  </details>
</ErrorShell>
