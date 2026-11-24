<script lang="ts" module>
  import type { Snippet } from 'svelte';

  export type BrowserItem = { type: 'file' | 'folder'; id: string; name: string };

  export type BrowserColumn<Row> = {
    id: string;
    label: string;
    sortable?: boolean;
    /** Column can be hidden from the view options menu. */
    hideable?: boolean;
    class?: string;
    cell: Snippet<[Row]>;
  };
</script>

<script lang="ts" generics="Row extends { id: string }">
  import { untrack } from 'svelte';
  import { mergeProps } from 'bits-ui';
  import { getCoreRowModel, type ColumnDef, type SortingState } from '@tanstack/table-core';
  import * as Table from '#ui/table';
  import * as DropdownMenu from '#ui/dropdown-menu';
  import * as ContextMenu from '#ui/context-menu';
  import { Button } from '#ui/button';
  import {
    createSvelteTable,
    FlexRender,
    renderComponent,
    renderSnippet
  } from '#lib/table/index.ts';
  import { DataTableColumnHeader, DataTablePagination } from '#components/data-table/index.ts';
  import { cn } from '#lib/utils.ts';
  import { isTyping, itemKey, type ItemSelection } from '#lib/hooks/item-selection.svelte.ts';
  import { TABLE_PAGE_SIZES, type TableState } from '#lib/hooks/table-state.svelte.ts';
  import { contextKit, dropdownKit, type MenuKit } from './menu-kit.ts';

  import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';

  // Table and grid views with Google Drive style selection. Built on
  // TanStack Table so sort headers, column visibility and pagination come from data-table.

  type Props = {
    rows: Row[];
    columns: BrowserColumn<Row>[];
    tableState: TableState;
    selection: ItemSelection;
    pageCount: number;
    /** Opens an item: folder navigates, file downloads. */
    onOpen: (row: Row) => void;
    /** Row actions, shown in the row ⋮ menu and on right-click. */
    rowActions?: Snippet<[Row, MenuKit]>;
    /** Right-click menu when the clicked row is part of a selection of 2+ items. */
    selectionActions?: Snippet<[MenuKit]>;
    /** Accessible name of a row, used for the ⋮ button label. */
    labelOf?: (row: Row) => string;
    gridCard?: Snippet<[Row, boolean]>;
    /** Heading of the group a row belongs to (Recent groups by date). */
    groupOf?: (row: Row) => string;
    /** Exposes the TanStack table, e.g. for view options. */
    table?: ReturnType<typeof createSvelteTable<Row>>;
    showPagination?: boolean;
    /** Selection key of a row; files and folders use `type:id`. */
    keyOf?: (row: Row) => string;
  };

  let {
    rows,
    columns,
    tableState,
    selection,
    pageCount,
    onOpen,
    rowActions,
    selectionActions,
    labelOf = (row: Row) => String((row as Record<string, unknown>).name ?? ''),
    gridCard,
    groupOf,
    table = $bindable(),
    showPagination = true,
    keyOf = (row: Row) => itemKey(row as unknown as BrowserItem)
  }: Props = $props();

  const columnDefs = $derived<ColumnDef<Row>[]>(
    columns.map((column) => ({
      id: column.id,
      accessorFn: (row) => (row as Record<string, unknown>)[column.id],
      enableSorting: column.sortable ?? false,
      enableHiding: column.hideable ?? false,
      meta: { label: column.label },
      header: ({ column: tableColumn }) =>
        renderComponent(DataTableColumnHeader, {
          column: tableColumn as never,
          label: column.label
        }),
      cell: ({ row }) => renderSnippet(column.cell, row.original)
    }))
  );

  const tanstack = createSvelteTable<Row>({
    get data() {
      return rows;
    },
    get columns() {
      return columnDefs;
    },
    getRowId: (row) => keyOf(row),
    get pageCount() {
      return pageCount;
    },
    state: {
      get sorting() {
        return tableState.sorts;
      },
      get pagination() {
        return { pageIndex: tableState.page - 1, pageSize: tableState.pageSize };
      },
      get columnVisibility() {
        return tableState.columnVisibility;
      },
      get rowSelection() {
        return Object.fromEntries([...selection.keys].map((key) => [key, true]));
      }
    },
    onSortingChange: (updater) => {
      const next: SortingState =
        typeof updater === 'function' ? updater(tableState.sorts) : updater;
      tableState.setSorts(next.map(({ id, desc }) => ({ id, desc })));
    },
    onPaginationChange: (updater) => {
      const current = { pageIndex: tableState.page - 1, pageSize: tableState.pageSize };
      const next = typeof updater === 'function' ? updater(current) : updater;
      if (next.pageSize !== tableState.pageSize) tableState.page = 1;
      else tableState.page = next.pageIndex + 1;
      tableState.pageSize = next.pageSize;
    },
    onColumnVisibilityChange: (updater) => {
      tableState.columnVisibility =
        typeof updater === 'function' ? updater(tableState.columnVisibility) : updater;
    },
    enableMultiSort: true,
    enableRowSelection: true,
    manualPagination: true,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel()
  });
  table = tanstack;

  const order = $derived(rows.map((row) => keyOf(row)));
  const headerGroups = $derived(tanstack.getHeaderGroups());
  const tableRows = $derived(tanstack.getRowModel().rows);
  const visibleColumnCount = $derived(
    tanstack.getVisibleLeafColumns().length + (rowActions ? 1 : 0)
  );

  // Keep the selection to items that are still on screen (after a refresh, move or bin).
  $effect(() => {
    const keys = order;
    untrack(() => selection.retain(keys));
  });

  // Reactive: the right-click menu is disabled for touch, where long-press selects instead.
  let lastPointer = $state('mouse');

  const handleClick = (event: MouseEvent, row: Row) => {
    const key = keyOf(row);
    if (lastPointer === 'touch' && !selection.touchMode) {
      // Touch: tap opens; long-press (handled in pointerdown) selects.
      if (selection.click(event, key, order)) {
        selection.clear();
        onOpen(row);
      }
      return;
    }
    selection.click(event, key, order);
  };

  const handlePointerDown = (event: PointerEvent, row: Row) => {
    lastPointer = event.pointerType;
    selection.pointerDown(event, keyOf(row));
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (isTyping(event.target)) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      selection.selectAll(order);
    } else if (event.key === 'Escape' && selection.size) {
      selection.clear();
    } else if (event.key === 'Enter' && selection.size === 1) {
      const row = rows.find((r) => selection.has(keyOf(r)));
      if (row) onOpen(row);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!order.length) return;
      event.preventDefault();
      const current = selection.anchor ? order.indexOf(selection.anchor) : -1;
      const next =
        event.key === 'ArrowDown'
          ? Math.min(order.length - 1, current + 1)
          : Math.max(0, current < 0 ? 0 : current - 1);
      const fake = new MouseEvent('click', { shiftKey: event.shiftKey });
      if (event.shiftKey) {
        selection.click(fake, order[next], order);
      } else {
        selection.click(new MouseEvent('click'), order[next], order);
      }
      document.querySelector(`[data-item-key="${CSS.escape(order[next])}"]`)?.scrollIntoView({
        block: 'nearest'
      });
    }
  };

  /** Right-click on an unselected item selects it alone, like Google Drive. */
  const handleContextMenu = (event: MouseEvent, row: Row) => {
    if (lastPointer === 'touch') {
      event.preventDefault();
      return;
    }
    const key = keyOf(row);
    if (!selection.has(key) && !selection.touchMode) {
      selection.click(new MouseEvent('click'), key, order);
    }
  };

  /** Clicking empty space clears the selection. */
  const clearOnBackground = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-item-key], [role="menu"], button, a, input')) selection.clear();
  };

  const gridGroups = $derived.by(() => {
    if (!groupOf) return [{ heading: null as string | null, rows }];
    const groups: { heading: string | null; rows: Row[] }[] = [];
    for (const row of rows) {
      const heading = groupOf(row);
      if (groups.at(-1)?.heading !== heading) groups.push({ heading, rows: [] });
      groups.at(-1)!.rows.push(row);
    }
    return groups;
  });

  const isNewGroup = (index: number) =>
    groupOf !== undefined && (index === 0 || groupOf(rows[index]) !== groupOf(rows[index - 1]));
