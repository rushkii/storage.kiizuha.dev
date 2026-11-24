<script lang="ts">
  import AppRoot from '#components/customs/app-layout/app-root.svelte';

  let { children } = $props();
</script>

<AppRoot>
  {@render children()}
</AppRoot>
