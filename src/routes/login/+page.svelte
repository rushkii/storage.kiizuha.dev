<script lang="ts">
  import { APP_NAME } from '$app/env/public';
  import * as Alert from '#ui/alert';
  import { Button } from '#ui/button';
  import { Input } from '#ui/input';
  import { Label } from '#ui/label';
  import { Spinner } from '#ui/spinner';
  import * as RadioGroup from '#ui/radio-group';
  import { signInSchema } from '#lib/schemas/storage.ts';
  import {
    DEFAULT_LOGIN_MODE,
    LOGIN_DAYS_DEFAULT,
    LOGIN_DAYS_MAX,
    LOGIN_DAYS_MIN,
    type LoginMode
  } from '#lib/schemas/account.ts';
  import { signIn } from '#lib/remotes/auth.remote.ts';

  import HardDriveIcon from '@lucide/svelte/icons/hard-drive';
  import AlertCircleIcon from '@lucide/svelte/icons/circle-alert';

  // Login page. Admin-only, so there is no sign-up link.

  let { data } = $props();

  const form = signIn.preflight(signInSchema);
  const pending = $derived(form.pending > 0);
  const failure = $derived(form.result?.failure);

  let loginMode = $state<LoginMode>(DEFAULT_LOGIN_MODE);
  const loginModeName = $derived(form.fields.loginMode.as('radio', DEFAULT_LOGIN_MODE).name);

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
      <fieldset class="grid gap-2.5" disabled={pending}>
        <legend class="mb-2.5 text-xs/relaxed font-medium">Stay signed in</legend>
        <RadioGroup.Root bind:value={loginMode} name={loginModeName} class="gap-2.5">
          <div class="flex items-start gap-2">
            <RadioGroup.Item value="idle_1h" id="login-idle" aria-describedby="login-idle-hint" />
            <div class="grid gap-0.5">
              <Label for="login-idle">Log out after an hour without use</Label>
              <p id="login-idle-hint" class="text-xs text-muted-foreground">
                Best on a shared or public computer.
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <RadioGroup.Item value="fixed_days" id="login-days" />
            <Label for="login-days" class="flex-wrap gap-1.5">
              Keep me logged in for
              <Input
                inputmode="numeric"
                min={LOGIN_DAYS_MIN}
                max={LOGIN_DAYS_MAX}
                step={1}
                aria-label={`Number of days, ${LOGIN_DAYS_MIN} to ${LOGIN_DAYS_MAX}`}
                class="h-6 w-14 text-center"
                disabled={pending || loginMode !== 'fixed_days'}
                {...form.fields.loginDays.as('number', LOGIN_DAYS_DEFAULT)}
              />
              days
            </Label>
          </div>
          {#each form.fields.loginDays.issues() ?? [] as issue (issue.message)}
            <p class="ms-6 text-xs text-destructive">{issue.message}</p>
          {/each}
          <div class="flex items-start gap-2">
            <RadioGroup.Item
              value="until_logout"
              id="login-until"
              aria-describedby="login-until-hint"
            />
            <div class="grid gap-0.5">
              <Label for="login-until">Keep me logged in until I log out</Label>
              <p id="login-until-hint" class="text-xs text-muted-foreground">
                Ends after 90 days without use.
              </p>
            </div>
          </div>
        </RadioGroup.Root>
      </fieldset>
      <Button type="submit" size="lg" class="mt-1 w-full" disabled={pending}>
        {#if pending}<Spinner /> Signing in…{:else}Sign in{/if}
      </Button>
    </form>
  </div>
</main>
