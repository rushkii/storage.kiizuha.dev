<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { SvelteSet } from 'svelte/reactivity';
  import * as Dialog from '#ui/dialog';
  import { Button } from '#ui/button';
  import { Spinner } from '#ui/spinner';
  import { cn } from '#lib/utils.ts';
  import { getFolderTree, moveItems } from '#lib/remotes/library.remote.ts';
  import { errorMessage, itemActions, LIST_QUERIES } from '#lib/hooks/item-actions.svelte.ts';
  import { toSelection } from '#lib/hooks/item-selection.svelte.ts';

  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import FolderIcon from '@lucide/svelte/icons/folder';

  type TreeNode = { id: string; name: string; children: TreeNode[] };

  const target = $derived(itemActions.move);
  const tree = $derived(target ? getFolderTree() : null);
  const movingFolders = $derived(
    new Set(target?.items.filter((i) => i.type === 'folder').map((i) => i.id) ?? [])
  );

  let chosen = $derived.by<{ id: string; name: string } | null>(() => {
    void target;
    return null;
  });
  let moving = $state(false);
  const expanded = new SvelteSet<string>();

  const close = () => (itemActions.move = null);

  const confirm = async () => {
    if (!target || !chosen) return;
    moving = true;
    try {
      const result = await moveItems({
        selection: toSelection(target.items),
        targetFolderId: chosen.id
      }).updates(...LIST_QUERIES);
      if (result.failed.length) {
        toast.warning(`${result.done} moved, ${result.failed.length} could not be moved.`, {
          description: result.failed.map((f) => `${f.name}: ${f.reason}`).join('\n')
        });
      } else {
        toast.success(
          `${result.done} item${result.done === 1 ? '' : 's'} moved to “${chosen.name}”.`
        );
      }
      close();
    } catch (cause) {
      toast.error(errorMessage(cause, 'Could not move these items.'));
    } finally {
      moving = false;
    }
  };
</script>

{#snippet branch(nodes: TreeNode[], depth: number, blocked: boolean)}
  {#each nodes as node (node.id)}
    {@const isBlocked = blocked || movingFolders.has(node.id)}
    {@const isOpen = expanded.has(node.id)}
    <li>
      <div
        class={cn(
          'flex items-center gap-1 rounded-md pe-2 text-sm',
          chosen?.id === node.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
          isBlocked && 'opacity-50'
        )}
        style:padding-inline-start="{depth * 16 + 4}px"
      >
        <button
          type="button"
          class={cn(
            'flex size-6 items-center justify-center rounded',
            !node.children.length && 'invisible'
          )}
          aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
          onclick={() => (isOpen ? expanded.delete(node.id) : expanded.add(node.id))}
        >
          <ChevronRightIcon
            class={cn(
              'size-3.5 transition-transform motion-reduce:transition-none',
              isOpen && 'rotate-90'
            )}
          />
        </button>
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-start disabled:cursor-not-allowed"
          disabled={isBlocked}
          aria-pressed={chosen?.id === node.id}
          onclick={() => (chosen = { id: node.id, name: node.name })}
        >
          <FolderIcon class="size-4 shrink-0 text-muted-foreground" />
          <span class="truncate">{node.name}</span>
        </button>
      </div>
      {#if isOpen && node.children.length}
        <ul>{@render branch(node.children, depth + 1, isBlocked)}</ul>
      {/if}
    </li>
  {/each}
{/snippet}

<Dialog.Root open={target !== null} onOpenChange={(open) => !open && close()}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>
        Move {target?.items.length === 1
          ? `“${target.items[0].name}”`
          : `${target?.items.length} items`}
      </Dialog.Title>
      <Dialog.Description>Choose the destination folder.</Dialog.Description>
    </Dialog.Header>
    <div class="max-h-80 overflow-y-auto rounded-md border p-1">
      {#if !tree?.ready}
        <div class="flex items-center gap-2 p-3 text-sm text-muted-foreground">
          <Spinner /> Loading folders…
        </div>
      {:else if tree.current.every((cat) => !cat.folders.length)}
        <p class="p-3 text-sm text-muted-foreground">There are no folders to move into.</p>
      {:else}
        {#each tree.current as category (category.id)}
          {#if category.folders.length}
            <p class="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">{category.name}</p>
            <ul>{@render branch(category.folders, 0, false)}</ul>
          {/if}
        {/each}
      {/if}
    </div>
    <Dialog.Footer>
      <Button variant="outline" onclick={close}>Cancel</Button>
      <Button disabled={!chosen || moving} onclick={confirm}>
        {#if moving}<Spinner />{/if}
        {chosen ? `Move to “${chosen.name}”` : 'Move here'}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
