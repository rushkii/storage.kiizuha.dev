<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { Button } from '#ui/button';
  import { Input } from '#ui/input';
  import { Label } from '#ui/label';
  import { Spinner } from '#ui/spinner';
  import { changePasswordSchema, NEW_PASSWORD_MIN_LENGTH } from '#lib/schemas/account.ts';
  import { changePassword } from '#lib/remotes/account.remote.ts';

  // "Current password" is the password confirmation here, so no extra prompt is shown.

  const form = changePassword.preflight(changePasswordSchema);
  const { fields } = form;
  const pending = $derived(form.pending > 0);

  const enhanced = form.enhance(async (submission) => {
    try {
      if (await submission.submit()) {
        submission.element.reset();
        toast.success('Password changed. Other sessions were signed out.');
      }
    } catch {
      toast.error('Couldn’t change your password. Please try again.');
    }
  });
</script>

<form class="flex max-w-sm flex-col gap-4" {...enhanced}>
  <div class="grid gap-0.5">
    <h3 class="text-xs/relaxed font-medium">Change password</h3>
    <p class="text-xs text-muted-foreground">
      Every other session is signed out. This browser stays signed in.
    </p>
  </div>

  <div class="grid gap-1.5">
    <Label for="current-password">Current password</Label>
    <Input
      id="current-password"
      autocomplete="current-password"
      required
      disabled={pending}
      {...fields._currentPassword.as('password')}
    />
    {#each fields._currentPassword.issues() ?? [] as issue (issue.message)}
      <p class="text-xs text-destructive">{issue.message}</p>
    {/each}
  </div>

  <div class="grid gap-1.5">
    <Label for="new-password">New password</Label>
    <Input
      id="new-password"
      autocomplete="new-password"
      required
      minlength={NEW_PASSWORD_MIN_LENGTH}
      disabled={pending}
      aria-describedby="new-password-hint"
      {...fields._newPassword.as('password')}
    />
    <p id="new-password-hint" class="text-xs text-muted-foreground">
      At least {NEW_PASSWORD_MIN_LENGTH} characters, different from the current one.
    </p>
    {#each fields._newPassword.issues() ?? [] as issue (issue.message)}
      <p class="text-xs text-destructive">{issue.message}</p>
    {/each}
  </div>

  <div class="grid gap-1.5">
    <Label for="confirm-password">Confirm new password</Label>
    <Input
      id="confirm-password"
      autocomplete="new-password"
      required
      disabled={pending}
      {...fields._confirmPassword.as('password')}
    />
    {#each fields._confirmPassword.issues() ?? [] as issue (issue.message)}
      <p class="text-xs text-destructive">{issue.message}</p>
    {/each}
  </div>

  <div>
    <Button type="submit" disabled={pending}>
      {#if pending}<Spinner /> Changing…{:else}Change password{/if}
    </Button>
  </div>
</form>
