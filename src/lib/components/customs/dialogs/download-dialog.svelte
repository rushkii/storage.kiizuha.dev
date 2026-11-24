<script lang="ts">
  import * as Dialog from '#ui/dialog';
  import { Button } from '#ui/button';
  import { formatBytes } from '#lib/file-kind.ts';
  import { itemActions } from '#lib/hooks/item-actions.svelte.ts';

  import FileIcon from '@lucide/svelte/icons/file';
  import InfoIcon from '@lucide/svelte/icons/info';

  const plan = $derived(itemActions.download?.plan);
  const zippedCount = $derived(plan?.zips.reduce((sum, zip) => sum + zip.fileIds.length, 0) ?? 0);
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  const summary = $derived.by(() => {
    if (!plan) return '';
    const parts: string[] = [];
    if (plan.large.length) {
      parts.push(
        `${plural(plan.large.length, 'file')} ${plan.large.length === 1 ? 'is' : 'are'} larger than 100 MB and will download separately.`
      );
    }
    if (plan.zips.length) {
      const zips = plan.zips.length === 1 ? 'one zip archive' : `${plan.zips.length} zip archives`;
      parts.push(
        `${plan.large.length ? 'The other' : 'The'} ${plural(zippedCount, 'file')} will download as ${zips} (100 MB max each).`
      );
    }
    return parts.join(' ');
  });
</script>

<Dialog.Root
  open={plan !== undefined}
  onOpenChange={(open) => !open && (itemActions.download = null)}
>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Download {plural(plan?.totalFiles ?? 0, 'file')}</Dialog.Title>
      <Dialog.Description>{summary}</Dialog.Description>
    </Dialog.Header>
    {#if plan?.large.length}
      <ul class="max-h-56 divide-y overflow-y-auto rounded-md border text-sm">
        {#each plan.large as file (file.id)}
          <li class="flex items-center gap-2 px-3 py-2">
            <FileIcon class="size-4 shrink-0 text-muted-foreground" />
            <span class="min-w-0 flex-1 truncate">{file.name}</span>
            <span class="shrink-0 text-muted-foreground tabular-nums">{formatBytes(file.size)}</span
            >
          </li>
        {/each}
      </ul>
    {/if}
    <p class="flex items-start gap-2 text-xs text-muted-foreground">
      <InfoIcon class="mt-px size-3.5 shrink-0" />
      Your browser may ask you to allow this site to download multiple files.
    </p>
    <Dialog.Footer>
      <Dialog.Close>
        {#snippet child({ props })}
          <Button variant="outline" {...props}>Cancel</Button>
        {/snippet}
      </Dialog.Close>
      <Button onclick={() => itemActions.runDownload()}>Download</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
