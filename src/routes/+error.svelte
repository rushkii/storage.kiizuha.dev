<script lang="ts">
  import { page } from '$app/state';
  import { APP_NAME } from '$app/env/public';
  import NotFound from '#components/customs/error-page/not-found.svelte';
  import Forbidden from '#components/customs/error-page/forbidden.svelte';
  import Maintenance from '#components/customs/error-page/maintenance.svelte';
  import ServerError from '#components/customs/error-page/server-error.svelte';
  import LinkUnavailable from '#components/customs/link-unavailable.svelte';

  // App-wide error page. Renders inside the root layout only, without the (app) sidebar,
  // so it works the same for guests and signed-in users.

  const TITLES: Record<number, string> = {
    401: 'Sign in required',
    403: 'No access',
    404: 'Page not found',
    410: 'Link unavailable',
    503: 'Down for maintenance'
  };

  const status = $derived(page.status);
  const title = $derived(TITLES[status] ?? (status >= 500 ? 'Something went wrong' : 'Error'));
</script>

<svelte:head>
  <title>{title} · {APP_NAME}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

{#if status === 404}
  <NotFound />
{:else if status === 401 || status === 403}
  <Forbidden />
{:else if status === 410}
  <LinkUnavailable />
{:else if status === 503}
  <Maintenance />
{:else}
  <ServerError />
{/if}
