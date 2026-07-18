import { openDB } from "idb";

const DB_NAME = "cratepro";

const dbPromise = openDB(DB_NAME, 2, {
  upgrade(db) {
    if (!db.objectStoreNames.contains("jobs")) {
      db.createObjectStore("jobs");
    }

    if (!db.objectStoreNames.contains("photos")) {
      db.createObjectStore("photos");
    }
  },
});

export async function saveJobs(jobs) {
  const db = await dbPromise;
  await db.put("jobs", jobs, "all-jobs");
}

export async function loadJobs() {
  const db = await dbPromise;
  return (await db.get("jobs", "all-jobs")) || [];
}

export async function savePhoto(id, data) {
  const db = await dbPromise;
  await db.put("photos", data, id);
}

export async function loadPhoto(id) {
  const db = await dbPromise;
  return await db.get("photos", id);
}