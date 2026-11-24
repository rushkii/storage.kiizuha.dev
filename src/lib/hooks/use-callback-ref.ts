/**
 * Wraps an optional callback in a function that is always defined and does nothing while
 * `callback` is undefined, so callers can call it without a null check.
 */
export function useCallbackRef<T extends (...args: never[]) => unknown>(
  callback: T | undefined
): T {
  return ((...args: Parameters<T>) => callback?.(...args)) as T;
}
