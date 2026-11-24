<script lang="ts">
  import * as InputGroup from '#ui/input-group';
  import type { TableState } from '#lib/hooks/table-state.svelte.ts';

  import SearchIcon from '@lucide/svelte/icons/search';
  import XIcon from '@lucide/svelte/icons/x';

  // Search box for a table. Debounced 300 ms so each keystroke does not hit the server.

  let { tableState, placeholder = 'Search' }: { tableState: TableState; placeholder?: string } =
    $props();

  // svelte-ignore state_referenced_locally
  let value = $state(tableState.search);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const update = (next: string) => {
    value = next;
    clearTimeout(timer);
    timer = setTimeout(() => tableState.setSearch(next), 300);
  };
</script>

<InputGroup.Root class="h-7 w-full max-w-56">
  <InputGroup.Addon><SearchIcon /></InputGroup.Addon>
  <InputGroup.Input
    type="search"
    {placeholder}
    aria-label={placeholder}
    {value}
    oninput={(e) => update(e.currentTarget.value)}
    onkeydown={(e) => e.key === 'Escape' && value && (e.stopPropagation(), update(''))}
  />
  {#if value}
    <InputGroup.Addon align="inline-end">
      <InputGroup.Button size="icon-xs" aria-label="Clear search" onclick={() => update('')}>
        <XIcon />
      </InputGroup.Button>
    </InputGroup.Addon>
  {/if}
</InputGroup.Root>
