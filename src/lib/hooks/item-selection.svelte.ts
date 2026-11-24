import { SvelteSet } from 'svelte/reactivity';
import type { Selection } from '#lib/schemas/storage.ts';

// Google Drive style selection: click selects one, Ctrl/Cmd toggles, Shift selects a range.
// Works on row keys in display order, so the same logic serves table and grid views.

export type ItemRef = { type: 'file' | 'folder'; id: string };

/** Stable selection key for an item, `type:id`, since files and folders can share ids. */
export const itemKey = (item: ItemRef) => `${item.type}:${item.id}`;

const LONG_PRESS_MS = 500;

export class ItemSelection {
  readonly keys = new SvelteSet<string>();
  /** Last item clicked without Shift; the start of Shift ranges. */
  anchor: string | null = null;
  /** Touch "selection mode": entered by long-press, left when nothing is selected. */
  touchMode = $state(false);

  readonly size = $derived(this.keys.size);

  #pressTimer: ReturnType<typeof setTimeout> | null = null;
  #pressed = false;

  has(key: string) {
    return this.keys.has(key);
  }

  clear() {
    this.keys.clear();
    this.anchor = null;
    this.touchMode = false;
  }

  selectAll(keys: string[]) {
    this.keys.clear();
    for (const key of keys) this.keys.add(key);
  }

  /** Keeps only keys that are still present, e.g. after a refresh or a move. */
  retain(keys: string[]) {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local lookup, not state
    const present = new Set(keys);
    for (const key of [...this.keys]) if (!present.has(key)) this.keys.delete(key);
    if (!this.keys.size) this.touchMode = false;
  }

  /**
   * Click on an item. `order` is the key of every item in display order.
   * Returns `false` when the click was swallowed by a long-press.
   */
  click(event: MouseEvent, key: string, order: string[]) {
    if (this.#pressed) {
      this.#pressed = false;
      return false;
    }
    const additive = event.metaKey || event.ctrlKey;

    if (this.touchMode) {
      this.toggle(key);
      return true;
    }

    if (event.shiftKey && this.anchor && order.includes(this.anchor)) {
      const from = order.indexOf(this.anchor);
      const to = order.indexOf(key);
      const range = order.slice(Math.min(from, to), Math.max(from, to) + 1);
      if (!additive) this.keys.clear();
      for (const k of range) this.keys.add(k);
      return true;
    }

    if (additive) {
      this.toggle(key);
      this.anchor = key;
      return true;
    }

    this.keys.clear();
    this.keys.add(key);
    this.anchor = key;
    return true;
  }

  toggle(key: string) {
    if (this.keys.has(key)) this.keys.delete(key);
    else this.keys.add(key);
    if (!this.keys.size) this.touchMode = false;
  }

  /** Touch: long-press selects and enters selection mode. Wire to `pointerdown`. */
  pointerDown(event: PointerEvent, key: string) {
    if (event.pointerType !== 'touch') return;
    this.cancelPress();
    this.#pressTimer = setTimeout(() => {
      this.#pressed = true;
      this.touchMode = true;
      this.keys.add(key);
      this.anchor = key;
      navigator.vibrate?.(10);
    }, LONG_PRESS_MS);
  }

  /** Wire to `pointerup`, `pointercancel` and `pointermove`. */
  cancelPress() {
    if (this.#pressTimer) clearTimeout(this.#pressTimer);
    this.#pressTimer = null;
  }

  /** The selection as file and folder ids, as remote functions expect it. */
  toSelection(): Selection {
    const fileIds: string[] = [];
    const folderIds: string[] = [];
    for (const key of this.keys) {
      const [type, id] = key.split(':');
      (type === 'folder' ? folderIds : fileIds).push(id);
    }
    return { fileIds, folderIds };
  }
}

/** Splits items into the `{ fileIds, folderIds }` shape the remote functions take. */
export const toSelection = (items: ItemRef[]): Selection => ({
  fileIds: items.filter((i) => i.type === 'file').map((i) => i.id),
  folderIds: items.filter((i) => i.type === 'folder').map((i) => i.id)
});

/** True when a keyboard shortcut should not fire because the user is typing. */
export const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement);
