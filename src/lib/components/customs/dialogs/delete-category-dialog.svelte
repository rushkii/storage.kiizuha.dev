<script lang="ts">
  import { toast } from 'svelte-sonner';
  import * as AlertDialog from '#ui/alert-dialog';
  import { Spinner } from '#ui/spinner';
  import { deleteCategory } from '#lib/remotes/library.remote.ts';
  import { errorMessage, itemActions } from '#lib/hooks/item-actions.svelte.ts';

  const target = $derived(itemActions.deleteCategory);
  let deleting = $state(false);

  const confirm = async () => {
    if (!target) return;
    deleting = true;
    try {
      await deleteCategory(target.id);
      toast.success(`Category “${target.name}” deleted.`);
      itemActions.deleteCategory = null;
    } catch (cause) {
      toast.error(errorMessage(cause, 'Could not delete the category.'));
    } finally {
      deleting = false;
    }
  };
</script>

<AlertDialog.Root
  open={target !== null}
  onOpenChange={(open) => !open && (itemActions.deleteCategory = null)}
>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete “{target?.name}”?</AlertDialog.Title>
      <AlertDialog.Description>
        The category is empty, so nothing else is deleted.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action variant="destructive" disabled={deleting} onclick={confirm}>
        {#if deleting}<Spinner />{/if}
        Delete category
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
