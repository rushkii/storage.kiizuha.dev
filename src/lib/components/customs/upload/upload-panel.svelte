<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { prefersReducedMotion } from 'svelte/motion';
  import { toast } from 'svelte-sonner';
  import { Button } from '#ui/button';
  import { Progress } from '#ui/progress';
  import { Spinner } from '#ui/spinner';
  import { cn } from '#lib/utils.ts';
  import { formatBytes } from '#lib/file-kind.ts';
  import { uploads, type UploadItem } from '#lib/uploads/upload-manager.svelte.ts';

  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import XIcon from '@lucide/svelte/icons/x';
  import PauseIcon from '@lucide/svelte/icons/pause';
  import PlayIcon from '@lucide/svelte/icons/play';
  import RotateCwIcon from '@lucide/svelte/icons/rotate-cw';
  import FileUpIcon from '@lucide/svelte/icons/file-up';
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check';
  import AlertCircleIcon from '@lucide/svelte/icons/circle-alert';
  import WifiOffIcon from '@lucide/svelte/icons/wifi-off';
  import ClockIcon from '@lucide/svelte/icons/clock';
  import BanIcon from '@lucide/svelte/icons/ban';
  import RefreshCcwIcon from '@lucide/svelte/icons/refresh-ccw';

  let collapsed = $state(false);
  let picker = $state<HTMLInputElement | null>(null);
  let reattaching = $state<UploadItem | null>(null);

  onMount(() => {
    void uploads.restore();
  });

  const items = $derived(uploads.items);
  const counts = $derived({
    active: items.filter((i) => i.isActive).length,
    completed: items.filter((i) => i.status === 'completed').length,
    paused: items.filter((i) => i.isPaused).length,
    failed: items.filter((i) => i.status === 'failed').length
  });

  const title = $derived.by(() => {
    if (counts.active) return `Uploading ${counts.active} file${counts.active === 1 ? '' : 's'}`;
    if (counts.paused) return `${counts.paused} upload${counts.paused === 1 ? '' : 's'} paused`;
    if (counts.failed) return `${counts.failed} upload${counts.failed === 1 ? '' : 's'} failed`;
    return `${counts.completed} upload${counts.completed === 1 ? '' : 's'} complete`;
  });

  const timeLeft = (seconds: number | null) => {
    if (seconds === null) return '';
    if (seconds < 60) return `${seconds} s left`;
    if (seconds < 3600) return `${Math.ceil(seconds / 60)} min left`;
    return `${Math.floor(seconds / 3600)} h ${Math.ceil((seconds % 3600) / 60)} min left`;
  };

  const reselect = (item: UploadItem) => {
    reattaching = item;
    picker?.click();
  };

  const onPicked = (file: File | undefined) => {
    const item = reattaching;
    reattaching = null;
    if (!item || !file) return;
    const problem = uploads.attachFile(item, file);
    if (problem) toast.error(problem);
  };

  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    if (uploads.hasActive) event.preventDefault();
  };
</script>

<svelte:window onbeforeunload={onBeforeUnload} />

<input
  bind:this={picker}
  type="file"
  class="sr-only"
  tabindex="-1"
  onchange={(e) => {
    onPicked(e.currentTarget.files?.[0]);
    e.currentTarget.value = '';
  }}
/>

