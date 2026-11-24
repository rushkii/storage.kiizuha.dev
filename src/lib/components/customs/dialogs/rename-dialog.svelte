<script lang="ts">
  import { toast } from 'svelte-sonner';
  import * as Dialog from '#ui/dialog';
  import { Button } from '#ui/button';
  import { Input } from '#ui/input';
  import { Label } from '#ui/label';
  import { Spinner } from '#ui/spinner';
  import { getFolderView, renameCategory, renameItem } from '#lib/remotes/library.remote.ts';
  import { errorMessage, itemActions, LIST_QUERIES } from '#lib/hooks/item-actions.svelte.ts';

  const target = $derived(itemActions.rename);
  const maxLength = $derived(
    target?.type === 'category' ? 50 : target?.type === 'file' ? 255 : 100
  );
  const noun = $derived(target?.type ?? 'item');

  let name = $derived(target?.name ?? '');
  let problem = $derived.by<string | null>(() => {
    void target;
    return null;
  });
  let saving = $state(false);
  let input = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (!target) return;
    // Select the name without the extension, like file managers do.
    queueMicrotask(() => {
      const dot = target.type === 'file' ? target.name.lastIndexOf('.') : -1;
      input?.setSelectionRange(0, dot > 0 ? dot : target.name.length);
    });
  });

  const validate = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return 'Enter a name.';
    if (trimmed.length > maxLength) return `Use ${maxLength} characters or fewer.`;
    if (target?.type !== 'category') {
      if (trimmed === '.' || trimmed === '..') return 'A name can’t be . or ..';
      if (trimmed.includes('/')) return 'A name can’t contain /';
    }
    return null;
  };

  const save = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!target) return;
    problem = validate(name);
    if (problem) return;
    const next = name.trim();
    if (next === target.name) {
      itemActions.rename = null;
      return;
    }
    saving = true;
    try {
      if (target.type === 'category') {
        await renameCategory({ categoryId: target.id, name: next }).updates(getFolderView);
      } else {
        await renameItem({ type: target.type, id: target.id, name: next }).updates(...LIST_QUERIES);
      }
      toast.success(`Renamed to “${next}”.`);
      itemActions.rename = null;
    } catch (cause) {
      problem = errorMessage(cause, 'Could not rename. Try again.');
    } finally {
      saving = false;
    }
  };
</script>

<Dialog.Root open={target !== null} onOpenChange={(open) => !open && (itemActions.rename = null)}>
  <Dialog.Content class="sm:max-w-sm">
    <Dialog.Header>
      <Dialog.Title>Rename {noun}</Dialog.Title>
    </Dialog.Header>
    <form class="grid gap-4" onsubmit={save}>
      <div class="grid gap-1.5">
        <Label for="rename-input" class="sr-only">New name</Label>
        <Input
          id="rename-input"
          bind:ref={input}
          bind:value={name}
          maxlength={maxLength}
          autocomplete="off"
          aria-invalid={problem ? true : undefined}
          oninput={() => (problem = null)}
        />
        {#if problem}
          <p class="text-xs text-destructive" role="alert">{problem}</p>
        {/if}
      </div>
      <Dialog.Footer>
        <Dialog.Close>
          {#snippet child({ props })}
            <Button variant="outline" {...props}>Cancel</Button>
          {/snippet}
        </Dialog.Close>
        <Button type="submit" disabled={saving}>
          {#if saving}<Spinner />{/if}
          Rename
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
