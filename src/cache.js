// Remembers the last result of each list so screens can show it at once
// and refresh quietly in the background. Kept for this browser tab only.

const memory = new Map();
const PREFIX = 'expoapp.cache.';

export function readCache(key) {
  if (memory.has(key)) return memory.get(key);
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (raw) {
      const value = JSON.parse(raw);
      memory.set(key, value);
      return value;
    }
  } catch {
    // Unreadable or storage unavailable: treat as nothing cached.
  }
  return null;
}

export function writeCache(key, value) {
  memory.set(key, value);
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Too large for tab storage: the in-memory copy still serves this visit.
  }
}

export function clearCache() {
  memory.clear();
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // Nothing to clear.
  }
}
