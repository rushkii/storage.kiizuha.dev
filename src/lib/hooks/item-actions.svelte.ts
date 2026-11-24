import { toast } from 'svelte-sonner';
import type { Selection } from '#lib/schemas/storage.ts';
import { getFileDownloadUrl, planDownload } from '#lib/remotes/transfer.remote.ts';
import type { RemoteQueryOverride } from '$app/server';
import { getFolderView, getRecent, moveToBin } from '#lib/remotes/library.remote.ts';
import { toSelection, type ItemRef } from './item-selection.svelte.ts';

// One place for the actions shared by the folder page, Recent and the row ⋮ menus. The dialogs
// these open are mounted once in the (app) layout (`item-dialogs.svelte`).

export type NamedItem = ItemRef & { name: string };

/**
 * Queries a library mutation asks the server to send back in the same response
 * (single-flight). The server only refreshes queries the client names here.
 */
export const LIST_QUERIES = [getFolderView, getRecent] as const;
export type DownloadPlan = Awaited<ReturnType<typeof planDownload>>;
export type SplitPlan = Extract<DownloadPlan, { kind: 'split' }>;
export type BinResult = Awaited<ReturnType<typeof moveToBin>>;

const errorMessage = (cause: unknown, fallback: string) =>
  (cause as { body?: { message?: string } })?.body?.message ??
  (cause as { message?: string })?.message ??
  fallback;

export { errorMessage };

/** Lets the browser download a presigned URL (sent with `Content-Disposition: attachment`). */
export const downloadUrl = (url: string) => {
  const link = document.createElement('a');
  link.href = url;
  link.rel = 'noopener';
  link.download = '';
  document.body.append(link);
  link.click();
  link.remove();
};

/**
 * Posts one zip request as a regular form so the browser streams the download natively. Each
 * zip gets its own hidden iframe as target, so starting the next one does not cancel this one.
 */
const submitZip = (selection: Selection, ids: string[], name: string) => {
  const target = `zip-${crypto.randomUUID()}`;
  const frame = document.createElement('iframe');
  frame.name = target;
  frame.hidden = true;
  document.body.append(frame);
  setTimeout(() => frame.remove(), 10 * 60 * 1000);

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = '/api/download/zip';
  form.target = target;
  const add = (field: string, value: string) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = field;
    input.value = value;
    form.append(input);
  };
  for (const id of selection.fileIds) add('selectionFileIds', id);
  for (const id of selection.folderIds) add('selectionFolderIds', id);
  for (const id of ids) add('ids', id);
  add('name', name);
  document.body.append(form);
  form.submit();
  form.remove();
};

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class ItemActions {
  share = $state<{ items: NamedItem[] } | null>(null);
  rename = $state<{ type: 'file' | 'folder' | 'category'; id: string; name: string } | null>(null);
  move = $state<{ items: NamedItem[] } | null>(null);
  download = $state<{ plan: SplitPlan; selection: Selection } | null>(null);
  binResult = $state<BinResult | null>(null);
  newFolder = $state<{
    categoryId?: string;
    parentId?: string;
    /** Shows the new folder in the open folder view while the request runs. */
    optimistic?: (name: string) => RemoteQueryOverride;
  } | null>(null);
  newCategory = $state(false);
  deleteCategory = $state<{ id: string; name: string } | null>(null);
  busy = $state(false);

  /** Folder: navigate (done by the caller). File: download directly. */
  async openFile(id: string) {
    try {
      const { url } = await getFileDownloadUrl(id);
      downloadUrl(url);
    } catch (cause) {
      toast.error(errorMessage(cause, 'Could not start the download.'));
    }
  }

  async startDownload(items: ItemRef[]) {
    const selection = toSelection(items);
    if (!selection.fileIds.length && !selection.folderIds.length) return;
    const id = toast.loading('Preparing download…');
    try {
      const plan = await planDownload(selection);
      toast.dismiss(id);
      if (plan.kind === 'single') {
        downloadUrl(plan.url);
      } else if (plan.totalFiles === 0) {
        toast.info('There are no files to download in this selection.');
      } else if (plan.large.length === 0 && plan.zips.length === 1) {
        submitZip(selection, plan.zips[0].fileIds, plan.zipName);
        toast.success('Your zip is being prepared. The download starts in a moment.');
      } else {
        this.download = { plan, selection };
      }
    } catch (cause) {
      toast.error(errorMessage(cause, 'Could not prepare the download.'), { id });
    }
  }

  /** Runs a split plan after the user confirmed it in the dialog. */
  async runDownload() {
    const current = this.download;
    if (!current) return;
    this.download = null;
    const { plan, selection } = current;
    for (const file of plan.large) {
      downloadUrl(file.url);
      await pause(600);
    }
    for (const [index, zip] of plan.zips.entries()) {
      const name = plan.zips.length > 1 ? `${plan.zipName}-${index + 1}` : plan.zipName;
      submitZip(selection, zip.fileIds, name);
      await pause(600);
    }
  }

  async moveToBin(items: ItemRef[], onDone?: () => void) {
    this.busy = true;
    try {
      const result = await moveToBin(toSelection(items)).updates(...LIST_QUERIES);
      this.binResult = result;
      onDone?.();
    } catch (cause) {
      toast.error(errorMessage(cause, 'Could not move these items to the bin.'));
    } finally {
      this.busy = false;
    }
  }
}

export const itemActions = new ItemActions();
