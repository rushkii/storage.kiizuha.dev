// Upload progress in IndexedDB. The server's
// `upload_session.completedParts` is the source of truth; this is the browser's own record, so a
// reload can tell which sessions it started. Every call fails soft: no IndexedDB, no record.

export type StoredProgress = {
  sessionId: string;
  name: string;
  size: number;
  lastModified: number;
  folderId: string;
  parts: number[];
};

const DB_NAME = 'storage-uploads';
const STORE = 'progress';

let opening: Promise<IDBDatabase | null> | null = null;

const open = () => {
  opening ??= new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'sessionId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  return opening;
};

const run = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> => {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
};

/** Saves or replaces the record for `entry.sessionId`. */
export const saveProgress = async (entry: StoredProgress) => {
  await run('readwrite', (store) => store.put(entry));
};

/** Removes a session's record, after it completes or is cancelled. */
export const deleteProgress = async (sessionId: string) => {
  await run('readwrite', (store) => store.delete(sessionId));
};

/** Every stored record, or an empty list when IndexedDB is unavailable. */
export const readAllProgress = async (): Promise<StoredProgress[]> =>
  ((await run('readonly', (store) => store.getAll())) as StoredProgress[] | null) ?? [];
