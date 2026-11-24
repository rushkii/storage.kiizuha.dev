import { goto } from '$app/navigation';
import { page } from '$app/state';

/** Query changes: a string sets the key; `null`, `undefined` or `''` removes it. */
export type SearchParamsChanges = Record<string, string | null | undefined>;

/**
 * The address bar's current query. Read from `window.location`, not `page.url`: a shallow
 * navigation changes the address bar but leaves `page.url` at the last full navigation.
 */
export const currentSearchParams = () => new URLSearchParams(window.location.search);

/** The current query string with `changes` applied, `?`-prefixed, or `''` when empty. */
export const searchWith = (changes: SearchParamsChanges) => {
  const params = currentSearchParams();
  for (const [key, value] of Object.entries(changes)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
};

/**
 * Applies `changes` to the current page's query string, keeping the path and hash. Shallow by
 * default: the URL and `page.state` update without rerunning `load`. Pass `shallow: false` to
 * navigate for real (focus and scroll are still kept). Replaces the history entry unless
 * `push` is true. Does nothing when the query would not change.
 *
 * The path is the one already in the address bar, which includes the base path, so it is not
 * passed through `resolve()`.
 */
export const setSearchParams = async (
  changes: SearchParamsChanges,
  { push = false, shallow = true }: { push?: boolean; shallow?: boolean } = {}
) => {
  const search = searchWith(changes);
  if (search === window.location.search) return;

  const url = `${window.location.pathname}${search}${window.location.hash}`;
  const options = shallow
    ? { state: page.state, shallow, replace: !push }
    : { replace: !push, reset: false };
  // eslint-disable-next-line svelte/no-navigation-without-resolve -- same page, only the query changes; the path comes from the address bar and already includes the base path
  await goto(url, options);
};
