<script lang="ts">
  import { onMount } from 'svelte';
  import { afterNavigate } from '$app/navigation';
  import * as Breadcrumb from '#ui/breadcrumb';
  import * as Dialog from '#ui/dialog';
  import * as Select from '#ui/select';
  import * as Sidebar from '#ui/sidebar';
  import { settingsDialog, type SettingsTab } from '#lib/hooks/settings-dialog.svelte.ts';
  import ProfileTab from './profile-tab.svelte';
  import SecurityTab from './security-tab.svelte';
  import SessionsTab from './sessions-tab.svelte';

  import UserIcon from '@lucide/svelte/icons/user';
  import ShieldIcon from '@lucide/svelte/icons/shield';
  import MonitorIcon from '@lucide/svelte/icons/monitor';

  // Settings dialog, laid out like the shadcn-svelte `sidebar-13` block. The open tab lives in
  // `?settings=`; on small screens the sidebar nav is replaced by a select.

  const TABS: { id: SettingsTab; title: string; icon: typeof UserIcon }[] = [
    { id: 'profile', title: 'Profile', icon: UserIcon },
    { id: 'security', title: 'Security', icon: ShieldIcon },
    { id: 'sessions', title: 'Sessions', icon: MonitorIcon }
  ];

  const tab = $derived(settingsDialog.tab);
  const current = $derived(TABS.find((item) => item.id === tab) ?? TABS[0]);

  onMount(() => settingsDialog.sync(window.location.search));
  afterNavigate(() => settingsDialog.sync(window.location.search));
</script>

<svelte:window onpopstate={() => settingsDialog.sync(window.location.search)} />

<Dialog.Root
  open={tab !== null}
  onOpenChange={(open) => {
    if (!open) void settingsDialog.close();
  }}
>
  <Dialog.Content
    class="h-[min(560px,calc(100svh-2rem))] max-w-[calc(100%-2rem)] gap-0 overflow-hidden p-0 sm:max-w-[calc(100%-2rem)] md:max-w-[700px] lg:max-w-[800px]"
  >
    <Dialog.Title class="sr-only">Settings</Dialog.Title>
    <Dialog.Description class="sr-only">
      Change your profile and password, and manage signed-in sessions.
    </Dialog.Description>

    <Sidebar.Provider class="min-h-0 items-start overflow-hidden">
      <Sidebar.Root collapsible="none" class="hidden h-full w-48 border-e md:flex">
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.GroupContent>
              <Sidebar.Menu>
                {#each TABS as item (item.id)}
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton
                      isActive={item.id === tab}
                      aria-current={item.id === tab ? 'page' : undefined}
                      onclick={() => settingsDialog.select(item.id)}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </Sidebar.MenuButton>
                  </Sidebar.MenuItem>
                {/each}
              </Sidebar.Menu>
            </Sidebar.GroupContent>
          </Sidebar.Group>
        </Sidebar.Content>
      </Sidebar.Root>

      <main class="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <header class="flex h-12 shrink-0 items-center gap-2 border-b ps-4 pe-12">
          <Breadcrumb.Root>
            <Breadcrumb.List>
              <Breadcrumb.Item class="hidden md:block">Settings</Breadcrumb.Item>
              <Breadcrumb.Separator class="hidden md:block" />
              <Breadcrumb.Item>
                <Breadcrumb.Page>{current.title}</Breadcrumb.Page>
              </Breadcrumb.Item>
            </Breadcrumb.List>
          </Breadcrumb.Root>
        </header>

        <div class="px-4 pt-3 md:hidden">
          <Select.Root
            type="single"
            value={current.id}
            onValueChange={(value) => settingsDialog.select(value as SettingsTab)}
          >
            <Select.Trigger class="w-full" aria-label="Settings section">
              {current.title}
            </Select.Trigger>
            <Select.Content>
              {#each TABS as item (item.id)}
                <Select.Item value={item.id} label={item.title} />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>

        <div class="flex-1 overflow-y-auto p-4">
          {#if tab === 'security'}
            <SecurityTab />
          {:else if tab === 'sessions'}
            <SessionsTab />
          {:else if tab === 'profile'}
            <ProfileTab />
          {/if}
        </div>
      </main>
    </Sidebar.Provider>
  </Dialog.Content>
</Dialog.Root>
