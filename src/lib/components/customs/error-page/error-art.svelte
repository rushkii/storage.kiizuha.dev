<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '#lib/utils.ts';

  // Decorative stage above the heading: two concentric rings with the
  // page's illustration centred on them. Hidden from assistive tech.

  let { class: className, children }: { class?: string; children: Snippet } = $props();
</script>

<div
  aria-hidden="true"
  class={cn('relative flex h-52 w-full items-center justify-center sm:h-56', className)}
>
  <div
    class="absolute top-1/2 left-1/2 size-60 -translate-1/2 rounded-full border border-dashed sm:size-72"
  ></div>
  <div
    class="absolute top-1/2 left-1/2 size-44 -translate-1/2 rounded-full border sm:size-48"
  ></div>
  {@render children()}
</div>
