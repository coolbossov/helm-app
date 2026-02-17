const DB_NAME = "sapd-offline";
const DB_VERSION = 1;

const STORES = ["contacts", "contact_details", "routes", "route_details", "offline_queue"] as const;
type StoreName = typeof STORES[number];

let db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const database = (e.target as IDBOpenDBRequest).result;
      for (const store of STORES) {
        if (!database.objectStoreNames.contains(store)) {
          database.createObjectStore(store, { keyPath: "id" });
        }
      }
    };
    request.onsuccess = (e) => {
      db = (e.target as IDBOpenDBRequest).result;
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function cacheSet<T extends { id: string | number }>(
  store: StoreName,
  data: T[]
): Promise<void> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, "readwrite");
    const s = tx.objectStore(store);
    for (const item of data) s.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function cacheGet<T>(store: StoreName): Promise<T[]> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, "readonly");
    const request = tx.objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

export async function cacheGetOne<T>(store: StoreName, id: string): Promise<T | undefined> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, "readonly");
    const request = tx.objectStore(store).get(id);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function queueMutation(mutation: {
  id: string;
  method: string;
  url: string;
  body: unknown;
}): Promise<void> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("offline_queue", "readwrite");
    tx.objectStore("offline_queue").put(mutation);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueue(): Promise<Array<{ id: string; method: string; url: string; body: unknown }>> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("offline_queue", "readonly");
    const request = tx.objectStore("offline_queue").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function removeFromQueue(id: string): Promise<void> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("offline_queue", "readwrite");
    tx.objectStore("offline_queue").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
