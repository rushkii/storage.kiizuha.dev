<script lang="ts">
  import type { Table as TanstackTable } from '@tanstack/table-core';
  import { SvelteSet } from 'svelte/reactivity';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { APP_NAME } from '$app/env/public';
  import * as DropdownMenu from '#ui/dropdown-menu';
  import * as Popover from '#ui/popover';
  import * as Empty from '#ui/empty';
  import { Button } from '#ui/button';
  import { Input } from '#ui/input';
  import { Label } from '#ui/label';
  import { DataTableSkeleton, DataTableViewOptions } from '#components/data-table/index.ts';
  import AppHeader from '#components/customs/app-layout/app-header.svelte';
  import ItemBrowser, { type BrowserColumn } from '#components/customs/item-browser.svelte';
  import ItemIcon from '#components/customs/item-icon.svelte';
  import ItemRowMenu from '#components/customs/item-row-menu.svelte';
  import SelectionMenu from '#components/customs/selection-menu.svelte';
  import type { MenuKit } from '#components/customs/menu-kit.ts';
  import SelectionToolbar from '#components/customs/selection-toolbar.svelte';
  import TableSearch from '#components/customs/table-search.svelte';
  import ViewToggle from '#components/customs/view-toggle.svelte';
  import { FILE_KINDS, formatBytes, type FileKind } from '#lib/file-kind.ts';
  import { formatLongDate, recentGroupOf } from '#lib/dates.ts';
  import { cn } from '#lib/utils.ts';
  import { HybridTable, TableState } from '#lib/hooks/table-state.svelte.ts';
  import { ItemSelection, itemKey } from '#lib/hooks/item-selection.svelte.ts';
  import { itemActions } from '#lib/hooks/item-actions.svelte.ts';
  import { getRecent } from '#lib/remotes/library.remote.ts';

  import ClockIcon from '@lucide/svelte/icons/clock';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import CalendarIcon from '@lucide/svelte/icons/calendar';
  import XIcon from '@lucide/svelte/icons/x';

  type Row = Awaited<ReturnType<typeof getRecent>>['rows'][number];

  const KIND_LABELS: Record<FileKind, string> = {
    folder: 'Folders',
    document: 'Documents',
    image: 'Images',
    video: 'Videos',
    archive: 'Archives',
    other: 'Other'
  };

  const tableState = new TableState({ withView: true });
  /** Bound from ItemBrowser so the View menu can toggle its columns. */
  let table = $state<TanstackTable<Row>>();
  const selection = new ItemSelection();
  const kinds = new SvelteSet<FileKind>();
  let openedFrom = $state('');
  let openedTo = $state('');

  const toTime = (value: string, endOfDay = false) => {
    if (!value) return undefined;
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local value in a pure helper
    const date = new Date(`${value}T00:00:00`);
    if (endOfDay) date.setDate(date.getDate() + 1);
    return Number.isNaN(date.getTime()) ? undefined : date.getTime();
  };

  const filters = $derived({
    kinds: [...kinds],
    openedFrom: toTime(openedFrom),
    openedTo: toTime(openedTo, true)
  });

  const view = new HybridTable({
    state: tableState,
    load: (table) => getRecent({ ...table, ...filters }),
    select: (data) => data,
    searchText: (row: Row) => row.name,
    defaultSort: { id: 'lastOpenedAt', desc: true }
  });

  const selectedItems = $derived(view.rows.filter((row) => selection.has(itemKey(row))));
  const groupedByDate = $derived(
    !tableState.sorts.length || tableState.sorts[0].id === 'lastOpenedAt'
  );
  const hasFilters = $derived(kinds.size > 0 || Boolean(openedFrom || openedTo));

  const open = (row: Row) => {
    if (row.type === 'folder') void goto(resolve('/(app)/f/[folderId]', { folderId: row.id }));
    else void itemActions.openFile(row.id);
  };

  const openedLabel = (date: Date) =>
    `${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} • Opened by me`;

  const clearFilters = () => {
    kinds.clear();
    openedFrom = '';
    openedTo = '';
  };

  const columns: BrowserColumn<Row>[] = [
    { id: 'name', label: 'Name', sortable: true, cell: nameCell },
    {
      id: 'lastOpenedAt',
      label: 'Last opened',
      sortable: true,
      hideable: true,
      class: 'w-48 max-md:hidden',
      cell: openedCell
    },
    {
      id: 'size',
      label: 'File size',
      sortable: true,
      hideable: true,
      class: 'w-28 max-sm:hidden',
      cell: sizeCell
    },
    {
      id: 'location',
      label: 'Location',
      sortable: true,
      hideable: true,
      class: 'w-48 max-lg:hidden',
      cell: locationCell
    }
  ];
