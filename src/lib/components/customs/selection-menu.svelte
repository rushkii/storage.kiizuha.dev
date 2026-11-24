<script lang="ts">
  import { itemActions, type NamedItem } from '#lib/hooks/item-actions.svelte.ts';
  import type { MenuKit } from './menu-kit.ts';

  import Share2Icon from '@lucide/svelte/icons/share-2';
  import DownloadIcon from '@lucide/svelte/icons/download';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import FolderInputIcon from '@lucide/svelte/icons/folder-input';

  // Right-click on a multi-selection: the selection toolbar's actions as a menu
  // (selection-toolbar.svelte).

  let { items, menu, onClear }: { items: NamedItem[]; menu: MenuKit; onClear: () => void } =
    $props();
</script>

<menu.Item onclick={() => (itemActions.share = { items })}>
  <Share2Icon /> Share
</menu.Item>
<menu.Item onclick={() => itemActions.startDownload(items)}>
  <DownloadIcon /> Download
</menu.Item>
<menu.Separator />
<menu.Item disabled={items.length !== 1} onclick={() => (itemActions.rename = { ...items[0] })}>
  <PencilIcon /> Rename
</menu.Item>
<menu.Item onclick={() => (itemActions.move = { items })}>
  <FolderInputIcon /> Move to…
</menu.Item>
<menu.Separator />
<menu.Item
  variant="destructive"
  disabled={itemActions.busy}
  onclick={() => itemActions.moveToBin(items, onClear)}
>
  <Trash2Icon /> Move to bin
</menu.Item>
