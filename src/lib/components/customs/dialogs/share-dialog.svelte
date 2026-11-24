<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { SvelteSet } from 'svelte/reactivity';
  import { page } from '$app/state';
  import * as Dialog from '#ui/dialog';
  import * as Select from '#ui/select';
  import * as Collapsible from '#ui/collapsible';
  import { Button } from '#ui/button';
  import { Checkbox } from '#ui/checkbox';
  import { Input } from '#ui/input';
  import { Label } from '#ui/label';
  import { Spinner } from '#ui/spinner';
  import { SHARE_EXPIRY_OPTIONS, type ShareExpiry } from '#lib/schemas/storage.ts';
  import { formatBytes } from '#lib/file-kind.ts';
  import { createShare, getShareTree } from '#lib/remotes/share.remote.ts';
  import { errorMessage, itemActions } from '#lib/hooks/item-actions.svelte.ts';
  import { toSelection } from '#lib/hooks/item-selection.svelte.ts';

  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import FolderIcon from '@lucide/svelte/icons/folder';
  import FileIcon from '@lucide/svelte/icons/file';
  import CopyIcon from '@lucide/svelte/icons/copy';
  import CheckIcon from '@lucide/svelte/icons/check';
  import GlobeIcon from '@lucide/svelte/icons/globe';

  type TreeFile = { id: string; name: string; size: number };
  type TreeNode = { id: string; name: string; folders: TreeNode[]; files: TreeFile[] };

  const EXPIRY_LABELS: Record<ShareExpiry, string> = {
    '1d': '1 day',
    '3d': '3 days',
    '7d': '7 days',
    never: 'Until I unshare'
  };

  const target = $derived(itemActions.share);
  const items = $derived(target?.items ?? []);
  const single = $derived(items.length === 1 && items[0].type === 'file');
  const selection = $derived(toSelection(items));
  const tree = $derived(target && !single ? getShareTree(selection) : null);

  // Reset whenever the dialog opens for a new selection.
  let title = $derived(items.length === 1 ? items[0].name : `${items.length} items`);
  let expiry = $derived.by<ShareExpiry>(() => {
    void target;
    return '7d';
  });
  let link = $derived.by<string | null>(() => {
    void target;
    return null;
  });
  let copied = $derived.by(() => {
    void target;
    return false;
  });
  const ticked = $derived.by(() => {
    void target;
    return new SvelteSet<string>();
  });
  let creating = $state(false);

  const filesOf = (node: TreeNode): string[] => [
    ...node.files.map((f) => f.id),
    ...node.folders.flatMap(filesOf)
  ];

  const allFileIds = $derived(
    tree?.current
      ? [...tree.current.files.map((f) => f.id), ...tree.current.folders.flatMap(filesOf)]
      : []
  );

  const stateOf = (ids: string[]) => {
    const count = ids.filter((id) => ticked.has(id)).length;
    return {
      checked: count > 0 && count === ids.length,
      indeterminate: count > 0 && count < ids.length
    };
  };

  const setAll = (ids: string[], value: boolean) => {
    for (const id of ids) {
      if (value) ticked.add(id);
      else ticked.delete(id);
    }
  };

  const close = () => (itemActions.share = null);

  const create = async () => {
    if (!target) return;
    creating = true;
    try {
      const created = await createShare({
        selection,
        tickedFileIds: single ? [] : [...ticked],
        title,
        expiry
      });
      link = new URL(`/s/${created.token}`, page.url.origin).href;
    } catch (cause) {
      toast.error(errorMessage(cause, 'Could not create the link.'));
    } finally {
      creating = false;
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      toast.error('Could not copy. Select the link and copy it yourself.');
    }
  };
</script>

