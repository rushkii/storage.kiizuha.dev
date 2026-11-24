<script lang="ts">
  import { APP_NAME } from '$app/env/public';
  import LinkUnavailable from '#components/customs/link-unavailable.svelte';
</script>

<svelte:head>
  <title>Link unavailable · {APP_NAME}</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<LinkUnavailable />
