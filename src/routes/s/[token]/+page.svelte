<script lang="ts">
  import { page } from '$app/state';
  import { APP_NAME } from '$app/env/public';
  import * as Collapsible from '#ui/collapsible';
  import * as Table from '#ui/table';
  import { Button } from '#ui/button';
  import { Skeleton } from '#ui/skeleton';
  import ItemIcon from '#components/customs/item-icon.svelte';
  import LinkUnavailable from '#components/customs/link-unavailable.svelte';
  import { fileKindOf, formatBytes } from '#lib/file-kind.ts';
  import { formatLongDate } from '#lib/dates.ts';
  import { getPublicListing } from '#lib/remotes/share.remote.ts';

  import DownloadIcon from '@lucide/svelte/icons/download';
  import FolderIcon from '@lucide/svelte/icons/folder';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import ShieldAlertIcon from '@lucide/svelte/icons/shield-alert';

  // Public listing share. No app chrome, no login.

  let { data } = $props();

  const token = $derived(page.params.token ?? '');
  const listing = $derived(data.available ? getPublicListing(token) : null);
  const current = $derived(listing?.current);
  const fileHref = (fileId: string) =>
    `/s/${encodeURIComponent(token)}/f/${encodeURIComponent(fileId)}`;
  const fileCount = $derived(
    current ? current.files.length + current.groups.reduce((n, g) => n + g.files.length, 0) : 0
  );
</script>

<svelte:head>
  <title>{current?.title ?? 'Shared files'} · {APP_NAME}</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#snippet fileRows(files: { id: string; name: string; size: number }[])}
  {#each files as file (file.id)}
    <Table.Row>
      <Table.Cell>
        <div class="flex min-w-0 items-center gap-2.5">
          <ItemIcon kind={fileKindOf(file.name)} />
          <span class="truncate" title={file.name}>{file.name}</span>
        </div>
      </Table.Cell>
      <Table.Cell class="w-28 text-muted-foreground tabular-nums max-sm:hidden">
        {formatBytes(file.size)}
      </Table.Cell>
      <Table.Cell class="w-32 text-end">
        <Button variant="outline" size="sm" href={fileHref(file.id)} data-sveltekit-reload>
          <DownloadIcon /> Download
        </Button>
      </Table.Cell>
    </Table.Row>
  {/each}
{/snippet}

{#if !data.available || (listing?.ready && !current)}
  <LinkUnavailable />
{:else}
  <main class="mx-auto flex min-h-svh w-full max-w-4xl flex-col gap-6 px-4 py-10">
    <header class="flex flex-col gap-1">
      <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Shared with you
      </p>
      {#if current}
        <h1 class="text-2xl font-semibold text-balance">{current.title}</h1>
        <p class="text-sm text-muted-foreground">
          {fileCount} file{fileCount === 1 ? '' : 's'} · {formatBytes(current.totalSize)}
          {#if current.expiresAt}
            · Link expires {formatLongDate(current.expiresAt)}{/if}
        </p>
      {:else}
        <Skeleton class="h-8 w-64" />
        <Skeleton class="h-4 w-40" />
      {/if}
    </header>

    <div class="overflow-hidden rounded-lg border">
      <Table.Root>
        <Table.Header>
          <Table.Row class="hover:bg-transparent">
            <Table.Head>Name</Table.Head>
            <Table.Head class="w-28 max-sm:hidden">Size</Table.Head>
            <Table.Head class="w-32 text-end"><span class="sr-only">Download</span></Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#if current}
            {@render fileRows(current.files)}
          {:else}
            {#each { length: 4 }, i (i)}
              <Table.Row>
                <Table.Cell colspan={3}><Skeleton class="h-5 w-full" /></Table.Cell>
              </Table.Row>
            {/each}
          {/if}
        </Table.Body>
      </Table.Root>

      {#each current?.groups ?? [] as group (group.path)}
        <Collapsible.Root open class="group/section border-t">
          <Collapsible.Trigger
            class="flex w-full items-center gap-2 px-3 py-2.5 text-start text-sm font-medium hover:bg-muted/50"
          >
            <ChevronRightIcon
              class="size-4 text-muted-foreground transition-transform group-data-[state=open]/section:rotate-90 motion-reduce:transition-none"
            />
            <FolderIcon class="size-4 text-sky-600 dark:text-sky-400" />
            <span class="min-w-0 flex-1 truncate">{group.path}</span>
            <span class="text-xs font-normal text-muted-foreground">
              {group.files.length} file{group.files.length === 1 ? '' : 's'}
            </span>
          </Collapsible.Trigger>
          <Collapsible.Content>
            <Table.Root>
              <Table.Body>{@render fileRows(group.files)}</Table.Body>
            </Table.Root>
          </Collapsible.Content>
        </Collapsible.Root>
      {/each}
    </div>

    <footer class="mt-auto flex items-start gap-2 border-t pt-4 text-xs text-muted-foreground">
      <ShieldAlertIcon class="mt-px size-3.5 shrink-0" />
      Files are shared by their uploader and are not checked by this service. Download and open them at
      your own risk.
    </footer>
  </main>
{/if}