</script>

<svelte:window onkeydown={handleKeydown} />

{#snippet rowDropdown(row: Row)}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for ${labelOf(row)}`}
          class="text-muted-foreground"
          {...props}
        >
          <EllipsisVerticalIcon />
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="end" class="w-48">
      {@render rowActions?.(row, dropdownKit)}
    </DropdownMenu.Content>
  </DropdownMenu.Root>
{/snippet}

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="flex min-h-0 flex-1 flex-col gap-3" onclick={clearOnBackground}>
  {#if tableState.view === 'table'}
    <div class="overflow-hidden rounded-lg border">
      <Table.Root class="select-none">
        <Table.Header>
          {#each headerGroups as headerGroup (headerGroup.id)}
            <Table.Row class="hover:bg-transparent">
              {#each headerGroup.headers as header (header.id)}
                <Table.Head
                  class={columns.find((c) => c.id === header.column.id)?.class}
                  colspan={header.colSpan}
                >
                  {#if !header.isPlaceholder}
                    <FlexRender
                      content={header.column.columnDef.header}
                      context={header.getContext()}
                    />
                  {/if}
                </Table.Head>
              {/each}
              {#if rowActions}<Table.Head class="w-10"
                  ><span class="sr-only">Actions</span></Table.Head
                >{/if}
            </Table.Row>
          {/each}
        </Table.Header>
        <Table.Body>
          {#each tableRows as row, index (row.id)}
            {#if isNewGroup(index)}
              <Table.Row class="hover:bg-transparent">
                <Table.Cell
                  colspan={visibleColumnCount}
                  class="bg-muted/40 py-1.5 text-xs font-medium text-muted-foreground"
                >
                  {groupOf?.(row.original)}
                </Table.Cell>
              </Table.Row>
            {/if}
            {@const selected = selection.has(row.id)}
            {@const rowProps = {
              'data-item-key': row.id,
              'data-state': selected ? 'selected' : undefined,
              'aria-selected': selected,
              class: cn(
                'cursor-default',
                selected && 'bg-primary/10 hover:bg-primary/15 data-[state=selected]:bg-primary/10'
              ),
              onclick: (event: MouseEvent) => handleClick(event, row.original),
              ondblclick: () => onOpen(row.original),
              onpointerdown: (event: PointerEvent) => handlePointerDown(event, row.original),
              onpointerup: () => selection.cancelPress(),
              onpointercancel: () => selection.cancelPress(),
              onpointermove: () => selection.cancelPress(),
              oncontextmenu: (event: MouseEvent) => handleContextMenu(event, row.original)
            }}
            {#snippet tableRow(props: Record<string, unknown>)}
              <Table.Row {...props}>
                {#each row.getVisibleCells() as cell (cell.id)}
                  <Table.Cell class={columns.find((c) => c.id === cell.column.id)?.class}>
                    <FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
                  </Table.Cell>
                {/each}
                {#if rowActions}
                  <Table.Cell class="w-10 py-0" onclick={(e: MouseEvent) => e.stopPropagation()}>
                    {@render rowDropdown(row.original)}
                  </Table.Cell>
                {/if}
              </Table.Row>
            {/snippet}
            {#if rowActions}
              <ContextMenu.Root>
                <ContextMenu.Trigger disabled={lastPointer === 'touch'}>
                  {#snippet child({ props })}
                    {@render tableRow(mergeProps(rowProps, props))}
                  {/snippet}
                </ContextMenu.Trigger>
                <ContextMenu.Content class="w-48">
                  {#if selectionActions && selection.size > 1 && selected}
                    {@render selectionActions(contextKit)}
                  {:else}
                    {@render rowActions(row.original, contextKit)}
                  {/if}
                </ContextMenu.Content>
              </ContextMenu.Root>
            {:else}
              {@render tableRow(rowProps)}
            {/if}
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
  {:else}
    <div class="grid gap-3">
      {#each gridGroups as group, groupIndex (groupIndex)}
        {#if group.heading}
          <p class="pt-2 text-xs font-medium text-muted-foreground">{group.heading}</p>
        {/if}
        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label={group.heading ?? 'Items'}
          class="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3 select-none"
        >
          {#each group.rows as row (keyOf(row))}
            {@const key = keyOf(row)}
            {@const selected = selection.has(key)}
            {@const cardProps = {
              role: 'option',
              tabindex: -1,
              'data-item-key': key,
              'aria-selected': selected,
              class: cn(
                'group/card relative rounded-lg border bg-card transition-colors motion-reduce:transition-none',
                selected ? 'border-primary/40 bg-primary/10' : 'hover:bg-muted/50'
              ),
              onclick: (event: MouseEvent) => handleClick(event, row),
              ondblclick: () => onOpen(row),
              onpointerdown: (event: PointerEvent) => handlePointerDown(event, row),
              onpointerup: () => selection.cancelPress(),
              onpointercancel: () => selection.cancelPress(),
              onpointermove: () => selection.cancelPress(),
              oncontextmenu: (event: MouseEvent) => handleContextMenu(event, row)
            }}
            {#snippet card(props: Record<string, unknown>)}
              <div {...props}>
                {@render gridCard?.(row, selected)}
                {#if rowActions}
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div class="absolute inset-e-1 top-1" onclick={(e) => e.stopPropagation()}>
                    {@render rowDropdown(row)}
                  </div>
                {/if}
              </div>
            {/snippet}
            {#if rowActions}
              <ContextMenu.Root>
                <ContextMenu.Trigger disabled={lastPointer === 'touch'}>
                  {#snippet child({ props })}
                    {@render card(mergeProps(cardProps, props))}
                  {/snippet}
                </ContextMenu.Trigger>
                <ContextMenu.Content class="w-48">
                  {#if selectionActions && selection.size > 1 && selected}
                    {@render selectionActions(contextKit)}
                  {:else}
                    {@render rowActions(row, contextKit)}
                  {/if}
                </ContextMenu.Content>
              </ContextMenu.Root>
            {:else}
              {@render card(cardProps)}
            {/if}
          {/each}
        </div>
      {/each}
    </div>
  {/if}

  {#if showPagination && (pageCount > 1 || rows.length > TABLE_PAGE_SIZES[0])}
    <DataTablePagination table={tanstack} pageSizeOptions={TABLE_PAGE_SIZES} />
  {/if}
</div>
