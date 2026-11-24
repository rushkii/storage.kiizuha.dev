<script lang="ts">
  import { APP_NAME } from '$app/env/public';
  import * as Alert from '#ui/alert';
  import { Button } from '#ui/button';
  import { Input } from '#ui/input';
  import { Label } from '#ui/label';
  import { Spinner } from '#ui/spinner';
  import { signInSchema } from '#lib/schemas/storage.ts';
  import { signIn } from '#lib/remotes/auth.remote.ts';

  import HardDriveIcon from '@lucide/svelte/icons/hard-drive';
  import AlertCircleIcon from '@lucide/svelte/icons/circle-alert';

  // Login page. Admin-only, so there is no sign-up link.

  let { data } = $props();

  const form = signIn.preflight(signInSchema);
  const pending = $derived(form.pending > 0);
  const failure = $derived(form.result?.failure);

  const FAILURES = {
    invalid: {
      title: 'Couldn’t sign you in',
      description: 'The username, email or password is incorrect.'
    },
    banned: {
      title: 'This account is suspended',
      description: 'Signing in is blocked for this account.'
    },
    rateLimited: {
      title: 'Too many attempts',
      description: 'Wait a minute, then try again.'
    }
  } as const;
</script>

<svelte:head>
  <title>Sign in · {APP_NAME}</title>
</svelte:head>

<main class="flex min-h-svh items-center justify-center bg-muted/40 p-4">
  <div class="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm sm:p-8">
    <div class="mb-6 flex flex-col items-center gap-2 text-center">
      <div
        class="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"
      >
        <HardDriveIcon class="size-5" />
      </div>
      <h1 class="text-lg font-semibold">Sign in to {APP_NAME}</h1>
      <p class="text-sm text-muted-foreground">This storage is private to its owner.</p>
    </div>

    {#if failure && !pending}
      <Alert.Root variant="destructive" class="mb-4" aria-live="assertive">
        <AlertCircleIcon />
        <Alert.Title>{FAILURES[failure].title}</Alert.Title>
        <Alert.Description>{FAILURES[failure].description}</Alert.Description>
      </Alert.Root>
    {/if}

    <form class="grid gap-4" {...form}>
      <input {...form.fields.redirectTo.as('hidden', data.redirectTo)} />
      <div class="grid gap-1.5">
        <Label for="identifier">Username or email</Label>
        <Input
          id="identifier"
          autocomplete="username"
          autocapitalize="none"
          spellcheck={false}
          required
          disabled={pending}
          {...form.fields.identifier.as('text')}
        />
        {#each form.fields.identifier.issues() ?? [] as issue (issue.message)}
          <p class="text-xs text-destructive">{issue.message}</p>
        {/each}
      </div>
      <div class="grid gap-1.5">
        <Label for="password">Password</Label>
        <Input
          id="password"
          autocomplete="current-password"
          required
          disabled={pending}
          {...form.fields._password.as('password')}
        />
        {#each form.fields._password.issues() ?? [] as issue (issue.message)}
          <p class="text-xs text-destructive">{issue.message}</p>
        {/each}
      </div>
      <Button type="submit" size="lg" class="mt-1 w-full" disabled={pending}>
        {#if pending}<Spinner /> Signing in…{:else}Sign in{/if}
      </Button>
    </form>
  </div>
</main>
