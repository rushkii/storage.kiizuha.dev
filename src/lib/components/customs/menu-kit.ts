import type { Component, Snippet } from 'svelte';
import * as DropdownMenu from '#ui/dropdown-menu';
import * as ContextMenu from '#ui/context-menu';

// Row actions are written once against this kit and rendered in both the row ⋮ dropdown and the
// right-click context menu, so the two menus never drift apart.

type MenuItemProps = {
  variant?: 'default' | 'destructive';
  disabled?: boolean;
  onclick?: (event: MouseEvent) => void;
  class?: string;
  children?: Snippet;
};

export type MenuKit = {
  Item: Component<MenuItemProps>;
  Separator: Component<{ class?: string }>;
};

export const dropdownKit: MenuKit = {
  Item: DropdownMenu.Item as unknown as MenuKit['Item'],
  Separator: DropdownMenu.Separator as unknown as MenuKit['Separator']
};

export const contextKit: MenuKit = {
  Item: ContextMenu.Item as unknown as MenuKit['Item'],
  Separator: ContextMenu.Separator as unknown as MenuKit['Separator']
};
