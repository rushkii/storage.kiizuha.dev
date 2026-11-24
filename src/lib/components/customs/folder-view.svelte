<script lang="ts">
  import type { Table as TanstackTable } from '@tanstack/table-core';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { APP_NAME } from '$app/env/public';
  import * as Breadcrumb from '#ui/breadcrumb';
  import * as Empty from '#ui/empty';
  import * as Popover from '#ui/popover';
  import { Button } from '#ui/button';
  import { DataTableSkeleton, DataTableViewOptions } from '#components/data-table/index.ts';
  import AppHeader from './app-layout/app-header.svelte';
  import ItemBrowser, { type BrowserColumn } from './item-browser.svelte';
  import ItemIcon from './item-icon.svelte';
  import ItemRowMenu from './item-row-menu.svelte';
  import SelectionMenu from './selection-menu.svelte';
  import type { MenuKit } from './menu-kit.ts';
  import SelectionToolbar from './selection-toolbar.svelte';
  import TableSearch from './table-search.svelte';
  import ViewToggle from './view-toggle.svelte';
  import { formatBytes } from '#lib/file-kind.ts';
  import { formatLongDate, formatShortDate } from '#lib/dates.ts';
  import { HybridTable, TableState } from '#lib/hooks/table-state.svelte.ts';
  import { ItemSelection, itemKey } from '#lib/hooks/item-selection.svelte.ts';
  import { itemActions } from '#lib/hooks/item-actions.svelte.ts';
  import { uploads } from '#lib/uploads/upload-manager.svelte.ts';
  import { getFolderView, getSidebar, recordItemOpen } from '#lib/remotes/library.remote.ts';

  import FolderPlusIcon from '@lucide/svelte/icons/folder-plus';
  import UploadIcon from '@lucide/svelte/icons/upload';
  import InfoIcon from '@lucide/svelte/icons/info';
  import FolderXIcon from '@lucide/svelte/icons/folder-x';
  import FolderOpenIcon from '@lucide/svelte/icons/folder-open';

  let { folderId }: { folderId: string } = $props();

  type Row = NonNullable<Awaited<ReturnType<typeof getFolderView>>>['page']['rows'][number];

  const tableState = new TableState({ withView: true });
  /** Bound from ItemBrowser so the View menu can toggle its columns. */
  let table = $state<TanstackTable<Row>>();
  const selection = new ItemSelection();
  const view = new HybridTable({
    state: tableState,
    load: (table) => getFolderView({ folderId, table }),
    select: (data) => data?.page ?? null,
    searchText: (row: Row) => row.name,
    pinFirst: (row) => row.type === 'folder',
    defaultSort: { id: 'name', desc: false }
  });

  const data = $derived(view.data);
  const notFound = $derived(view.ready && data === null);
  const selectedItems = $derived(view.rows.filter((row) => selection.has(itemKey(row))));

  // Visiting a folder counts as an open for Recent.
  // onMount, not $effect: calling a command reads its internal `pending` state, so inside an
  // effect every completed call would re-run the effect (an endless loop of opens).
  onMount(() => {
    void recordItemOpen({ type: 'folder', id: folderId }).then(
      () => {
        const sidebar = getSidebar();
        if (sidebar.current && !sidebar.current.showRecent) void sidebar.refresh();
      },
      () => {}
    );
  });

  const open = (row: Row) => {
    if (row.type === 'folder') void goto(resolve('/(app)/f/[folderId]', { folderId: row.id }));
    else void itemActions.openFile(row.id);
  };

  const newFolder = () =>
    (itemActions.newFolder = {
      parentId: folderId,
      // A placeholder row until the server's single-flight refresh replaces it.
      optimistic: (name) =>
        view.resource.withOverride((current) => {
          if (!current) return current;
          const row: Row = {
            type: 'folder',
            id: `pending-${crypto.randomUUID()}`,
            name,
            kind: 'folder',
            size: null,
            updatedAt: new Date()
          };
          const { page } = current;
          return {
            ...current,
            page: { ...page, rows: [row, ...page.rows], total: page.total + 1 }
          };
        })
    });
  const upload = () => {
    if (data) uploads.dialog = { folderId, folderName: data.folder.name };
  };

  const stats = $derived.by(() => {
    const rows = view.allRows;
    const folders = rows.filter((r) => r.type === 'folder').length;
    const files = rows.length - folders;
    const size = rows.reduce((sum, r) => sum + (r.size ?? 0), 0);
    return { folders, files, size };
  });

  const columns: BrowserColumn<Row>[] = [
    { id: 'name', label: 'Name', sortable: true, cell: nameCell },
    {
      id: 'updatedAt',
      label: 'Date modified',
      sortable: true,
      hideable: true,
      class: 'w-40 max-md:hidden',
      cell: dateCell
    },
    {
      id: 'size',
      label: 'File size',
      sortable: true,
      hideable: true,
      class: 'w-28 max-sm:hidden',
      cell: sizeCell
    }
  ];
</script>

