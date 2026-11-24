<script lang="ts">
  import NewCategoryDialog from './dialogs/new-category-dialog.svelte';
  import NewFolderDialog from './dialogs/new-folder-dialog.svelte';
  import RenameDialog from './dialogs/rename-dialog.svelte';
  import DeleteCategoryDialog from './dialogs/delete-category-dialog.svelte';
  import MoveDialog from './dialogs/move-dialog.svelte';
  import DownloadDialog from './dialogs/download-dialog.svelte';
  import BinResultDialog from './dialogs/bin-result-dialog.svelte';
  import ShareDialog from './dialogs/share-dialog.svelte';

  // Mounted once in the (app) shell; pages open these through `itemActions`.
</script>

<NewCategoryDialog />
<NewFolderDialog />
<RenameDialog />
<DeleteCategoryDialog />
<MoveDialog />
<DownloadDialog />
<BinResultDialog />
<ShareDialog />
