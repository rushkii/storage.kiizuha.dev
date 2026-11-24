<script lang="ts">
  import { page } from '$app/state';
  import FolderView from '#components/customs/folder-view.svelte';

  const folderId = $derived(page.params.folderId ?? '');
</script>

{#key folderId}
  <FolderView {folderId} />
{/key}
