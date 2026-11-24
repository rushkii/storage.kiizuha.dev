<script lang="ts">
  import type { Table as TanstackTable } from '@tanstack/table-core';
  import { toast } from 'svelte-sonner';
  import { resolve } from '$app/paths';
  import { APP_NAME } from '$app/env/public';
  import * as Empty from '#ui/empty';
  import { Button } from '#ui/button';
  import { Spinner } from '#ui/spinner';
  import { DataTableSkeleton, DataTableViewOptions } from '#components/data-table/index.ts';
  import AppHeader from '#components/customs/app-layout/app-header.svelte';
  import ItemBrowser, { type BrowserColumn } from '#components/customs/item-browser.svelte';
  import type { MenuKit } from '#components/customs/menu-kit.ts';
  import ItemIcon from '#components/customs/item-icon.svelte';
  import TableSearch from '#components/customs/table-search.svelte';
  import PermanentDeleteDialog from '#components/customs/dialogs/permanent-delete-dialog.svelte';
  import { BIN_RETENTION_DAYS } from '#lib/schemas/storage.ts';
  import { formatLongDate, formatShortDate } from '#lib/dates.ts';
  import { cn } from '#lib/utils.ts';
  import { HybridTable, TableState } from '#lib/hooks/table-state.svelte.ts';
  import {
    ItemSelection,
    itemKey,
    toSelection,
    type ItemRef
  } from '#lib/hooks/item-selection.svelte.ts';
  import { errorMessage } from '#lib/hooks/item-actions.svelte.ts';
  import { deletePermanently, getBin, restoreItems } from '#lib/remotes/bin.remote.ts';

  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import UndoIcon from '@lucide/svelte/icons/undo-2';
  import XIcon from '@lucide/svelte/icons/x';

  type Row = Awaited<ReturnType<typeof getBin>>['rows'][number];

  const tableState = new TableState();
  /** Bound from ItemBrowser so the View menu can toggle its columns. */
  let table = $state<TanstackTable<Row>>();
  const selection = new ItemSelection();
  const view = new HybridTable({
    state: tableState,
    load: (table) => getBin(table),
    select: (data) => data,
    searchText: (row: Row) => row.name,
    defaultSort: { id: 'deletedAt', desc: true }
  });

  const selectedItems = $derived(view.rows.filter((row) => selection.has(itemKey(row))));

  let restoring = $state(false);
  /** Items waiting in the permanent delete confirmation; the dialog is open while set. */
  let pendingDelete = $state<ItemRef[] | null>(null);
  let deleting = $state(false);

  const reportFailures = (failed: { name: string; reason: string }[]) => {
    if (failed.length) {
      toast.warning(
        `${failed.length} item${failed.length === 1 ? '' : 's'} could not be processed.`,
        {
          description: failed.map((f) => `${f.name}: ${f.reason}`).join('\n')
        }
      );
    }
  };

  /** Hides the given rows until the server's refreshed bin arrives with the response. */
  const withoutRows = (items: ItemRef[]) => {
    const keys = new Set(items.map(itemKey));
    return view.resource.withOverride((current) => {
      const rows = current.rows.filter((row) => !keys.has(itemKey(row)));
      return { ...current, rows, total: current.total - (current.rows.length - rows.length) };
    });
  };

  /** Drops `items` from the selection and keeps the rest selected. */
  const deselect = (items: ItemRef[]) => {
    const gone = items.map(itemKey);
    selection.retain(view.rows.map(itemKey).filter((key) => !gone.includes(key)));
  };

  const restore = async (items: ItemRef[]) => {
    restoring = true;
    deselect(items);
    try {
      const result = await restoreItems(toSelection(items)).updates(withoutRows(items));
      if (result.done)
        toast.success(`${result.done} item${result.done === 1 ? '' : 's'} restored.`);
      reportFailures(result.failed);
    } catch (cause) {
      toast.error(errorMessage(cause, 'Could not restore these items.'));
    } finally {
      restoring = false;
    }
  };

  const toRefs = (rows: Row[]): ItemRef[] => rows.map(({ type, id }) => ({ type, id }));

  /** Runs after the user typed the confirmation phrase; the dialog stays open until done. */
  const confirmDelete = async (items: ItemRef[]) => {
    deleting = true;
    try {
      const result = await deletePermanently(toSelection(items)).updates(withoutRows(items));
      deselect(items);
      pendingDelete = null;
      if (result.done) {
        toast.success(`${result.done} item${result.done === 1 ? '' : 's'} deleted permanently.`);
      }
      reportFailures(result.failed);
    } catch (cause) {
      toast.error(errorMessage(cause, 'Could not delete these items.'));
    } finally {
      deleting = false;
    }
  };

  const columns: BrowserColumn<Row>[] = [
    { id: 'name', label: 'Name', sortable: true, cell: nameCell },
    {
      id: 'location',
      label: 'Original location',
      sortable: true,
      hideable: true,
      class: 'w-48 max-lg:hidden',
      cell: locationCell
    },
    {
      id: 'deletedAt',
      label: 'Date binned',
      sortable: true,
      hideable: true,
      class: 'w-36 max-md:hidden',
      cell: binnedCell
    },
    {
      id: 'daysLeft',
      label: 'Days left',
      sortable: true,
      class: 'w-28',
      cell: daysCell
    }
  ];
