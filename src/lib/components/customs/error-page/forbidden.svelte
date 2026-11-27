<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import * as Avatar from '#ui/avatar';
  import { Button } from '#ui/button';
  import { getUserInitials, toastFormSubmission } from '#lib/utils.ts';
  import { signOut } from '#lib/remotes/auth.remote.ts';
  import ErrorShell from './error-shell.svelte';
  import ErrorArt from './error-art.svelte';
  import ErrorChip from './error-chip.svelte';
  import ErrorIntro from './error-intro.svelte';

  import LockIcon from '@lucide/svelte/icons/lock';
  import FileIcon from '@lucide/svelte/icons/file';
  import HouseIcon from '@lucide/svelte/icons/house';
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
  import LogInIcon from '@lucide/svelte/icons/log-in';

  // 401 and 403. Signed in: this account can't open it, offer to switch. Signed out: sign in.

  const viewer = $derived(page.data.viewer as { name: string } | null | undefined);
  const signInHref = $derived(
    resolve(`/login?redirectTo=${encodeURIComponent(page.url.pathname + page.url.search)}`)
  );

  const switchAccount = async () => {
    const ok = await toastFormSubmission(signOut, signOut.submit(), {
      loading: 'Signing out...',
      success: 'Signed out. Sign in with the other account.',
      error: 'Failed to sign out. Please try again.'
    });
    if (ok) await goto(signInHref);
  };
</script>

<ErrorShell>
  <ErrorArt>
    <div
      class="absolute top-1/2 left-1/2 h-36 w-28 -translate-x-[70%] -translate-y-[48%] -rotate-9 rounded-xl bg-card opacity-60 ring-1 ring-border sm:h-44 sm:w-36"
    ></div>
    <div
      class="relative flex h-38 w-30 rotate-3 flex-col gap-2 rounded-xl bg-card p-3.5 shadow-lg ring-1 shadow-foreground/10 ring-foreground/10 sm:h-48 sm:w-40"
    >
      <div class="flex items-center gap-1.5">
        <FileIcon class="size-3 text-primary" />
        <span class="h-1.5 w-16 rounded-full bg-muted"></span>
      </div>
      <span class="h-1.5 w-full rounded-full bg-muted"></span>
      <span class="h-1.5 w-[86%] rounded-full bg-muted"></span>
      <span class="h-1.5 w-[94%] rounded-full bg-muted"></span>
      <span class="mt-1 h-9 w-full rounded-md bg-muted sm:h-11"></span>
      <span class="h-1.5 w-[70%] rounded-full bg-muted"></span>
      <span class="absolute inset-0 rounded-xl bg-card/45 backdrop-blur-[2px]"></span>
      <span
        class="absolute top-1/2 left-1/2 flex size-11 -translate-1/2 items-center justify-center rounded-full bg-foreground text-background ring-6 ring-card sm:size-13"
      >
        <LockIcon class="size-5" />
      </span>
    </div>

    <ErrorChip class="top-8 right-2 rotate-4 sm:right-8">
      <LockIcon /> Private
    </ErrorChip>
    <ErrorChip class="bottom-6 left-2 -rotate-4 font-mono text-destructive sm:left-10">
      access: none
    </ErrorChip>
  </ErrorArt>

  {#if viewer}
    <ErrorIntro
      code="{page.status} · Forbidden"
      tone="destructive"
      title="You don’t have access to this"
    >
      This belongs to another account and hasn’t been shared with you. Ask the owner for a share
      link, or switch to the account that owns it.
    </ErrorIntro>

    <div
      class="mt-5 flex w-full max-w-sm items-center gap-2.5 rounded-lg bg-card px-3 py-2.5 text-start ring-1 ring-foreground/10"
    >
      <Avatar.Root>
        <Avatar.Fallback class="text-xs font-semibold"
          >{getUserInitials(viewer.name)}</Avatar.Fallback
        >
      </Avatar.Root>
      <span class="flex min-w-0 flex-1 flex-col leading-snug">
        <span class="truncate text-xs font-medium">Signed in as {viewer.name}</span>
        <span class="text-[0.6875rem] text-muted-foreground">This account can’t open it</span>
      </span>
      <form {...signOut}>
        <Button
          variant="secondary"
          onclick={switchAccount}
          disabled={signOut.pending > 0}
          class="max-sm:h-9"
        >
          Switch
        </Button>
      </form>
    </div>

    <div class="mt-4 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
      <Button size="lg" href={resolve('/(app)')} class="max-sm:h-11">
        <HouseIcon data-icon="inline-start" /> Go to My files
      </Button>
      <Button size="lg" variant="outline" onclick={() => history.back()} class="max-sm:h-11">
        <ArrowLeftIcon data-icon="inline-start" /> Go back
      </Button>
    </div>
  {:else}
    <ErrorIntro
      code="{page.status} · Sign in required"
      tone="destructive"
      title="Sign in to see this"
    >
      This page needs an account. Sign in and you’ll come straight back here.
    </ErrorIntro>

    <div class="mt-5 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
      <Button size="lg" href={signInHref} class="max-sm:h-11">
        <LogInIcon data-icon="inline-start" /> Sign in
      </Button>
      <Button size="lg" variant="outline" onclick={() => history.back()} class="max-sm:h-11">
        <ArrowLeftIcon data-icon="inline-start" /> Go back
      </Button>
    </div>
  {/if}
</ErrorShell>