</script>

{#snippet nameCell(row: Row)}
  <div class="flex min-w-0 items-center gap-2.5">
    <ItemIcon kind={row.kind} />
    <span class="truncate font-medium" title={row.name}>{row.name}</span>
  </div>
{/snippet}

{#snippet openedCell(row: Row)}
  <span class="text-muted-foreground" title={formatLongDate(row.lastOpenedAt)}>
    {openedLabel(row.lastOpenedAt)}
  </span>
{/snippet}

{#snippet sizeCell(row: Row)}
  <span class="text-muted-foreground tabular-nums">
    {row.size === null ? '—' : formatBytes(row.size)}
  </span>
{/snippet}

{#snippet locationCell(row: Row)}
  {#if row.location?.type === 'folder'}
    <a
      href={resolve('/(app)/f/[folderId]', { folderId: row.location.id })}
      class="block truncate text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
    >
      {row.location.name}
    </a>
  {:else}
    <span class="block truncate text-muted-foreground">{row.location?.name ?? '—'}</span>
  {/if}
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
      <p class="truncate text-xs text-muted-foreground">{openedLabel(row.lastOpenedAt)}</p>
    </div>
  </div>
{/snippet}

<svelte:head>
  <title>Recent · {APP_NAME}</title>
</svelte:head>

<AppHeader>
  {#if selection.size}
    <SelectionToolbar items={selectedItems} onClear={() => selection.clear()} />
  {:else}
    <h1 class="flex-1 text-sm font-medium">Recent</h1>
    <ViewToggle {tableState} />
  {/if}
</AppHeader>

<div class="flex flex-1 flex-col gap-4 p-4 lg:p-6">
  <div class="flex flex-wrap items-center gap-2">
    <TableSearch {tableState} placeholder="Search recent items" />

    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button variant="outline" class={cn(kinds.size && 'border-primary/50')} {...props}>
            Type{kinds.size ? ` · ${kinds.size}` : ''}
            <ChevronDownIcon data-icon="inline-end" />
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" class="w-44">
        {#each FILE_KINDS as kind (kind)}
          <DropdownMenu.CheckboxItem
            checked={kinds.has(kind)}
            closeOnSelect={false}
            onCheckedChange={(checked) => (checked ? kinds.add(kind) : kinds.delete(kind))}
          >
            <ItemIcon {kind} />
            {KIND_LABELS[kind]}
          </DropdownMenu.CheckboxItem>
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Root>

    <Popover.Root>
      <Popover.Trigger>
        {#snippet child({ props })}
          <Button
            variant="outline"
            class={cn((openedFrom || openedTo) && 'border-primary/50')}
            {...props}
          >
            <CalendarIcon />
            Last opened{openedFrom || openedTo ? ' · custom' : ''}
          </Button>
        {/snippet}
      </Popover.Trigger>
      <Popover.Content align="start" class="grid w-64 gap-3">
        <div class="grid gap-1.5">
          <Label for="opened-from">From</Label>
          <Input id="opened-from" type="date" bind:value={openedFrom} max={openedTo || undefined} />
        </div>
        <div class="grid gap-1.5">
          <Label for="opened-to">To</Label>
          <Input id="opened-to" type="date" bind:value={openedTo} min={openedFrom || undefined} />
        </div>
      </Popover.Content>
    </Popover.Root>

    {#if hasFilters}
      <Button variant="ghost" onclick={clearFilters}><XIcon /> Clear filters</Button>
    {/if}

    {#if table && tableState.view === 'table'}<DataTableViewOptions {table} align="end" />{/if}
  </div>

  {#if !view.ready}
    <DataTableSkeleton columnCount={4} rowCount={8} filterCount={0} withViewOptions={false} />
  {:else if view.total === 0 && !tableState.search && !hasFilters}
    <Empty.Root class="flex-1">
      <Empty.Header>
        <Empty.Media variant="icon"><ClockIcon /></Empty.Media>
        <Empty.Title>Nothing opened yet</Empty.Title>
        <Empty.Description>Folders you visit and files you download show up here.</Empty.Description
        >
      </Empty.Header>
    </Empty.Root>
  {:else if view.total === 0}
    <p class="py-10 text-center text-sm text-muted-foreground">
      No recent items match these filters.
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
      groupOf={groupedByDate ? (row) => recentGroupOf(row.lastOpenedAt) : undefined}
      bind:table
    />
  {/if}
</div>
