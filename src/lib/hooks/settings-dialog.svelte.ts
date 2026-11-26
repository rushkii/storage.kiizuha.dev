import { setSearchParams } from '#lib/navigation.ts';

export const SETTINGS_TABS = ['profile', 'security', 'sessions'] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

const PARAM = 'settings';

const isTab = (value: string): value is SettingsTab =>
  (SETTINGS_TABS as readonly string[]).includes(value);

/**
 * Which settings tab is open, kept in `?settings=`. Opening pushes a shallow history entry, so
 * Back closes the dialog; switching tabs replaces it. Shallow navigation leaves `page.url` stale,
 * so the tab lives here and is re-read from the address bar on popstate and real navigations.
 */
class SettingsDialog {
  tab = $state<SettingsTab | null>(null);
  /** True while the open dialog has a history entry of its own that Back would remove. */
  #pushed = false;

  /** Reads the tab from a query string. An unknown value opens Profile. */
  sync(search: string) {
    const value = new URLSearchParams(search).get(PARAM);
    this.tab = value === null ? null : isTab(value) ? value : 'profile';
    if (this.tab === null) this.#pushed = false;
  }

  async open(tab: SettingsTab = 'profile') {
    if (this.tab !== null) return this.select(tab);
    this.tab = tab;
    this.#pushed = true;
    await setSearchParams({ [PARAM]: tab }, { push: true });
  }

  async select(tab: SettingsTab) {
    this.tab = tab;
    await setSearchParams({ [PARAM]: tab });
  }

  async close() {
    if (this.tab === null) return;
    this.tab = null;
    if (this.#pushed) {
      this.#pushed = false;
      history.back();
      return;
    }
    await setSearchParams({ [PARAM]: null });
  }
}

export const settingsDialog = new SettingsDialog();
