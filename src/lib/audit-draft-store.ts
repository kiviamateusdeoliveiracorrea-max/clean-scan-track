const DB = "audit-local-drafts";
async function openDB() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function draftStore(key: string, action: "read" | "write" | "delete", value?: unknown): Promise<any> {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("drafts", action === "read" ? "readonly" : "readwrite");
      const store = tx.objectStore("drafts");
      const request = action === "read" ? store.get(key) : action === "delete" ? store.delete(key) : store.put(value, key);
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}