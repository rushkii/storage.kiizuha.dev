<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import * as Dialog from '#ui/dialog';
  import * as Select from '#ui/select';
  import { Button } from '#ui/button';
  import { Input } from '#ui/input';
  import { Label } from '#ui/label';
  import { Spinner } from '#ui/spinner';
  import { newFolderSchema } from '#lib/schemas/storage.ts';
  import { createFolder, getFolderView, getSidebar } from '#lib/remotes/library.remote.ts';
  import { itemActions } from '#lib/hooks/item-actions.svelte.ts';

  const form = createFolder.preflight(newFolderSchema);
  const sidebar = getSidebar();

  const target = $derived(itemActions.newFolder);
  const isSubfolder = $derived(Boolean(target?.parentId));
  let categoryId = $derived(target?.categoryId ?? '');

  const categories = $derived(sidebar.current?.categories ?? []);
  const categoryName = $derived(categories.find((c) => c.id === categoryId)?.name);
  const nameIssues = $derived(form.fields.name.issues());

  const setOpen = (open: boolean) => {
    if (!open) itemActions.newFolder = null;
  };
</script>

<Dialog.Root open={target !== null} onOpenChange={setOpen}>
  <Dialog.Content class="sm:max-w-sm">
    <Dialog.Header>
      <Dialog.Title>{isSubfolder ? 'New subfolder' : 'New folder'}</Dialog.Title>
      <Dialog.Description>
        {isSubfolder
          ? 'The folder is created inside the folder you are viewing.'
          : 'Root folders appear in the sidebar under their category.'}
      </Dialog.Description>
    </Dialog.Header>
    <form
      class="grid gap-4"
      {...form.enhance(async (instance) => {
        const name = instance.fields.name.value()?.trim();
        const pending = target?.optimistic && name ? target.optimistic(name) : null;
        const submitted = await instance
          .submit()
          .updates(...(pending ? [pending] : []), getFolderView);
        if (submitted && !instance.fields.allIssues()) {
          const created = instance.result;
          instance.element.reset();
          itemActions.newFolder = null;
          if (created) {
            toast.success(`Folder “${created.name}” created.`);
            if (!isSubfolder) await goto(resolve('/(app)/f/[folderId]', { folderId: created.id }));
          }
        }
      })}
    >
      {#if target?.parentId}
        <input {...form.fields.parentId.as('hidden', target.parentId)} />
      {:else}
        <div class="grid gap-1.5">
          <Label for="folder-category">Category</Label>
          <Select.Root type="single" bind:value={categoryId}>
            <Select.Trigger id="folder-category" class="w-full">
              {categoryName ?? 'Choose a category'}
            </Select.Trigger>
            <Select.Content>
              {#each categories as category (category.id)}
                <Select.Item value={category.id} label={category.name} />
              {/each}
            </Select.Content>
          </Select.Root>
          {#if categoryId}
            <input {...form.fields.categoryId.as('hidden', categoryId)} />
          {/if}
        </div>
      {/if}
      <div class="grid gap-1.5">
        <Label for="folder-name">Folder name</Label>
        <Input
          id="folder-name"
          maxlength={100}
          required
          autocomplete="off"
          placeholder="e.g. Bromo trip 2026"
          {...form.fields.name.as('text')}
        />
        {#each nameIssues ?? [] as issue (issue.message)}
          <p class="text-xs text-destructive" role="alert">{issue.message}</p>
        {/each}
        <p class="text-xs text-muted-foreground">
          Up to 100 characters. Can’t be . or .. and can’t contain /.
        </p>
      </div>
      <Dialog.Footer>
        <Dialog.Close>
          {#snippet child({ props })}
            <Button variant="outline" {...props}>Cancel</Button>
          {/snippet}
        </Dialog.Close>
        <Button type="submit" disabled={form.pending > 0 || (!isSubfolder && !categoryId)}>
          {#if form.pending > 0}<Spinner />{/if}
          Create folder
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
