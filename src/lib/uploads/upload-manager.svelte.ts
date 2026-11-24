import { SvelteSet } from 'svelte/reactivity';
import {
  abortUpload,
  completeUpload,
  getPartUploadUrl,
  getPendingUploads,
  recordUploadedPart,
  setUploadPaused,
  startUpload
} from '#lib/remotes/transfer.remote.ts';
import { getFolderView } from '#lib/remotes/library.remote.ts';
import { errorMessage } from '#lib/hooks/item-actions.svelte.ts';
import { deleteProgress, readAllProgress, saveProgress } from './progress-store.ts';

// Global upload manager. One instance for the whole tab, so uploads
// keep running across client-side navigation. 3 files at a time, 4 parts in parallel per file.

const FILE_CONCURRENCY = 3;
const PART_CONCURRENCY = 4;
const SPEED_WINDOW_MS = 5000;

export type UploadStatus =
  | 'queued'
  | 'preparing'
  | 'uploading'
  | 'pausedUser'
  | 'pausedOffline'
  | 'pausedReload'
  | 'resuming'
  | 'completing'
  | 'completed'
  | 'failed'
  | 'cancelling'
  | 'cancelled';

const ACTIVE: UploadStatus[] = ['queued', 'preparing', 'uploading', 'resuming', 'completing'];
const FINISHED: UploadStatus[] = ['completed', 'failed', 'cancelled'];

class OfflineError extends Error {}
class AbortedError extends Error {}

export class UploadItem {
  readonly key = crypto.randomUUID();
  status = $state<UploadStatus>('queued');
  file = $state<File | null>(null);
  error = $state<string | null>(null);
  /** Bytes of parts still in flight. */
  inflightBytes = $state(0);
  /** Bytes per second over the last few seconds. */
  speed = $state(0);

  readonly name: string;
  readonly size: number;
  readonly lastModified: number;
  readonly contentType: string;
  readonly folderId: string;
  readonly folderName: string;

  sessionId: string | null = null;
  partSize = 0;
  partCount = 0;
  readonly done = new SvelteSet<number>();
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- XHR bookkeeping; progress is mirrored into `inflightBytes`
  readonly inflight = new Map<number, { xhr: XMLHttpRequest; loaded: number }>();
  samples: { at: number; bytes: number }[] = [];

  constructor(init: {
    name: string;
    size: number;
    lastModified: number;
    contentType: string;
    folderId: string;
    folderName: string;
    file?: File;
  }) {
    this.name = init.name;
    this.size = init.size;
    this.lastModified = init.lastModified;
    this.contentType = init.contentType;
    this.folderId = init.folderId;
    this.folderName = init.folderName;
    this.file = init.file ?? null;
  }

  partBytes(partNumber: number) {
    return Math.max(0, Math.min(this.partSize, this.size - (partNumber - 1) * this.partSize));
  }

  readonly doneBytes = $derived.by(() => {
    let total = 0;
    for (const n of this.done) total += this.partBytes(n);
    return total;
  });

  readonly uploadedBytes = $derived.by(() =>
    this.status === 'completed'
      ? this.size
      : Math.min(this.size, this.doneBytes + this.inflightBytes)
  );

  readonly progress = $derived.by(() => (this.size ? (this.uploadedBytes / this.size) * 100 : 100));

  /** Seconds left at the current speed, or null when unknown. */
  readonly secondsLeft = $derived.by(() =>
    this.speed > 0 ? Math.ceil((this.size - this.uploadedBytes) / this.speed) : null
  );

  readonly isActive = $derived.by(() => ACTIVE.includes(this.status));
  readonly isFinished = $derived.by(() => FINISHED.includes(this.status));
  readonly isPaused = $derived.by(
    () =>
      this.status === 'pausedUser' ||
      this.status === 'pausedOffline' ||
      this.status === 'pausedReload'
  );

  syncInflight() {
    let total = 0;
    for (const entry of this.inflight.values()) total += entry.loaded;
    this.inflightBytes = total;
  }
}

class UploadManager {
  readonly items = $state<UploadItem[]>([]);
  /** The upload dialog's target folder, or null when closed. */
  dialog = $state<{ folderId: string; folderName: string } | null>(null);

  readonly #running = new SvelteSet<string>();
  #restored = false;
  #ticker: ReturnType<typeof setInterval> | null = null;

  readonly hasActive = $derived.by(() => this.items.some((item) => item.isActive));
  readonly allFinished = $derived.by(() => this.items.every((item) => item.isFinished));

