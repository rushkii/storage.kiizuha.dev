<script lang="ts">
  import type { Snippet } from 'svelte';
  import * as Sidebar from '#ui/sidebar';
  import { Separator } from '#ui/separator';

  let { children }: { children?: Snippet } = $props();
</script>

<!-- Page header inside the inset card: sidebar toggle, then whatever the page puts there -->
<!-- (breadcrumb and view toggle, or the selection toolbar). -->

<header
  class="sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/95 backdrop-blur"
>
  <div class="flex w-full min-w-0 items-center gap-1 px-3 lg:gap-2 lg:px-4">
    <Sidebar.Trigger class="-ms-1" />
    <Separator orientation="vertical" class="mx-1 data-[orientation=vertical]:h-4" />
    <div class="flex min-w-0 flex-1 items-center gap-2">
      {@render children?.()}
    </div>
  </div>
</header>
