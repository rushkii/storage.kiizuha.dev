<script lang="ts">
  import { resolve } from '$app/paths';
  import * as Dialog from '#ui/dialog';
  import { Button } from '#ui/button';
  import { BIN_RETENTION_DAYS } from '#lib/schemas/storage.ts';
  import { itemActions } from '#lib/hooks/item-actions.svelte.ts';

  import Trash2Icon from '@lucide/svelte/icons/trash-2';

  const result = $derived(itemActions.binResult);
  const close = () => (itemActions.binResult = null);
</script>

<Dialog.Root open={result !== null} onOpenChange={(open) => !open && close()}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <div class="mb-1 flex size-9 items-center justify-center rounded-full bg-muted">
        <Trash2Icon class="size-4" />
      </div>
      <Dialog.Title>
        {result?.done ?? 0} item{result?.done === 1 ? '' : 's'} moved to bin
      </Dialog.Title>
      <Dialog.Description>
        Items in the bin are deleted permanently after {BIN_RETENTION_DAYS} days.
      </Dialog.Description>
    </Dialog.Header>
    {#if result?.failed.length}
      <div class="grid gap-1.5">
        <p class="text-sm font-medium">
          {result.failed.length} item{result.failed.length === 1 ? '' : 's'} could not be moved
        </p>
        <ul class="max-h-48 divide-y overflow-y-auto rounded-md border text-sm">
          {#each result.failed as failure, i (i)}
            <li class="px-3 py-2">
              <p class="truncate font-medium">{failure.name}</p>
              <p class="text-xs text-muted-foreground">{failure.reason}</p>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
    <Dialog.Footer>
      <Button variant="outline" href={resolve('/(app)/bin')} onclick={close}>Go to bin</Button>
      <Button onclick={close}>Done</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
