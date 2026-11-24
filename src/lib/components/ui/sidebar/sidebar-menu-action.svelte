<script lang="ts">
  import { mergeProps } from 'bits-ui';
  import * as Tooltip from '#ui/tooltip';
  import { cn, type WithElementRef, type WithoutChildrenOrChild } from '#lib/utils.ts';
  import type { ComponentProps, Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  let {
    ref = $bindable(null),
    class: className,
    showOnHover = false,
    children,
    child,
    tooltipContent,
    tooltipContentProps,
    ...restProps
  }: WithElementRef<HTMLButtonAttributes> & {
    child?: Snippet<[{ props: Record<string, unknown> }]>;
    showOnHover?: boolean;
    tooltipContent?: Snippet | string;
    tooltipContentProps?: WithoutChildrenOrChild<ComponentProps<typeof Tooltip.Content>>;
  } = $props();

  const actionProps = $derived({
    class: cn(
      'text-sidebar-foreground/50! ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground! peer-hover/menu-button:text-sidebar-accent-foreground absolute top-1.5 right-1 aspect-square w-5 rounded-[calc(var(--radius-sm)_-_2px)] p-0 peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 focus-visible:ring-2 [&>svg]:size-4 flex items-center justify-center outline-hidden transition-transform group-data-[collapsible=icon]:hidden after:absolute after:-inset-2 md:after:hidden [&>svg]:shrink-0',
      showOnHover &&
        'group-has-[:focus-visible]/menu-item:opacity-100 group-hover/menu-item:opacity-100 peer-data-active/menu-button:text-sidebar-accent-foreground aria-expanded:opacity-100 md:opacity-0',
      className
    ),
    'data-slot': 'sidebar-menu-action',
    'data-sidebar': 'menu-action',
    ...restProps
  });
</script>

{#snippet Action({ props }: { props?: Record<string, unknown> })}
  <!-- Tooltip trigger props go first so caller props (e.g. a DropdownMenu trigger's data-state) win. -->
  {@const mergedProps = mergeProps(props, actionProps)}
  {#if child}
    {@render child({ props: mergedProps })}
  {:else}
    <button bind:this={ref} {...mergedProps}>
      {@render children?.()}
    </button>
  {/if}
{/snippet}

{#if !tooltipContent}
  {@render Action({})}
{:else}
  <!-- Menus/dialogs return focus to this trigger on close; only keyboard focus should reopen the tooltip. -->
  <Tooltip.Root ignoreNonKeyboardFocus>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        {@render Action({ props })}
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content side="top" align="center" sideOffset={4} {...tooltipContentProps}>
      {#if typeof tooltipContent === 'string'}
        {tooltipContent}
      {:else}
        {@render tooltipContent()}
      {/if}
    </Tooltip.Content>
  </Tooltip.Root>
{/if}
