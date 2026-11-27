<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '#lib/utils.ts';

  // A small floating label scattered around an error illustration. Position it with `class`.

  let { class: className, children }: { class?: string; children: Snippet } = $props();
</script>

<span
  class={cn(
    'absolute flex items-center gap-1.5 rounded-md bg-card px-2 py-1 text-[0.6875rem] whitespace-nowrap text-muted-foreground shadow-xs ring-1 ring-border [&_svg]:size-3',
    className
  )}
>
  {@render children()}
</span>
