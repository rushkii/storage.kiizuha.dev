<script lang="ts">
  import * as AlertDialog from '#ui/alert-dialog';
  import { Button } from '#ui/button';
  import { Input } from '#ui/input';
  import { Label } from '#ui/label';
  import { Skeleton } from '#ui/skeleton';
  import { Spinner } from '#ui/spinner';
  import ItemIcon from '#components/customs/item-icon.svelte';
  import { formatBytes } from '#lib/file-kind.ts';
  import { toSelection, type ItemRef } from '#lib/hooks/item-selection.svelte.ts';
  import { errorMessage } from '#lib/hooks/item-actions.svelte.ts';
  import { getDeletePreview } from '#lib/remotes/bin.remote.ts';

  // Permanent delete confirmation: previews everything that will be removed and asks the user
  // to type the confirm phrase, since this cannot be undone.

  type Node = NonNullable<Awaited<ReturnType<typeof getDeletePreview>>>['items'][number];

  const CONFIRM_PHRASE = 'delete permanently';

  let {
    items,
    deleting = false,
    onCancel,
    onConfirm
  }: {
    /** The items to delete; the dialog is open while this is set. */
    items: ItemRef[] | null;
    deleting?: boolean;
    onCancel: () => void;
    onConfirm: (items: ItemRef[]) => void;
  } = $props();

  let confirmText = $state('');

  const preview = $derived(items ? getDeletePreview(toSelection(items)) : null);
  const data = $derived(preview?.current);
  const matches = $derived(confirmText.trim() === CONFIRM_PHRASE);

  const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

  const summary = $derived.by(() => {
    if (!data) return '';
    const parts = [];
    if (data.totals.folders) parts.push(plural(data.totals.folders, 'folder'));
    if (data.totals.files) parts.push(plural(data.totals.files, 'file'));
    if (!parts.length) return 'Nothing left to delete.';
    return `${parts.join(' and ')}${data.totals.bytes ? ` · ${formatBytes(data.totals.bytes)}` : ''}`;
  });

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!items || !matches || deleting) return;
    onConfirm(items);
  };
</script>

{#snippet tree(nodes: Node[], depth: number)}
  {#each nodes as node (`${node.type}:${node.id}`)}
    <li>
      <div
        class="flex min-w-0 items-center gap-2 py-1 pe-3 text-sm"
        style:padding-inline-start={`${0.75 + depth * 1.25}rem`}
      >
        <ItemIcon kind={node.kind} class="size-4 shrink-0" />
        <span class="truncate" title={node.name}>{node.name}</span>
        {#if node.type === 'file' && node.size !== undefined}
          <span class="ms-auto shrink-0 text-xs text-muted-foreground tabular-nums">
            {formatBytes(node.size)}
          </span>
        {:else if node.children && node.children.length === 0}
          <span class="ms-auto shrink-0 text-xs text-muted-foreground">Empty</span>
        {/if}
      </div>
      {#if node.children?.length}
        <ul>{@render tree(node.children, depth + 1)}</ul>
      {/if}
    </li>
  {/each}
{/snippet}

<AlertDialog.Root
  open={items !== null}
  onOpenChange={(open) => {
    if (!open && !deleting) onCancel();
  }}
  onOpenChangeComplete={(open) => {
    if (!open) confirmText = '';
  }}
>
  <AlertDialog.Content class="sm:max-w-lg">
    <form class="contents" onsubmit={submit}>
      <AlertDialog.Header>
        <AlertDialog.Title>
          Delete {plural(items?.length ?? 0, 'item')} permanently?
        </AlertDialog.Title>
        <AlertDialog.Description>
          This can’t be undone. Everything listed below is removed from storage, and share links
          stop listing it.
        </AlertDialog.Description>
      </AlertDialog.Header>

      <div class="grid gap-1.5">
        <div class="flex items-baseline justify-between gap-2">
          <p class="text-sm font-medium">What will be deleted</p>
          {#if data}
            <p class="text-xs text-muted-foreground" aria-live="polite">{summary}</p>
          {/if}
        </div>
        <div class="max-h-64 overflow-y-auto rounded-md border py-1">
          {#if preview?.error}
            <p class="px-3 py-2 text-sm text-destructive" role="alert">
              {errorMessage(preview.error, 'Could not load the contents.')}
            </p>
          {:else if !data}
            <div class="grid gap-2 px-3 py-2" aria-busy="true" aria-label="Loading contents">
              {#each { length: 4 }, i (i)}
                <Skeleton class="h-4" style={`width: ${80 - i * 12}%`} />
              {/each}
            </div>
          {:else if data.items.length === 0}
            <p class="px-3 py-2 text-sm text-muted-foreground">
              These items are no longer in the bin.
            </p>
          {:else}
            <ul aria-label="Items to delete">{@render tree(data.items, 0)}</ul>
            {#if data.truncated}
              <p class="px-3 py-1 text-xs text-muted-foreground">
                Only the first part of the list is shown. The totals above count everything.
              </p>
            {/if}
          {/if}
        </div>
      </div>

      <div class="grid gap-1.5">
        <Label for="confirm-delete">
          Type <span class="font-mono font-semibold">{CONFIRM_PHRASE}</span> to confirm
        </Label>
        <Input
          id="confirm-delete"
          bind:value={confirmText}
          autocomplete="off"
          spellcheck={false}
          disabled={deleting}
        />
      </div>

      <AlertDialog.Footer>
        <AlertDialog.Cancel type="button" disabled={deleting}>Cancel</AlertDialog.Cancel>
        <Button type="submit" variant="destructive" disabled={!matches || deleting}>
          {#if deleting}<Spinner />{/if}
          Delete permanently
        </Button>
      </AlertDialog.Footer>
    </form>
  </AlertDialog.Content>
</AlertDialog.Root>