{#snippet fileRow(file: TreeFile, depth: number)}
  <label
    class="flex cursor-pointer items-center gap-2 rounded-md py-1.5 pe-2 text-sm hover:bg-muted"
    style:padding-inline-start="{depth * 16 + 8}px"
  >
    <Checkbox
      checked={ticked.has(file.id)}
      onCheckedChange={(value) => setAll([file.id], value === true)}
    />
    <FileIcon class="size-4 shrink-0 text-muted-foreground" />
    <span class="min-w-0 flex-1 truncate">{file.name}</span>
    <span class="shrink-0 text-xs text-muted-foreground tabular-nums">{formatBytes(file.size)}</span
    >
  </label>
{/snippet}

{#snippet folderSection(node: TreeNode, depth: number)}
  {@const ids = filesOf(node)}
  {@const state = stateOf(ids)}
  <Collapsible.Root open={depth === 0} class="group/section">
    <div
      class="flex items-center gap-2 rounded-md py-1.5 pe-2 text-sm hover:bg-muted"
      style:padding-inline-start="{depth * 16 + 8}px"
    >
      <Checkbox
        checked={state.checked}
        indeterminate={state.indeterminate}
        disabled={!ids.length}
        aria-label={`Select all files in ${node.name}`}
        onCheckedChange={(value) => setAll(ids, value === true)}
      />
      <Collapsible.Trigger class="flex min-w-0 flex-1 items-center gap-2 text-start">
        <FolderIcon class="size-4 shrink-0 text-muted-foreground" />
        <span class="min-w-0 flex-1 truncate font-medium">{node.name}</span>
        <span class="shrink-0 text-xs text-muted-foreground">
          {ids.filter((id) => ticked.has(id)).length}/{ids.length}
        </span>
        <ChevronRightIcon
          class="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/section:rotate-90 motion-reduce:transition-none"
        />
      </Collapsible.Trigger>
    </div>
    <Collapsible.Content>
      {#each node.folders as child (child.id)}
        {@render folderSection(child, depth + 1)}
      {/each}
      {#each node.files as file (file.id)}
        {@render fileRow(file, depth + 1)}
      {/each}
      {#if !ids.length}
        <p
          class="py-1 text-xs text-muted-foreground"
          style:padding-inline-start="{(depth + 1) * 16 + 8}px"
        >
          No files in this folder.
        </p>
      {/if}
    </Collapsible.Content>
  </Collapsible.Root>
{/snippet}

<Dialog.Root open={target !== null} onOpenChange={(open) => !open && close()}>
  <Dialog.Content class="sm:max-w-lg">
    <Dialog.Header>
      <Dialog.Title
        >Share {items.length === 1 ? `“${items[0].name}”` : `${items.length} items`}</Dialog.Title
      >
      <Dialog.Description class="flex items-center gap-1.5">
        <GlobeIcon class="size-3.5" />
        Anyone with the link can download, no sign-in needed.
      </Dialog.Description>
    </Dialog.Header>

    {#if link}
      <div class="grid gap-2">
        <Label for="share-link">Share link</Label>
        <div class="flex gap-2">
          <Input id="share-link" readonly value={link} onfocus={(e) => e.currentTarget.select()} />
          <Button variant="outline" onclick={copy} aria-label="Copy link">
            {#if copied}<CheckIcon /> Copied{:else}<CopyIcon /> Copy{/if}
          </Button>
        </div>
        <p class="text-xs text-muted-foreground">
          {expiry === 'never'
            ? 'The link works until you unshare it from “What I shared”.'
            : `The link stops working after ${EXPIRY_LABELS[expiry]}.`}
        </p>
      </div>
      <Dialog.Footer>
        <Button onclick={close}>Done</Button>
      </Dialog.Footer>
    {:else}
      <div class="grid gap-4">
        <div class="grid gap-1.5">
          <Label for="share-title">Title</Label>
          <Input id="share-title" bind:value={title} maxlength={200} autocomplete="off" />
        </div>

        {#if !single}
          <div class="grid gap-1.5">
            <div class="flex items-center justify-between">
              <Label>Files to share</Label>
              {#if allFileIds.length}
                <button
                  type="button"
                  class="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  onclick={() => setAll(allFileIds, ticked.size !== allFileIds.length)}
                >
                  {ticked.size === allFileIds.length ? 'Clear all' : 'Select all'}
                </button>
              {/if}
            </div>
            <div class="max-h-72 overflow-y-auto rounded-md border p-1">
              {#if !tree?.ready}
                <div class="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Spinner /> Loading files…
                </div>
              {:else if !allFileIds.length}
                <p class="p-3 text-sm text-muted-foreground">
                  There are no files in this selection.
                </p>
              {:else}
                {#each tree.current.folders as node (node.id)}
                  {@render folderSection(node, 0)}
                {/each}
                {#each tree.current.files as file (file.id)}
                  {@render fileRow(file, 0)}
                {/each}
              {/if}
            </div>
            <p class="text-xs text-muted-foreground">
              Nothing is shared until you tick it. Files added to these folders later are not
              shared.
            </p>
          </div>
        {/if}

        <div class="grid gap-1.5">
          <Label for="share-expiry">Link expires</Label>
          <Select.Root type="single" bind:value={expiry}>
            <Select.Trigger id="share-expiry" class="w-full">{EXPIRY_LABELS[expiry]}</Select.Trigger
            >
            <Select.Content>
              {#each SHARE_EXPIRY_OPTIONS as option (option)}
                <Select.Item value={option} label={EXPIRY_LABELS[option]} />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
      </div>
      <Dialog.Footer>
        <Button variant="outline" onclick={close}>Cancel</Button>
        <Button
          onclick={create}
          disabled={creating || !title.trim() || (!single && ticked.size === 0)}
        >
          {#if creating}<Spinner />{/if}
          {!single && ticked.size
            ? `Create link (${ticked.size} file${ticked.size === 1 ? '' : 's'})`
            : 'Create link'}
        </Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>