{#snippet status(item: UploadItem)}
  {#if item.status === 'queued'}
    <ClockIcon class="size-3" /> Queued
  {:else if item.status === 'preparing'}
    <Spinner class="size-3" /> Preparing…
  {:else if item.status === 'uploading'}
    {formatBytes(item.uploadedBytes)} of {formatBytes(item.size)}
    {#if item.speed > 0}· {formatBytes(item.speed)}/s · {timeLeft(item.secondsLeft)}{/if}
  {:else if item.status === 'pausedUser'}
    <PauseIcon class="size-3" /> Paused · {Math.floor(item.progress)}%
  {:else if item.status === 'pausedOffline'}
    <WifiOffIcon class="size-3" /> Paused, you're offline. Resumes when you're back.
  {:else if item.status === 'pausedReload'}
    <RefreshCcwIcon class="size-3" /> Paused, page reloaded. Select the file again to resume.
  {:else if item.status === 'resuming'}
    <Spinner class="size-3" /> Resuming…
  {:else if item.status === 'completing'}
    <Spinner class="size-3" /> Finishing…
  {:else if item.status === 'completed'}
    <CheckCircleIcon class="size-3" /> Uploaded to {item.folderName}
  {:else if item.status === 'failed'}
    <AlertCircleIcon class="size-3 shrink-0" /> {item.error ?? 'Upload failed.'}
  {:else if item.status === 'cancelling'}
    <Spinner class="size-3" /> Cancelling…
  {:else}
    <BanIcon class="size-3" /> Cancelled
  {/if}
{/snippet}

{#if items.length}
  <section
    aria-label="Uploads"
    class="fixed inset-e-4 bottom-4 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg"
    transition:fly={{ y: 16, duration: prefersReducedMotion.current ? 0 : 200 }}
  >
    <header class="flex items-center gap-2 border-b bg-muted/50 px-3 py-2">
      {#if counts.active}<Spinner class="size-3.5" />{/if}
      <h2 class="min-w-0 flex-1 truncate text-sm font-medium" aria-live="polite">{title}</h2>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={collapsed ? 'Expand uploads' : 'Collapse uploads'}
        aria-expanded={!collapsed}
        onclick={() => (collapsed = !collapsed)}
      >
        <ChevronDownIcon
          class={cn(
            'transition-transform motion-reduce:transition-none',
            collapsed && 'rotate-180'
          )}
        />
      </Button>
      {#if uploads.allFinished}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Dismiss uploads"
          onclick={() => uploads.dismissFinished()}
        >
          <XIcon />
        </Button>
      {/if}
    </header>

    {#if !collapsed}
      <ul class="max-h-80 divide-y overflow-y-auto">
        {#each items as item (item.key)}
          <li class="grid gap-1.5 px-3 py-2.5" data-status={item.status}>
            <div class="flex items-center gap-2">
              <FileUpIcon
                class={cn(
                  'size-4 shrink-0',
                  item.status === 'completed' && 'text-emerald-600 dark:text-emerald-400',
                  item.status === 'failed' && 'text-destructive',
                  item.isPaused && 'text-amber-600 dark:text-amber-400',
                  (item.status === 'cancelled' || item.status === 'queued') &&
                    'text-muted-foreground'
                )}
              />
              <p class="min-w-0 flex-1 truncate text-sm" title={item.name}>{item.name}</p>
              <div class="flex shrink-0 items-center">
                {#if item.status === 'pausedReload'}
                  <Button variant="outline" size="sm" onclick={() => reselect(item)}
                    >Select file</Button
                  >
                {:else if item.isPaused}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Resume ${item.name}`}
                    onclick={() => uploads.resume(item)}
                  >
                    <PlayIcon />
                  </Button>
                {:else if item.status === 'failed'}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Retry ${item.name}`}
                    onclick={() => uploads.retry(item)}
                  >
                    <RotateCwIcon />
                  </Button>
                {:else if ['queued', 'preparing', 'uploading', 'resuming'].includes(item.status)}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Pause ${item.name}`}
                    onclick={() => uploads.pause(item)}
                  >
                    <PauseIcon />
                  </Button>
                {/if}
                {#if !item.isFinished && item.status !== 'cancelling' && item.status !== 'completing'}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Cancel ${item.name}`}
                    onclick={() => uploads.cancel(item)}
                  >
                    <XIcon />
                  </Button>
                {/if}
              </div>
            </div>
            {#if !item.isFinished}
              <Progress
                value={item.progress}
                class={cn(item.isPaused && '*:data-[slot=progress-indicator]:bg-amber-500')}
                aria-label={`${item.name} upload progress`}
              />
            {/if}
            <p
              class={cn(
                'flex items-center gap-1 text-xs text-muted-foreground',
                item.status === 'failed' && 'text-destructive',
                item.status === 'completed' && 'text-emerald-700 dark:text-emerald-400'
              )}
            >
              {@render status(item)}
            </p>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}