{#snippet nameCell(row: Row)}
  <div class="flex min-w-0 items-center gap-2.5">
    <ItemIcon kind={row.kind} />
    <span class="truncate font-medium" title={row.name}>{row.name}</span>
  </div>
{/snippet}

{#snippet dateCell(row: Row)}
  <span class="text-muted-foreground" title={formatLongDate(row.updatedAt)}>
    {formatShortDate(row.updatedAt)}
  </span>
{/snippet}

{#snippet sizeCell(row: Row)}
  <span class="text-muted-foreground tabular-nums">
    {row.size === null ? '—' : formatBytes(row.size)}
  </span>
{/snippet}

{#snippet rowActions(row: Row, menu: MenuKit)}
  <ItemRowMenu item={row} {menu} onOpen={() => open(row)} />
{/snippet}

{#snippet selectionActions(menu: MenuKit)}
  <SelectionMenu items={selectedItems} {menu} onClear={() => selection.clear()} />
{/snippet}

{#snippet gridCard(row: Row)}
  <div class="flex flex-col gap-3 p-3">
    <div class="flex aspect-4/3 items-center justify-center rounded-md bg-muted/60">
      <ItemIcon kind={row.kind} class="size-10" />
    </div>
    <div class="min-w-0 pe-6">
      <p class="truncate text-sm font-medium" title={row.name}>{row.name}</p>
      <p class="text-xs text-muted-foreground">
        {row.size === null ? 'Folder' : formatBytes(row.size)} · {formatShortDate(row.updatedAt)}
      </p>
    </div>
  </div>
{/snippet}

<svelte:head>
  <title>{data?.folder.name ?? 'Folder'} · {APP_NAME}</title>
</svelte:head>

<AppHeader>
  {#if selection.size}
    <SelectionToolbar items={selectedItems} onClear={() => selection.clear()} />
  {:else}
    <Breadcrumb.Root class="min-w-0 flex-1">
      <Breadcrumb.List class="flex-nowrap">
        {#if data}
          {#each data.breadcrumb as crumb, i (crumb.id)}
            {@const last = i === data.breadcrumb.length - 1}
            <Breadcrumb.Item class={i < data.breadcrumb.length - 2 ? 'max-md:hidden' : 'min-w-0'}>
              {#if last}
                <Breadcrumb.Page class="truncate">{crumb.name}</Breadcrumb.Page>
              {:else if crumb.type === 'folder'}
                <Breadcrumb.Link
                  href={resolve('/(app)/f/[folderId]', { folderId: crumb.id })}
                  class="truncate"
                >
                  {crumb.name}
                </Breadcrumb.Link>
              {:else}
                <span class="truncate text-muted-foreground">{crumb.name}</span>
              {/if}
            </Breadcrumb.Item>
            {#if !last}
              <Breadcrumb.Separator class={i < data.breadcrumb.length - 2 ? 'max-md:hidden' : ''} />
            {/if}
          {/each}
        {/if}
      </Breadcrumb.List>
    </Breadcrumb.Root>
    <div class="flex items-center gap-1.5">
      <ViewToggle {tableState} />
      <Popover.Root>
        <Popover.Trigger>
          {#snippet child({ props })}
            <Button variant="ghost" size="icon-sm" aria-label="Folder info" {...props}>
              <InfoIcon />
            </Button>
          {/snippet}
        </Popover.Trigger>
        <Popover.Content align="end" class="w-60 text-sm">
          <p class="truncate font-medium">{data?.folder.name}</p>
          <dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
            <dt>Folders</dt>
            <dd class="text-end text-foreground tabular-nums">{stats.folders}</dd>
            <dt>Files</dt>
            <dd class="text-end text-foreground tabular-nums">{stats.files}</dd>
            <dt>Total size</dt>
            <dd class="text-end text-foreground tabular-nums">{formatBytes(stats.size)}</dd>
          </dl>
          {#if view.pageData && !view.pageData.clientMode}
            <p class="mt-2 text-xs text-muted-foreground">Counts cover the current page.</p>
          {/if}
        </Popover.Content>
      </Popover.Root>
    </div>
  {/if}
</AppHeader>

<div class="flex flex-1 flex-col gap-4 p-4 lg:p-6">
  {#if notFound}
    <Empty.Root class="flex-1">
      <Empty.Header>
        <Empty.Media variant="icon"><FolderXIcon /></Empty.Media>
        <Empty.Title>This folder isn’t available</Empty.Title>
        <Empty.Description>
          It may have been moved to the bin or deleted. Pick another folder from the sidebar.
        </Empty.Description>
      </Empty.Header>
      <Empty.Content>
        <Button variant="outline" href={resolve('/(app)/bin')}>Open bin</Button>
      </Empty.Content>
    </Empty.Root>
  {:else}
    <div class="flex flex-wrap items-center gap-2">
      <TableSearch {tableState} placeholder="Search in this folder" />
      <div class="ms-auto flex items-center gap-2">
        {#if table && tableState.view === 'table'}<DataTableViewOptions {table} align="end" />{/if}
        <Button variant="outline" onclick={newFolder} disabled={!data}>
          <FolderPlusIcon /> New folder
        </Button>
        <Button onclick={upload} disabled={!data}>
          <UploadIcon /> Upload
        </Button>
      </div>
    </div>

    {#if !view.ready}
      <DataTableSkeleton columnCount={3} rowCount={8} filterCount={0} withViewOptions={false} />
    {:else if view.total === 0 && !tableState.search}
      <Empty.Root class="flex-1 border border-dashed">
        <Empty.Header>
          <Empty.Media variant="icon"><FolderOpenIcon /></Empty.Media>
          <Empty.Title>This folder is empty</Empty.Title>
          <Empty.Description>Upload files or create a subfolder to get started.</Empty.Description>
        </Empty.Header>
        <Empty.Content class="flex-row justify-center">
          <Button variant="outline" onclick={newFolder}><FolderPlusIcon /> New folder</Button>
          <Button onclick={upload}><UploadIcon /> Upload</Button>
        </Empty.Content>
      </Empty.Root>
    {:else if view.total === 0}
      <p class="py-10 text-center text-sm text-muted-foreground">
        Nothing in this folder matches “{tableState.search}”.
      </p>
    {:else}
      <ItemBrowser
        rows={view.rows}
        {columns}
        {tableState}
        {selection}
        pageCount={view.pageCount}
        onOpen={open}
        {rowActions}
        {selectionActions}
        {gridCard}
        bind:table
      />
    {/if}
  {/if}
</div>
