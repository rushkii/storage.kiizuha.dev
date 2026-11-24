<script lang="ts">
  import { resolve } from '$app/paths';
  import { APP_NAME } from '$app/env/public';
  import * as Empty from '#ui/empty';
  import { Button } from '#ui/button';
  import AppHeader from '#components/customs/app-layout/app-header.svelte';
  import { itemActions } from '#lib/hooks/item-actions.svelte.ts';
  import { getSidebar } from '#lib/remotes/library.remote.ts';

  import HardDriveIcon from '@lucide/svelte/icons/hard-drive';
  import FolderIcon from '@lucide/svelte/icons/folder';
  import PlusIcon from '@lucide/svelte/icons/plus';

  // Home: no content of its own. Points to the root folders, or to creating the first one.

  const sidebar = getSidebar();
  const categories = $derived(sidebar.current?.categories ?? []);
  const folders = $derived(
    categories.flatMap((c) => c.folders.map((f) => ({ ...f, category: c.name })))
  );
</script>

<svelte:head>
  <title>Home · {APP_NAME}</title>
</svelte:head>

<AppHeader>
  <h1 class="text-sm font-medium">Home</h1>
</AppHeader>

<div class="flex flex-1 flex-col p-4 lg:p-6">
  {#if sidebar.ready && !folders.length}
    <Empty.Root class="flex-1">
      <Empty.Header>
        <Empty.Media variant="icon"><HardDriveIcon /></Empty.Media>
        <Empty.Title>No folders yet</Empty.Title>
        <Empty.Description>
          {categories.length
            ? 'Create a folder in one of your categories to start uploading.'
            : 'Create a category first. Root folders live inside categories.'}
        </Empty.Description>
      </Empty.Header>
      <Empty.Content>
        {#if categories.length}
          <Button onclick={() => (itemActions.newFolder = { categoryId: categories[0].id })}>
            <PlusIcon /> New folder
          </Button>
        {:else}
          <Button onclick={() => (itemActions.newCategory = true)}>
            <PlusIcon /> New category
          </Button>
        {/if}
      </Empty.Content>
    </Empty.Root>
  {:else if folders.length}
    <h2 class="mb-3 text-xs font-medium text-muted-foreground">Folders</h2>
    <ul class="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
      {#each folders as folder (folder.id)}
        <li>
          <a
            href={resolve('/(app)/f/[folderId]', { folderId: folder.id })}
            class="flex items-center gap-3 rounded-lg border p-3 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
          >
            <FolderIcon class="size-5 shrink-0 text-sky-600 dark:text-sky-400" />
            <span class="min-w-0">
              <span class="block truncate text-sm font-medium">{folder.name}</span>
              <span class="block truncate text-xs text-muted-foreground">{folder.category}</span>
            </span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</div>
