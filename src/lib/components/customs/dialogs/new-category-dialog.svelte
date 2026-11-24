<script lang="ts">
  import { toast } from 'svelte-sonner';
  import * as Dialog from '#ui/dialog';
  import { Button } from '#ui/button';
  import { Input } from '#ui/input';
  import { Label } from '#ui/label';
  import { Spinner } from '#ui/spinner';
  import { newCategorySchema } from '#lib/schemas/storage.ts';
  import { createCategory } from '#lib/remotes/library.remote.ts';
  import { itemActions } from '#lib/hooks/item-actions.svelte.ts';

  const form = createCategory.preflight(newCategorySchema);
  const nameIssues = $derived(form.fields.name.issues());
</script>

<Dialog.Root bind:open={itemActions.newCategory}>
  <Dialog.Content class="sm:max-w-sm">
    <Dialog.Header>
      <Dialog.Title>New category</Dialog.Title>
      <Dialog.Description>Categories group root folders in the sidebar.</Dialog.Description>
    </Dialog.Header>
    <form
      class="grid gap-4"
      {...form.enhance(async (instance) => {
        if (await instance.submit()) {
          if (!instance.fields.name.issues()) {
            toast.success(`Category “${instance.result?.name}” created.`);
            itemActions.newCategory = false;
            instance.element.reset();
          }
        }
      })}
    >
      <div class="grid gap-1.5">
        <Label for="category-name">Category name</Label>
        <Input
          id="category-name"
          maxlength={50}
          required
          autocomplete="off"
          placeholder="e.g. Photography"
          {...form.fields.name.as('text')}
        />
        {#each nameIssues ?? [] as issue (issue.message)}
          <p class="text-xs text-destructive" role="alert">{issue.message}</p>
        {/each}
      </div>
      <Dialog.Footer>
        <Dialog.Close>
          {#snippet child({ props })}
            <Button variant="outline" {...props}>Cancel</Button>
          {/snippet}
        </Dialog.Close>
        <Button type="submit" disabled={form.pending > 0}>
          {#if form.pending > 0}<Spinner />{/if}
          Create
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
