<script lang="ts">
  import type { Table as TanstackTable } from '@tanstack/table-core';
  import { toast } from 'svelte-sonner';
  import { page } from '$app/state';
  import { APP_NAME } from '$app/env/public';
  import * as AlertDialog from '#ui/alert-dialog';
  import * as Empty from '#ui/empty';
  import { Badge } from '#ui/badge';
  import { Spinner } from '#ui/spinner';
  import { DataTableSkeleton, DataTableViewOptions } from '#components/data-table/index.ts';
  import AppHeader from '#components/customs/app-layout/app-header.svelte';
  import ItemBrowser, { type BrowserColumn } from '#components/customs/item-browser.svelte';
  import type { MenuKit } from '#components/customs/menu-kit.ts';
  import TableSearch from '#components/customs/table-search.svelte';
  import { formatLongDate, formatShortDate } from '#lib/dates.ts';
  import { HybridTable, TableState } from '#lib/hooks/table-state.svelte.ts';
  import { ItemSelection } from '#lib/hooks/item-selection.svelte.ts';
  import { errorMessage } from '#lib/hooks/item-actions.svelte.ts';
  import { getShares, unshare } from '#lib/remotes/share.remote.ts';

  import Share2Icon from '@lucide/svelte/icons/share-2';
  import CopyIcon from '@lucide/svelte/icons/copy';
  import LinkIcon from '@lucide/svelte/icons/link-2-off';
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link';

  type Row = Awaited<ReturnType<typeof getShares>>['rows'][number];

  const tableState = new TableState();
  /** Bound from ItemBrowser so the View menu can toggle its columns. */
  let table = $state<TanstackTable<Row>>();
  const selection = new ItemSelection();
  const view = new HybridTable({
    state: tableState,
    load: (table) => getShares(table),
    select: (data) => data,
    searchText: (row: Row) => row.title,
    defaultSort: { id: 'createdAt', desc: true }
  });

  const selectedRows = $derived(view.rows.filter((row) => selection.has(row.id)));

  /** Shares waiting in the unshare confirmation; the dialog is open while set. */
  let pendingUnshare = $state<Row[] | null>(null);
  let unsharing = $state(false);
  const unshareMany = $derived((pendingUnshare?.length ?? 0) > 1);

  /** Hides the given shares until the server's refreshed list arrives with the response. */
  const withoutRows = (ids: Set<string>) =>
    view.resource.withOverride((current) => {
      const rows = current.rows.filter((row) => !ids.has(row.id));
      return { ...current, rows, total: current.total - (current.rows.length - rows.length) };
    });

  const linkOf = (row: Row) => new URL(`/s/${row.token}`, page.url.origin).href;

  const copyLink = async (row: Row) => {
    try {
      await navigator.clipboard.writeText(linkOf(row));
      toast.success('Link copied.');
    } catch {
      toast.error('Could not copy the link.');
    }
  };

  const confirmUnshare = async () => {
    if (!pendingUnshare?.length) return;
    const targets = pendingUnshare;
    const ids = new Set(targets.map((row) => row.id));
    unsharing = true;
    try {
      const revoked = await unshare([...ids]).updates(withoutRows(ids));
      selection.retain(view.rows.map((row) => row.id).filter((id) => !ids.has(id)));
      toast.success(
        targets.length === 1
          ? `“${targets[0].title}” is no longer shared.`
          : `${revoked} share link${revoked === 1 ? '' : 's'} removed.`
      );
      pendingUnshare = null;
    } catch (cause) {
      toast.error(errorMessage(cause, 'Could not unshare.'));
    } finally {
      unsharing = false;
    }
  };

  const columns: BrowserColumn<Row>[] = [
    { id: 'title', label: 'Title', sortable: true, cell: titleCell },
    {
      id: 'type',
      label: 'Type',
      sortable: true,
      hideable: true,
      class: 'w-36 max-md:hidden',
      cell: typeCell
    },
    {
      id: 'items',
      label: 'Items',
      sortable: true,
      hideable: true,
      class: 'w-20 max-sm:hidden',
      cell: itemsCell
    },
    {
      id: 'createdAt',
      label: 'Created',
      sortable: true,
      hideable: true,
      class: 'w-32 max-lg:hidden',
      cell: createdCell
    },
    { id: 'expiresAt', label: 'Expires', sortable: true, class: 'w-36', cell: expiresCell }
  ];
