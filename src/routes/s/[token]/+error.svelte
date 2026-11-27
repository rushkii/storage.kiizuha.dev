<script lang="ts">
  import { page } from '$app/state';
  import { APP_NAME } from '$app/env/public';
  import LinkUnavailable from '#components/customs/link-unavailable.svelte';
  import ServerError from '#components/customs/error-page/server-error.svelte';

  // A share's own failures (unknown file, expired link) all look like an unavailable link.
  // Server faults keep the regular error page so they aren't mistaken for a dead link.

  const serverFault = $derived(page.status >= 500);
</script>

<svelte:head>
  <title>{serverFault ? 'Something went wrong' : 'Link unavailable'} · {APP_NAME}</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if serverFault}
  <ServerError />
{:else}
  <LinkUnavailable />
{/if}