</script>

{#snippet nameCell(row: Row)}
  <div class="flex min-w-0 items-center gap-2.5">
    <ItemIcon kind={row.kind} />
    <span class="truncate font-medium" title={row.name}>{row.name}</span>
  </div>
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

{#snippet binnedCell(row: Row)}
  <span class="text-muted-foreground" title={formatLongDate(row.deletedAt)}>
    {formatShortDate(row.deletedAt)}
  </span>
{/snippet}

{#snippet daysCell(row: Row)}
  <span
    class={cn(
      'tabular-nums',
      row.daysLeft <= 3 ? 'font-medium text-destructive' : 'text-muted-foreground'
    )}
  >
    {row.daysLeft === 0 ? 'Today' : `${row.daysLeft} day${row.daysLeft === 1 ? '' : 's'}`}
  </span>
{/snippet}

{#snippet rowActions(row: Row, menu: MenuKit)}
  <menu.Item disabled={restoring} onclick={() => restore(toRefs([row]))}>
    <UndoIcon /> Restore
  </menu.Item>
  <menu.Separator />
  <menu.Item variant="destructive" onclick={() => (pendingDelete = toRefs([row]))}>
    <Trash2Icon /> Delete permanently
  </menu.Item>
{/snippet}

{#snippet selectionActions(menu: MenuKit)}
  <menu.Item disabled={restoring} onclick={() => restore(toRefs(selectedItems))}>
    <UndoIcon /> Restore
  </menu.Item>
  <menu.Separator />
  <menu.Item variant="destructive" onclick={() => (pendingDelete = toRefs(selectedItems))}>
    <Trash2Icon /> Delete permanently
  </menu.Item>
{/snippet}

<svelte:head>
  <title>Bin · {APP_NAME}</title>
</svelte:head>

<AppHeader>
  {#if selection.size}
    <div
      class="flex min-w-0 flex-1 items-center gap-1"
      role="toolbar"
      aria-label="Selection actions"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Clear selection"
        onclick={() => selection.clear()}
      >
        <XIcon />
      </Button>
      <span class="me-2 text-sm font-medium" aria-live="polite">{selection.size} selected</span>
      <Button
        variant="ghost"
        size="sm"
        disabled={restoring}
        onclick={() => restore(toRefs(selectedItems))}
      >
        {#if restoring}<Spinner />{:else}<UndoIcon />{/if} Restore
      </Button>
      <Button
        variant="ghost"
        size="sm"
        class="text-destructive"
        onclick={() => (pendingDelete = toRefs(selectedItems))}
      >
        <Trash2Icon /> Delete permanently
      </Button>
    </div>
  {:else}
    <h1 class="text-sm font-medium">Bin</h1>
  {/if}
</AppHeader>

<div class="flex flex-1 flex-col gap-4 p-4 lg:p-6">
  <div class="flex flex-wrap items-center gap-2">
    <TableSearch {tableState} placeholder="Search the bin" />
    <p class="text-xs text-muted-foreground">
      Items are deleted permanently {BIN_RETENTION_DAYS} days after they’re moved here.
    </p>
    {#if table && tableState.view === 'table'}<DataTableViewOptions {table} align="end" />{/if}
  </div>

  {#if !view.ready}
    <DataTableSkeleton columnCount={4} rowCount={6} filterCount={0} withViewOptions={false} />
  {:else if view.total === 0 && !tableState.search}
    <Empty.Root class="flex-1">
      <Empty.Header>
        <Empty.Media variant="icon"><Trash2Icon /></Empty.Media>
        <Empty.Title>The bin is empty</Empty.Title>
        <Empty.Description
          >Items you move to the bin stay here for {BIN_RETENTION_DAYS} days.</Empty.Description
        >
      </Empty.Header>
    </Empty.Root>
  {:else if view.total === 0}
    <p class="py-10 text-center text-sm text-muted-foreground">
      Nothing in the bin matches “{tableState.search}”.
    </p>
  {:else}
    <ItemBrowser
      rows={view.rows}
      {columns}
      {tableState}
      {selection}
      pageCount={view.pageCount}
      onOpen={(row) => {
        selection.selectAll([itemKey(row)]);
      }}
      {rowActions}
      {selectionActions}
      bind:table
    />
  {/if}
</div>

<PermanentDeleteDialog
  items={pendingDelete}
  {deleting}
  onCancel={() => (pendingDelete = null)}
  onConfirm={confirmDelete}
/>
