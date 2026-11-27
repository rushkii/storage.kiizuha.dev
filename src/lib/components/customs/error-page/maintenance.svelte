<script lang="ts">
  import { Button } from '#ui/button';
  import ErrorShell from './error-shell.svelte';
  import ErrorArt from './error-art.svelte';
  import ErrorIntro from './error-intro.svelte';

  import WrenchIcon from '@lucide/svelte/icons/wrench';
  import RotateCwIcon from '@lucide/svelte/icons/rotate-cw';

  // 503. Reloads itself every minute so the visitor lands back in the app once it's up.

  const RETRY_MS = 60_000;

  $effect(() => {
    const timer = setInterval(() => location.reload(), RETRY_MS);
    return () => clearInterval(timer);
  });

  const SERVICES = [
    { label: 'Uploads', state: 'Paused', ok: false },
    { label: 'Downloads', state: 'Paused', ok: false },
    { label: 'Your files', state: 'Safe', ok: true }
  ];
</script>

<ErrorShell>
  <ErrorArt>
    <div class="relative flex w-44 flex-col gap-2 sm:w-52">
      {#each [16, 22, 13] as width, i (i)}
        <div
          class={[
            'flex h-9 items-center gap-2.5 rounded-lg bg-card px-3 shadow-md ring-1 shadow-foreground/5 sm:h-11',
            i === 1 ? 'translate-x-4 ring-amber-500/45' : 'ring-foreground/10'
          ]}
        >
          <span class={['size-1.5 rounded-full', i === 1 ? 'bg-amber-500' : 'bg-primary']}></span>
          <span class="h-1.5 rounded-full bg-muted" style:width="{width * 4}px"></span>
          <span class="ms-auto h-1.5 w-6 rounded-full bg-muted"></span>
        </div>
      {/each}
      <span
        class="absolute top-7 -right-9 flex size-12 -rotate-12 items-center justify-center rounded-full bg-foreground text-background ring-6 ring-background sm:top-9 sm:-right-10 sm:size-14"
      >
        <WrenchIcon class="size-5 motion-safe:animate-[spin_6s_ease-in-out_infinite]" />
      </span>
    </div>
  </ErrorArt>

  <ErrorIntro code="503 · Maintenance" tone="warning" title="Tidying up the shelves">
    Storage is down for a short upgrade. Nothing you’ve uploaded is affected, and we’ll be back
    shortly.
  </ErrorIntro>

  <dl
    class="mt-5 grid w-full max-w-md grid-cols-3 gap-2 rounded-lg bg-card p-3.5 text-start ring-1 ring-foreground/10"
  >
    {#each SERVICES as service (service.label)}
      <div class="flex flex-col leading-snug">
        <dt class="text-[0.625rem] text-muted-foreground">{service.label}</dt>
        <dd class="flex items-center gap-1.5 text-xs font-medium">
          <span class={['size-1.5 rounded-full', service.ok ? 'bg-primary' : 'bg-amber-500']}
          ></span>
          {service.state}
        </dd>
      </div>
    {/each}
  </dl>

  <div class="mt-4 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
    <Button size="lg" onclick={() => location.reload()} class="max-sm:h-11">
      <RotateCwIcon data-icon="inline-start" /> Check again
    </Button>
  </div>
  <p class="mt-3 text-[0.6875rem] text-muted-foreground">
    This page refreshes by itself every minute.
  </p>
</ErrorShell>
