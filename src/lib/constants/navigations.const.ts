import type { Component } from 'svelte';
import type { RouteId } from '$app/types';
import ClockIcon from '@lucide/svelte/icons/clock';
import Share2Icon from '@lucide/svelte/icons/share-2';
import Trash2Icon from '@lucide/svelte/icons/trash-2';

export type Navigation = {
  title: string;
  /** A route without params, so `resolve(url)` needs no extra arguments. */
  url: Exclude<RouteId, `${string}[${string}]${string}`>;
  icon: Component;
};

export const RECENT_NAV: Navigation = {
  title: 'Recent',
  url: '/(app)/recent',
  icon: ClockIcon
};

export const SHARED_NAV: Navigation = {
  title: 'What I shared',
  url: '/(app)/shared',
  icon: Share2Icon
};

export const BIN_NAV: Navigation = {
  title: 'Bin',
  url: '/(app)/bin',
  icon: Trash2Icon
};
