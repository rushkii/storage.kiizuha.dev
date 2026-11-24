<script lang="ts">
  import * as Dialog from '#ui/dialog';
  import { Button } from '#ui/button';
  import { cn } from '#lib/utils.ts';
  import { uploads } from '#lib/uploads/upload-manager.svelte.ts';

  import UploadCloudIcon from '@lucide/svelte/icons/cloud-upload';
  import ShieldAlertIcon from '@lucide/svelte/icons/shield-alert';

  const target = $derived(uploads.dialog);
  let dragging = $state(false);
  let input = $state<HTMLInputElement | null>(null);

  const take = (list: FileList | null | undefined) => {
    const files = [...(list ?? [])];
    if (!target || !files.length) return;
    uploads.add(files, target);
    uploads.dialog = null;
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    dragging = false;
    take(event.dataTransfer?.files);
  };
</script>

<Dialog.Root open={target !== null} onOpenChange={(open) => !open && (uploads.dialog = null)}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Upload to “{target?.folderName}”</Dialog.Title>
      <Dialog.Description>Uploads keep going while you move between folders.</Dialog.Description>
    </Dialog.Header>

    <button
      type="button"
      class={cn(
        'flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors motion-reduce:transition-none',
        dragging ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
      )}
      ondragenter={(e) => {
        e.preventDefault();
        dragging = true;
      }}
      ondragover={(e) => e.preventDefault()}
      ondragleave={() => (dragging = false)}
      ondrop={onDrop}
      onclick={() => input?.click()}
    >
      <UploadCloudIcon class="size-8 text-muted-foreground" />
      <span class="text-sm font-medium">Drop files here</span>
      <span class="text-xs text-muted-foreground">or click to choose files</span>
    </button>
    <input
      bind:this={input}
      type="file"
      multiple
      class="sr-only"
      tabindex="-1"
      onchange={(e) => {
        take(e.currentTarget.files);
        e.currentTarget.value = '';
      }}
    />

    <p class="flex items-start gap-2 text-xs text-muted-foreground">
      <ShieldAlertIcon class="mt-px size-3.5 shrink-0" />
      Files are stored as-is and never run or checked by the server. You are responsible for what you
      upload.
    </p>

    <Dialog.Footer>
      <Dialog.Close>
        {#snippet child({ props })}
          <Button variant="outline" {...props}>Close</Button>
        {/snippet}
      </Dialog.Close>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