  add(files: File[], folder: { folderId: string; folderName: string }) {
    for (const file of files) {
      this.items.push(
        new UploadItem({
          name: file.name,
          size: file.size,
          lastModified: file.lastModified,
          contentType: file.type,
          folderId: folder.folderId,
          folderName: folder.folderName,
          file
        })
      );
    }
    this.#pump();
  }

  pause(item: UploadItem) {
    if (!['queued', 'preparing', 'uploading', 'resuming'].includes(item.status)) return;
    item.status = 'pausedUser';
    item.speed = 0;
    if (item.sessionId)
      void setUploadPaused({ sessionId: item.sessionId, paused: true }).catch(() => {});
  }

  resume(item: UploadItem) {
    if (item.status === 'pausedReload' && !item.file) return;
    if (!item.isPaused && item.status !== 'failed') return;
    item.error = null;
    item.status = 'resuming';
    this.#pump();
  }

  /**
   * After a reload the browser no longer has the file. The user picks it again; it must be the
   * same file (name, size, lastModified), then only the missing parts are sent.
   */
  attachFile(item: UploadItem, file: File) {
    if (
      file.name !== item.name ||
      file.size !== item.size ||
      file.lastModified !== item.lastModified
    ) {
      return `That is not the same file. Pick “${item.name}” (${item.size} bytes) again.`;
    }
    item.file = file;
    this.resume(item);
    return null;
  }

  async cancel(item: UploadItem) {
    if (item.isFinished || item.status === 'cancelling') return;
    item.status = 'cancelling';
    for (const { xhr } of item.inflight.values()) xhr.abort();
    try {
      if (item.sessionId) await abortUpload(item.sessionId);
    } catch {
      // The session may already be gone; either way nothing more is sent.
    }
    if (item.sessionId) await deleteProgress(item.sessionId);
    item.status = 'cancelled';
    item.speed = 0;
    this.#pump();
  }

  retry(item: UploadItem) {
    if (item.status === 'failed') this.resume(item);
  }

  /** Removes finished uploads from the panel. */
  dismissFinished() {
    const keep = this.items.filter((item) => !item.isFinished);
    this.items.splice(0, this.items.length, ...keep);
  }

  /** Called once per tab: unfinished uploads from before a reload come back paused. */
  async restore() {
    if (this.#restored) return;
    this.#restored = true;
    window.addEventListener('online', () => this.#onOnline());
    try {
      const [pending, local] = await Promise.all([getPendingUploads(), readAllProgress()]);
      for (const session of pending) {
        if (this.items.some((item) => item.sessionId === session.id)) continue;
        const item = new UploadItem({
          name: session.fileName,
          size: session.size,
          lastModified: session.lastModified,
          contentType: '',
          folderId: session.folderId,
          folderName: session.folderName
        });
        item.sessionId = session.id;
        item.partSize = session.partSize;
        item.partCount = session.partCount;
        for (const part of session.completedParts) item.done.add(part.partNumber);
        item.status = 'pausedReload';
        this.items.push(item);
      }
      // Local progress for sessions the server no longer knows about is stale.
      const known = new Set(pending.map((s) => s.id));
      for (const entry of local)
        if (!known.has(entry.sessionId)) void deleteProgress(entry.sessionId);
    } catch {
      // Not signed in or offline: nothing to restore.
    }
  }

  #onOnline() {
    for (const item of this.items) if (item.status === 'pausedOffline') this.resume(item);
  }

  #pump() {
    for (const item of this.items) {
      if (this.#running.size >= FILE_CONCURRENCY) break;
      if (this.#running.has(item.key) || !item.file) continue;
      if (item.status === 'queued' || item.status === 'resuming') {
        this.#running.add(item.key);
        void this.#run(item).finally(() => {
          this.#running.delete(item.key);
          this.#pump();
        });
      }
    }
    this.#syncTicker();
  }

