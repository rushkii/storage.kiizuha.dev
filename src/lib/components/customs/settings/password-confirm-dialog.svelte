<script lang="ts">
  import * as AlertDialog from '#ui/alert-dialog';
  import { Button } from '#ui/button';
  import { Input } from '#ui/input';
  import { Label } from '#ui/label';
  import { Spinner } from '#ui/spinner';

  // Password prompt for a settings change. The input and the Confirm button belong to the form
  // named by `formId` (HTML `form` attribute), so the password is sent with the change itself.

  type FieldAttrs = { name: string; 'aria-invalid': boolean | 'false' | 'true' | undefined };

  let {
    open = $bindable(false),
    formId,
    description,
    field,
    issues,
    pending
  }: {
    open?: boolean;
    formId: string;
    description: string;
    field: FieldAttrs;
    issues?: { message: string }[];
    pending: boolean;
  } = $props();

  const inputId = $derived(`${formId}-password`);
  const errorId = $derived(`${formId}-password-error`);
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Confirm it’s you</AlertDialog.Title>
      <AlertDialog.Description>{description}</AlertDialog.Description>
    </AlertDialog.Header>
    <div class="grid gap-1.5">
      <Label for={inputId}>Password</Label>
      <!-- Not reset by the form: it lives outside it, so it is cleared on close instead. -->
      {#if open}
        <Input
          id={inputId}
          type="password"
          form={formId}
          autocomplete="current-password"
          required
          disabled={pending}
          aria-describedby={issues?.length ? errorId : undefined}
          name={field.name}
          aria-invalid={field['aria-invalid']}
        />
      {/if}
      {#each issues ?? [] as issue (issue.message)}
        <p id={errorId} class="text-xs text-destructive">{issue.message}</p>
      {/each}
    </div>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={pending}>Cancel</AlertDialog.Cancel>
      <Button type="submit" form={formId} disabled={pending}>
        {#if pending}<Spinner /> Confirming…{:else}Confirm{/if}
      </Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
