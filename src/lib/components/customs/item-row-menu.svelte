<script lang="ts">
  import { itemActions, type NamedItem } from '#lib/hooks/item-actions.svelte.ts';
  import type { MenuKit } from './menu-kit.ts';

  import Share2Icon from '@lucide/svelte/icons/share-2';
  import DownloadIcon from '@lucide/svelte/icons/download';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import FolderInputIcon from '@lucide/svelte/icons/folder-input';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import FolderOpenIcon from '@lucide/svelte/icons/folder-open';

  // Row actions (⋮ and right-click): the selection toolbar's actions for one row.

  let {
    item,
    menu,
    onOpen,
    onBinned
  }: { item: NamedItem; menu: MenuKit; onOpen?: () => void; onBinned?: () => void } = $props();
</script>

{#if onOpen && item.type === 'folder'}
  <menu.Item onclick={onOpen}><FolderOpenIcon /> Open</menu.Item>
  <menu.Separator />
{/if}
<menu.Item onclick={() => (itemActions.share = { items: [item] })}>
  <Share2Icon /> Share
</menu.Item>
<menu.Item onclick={() => itemActions.startDownload([item])}>
  <DownloadIcon /> Download
</menu.Item>
<menu.Separator />
<menu.Item onclick={() => (itemActions.rename = { ...item })}>
  <PencilIcon /> Rename
</menu.Item>
<menu.Item onclick={() => (itemActions.move = { items: [item] })}>
  <FolderInputIcon /> Move to…
</menu.Item>
<menu.Separator />
<menu.Item variant="destructive" onclick={() => itemActions.moveToBin([item], onBinned)}>
  <Trash2Icon /> Move to bin
</menu.Item>