  /** Samples progress once a second for speed and time left. */
  #syncTicker() {
    if (this.hasActive && !this.#ticker) {
      this.#ticker = setInterval(() => {
        const now = Date.now();
        for (const item of this.items) {
          if (item.status !== 'uploading') {
            item.samples = [];
            continue;
          }
          item.samples.push({ at: now, bytes: item.uploadedBytes });
          item.samples = item.samples.filter((s) => now - s.at <= SPEED_WINDOW_MS);
          const first = item.samples[0];
          const elapsed = (now - first.at) / 1000;
          item.speed = elapsed > 0 ? (item.uploadedBytes - first.bytes) / elapsed : 0;
        }
        if (!this.hasActive) this.#syncTicker();
      }, 1000);
    } else if (!this.hasActive && this.#ticker) {
      clearInterval(this.#ticker);
      this.#ticker = null;
    }
  }

  async #run(item: UploadItem) {
    const stillWanted = () => item.status === 'uploading' || item.status === 'preparing';
    try {
      if (!item.sessionId) {
        item.status = 'preparing';
        const started = await startUpload({
          folderId: item.folderId,
          fileName: item.name,
          size: item.size,
          lastModified: item.lastModified,
          contentType: item.contentType
        });
        item.sessionId = started.sessionId;
        item.partSize = started.partSize;
        item.partCount = started.partCount;
        await this.#save(item);
        if (!stillWanted()) return this.#afterStop(item);
      } else if (item.status === 'resuming') {
        await setUploadPaused({ sessionId: item.sessionId, paused: false });
      }

      item.status = 'uploading';
      const queue: number[] = [];
      for (let n = 1; n <= item.partCount; n++) if (!item.done.has(n)) queue.push(n);

      const workers = Array.from({ length: Math.min(PART_CONCURRENCY, queue.length) }, () =>
        this.#partWorker(item, queue)
      );
      const results = await Promise.allSettled(workers);
      const failure = results.find((r) => r.status === 'rejected');
      if (failure) throw (failure as PromiseRejectedResult).reason;
      if (item.status !== 'uploading') return this.#afterStop(item);

      item.status = 'completing';
      await completeUpload(item.sessionId!).updates(getFolderView);
      await deleteProgress(item.sessionId!);
      item.status = 'completed';
      item.speed = 0;
    } catch (cause) {
      if (item.status === 'cancelling' || item.status === 'cancelled') return;
      if (item.status === 'pausedUser') return;
      for (const { xhr } of item.inflight.values()) xhr.abort();
      item.inflight.clear();
      item.syncInflight();
      item.speed = 0;
      if (cause instanceof OfflineError || !navigator.onLine) {
        item.status = 'pausedOffline';
      } else if (!(cause instanceof AbortedError)) {
        item.status = 'failed';
        item.error = errorMessage(cause, 'The upload failed.');
      }
    }
  }

  #afterStop(item: UploadItem) {
    item.speed = 0;
  }

  async #partWorker(item: UploadItem, queue: number[]) {
    while (queue.length && item.status === 'uploading') {
      const partNumber = queue.shift()!;
      const url = await getPartUploadUrl({ sessionId: item.sessionId!, partNumber });
      if (item.status !== 'uploading' && item.status !== 'pausedUser') return;
      const etag = await this.#put(item, partNumber, url);
      await recordUploadedPart({ sessionId: item.sessionId!, partNumber, etag });
      item.done.add(partNumber);
      await this.#save(item);
    }
  }

  #put(item: UploadItem, partNumber: number, url: string) {
    return new Promise<string>((resolve, reject) => {
      const file = item.file;
      if (!file) return reject(new AbortedError());
      const start = (partNumber - 1) * item.partSize;
      const blob = file.slice(start, start + item.partSize);
      const xhr = new XMLHttpRequest();
      const entry = { xhr, loaded: 0 };
      item.inflight.set(partNumber, entry);

      const settle = () => {
        item.inflight.delete(partNumber);
        item.syncInflight();
      };
      xhr.upload.onprogress = (event) => {
        entry.loaded = event.loaded;
        item.syncInflight();
      };
      xhr.onload = () => {
        settle();
        if (xhr.status >= 200 && xhr.status < 300) {
          const etag = xhr.getResponseHeader('ETag');
          if (etag) resolve(etag);
          else
            reject(
              new Error('The storage did not return an ETag. Check the bucket CORS settings.')
            );
        } else {
          reject(new Error(`Storage rejected part ${partNumber} (HTTP ${xhr.status}).`));
        }
      };
      xhr.onerror = () => {
        settle();
        // A CORS rejection also lands here, so only call it offline when the browser agrees.
        if (!navigator.onLine) reject(new OfflineError('Network error'));
        else
          reject(
            new Error(
              'Could not reach the storage. Check your connection and the bucket CORS settings.'
            )
          );
      };
      xhr.onabort = () => {
        settle();
        reject(new AbortedError());
      };
      xhr.open('PUT', url);
      xhr.send(blob);
    });
  }

  #save(item: UploadItem) {
    if (!item.sessionId) return Promise.resolve();
    return saveProgress({
      sessionId: item.sessionId,
      name: item.name,
      size: item.size,
      lastModified: item.lastModified,
      folderId: item.folderId,
      parts: [...item.done]
    });
  }
}

export const uploads = new UploadManager();
