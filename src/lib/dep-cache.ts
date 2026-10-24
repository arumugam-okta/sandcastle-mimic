// Mimic containers live in memory, so every Run starts empty. Keep the installed
// node_modules as a tar in IndexedDB, keyed by the package.json it was built from.
const DB = "sandcastle";
const STORE = "node_modules";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>) {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheKey(packageJson: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(packageJson));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const getCached = (key: string) => tx<Uint8Array | undefined>("readonly", (s) => s.get(key));
export const putCached = (key: string, tar: Uint8Array) => tx("readwrite", (s) => s.put(tar, key));
