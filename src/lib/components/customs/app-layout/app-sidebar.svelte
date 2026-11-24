<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { browser } from '$app/env';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { APP_NAME } from '$app/env/public';
  import * as DropdownMenu from '#ui/dropdown-menu';
  import * as ContextMenu from '#ui/context-menu';
  import * as Sidebar from '#ui/sidebar';
  import * as Avatar from '#ui/avatar';
  import * as Collapsible from '#ui/collapsible';
  import { Spinner } from '#ui/spinner';
  import { cn, toastFormSubmission, getUserInitials } from '#lib/utils.ts';
  import { BIN_NAV, RECENT_NAV, SHARED_NAV, type Navigation } from '#lib/constants/index.ts';
  import { itemActions } from '#lib/hooks/item-actions.svelte.ts';
  import { signOut } from '#lib/remotes/auth.remote.ts';
  import { getSidebar } from '#lib/remotes/library.remote.ts';

  import HardDriveIcon from '@lucide/svelte/icons/hard-drive';
  import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import FolderIcon from '@lucide/svelte/icons/folder';
  import FolderPlusIcon from '@lucide/svelte/icons/folder-plus';
  import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import LogOutIcon from '@lucide/svelte/icons/log-out';

  import avatarDefault from '#lib/assets/favicon.svg';

  let { ...restProps }: ComponentProps<typeof Sidebar.Root> = $props();

  const sidebar = Sidebar.useSidebar();
  const sidebarData = getSidebar();

  const user = $derived(page.data.user);
  const userInitials = $derived(getUserInitials(user?.name));
  const categories = $derived(sidebarData.current?.categories ?? []);
  const hasFolders = $derived(categories.some((cat) => cat.folders.length > 0));

  // Collapsed categories are remembered per browser.
  const COLLAPSED_KEY = 'storage:collapsed-categories';
  const readCollapsed = (): string[] => {
    if (!browser) return [];
    try {
      const value = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]');
      return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [];
    } catch {
      return [];
    }
  };
  const collapsed = new SvelteSet<string>(readCollapsed());
  const setOpen = (categoryId: string, open: boolean) => {
    if (open) collapsed.delete(categoryId);
    else collapsed.add(categoryId);
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
    } catch {
      // Storage can be unavailable (private mode); the state just isn't remembered.
    }
  };

  const isActive = (nav: Navigation) => page.route.id === nav.url;

  /** Leaves the folder page first when the folder being binned is the one on screen. */
  const binFolder = (folderId: string) =>
    itemActions.moveToBin([{ type: 'folder', id: folderId }], () => {
      if (page.params.folderId === folderId) void goto(resolve('/(app)'));
    });

  const signOutWithToast = async () => {
    const ok = await toastFormSubmission(signOut, signOut.submit(), {
      loading: 'Signing out...',
      success: 'Signed out successfully.',
      error: 'Failed to sign out. Please try again.'
    });
    if (ok) await goto(resolve('/login'));
  };
</script>

