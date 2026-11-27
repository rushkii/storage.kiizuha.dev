<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { toast } from 'svelte-sonner';
  import { Button } from '#ui/button';
  import { SHARED_NAV } from '#lib/constants/index.ts';
  import ErrorShell from './error-page/error-shell.svelte';
  import ErrorArt from './error-page/error-art.svelte';
  import ErrorChip from './error-page/error-chip.svelte';
  import ErrorIntro from './error-page/error-intro.svelte';

  import Link2OffIcon from '@lucide/svelte/icons/link-2-off';
  import ClockIcon from '@lucide/svelte/icons/clock';
  import CopyIcon from '@lucide/svelte/icons/copy';
  import LogInIcon from '@lucide/svelte/icons/log-in';

  // Same page for expired, revoked and unknown share links, so a token's state never leaks.

  const signedIn = $derived(Boolean(page.data.viewer));
  const signInHref = $derived(
    resolve(`/login?redirectTo=${encodeURIComponent(resolve(SHARED_NAV.url))}`)
  );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(page.url.href);
      toast.success('Link copied. Send it to whoever shared it.');
    } catch {
      toast.error('Couldn’t copy the link.');
    }
  };
</script>

<ErrorShell>
  <ErrorArt>
    <div class="relative flex items-center gap-6 sm:gap-7">
      <div
        class="flex h-10 -translate-y-1.5 -rotate-8 items-center gap-2 rounded-l-full rounded-r-lg bg-card ps-2 pe-3 shadow-lg ring-1 shadow-foreground/10 ring-foreground/10 sm:h-11"
      >
        <span
          class="flex size-6 items-center justify-center rounded-full bg-primary/12 text-primary"
        >
          <Link2OffIcon class="size-3" />
        </span>
        <span class="font-mono text-[0.6875rem] text-muted-foreground">/s/</span>
      </div>
      <div
        class="flex h-10 translate-y-2 rotate-7 items-center gap-2 rounded-l-lg rounded-r-full bg-card ps-3 pe-2 shadow-lg ring-1 shadow-foreground/10 ring-foreground/10 sm:h-11"
      >
        <span class="font-mono text-[0.6875rem] text-muted-foreground">…</span>
        <span
          class="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground"
        >
          <Link2OffIcon class="size-3" />
        </span>
      </div>
      <span
        class="absolute top-1/2 left-1/2 size-1.5 -translate-1/2 rounded-full bg-destructive motion-safe:animate-ping"
      ></span>
    </div>

    <ErrorChip class="top-7 right-2 rotate-5 sm:right-8">
      <ClockIcon /> No longer active
    </ErrorChip>
  </ErrorArt>

  <ErrorIntro
    code="Link unavailable"
    tone="destructive"
    title="This link has expired or was removed"
  >
    It may have reached its end date, been turned off, or been copied incompletely. Whatever it
    pointed to is still with the person who shared it.
  </ErrorIntro>

  <ol
    class="mt-5 flex w-full max-w-md flex-col overflow-hidden rounded-lg bg-card text-start text-xs ring-1 ring-foreground/10"
  >
    <li class="flex gap-2.5 border-b px-3 py-2.5">
      <span
        class="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[0.625rem] font-semibold"
        >1</span
      >
      <span>
        <span class="font-medium">Ask the sender for a new link.</span>
        <span class="text-muted-foreground">They can make one in a few clicks.</span>
      </span>
    </li>
    <li class="flex gap-2.5 px-3 py-2.5">
      <span
        class="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[0.625rem] font-semibold"
        >2</span
      >
      <span>
        <span class="font-medium">Is it your link?</span>
        <span class="text-muted-foreground">
          {signedIn ? 'Open What I shared to extend it.' : 'Sign in to extend it or share again.'}
        </span>
      </span>
    </li>
  </ol>

  <div class="mt-4 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
    {#if signedIn}
      <Button size="lg" href={resolve(SHARED_NAV.url)} class="max-sm:h-11">
        <SHARED_NAV.icon data-icon="inline-start" /> Open What I shared
      </Button>
    {:else}
      <Button size="lg" href={signInHref} class="max-sm:h-11">
        <LogInIcon data-icon="inline-start" /> Sign in to manage
      </Button>
    {/if}
    <Button size="lg" variant="outline" onclick={copyLink} class="max-sm:h-11">
      <CopyIcon data-icon="inline-start" /> Copy this link
    </Button>
  </div>
</ErrorShell>