</script>

{#snippet titleCell(row: Row)}
  <div class="flex min-w-0 items-center gap-2.5">
    <Share2Icon class="size-4 shrink-0 text-muted-foreground" />
    <span class="truncate font-medium" title={row.title}>{row.title}</span>
  </div>
{/snippet}

{#snippet typeCell(row: Row)}
  <Badge variant="secondary">{row.type}</Badge>
{/snippet}

{#snippet itemsCell(row: Row)}
  <span class="text-muted-foreground tabular-nums">{row.items}</span>
{/snippet}

{#snippet createdCell(row: Row)}
  <span class="text-muted-foreground" title={formatLongDate(row.createdAt)}>
    {formatShortDate(row.createdAt)}
  </span>
{/snippet}

{#snippet expiresCell(row: Row)}
  <span
    class="text-muted-foreground"
    title={row.expiresAt ? formatLongDate(row.expiresAt) : undefined}
  >
    {row.expiresAt ? formatLongDate(row.expiresAt) : 'Until unshared'}
  </span>
{/snippet}

{#snippet rowActions(row: Row, menu: MenuKit)}
  <menu.Item onclick={() => copyLink(row)}><CopyIcon /> Copy link</menu.Item>
  <menu.Item onclick={() => window.open(linkOf(row), '_blank', 'noopener')}>
    <ExternalLinkIcon /> Open link
  </menu.Item>
  <menu.Separator />
  <menu.Item variant="destructive" onclick={() => (pendingUnshare = [row])}>
    <LinkIcon /> Unshare
  </menu.Item>
{/snippet}

{#snippet selectionActions(menu: MenuKit)}
  <menu.Item variant="destructive" onclick={() => (pendingUnshare = selectedRows)}>
    <LinkIcon /> Unshare {selectedRows.length} links
  </menu.Item>
{/snippet}

<svelte:head>
  <title>What I shared · {APP_NAME}</title>
</svelte:head>

<AppHeader>
  <h1 class="text-sm font-medium">What I shared</h1>
</AppHeader>

<div class="flex flex-1 flex-col gap-4 p-4 lg:p-6">
  <div class="flex flex-wrap items-center gap-2">
    <TableSearch {tableState} placeholder="Search shares" />
    <p class="text-xs text-muted-foreground">Only active links are listed.</p>
    {#if table && tableState.view === 'table'}<DataTableViewOptions {table} align="end" />{/if}
  </div>

  {#if !view.ready}
    <DataTableSkeleton columnCount={5} rowCount={5} filterCount={0} withViewOptions={false} />
  {:else if view.total === 0 && !tableState.search}
    <Empty.Root class="flex-1">
      <Empty.Header>
        <Empty.Media variant="icon"><Share2Icon /></Empty.Media>
        <Empty.Title>No active share links</Empty.Title>
        <Empty.Description>
          Select files or folders and choose Share to create a public link.
        </Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else if view.total === 0}
    <p class="py-10 text-center text-sm text-muted-foreground">
      No shares match “{tableState.search}”.
    </p>
  {:else}
    <ItemBrowser
      rows={view.rows}
      {columns}
      {tableState}
      {selection}
      pageCount={view.pageCount}
      keyOf={(row) => row.id}
      onOpen={copyLink}
      {rowActions}
      {selectionActions}
      labelOf={(row) => row.title}
      bind:table
    />
  {/if}
</div>

<AlertDialog.Root
  open={pendingUnshare !== null}
  onOpenChange={(open) => !open && (pendingUnshare = null)}
>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>
        {#if unshareMany}
          Unshare {pendingUnshare?.length} links?
        {:else}
          Unshare “{pendingUnshare?.[0]?.title}”?
        {/if}
      </AlertDialog.Title>
      <AlertDialog.Description>
        {unshareMany
          ? 'These links and every download from them'
          : 'The link and every download from it'}
        stop working right away. Your files stay where they are.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action variant="destructive" disabled={unsharing} onclick={confirmUnshare}>
        {#if unsharing}<Spinner />{/if}
        Unshare
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
