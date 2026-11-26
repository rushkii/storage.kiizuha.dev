<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { toast } from 'svelte-sonner';
  import { Badge } from '#ui/badge';
  import { Button } from '#ui/button';
  import { Skeleton } from '#ui/skeleton';
  import * as Table from '#ui/table';
  import * as Tooltip from '#ui/tooltip';
  import { formatRelativeTime, formatZonedDate } from '#lib/dates.ts';
  import { getSessions, signOutSessions } from '#lib/remotes/account.remote.ts';
  import PasswordConfirmDialog from './password-confirm-dialog.svelte';

  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import LogOutIcon from '@lucide/svelte/icons/log-out';

  type Session = NonNullable<typeof sessionsQuery.current>[number];

  const FORM_ID = 'settings-sessions-form';

  const sessionsQuery = getSessions();
  const sessions = $derived(sessionsQuery.current);
  const hasOthers = $derived((sessions ?? []).some((session) => !session.current));

  const form = signOutSessions;
  const { fields } = form;
  const pending = $derived(form.pending > 0);

  const expanded = new SvelteSet<string>();
  /** What the password prompt will sign out: a session id, or `others`. */
  let target = $state('others');
  let passwordOpen = $state(false);

  // Times are formatted in the browser's own zone, so only after hydration; `now` keeps the
  // relative times fresh while the tab is open.
  let now = $state<Date | null>(null);
  onMount(() => {
    now = new Date();
    const timer = setInterval(() => (now = new Date()), 30_000);
    return () => clearInterval(timer);
  });

  const toggle = (id: string) => {
    if (expanded.has(id)) expanded.delete(id);
    else expanded.add(id);
  };

  const askSignOut = (next: string) => {
    target = next;
    passwordOpen = true;
  };

  const endsLabel = (session: Session) => {
    if (session.loginMode === 'idle_1h') return 'Signed out after an hour without use';
    if (session.loginMode === 'until_logout')
      return 'Kept until signed out, or 90 days without use';
    return now ? `Signed out on ${formatZonedDate(new Date(session.expiresAt))}` : '';
  };

  const loginOptionLabel = (session: Session) => {
    if (session.loginMode === 'idle_1h') return 'Log out after an hour without use';
    if (session.loginMode === 'until_logout') return 'Keep me logged in until I log out';
    if (session.loginMode === 'fixed_days') {
      return `Keep me logged in for ${session.loginDays} ${session.loginDays === 1 ? 'day' : 'days'}`;
    }
    return 'Fixed length (signed in before login options existed)';
  };

  const enhanced = form.enhance(async (submission) => {
    try {
      if (await submission.submit()) {
        passwordOpen = false;
        const { count = 0, target: done } = form.result ?? {};
        toast.success(
          done === 'others'
            ? `${count} ${count === 1 ? 'session' : 'sessions'} signed out`
            : 'Session signed out'
        );
      }
    } catch {
      passwordOpen = false;
      toast.error('Couldn’t sign out. Please try again.');
    }
  });
</script>

