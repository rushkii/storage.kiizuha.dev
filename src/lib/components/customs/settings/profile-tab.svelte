<script lang="ts">
  import * as v from 'valibot';
  import { toast } from 'svelte-sonner';
  import * as Avatar from '#ui/avatar';
  import { Button } from '#ui/button';
  import { Checkbox } from '#ui/checkbox';
  import { Input } from '#ui/input';
  import { Label } from '#ui/label';
  import { Separator } from '#ui/separator';
  import { Skeleton } from '#ui/skeleton';
  import { getUserInitials } from '#lib/utils.ts';
  import {
    AVATAR_SOURCE_MAX_BYTES,
    AVATAR_SOURCE_TYPES,
    profileSchema
  } from '#lib/schemas/account.ts';
  import { getProfile, updateProfile } from '#lib/remotes/account.remote.ts';
  import { settingsDialog } from '#lib/hooks/settings-dialog.svelte.ts';
  import AvatarCropDialog from './avatar-crop-dialog.svelte';
  import PasswordConfirmDialog from './password-confirm-dialog.svelte';

  import UploadIcon from '@lucide/svelte/icons/upload';

  const FORM_ID = 'settings-profile-form';

  // Same rules as the server, minus the password, which the prompt asks for afterwards. The cast
  // only widens `_password` to optional; every other field keeps the server's schema.
  const preflightSchema = v.object({
    ...profileSchema.entries,
    _password: v.optional(v.string())
  }) as unknown as typeof profileSchema;

  const profileQuery = getProfile();
  const profile = $derived(profileQuery.current);
  const form = updateProfile.preflight(preflightSchema);
  const { fields } = form;

  let passwordOpen = $state(false);
  let picker = $state<HTMLInputElement | null>(null);
  let avatarInput = $state<HTMLInputElement | null>(null);
  let cropSource = $state<string | null>(null);
  /** Object URL of the cropped image waiting to be saved. */
  let pendingAvatar = $state<string | null>(null);
  let removeAvatar = $state(false);
  /** The checkbox choice, or `null` while it matches the saved profile. */
  let useGravatar = $state<boolean | null>(null);
  let pickError = $state<string | null>(null);

  const pending = $derived(form.pending > 0);
  const gravatarChecked = $derived(useGravatar ?? profile?.useGravatar ?? false);
  const normalized = (value: string | undefined) => value?.trim().toLowerCase();
  const dirty = $derived.by(() => {
    if (!profile) return false;
    const username = normalized(fields.username.value()) ?? profile.username;
    const email = normalized(fields.email.value()) ?? profile.email;
    return (
      pendingAvatar !== null ||
      removeAvatar ||
      gravatarChecked !== profile.useGravatar ||
      username !== profile.username ||
      email !== profile.email
    );
  });

  const shownAvatar = $derived(pendingAvatar ?? (removeAvatar ? null : profile?.avatarUrl));
  const canRemove = $derived(pendingAvatar !== null || (!!profile?.hasAvatar && !removeAvatar));

  const clearPendingAvatar = () => {
    if (pendingAvatar) URL.revokeObjectURL(pendingAvatar);
    pendingAvatar = null;
    if (avatarInput) avatarInput.value = '';
  };

  const pick = () => {
    pickError = null;
    picker?.click();
  };

  const onPicked = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!(AVATAR_SOURCE_TYPES as readonly string[]).includes(file.type)) {
      pickError = 'Use a PNG, JPG, WebP or AVIF image.';
      return;
    }
    if (file.size > AVATAR_SOURCE_MAX_BYTES) {
      pickError = 'Use an image up to 2 MB.';
      return;
    }
    cropSource = URL.createObjectURL(file);
  };

  const closeCrop = () => {
    if (cropSource) URL.revokeObjectURL(cropSource);
    cropSource = null;
  };

  /** Puts the cropped image into the form's file input so it is sent on Save. */
  const onCropped = (file: File) => {
    closeCrop();
    clearPendingAvatar();
    const transfer = new DataTransfer();
    transfer.items.add(file);
    if (avatarInput) {
      avatarInput.files = transfer.files;
      avatarInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    pendingAvatar = URL.createObjectURL(file);
    removeAvatar = false;
  };

  const onRemove = () => {
    if (pendingAvatar) {
      clearPendingAvatar();
      return;
    }
    removeAvatar = true;
  };

  /** Checks the fields in the browser first; the password is asked only for a valid change. */
  const askPassword = async () => {
    await form.validate({ all: true, preflightOnly: true });
    if (!fields.allIssues()?.length) passwordOpen = true;
  };

  /** Enter in a field opens the password prompt instead of sending the form without it. */
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || !(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    if (dirty && !pending) void askPassword();
  };

  const enhanced = form.enhance(async (submission) => {
    try {
      const ok = await submission.submit();
      if (ok) {
        passwordOpen = false;
        clearPendingAvatar();
        removeAvatar = false;
        useGravatar = null;
        toast.success('Profile updated');
      } else if (!fields._password.issues()?.length) {
        // The password was right; another field failed on the server.
        passwordOpen = false;
      }
    } catch {
      passwordOpen = false;
      toast.error('Couldn’t save your profile. Please try again.');
    }
  });
</script>

{#if !profile}
  <div class="grid gap-4" aria-busy="true">
    <div class="flex items-center gap-4">
      <Skeleton class="size-16 rounded-full" />
      <Skeleton class="h-7 w-40" />
    </div>
    <Skeleton class="h-7 w-full" />
    <Skeleton class="h-7 w-full" />
  </div>
{:else}
  <form
    id={FORM_ID}
    class="flex flex-col gap-5"
    enctype="multipart/form-data"
    {...enhanced}
    onkeydown={onKeyDown}
  >
    <section class="flex flex-col gap-3" aria-labelledby="avatar-heading">
      <h3 id="avatar-heading" class="text-xs/relaxed font-medium">Avatar</h3>
      <div class="flex items-center gap-4">
        <Avatar.Root class="size-16">
          {#if shownAvatar}
            <Avatar.Image src={shownAvatar} alt="Your avatar" />
          {/if}
          <Avatar.Fallback class="text-lg">{getUserInitials(profile.name)}</Avatar.Fallback>
        </Avatar.Root>
        <div class="flex flex-col gap-1.5">
          <div class="flex flex-wrap gap-1.5">
            <Button variant="outline" onclick={pick} disabled={pending}>
              <UploadIcon data-icon="inline-start" /> Change
            </Button>
            {#if canRemove}
              <Button variant="destructive" onclick={onRemove} disabled={pending}>
                {pendingAvatar ? 'Undo' : 'Remove'}
              </Button>
            {/if}
          </div>
          <p class="text-xs text-muted-foreground">PNG, JPG, WebP or AVIF, up to 2 MB.</p>
        </div>
      </div>
      {#if pickError}
        <p class="text-xs text-destructive" role="alert">{pickError}</p>
      {/if}
      {#each fields.avatar.issues() ?? [] as issue (issue.message)}
        <p class="text-xs text-destructive">{issue.message}</p>
      {/each}
      {#if removeAvatar}
        <p class="text-xs text-muted-foreground">The avatar is removed when you save.</p>
      {/if}

      <input
        bind:this={picker}
        type="file"
        accept={AVATAR_SOURCE_TYPES.join(',')}
        class="hidden"
        tabindex="-1"
        aria-hidden="true"
        onchange={onPicked}
      />
      <input bind:this={avatarInput} {...fields.avatar.as('file')} class="hidden" tabindex="-1" />
      <input
        {...fields.removeAvatar.as('checkbox')}
        checked={removeAvatar}
        class="hidden"
        tabindex="-1"
      />

      <div class="flex items-start gap-2">
        <Checkbox
          id="use-gravatar"
          name={fields.useGravatar.as('checkbox').name}
          checked={gravatarChecked}
          onCheckedChange={(checked) => (useGravatar = checked === true)}
          aria-describedby="use-gravatar-hint"
          disabled={pending}
        />
        <div class="grid gap-0.5">
          <Label for="use-gravatar">Use Gravatar when I don’t have an avatar image</Label>
          <p id="use-gravatar-hint" class="text-xs text-muted-foreground">
            Your browser loads it from gravatar.com, which sees your IP and a hash of your email.
          </p>
        </div>
      </div>
    </section>

    <div class="grid gap-3 sm:grid-cols-2">
      <div class="grid content-start gap-1.5">
        <Label for="profile-username">Username</Label>
        <Input
          id="profile-username"
          autocomplete="username"
          autocapitalize="none"
          spellcheck={false}
          required
          disabled={pending}
          aria-describedby="profile-username-hint"
          {...fields.username.as('text', profile.username)}
        />
        <p id="profile-username-hint" class="text-xs text-muted-foreground">
          Used to sign in. Saved in lowercase.
        </p>
        {#each fields.username.issues() ?? [] as issue (issue.message)}
          <p class="text-xs text-destructive">{issue.message}</p>
        {/each}
      </div>
      <div class="grid content-start gap-1.5">
        <Label for="profile-email">Email</Label>
        <Input
          id="profile-email"
          autocomplete="email"
          required
          disabled={pending}
          {...fields.email.as('email', profile.email)}
        />
        {#each fields.email.issues() ?? [] as issue (issue.message)}
          <p class="text-xs text-destructive">{issue.message}</p>
        {/each}
      </div>
    </div>

    <div class="flex justify-end">
      <Button type="button" onclick={askPassword} disabled={!dirty || pending}>Save</Button>
    </div>
  </form>

  <PasswordConfirmDialog
    bind:open={passwordOpen}
    formId={FORM_ID}
    description="Enter your password to save your profile."
    field={fields._password.as('password')}
    issues={fields._password.issues()}
    {pending}
  />

  <AvatarCropDialog source={cropSource} onApply={onCropped} onCancel={closeCrop} />

  <Separator class="my-5" />

  <section class="flex flex-col items-start gap-2.5" aria-labelledby="security-heading">
    <div class="grid gap-0.5">
      <h3 id="security-heading" class="text-xs/relaxed font-medium">Security</h3>
      <p class="text-xs text-muted-foreground">To change your password, use the button below.</p>
    </div>
    <Button variant="outline" onclick={() => settingsDialog.select('security')}>
      Change password
    </Button>
  </section>
{/if}
