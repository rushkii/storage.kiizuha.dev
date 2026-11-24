export { cn } from 'cn';
import { toast } from 'svelte-sonner';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

/** Up to two initials from a display name ("Kiizuha Kanazawa" → "KK"); "?" when empty. */
export const getUserInitials = (user?: string) => {
  const name = user?.trim();
  if (!name) return '?';
  const [first, last] = name.split(/\s+/);
  return `${first[0]}${last?.[0] ?? ''}`.toUpperCase();
};

export type ToastFormMessages<Output> = {
  loading: string;
  success: string | ((result: Output | undefined) => string);
  error: string;
};

/** Submits a remote form and reports its progress with a single updating toast. */
export const toastFormSubmission = async <Output>(
  form: { readonly result: Output | undefined },
  submission: Promise<boolean>,
  messages: ToastFormMessages<Output>
) => {
  const id = toast.loading(messages.loading);
  try {
    const ok = await submission;
    if (!ok) {
      toast.error(messages.error, { id });
      return false;
    }
    const { success } = messages;
    toast.success(typeof success === 'function' ? success(form.result) : success, { id });
    return true;
  } catch {
    toast.error(messages.error, { id });
    return false;
  }
};
