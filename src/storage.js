import { openDB } from "idb";

const DB_NAME = "cratepro";
const STORE_NAME = "jobs";

const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME);
    }
  },
});

export async function saveJobs(jobs) {
  const db = await dbPromise;
  await db.put(STORE_NAME, jobs, "all-jobs");
}

export async function loadJobs() {
  const db = await dbPromise;
  return (await db.get(STORE_NAME, "all-jobs")) || [];
}