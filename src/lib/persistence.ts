export type StorageAccess = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function protectedKey(key: string) {
  return key === "morrow.sessions" || key === "morrow.reportArchive";
}

function parseValue<T>(key: string, raw: string): T {
  const value = JSON.parse(raw);
  if (key === "morrow.sessions" && !Array.isArray(value)) throw new Error("Invalid session history");
  if (key === "morrow.reportArchive" && (value?.version !== 1 || !value.days || typeof value.days !== "object")) throw new Error("Invalid report archive");
  return value as T;
}

export function readPersistentValue<T>(storage: StorageAccess, key: string, initial: T) {
  let readFailed = false;
  try {
    const raw = storage.getItem(key);
    if (raw !== null) return { value: parseValue<T>(key, raw), recovered: false, readFailed: false };
  } catch { readFailed = true; }
  if (protectedKey(key)) {
    try {
      const backup = storage.getItem(`${key}.backup`);
      if (backup !== null) return { value: parseValue<T>(key, backup), recovered: true, readFailed: false };
    } catch { readFailed = true; }
  }
  return { value: initial, recovered: false, readFailed };
}

export function writePersistentValue<T>(storage: StorageAccess, key: string, value: T, changed = true) {
  if (!changed) return;
  const raw = JSON.stringify(value);
  // Keep an unreadable source for recovery instead of destroying the only copy.
  if (protectedKey(key)) {
    const previous = storage.getItem(key);
    if (previous !== null) {
      try { parseValue(key, previous); }
      catch { if (storage.getItem(`${key}.unreadable`) === null) storage.setItem(`${key}.unreadable`, previous); }
    }
  }
  storage.setItem(key, raw);
  if (protectedKey(key)) {
    storage.setItem(`${key}.backup`, raw);
    const cleared = key === "morrow.sessions" ? Array.isArray(value) && value.length === 0
      : Object.keys((value as { days: object }).days).length === 0;
    if (cleared) storage.removeItem(`${key}.unreadable`);
  }
}

export function seedPersistentRecovery(storage: StorageAccess, key: string) {
  if (!protectedKey(key)) return;
  const raw = storage.getItem(key);
  if (raw === null) return;
  parseValue(key, raw);
  const backup = storage.getItem(`${key}.backup`);
  if (backup === null) storage.setItem(`${key}.backup`, raw);
}
