<script lang="ts">
  import './layout.css';
  import { APP_NAME } from '$app/env/public';
  import { ModeWatcher, toggleMode } from 'mode-watcher';
  import { Toaster } from 'svelte-sonner';
  import favicon from '#lib/assets/favicon.svg';

  let { children } = $props();

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.key === 'd' || e.key === 'D') && !e.metaKey && !e.ctrlKey) {
      if (
        (e.target instanceof HTMLElement && e.target.isContentEditable) ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      e.preventDefault();
      toggleMode();
    }
  };
</script>

<ModeWatcher />
<Toaster richColors />

<svelte:window onkeydown={handleKeyDown} />

<svelte:head>
  <link rel="icon" href={favicon} />
  <title>{APP_NAME}</title>
</svelte:head>

{@render children()}
