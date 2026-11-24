<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ComponentProps } from 'svelte';
  import { Command } from '#ui/command/index.js';
  import { PopoverContent } from '#ui/popover/index.js';
  import { cn, type WithoutChildrenOrChild } from '#lib/utils.js';

  type Props = WithoutChildrenOrChild<ComponentProps<typeof PopoverContent>> & {
    children?: Snippet;
  };

  let { class: className, children, ...contentProps }: Props = $props();
</script>

<PopoverContent
  align="start"
  class={cn('w-50 origin-(--bits-popover-content-transform-origin) p-0', className)}
  {...contentProps}
>
  <Command>
    {@render children?.()}
  </Command>
</PopoverContent>
