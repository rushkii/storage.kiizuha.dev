<script lang="ts">
  import { fade } from 'svelte/transition';
  import { prefersReducedMotion } from 'svelte/motion';
  import * as DropdownMenu from '#ui/dropdown-menu';
  import { Button } from '#ui/button';
  import { Spinner } from '#ui/spinner';
  import { itemActions, type NamedItem } from '#lib/hooks/item-actions.svelte.ts';

  import XIcon from '@lucide/svelte/icons/x';
  import Share2Icon from '@lucide/svelte/icons/share-2';
  import DownloadIcon from '@lucide/svelte/icons/download';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import FolderInputIcon from '@lucide/svelte/icons/folder-input';

  // Replaces the page header while items are selected.

  let { items, onClear }: { items: NamedItem[]; onClear: () => void } = $props();
</script>

<div
  class="flex min-w-0 flex-1 items-center gap-1"
  role="toolbar"
  aria-label="Selection actions"
  in:fade={{ duration: prefersReducedMotion.current ? 0 : 120 }}
>
  <Button variant="ghost" size="icon-sm" aria-label="Clear selection" onclick={onClear}>
    <XIcon />
  </Button>
  <span class="me-2 text-sm font-medium whitespace-nowrap" aria-live="polite">
    {items.length} selected
  </span>
  <Button variant="ghost" size="sm" onclick={() => (itemActions.share = { items })}>
    <Share2Icon /> <span class="max-sm:sr-only">Share</span>
  </Button>
  <Button variant="ghost" size="sm" onclick={() => itemActions.startDownload(items)}>
    <DownloadIcon /> <span class="max-sm:sr-only">Download</span>
  </Button>
  <Button
    variant="ghost"
    size="sm"
    disabled={itemActions.busy}
    onclick={() => itemActions.moveToBin(items, onClear)}
  >
    {#if itemActions.busy}<Spinner />{:else}<Trash2Icon />{/if}
    <span class="max-sm:sr-only">Move to bin</span>
  </Button>
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button variant="ghost" size="icon-sm" aria-label="More actions" {...props}>
          <EllipsisVerticalIcon />
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="start" class="w-44">
      <DropdownMenu.Item
        disabled={items.length !== 1}
        onclick={() => (itemActions.rename = { ...items[0] })}
      >
        <PencilIcon /> Rename
      </DropdownMenu.Item>
      <DropdownMenu.Item onclick={() => (itemActions.move = { items })}>
        <FolderInputIcon /> Move to…
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</div>