{#snippet navItem(nav: Navigation)}
  <Sidebar.MenuItem>
    <Sidebar.MenuButton isActive={isActive(nav)} tooltipContent={nav.title}>
      {#snippet child({ props })}
        <a href={resolve(nav.url)} {...props}>
          <nav.icon />
          <span>{nav.title}</span>
        </a>
      {/snippet}
    </Sidebar.MenuButton>
  </Sidebar.MenuItem>
{/snippet}

{#snippet userIdentity()}
  <Avatar.Root class="size-8 rounded-lg">
    <Avatar.Image src={avatarDefault} alt={`${user?.username ?? user?.name}'s avatar`} />
    <Avatar.Fallback>{userInitials}</Avatar.Fallback>
  </Avatar.Root>
  <div class="grid flex-1 text-start text-sm leading-tight">
    <span class="truncate font-medium">{user?.name}</span>
    <span class="truncate text-xs">{user?.email}</span>
  </div>
{/snippet}

<Sidebar.Root collapsible="icon" {...restProps}>
  <Sidebar.Header>
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <Sidebar.MenuButton class="data-[slot=sidebar-menu-button]:p-1.5!">
          {#snippet child({ props })}
            <a
              href={resolve('/(app)')}
              {...props}
              class={cn(props.class as string, 'transition-colors')}
            >
              <HardDriveIcon class="size-5!" />
              <span class="text-base font-semibold">{APP_NAME}</span>
            </a>
          {/snippet}
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  </Sidebar.Header>

  <Sidebar.Content>
    <Sidebar.Group>
      <Sidebar.GroupContent>
        <Sidebar.Menu>
          <!-- Same menu as the real item, so swapping skeleton for Recent shifts nothing. -->
          {#if !sidebarData.ready}
            <Sidebar.MenuItem>
              <Sidebar.MenuSkeleton showIcon />
            </Sidebar.MenuItem>
          {:else if sidebarData.current?.showRecent}
            {@render navItem(RECENT_NAV)}
          {/if}
          {@render navItem(SHARED_NAV)}
        </Sidebar.Menu>
      </Sidebar.GroupContent>
    </Sidebar.Group>

    <Sidebar.Separator class="my-2" />

    {#if !sidebarData.ready}
      <Sidebar.Group>
        <Sidebar.Menu>
          {#each { length: 10 }, i (i)}
            <Sidebar.MenuItem>
              <Sidebar.MenuSkeleton showIcon />
            </Sidebar.MenuItem>
          {/each}
        </Sidebar.Menu>
      </Sidebar.Group>
    {/if}

    {#each categories as category (category.id)}
      <Collapsible.Root
        open={!collapsed.has(category.id)}
        onOpenChange={(open) => setOpen(category.id, open)}
        class="group/collapsible"
      >
        <Sidebar.Group class="py-1">
          <ContextMenu.Root>
            <ContextMenu.Trigger class="group/category relative flex items-center">
              <Sidebar.GroupLabel class="flex-1 pe-8">
                {#snippet child({ props })}
                  <Collapsible.Trigger {...props}>
                    <ChevronRightIcon
                      class="me-1 size-3.5! transition-transform group-data-[state=open]/collapsible:rotate-90 motion-reduce:transition-none"
                    />
                    <span class="truncate">{category.name}</span>
                  </Collapsible.Trigger>
                {/snippet}
              </Sidebar.GroupLabel>
              <button
                type="button"
                class="absolute inset-e-1 top-1.5 flex size-5 items-center justify-center rounded-md text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                aria-label={`New folder in ${category.name}`}
                title="New folder"
                onclick={() => (itemActions.newFolder = { categoryId: category.id })}
              >
                <PlusIcon class="size-3.5" />
              </button>
            </ContextMenu.Trigger>
            <ContextMenu.Content class="w-56">
              <ContextMenu.Item
                onclick={() =>
                  (itemActions.rename = {
                    type: 'category',
                    id: category.id,
                    name: category.name
                  })}
              >
                <PencilIcon /> Rename category
              </ContextMenu.Item>
              <ContextMenu.Item
                variant="destructive"
                disabled={category.folders.length > 0}
                onclick={() =>
                  (itemActions.deleteCategory = { id: category.id, name: category.name })}
              >
                <Trash2Icon />
                {category.folders.length > 0
                  ? 'Delete (move its folders out first)'
                  : 'Delete category'}
              </ContextMenu.Item>
            </ContextMenu.Content>
          </ContextMenu.Root>
          <Collapsible.Content>
            <Sidebar.GroupContent>
              <Sidebar.Menu>
                {#each category.folders as folder (folder.id)}
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton
                      isActive={page.params.folderId === folder.id}
                      tooltipContent={folder.name}
                      class="group-hover/menu-item:bg-sidebar-accent group-hover/menu-item:text-sidebar-accent-foreground group-has-data-[state=open]/menu-item:bg-sidebar-accent group-has-data-[state=open]/menu-item:text-sidebar-accent-foreground"
                    >
                      {#snippet child({ props })}
                        <a
                          href={resolve('/(app)/f/[folderId]', { folderId: folder.id })}
                          {...props}
                        >
                          <FolderIcon />
                          <span>{folder.name}</span>
                        </a>
                      {/snippet}
                    </Sidebar.MenuButton>
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger>
                        {#snippet child({ props })}
                          <Sidebar.MenuAction
                            showOnHover
                            tooltipContent="Edit"
                            class="data-[state=open]:bg-sidebar-accent"
                            aria-label={`More actions for ${folder.name}`}
                            {...props}
                          >
                            <EllipsisIcon />
                          </Sidebar.MenuAction>
                        {/snippet}
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Content
                        class="w-44"
                        side={sidebar.isMobile ? 'bottom' : 'right'}
                        align={sidebar.isMobile ? 'end' : 'start'}
                      >
                        <DropdownMenu.Item
                          onclick={() =>
                            (itemActions.rename = {
                              type: 'folder',
                              id: folder.id,
                              name: folder.name
                            })}
                        >
                          <PencilIcon /> Rename
                        </DropdownMenu.Item>
                        <DropdownMenu.Separator />
                        <DropdownMenu.Item
                          variant="destructive"
                          disabled={itemActions.busy}
                          onclick={() => binFolder(folder.id)}
                        >
                          <Trash2Icon /> Move to bin
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Root>
                  </Sidebar.MenuItem>
                {:else}
                  <li
                    class="px-2 py-1 text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden"
                  >
                    No folders yet
                  </li>
                {/each}
              </Sidebar.Menu>
            </Sidebar.GroupContent>
          </Collapsible.Content>
        </Sidebar.Group>
      </Collapsible.Root>
    {/each}

    {#if sidebarData.ready}
      <Sidebar.Group class="group-data-[collapsible=icon]:hidden">
        {#if !hasFolders}
          <div class="mb-2 rounded-lg border border-dashed border-sidebar-border p-3 text-center">
            <FolderPlusIcon class="mx-auto mb-1.5 size-5 text-sidebar-foreground/60" />
            <p class="text-xs font-medium">No folders yet</p>
            <p class="mt-0.5 text-xs text-sidebar-foreground/60">
              {categories.length
                ? 'Use + next to a category to add a folder.'
                : 'Start with a category, then add folders to it.'}
            </p>
          </div>
        {/if}
        <Sidebar.Menu>
          <Sidebar.MenuItem>
            <Sidebar.MenuButton
              class="text-sidebar-foreground/70"
              onclick={() => (itemActions.newCategory = true)}
            >
              <PlusIcon />
              <span>New category</span>
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
        </Sidebar.Menu>
      </Sidebar.Group>
    {/if}

    <div class="mt-auto">
      <Sidebar.Separator class="my-2" />

      <Sidebar.Group>
        <Sidebar.GroupContent>
          <Sidebar.Menu>
            {@render navItem(BIN_NAV)}
          </Sidebar.Menu>
        </Sidebar.GroupContent>
      </Sidebar.Group>
    </div>
  </Sidebar.Content>

  <Sidebar.Footer>
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            {#snippet child({ props })}
              <Sidebar.MenuButton
                size="lg"
                class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                {...props}
              >
                {@render userIdentity()}
                <ChevronsUpDownIcon class="ms-auto size-4" />
              </Sidebar.MenuButton>
            {/snippet}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            class="w-(--bits-dropdown-menu-anchor-width) min-w-56 rounded-lg"
            side={sidebar.isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenu.Label class="p-0 font-normal">
              <div class="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
                {@render userIdentity()}
              </div>
            </DropdownMenu.Label>
            <DropdownMenu.Separator />
            <form {...signOut}>
              <DropdownMenu.Item onclick={signOutWithToast} disabled={signOut.pending > 0}>
                {#if signOut.pending > 0}
                  <Spinner />
                  Logging out...
                {:else}
                  <LogOutIcon />
                  Log out
                {/if}
              </DropdownMenu.Item>
            </form>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  </Sidebar.Footer>
</Sidebar.Root>
