<script lang="ts">
  import AppSidebar from './app-sidebar.svelte';
  import ItemDialogs from '../item-dialogs.svelte';
  import UploadPanel from '../upload/upload-panel.svelte';
  import UploadDialog from '../upload/upload-dialog.svelte';
  import * as Sidebar from '#ui/sidebar';

  let { children } = $props();
</script>

<Sidebar.Provider
  style="--sidebar-width: calc(var(--spacing) * 60); --header-height: calc(var(--spacing) * 12);"
>
  <AppSidebar variant="inset" />
  <Sidebar.Inset class="min-w-0">
    {@render children?.()}
  </Sidebar.Inset>
</Sidebar.Provider>

<ItemDialogs />
<UploadDialog />
<UploadPanel />