<div class="flex flex-col gap-3">
  <p class="max-w-xl text-xs text-muted-foreground">
    Each browser signed in to this account. How long a session lasts depends on the option chosen
    when it logged in. Changing your password signs out every session except this one.
  </p>

  <form id={FORM_ID} class="hidden" {...enhanced}>
    <input {...fields.target.as('hidden', target)} />
  </form>

  {#if !sessions}
    <div class="grid gap-2" aria-busy="true">
      <Skeleton class="h-12 w-full" />
      <Skeleton class="h-12 w-full" />
    </div>
  {:else}
    <div class="overflow-x-auto rounded-lg border">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head class="w-8"><span class="sr-only">Details</span></Table.Head>
            <Table.Head>Device</Table.Head>
            <Table.Head>IP address</Table.Head>
            <Table.Head>Last activity</Table.Head>
            <Table.Head><span class="sr-only">Actions</span></Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each sessions as session (session.id)}
            {@const open = expanded.has(session.id)}
            <Table.Row class={open ? 'border-b-0 bg-muted/50' : ''}>
              <Table.Cell class="align-top">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-expanded={open}
                  aria-controls={`session-${session.id}`}
                  aria-label={open ? 'Hide details' : 'Show details'}
                  onclick={() => toggle(session.id)}
                >
                  <ChevronRightIcon
                    class="transition-transform motion-reduce:transition-none {open
                      ? 'rotate-90'
                      : ''}"
                  />
                </Button>
              </Table.Cell>
              <Table.Cell class="align-top whitespace-normal">
                <div class="flex flex-wrap items-center gap-1.5 font-medium">
                  {session.device}
                  {#if session.current}<Badge>This browser</Badge>{/if}
                </div>
                <div class="mt-0.5 text-muted-foreground">{endsLabel(session)}</div>
              </Table.Cell>
              <Table.Cell class="align-top tabular-nums">
                {#if session.ipAddress}
                  {session.ipAddress}
                {:else}
                  <span class="text-muted-foreground" aria-label="Unknown">—</span>
                {/if}
              </Table.Cell>
              <Table.Cell class="align-top">
                {#if now}
                  <Tooltip.Root>
                    <Tooltip.Trigger
                      class="underline decoration-muted-foreground/50 decoration-dotted underline-offset-3"
                    >
                      {formatRelativeTime(new Date(session.lastActiveAt), now)}
                    </Tooltip.Trigger>
                    <Tooltip.Content
                      >{formatZonedDate(new Date(session.lastActiveAt))}</Tooltip.Content
                    >
                  </Tooltip.Root>
                {/if}
              </Table.Cell>
              <Table.Cell class="text-end align-top">
                {#if !session.current}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onclick={() => askSignOut(session.id)}
                  >
                    Sign out
                  </Button>
                {/if}
              </Table.Cell>
            </Table.Row>
            {#if open}
              <Table.Row id={`session-${session.id}`} class="bg-muted/50 hover:bg-muted/50">
                <Table.Cell></Table.Cell>
                <Table.Cell colspan={4} class="pt-0 pb-3 whitespace-normal">
                  <dl class="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1.5">
                    <dt class="text-muted-foreground">User agent</dt>
                    <dd class="font-mono text-[0.6875rem] break-all">
                      {session.userAgent ?? 'Unknown'}
                    </dd>
                    <dt class="text-muted-foreground">Signed in</dt>
                    <dd>
                      {now ? formatZonedDate(new Date(session.createdAt)) : ''} · {loginOptionLabel(
                        session
                      )}
                    </dd>
                    <dt class="text-muted-foreground">Expires</dt>
                    <dd>
                      {now ? formatZonedDate(new Date(session.expiresAt)) : ''}
                      {#if session.loginMode === 'idle_1h' || session.loginMode === 'until_logout'}
                        <span class="text-muted-foreground">(moves with use)</span>
                      {/if}
                    </dd>
                    <dt class="text-muted-foreground">IP address</dt>
                    <dd class="tabular-nums">{session.ipAddress ?? '—'}</dd>
                  </dl>
                </Table.Cell>
              </Table.Row>
            {/if}
          {/each}
        </Table.Body>
      </Table.Root>
    </div>

    <div>
      <Button
        variant="destructive"
        disabled={!hasOthers || pending}
        onclick={() => askSignOut('others')}
      >
        <LogOutIcon data-icon="inline-start" /> Sign out all other sessions
      </Button>
    </div>
  {/if}
</div>

<PasswordConfirmDialog
  bind:open={passwordOpen}
  formId={FORM_ID}
  description={target === 'others'
    ? 'Enter your password to sign out every other session.'
    : 'Enter your password to sign out this session.'}
  field={fields._password.as('password')}
  issues={fields._password.issues()}
  {pending}
/>
