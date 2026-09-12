// IndexedDB wrapper — all app data lives here, on-device only.
const DB_NAME = "simple_cc";
const DB_VERSION = 1;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("logEntries")) {
        const store = db.createObjectStore("logEntries", { keyPath: "id" });
        store.createIndex("by_date", "date");
      }
      if (!db.objectStoreNames.contains("customFoods")) {
        db.createObjectStore("customFoods", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("recipes")) {
        db.createObjectStore("recipes", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("cachedFoods")) {
        db.createObjectStore("cachedFoods", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(storeName, mode) {
  const db = await openDb();
  return db.transaction(storeName, mode).objectStore(storeName);
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const db = {
  async get(storeName, key) {
    const store = await tx(storeName, "readonly");
    return reqToPromise(store.get(key));
  },

  async getAll(storeName) {
    const store = await tx(storeName, "readonly");
    return reqToPromise(store.getAll());
  },

  async getAllByIndex(storeName, indexName, value) {
    const store = await tx(storeName, "readonly");
    return reqToPromise(store.index(indexName).getAll(value));
  },

  async put(storeName, value) {
    const store = await tx(storeName, "readwrite");
    return reqToPromise(store.put(value));
  },

  async delete(storeName, key) {
    const store = await tx(storeName, "readwrite");
    return reqToPromise(store.delete(key));
  },
};

export async function getSetting(key, fallback) {
  const row = await db.get("settings", key);
  return row ? row.value : fallback;
}

export async function setSetting(key, value) {
  await db.put("settings", { key, value });
}
