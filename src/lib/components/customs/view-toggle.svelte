<script lang="ts">
  import * as ToggleGroup from '#ui/toggle-group';
  import type { TableState } from '#lib/hooks/table-state.svelte.ts';

  import ListIcon from '@lucide/svelte/icons/list';
  import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';

  let { tableState }: { tableState: TableState } = $props();
</script>

<ToggleGroup.Root
  type="single"
  variant="outline"
  size="sm"
  value={tableState.view}
  onValueChange={(value) => value && (tableState.view = value as 'table' | 'grid')}
  aria-label="View"
>
  <ToggleGroup.Item value="table" aria-label="Table view"><ListIcon /></ToggleGroup.Item>
  <ToggleGroup.Item value="grid" aria-label="Grid view"><LayoutGridIcon /></ToggleGroup.Item>
</ToggleGroup.Root>
