// Minimal shim so the app's existing window.storage.get/set calls
// keep working outside of the Claude artifact environment, backed by
// the browser's localStorage instead.

function scopedKey(key, shared) {
  return shared ? `shared:${key}` : `personal:${key}`;
}

const storage = {
  async get(key, shared = false) {
    const raw = localStorage.getItem(scopedKey(key, shared));
    if (raw === null) return null;
    return { key, value: raw, shared };
  },
  async set(key, value, shared = false) {
    localStorage.setItem(scopedKey(key, shared), value);
    return { key, value, shared };
  },
  async delete(key, shared = false) {
    localStorage.removeItem(scopedKey(key, shared));
    return { key, deleted: true, shared };
  },
  async list(prefix = "", shared = false) {
    const scopePrefix = shared ? "shared:" : "personal:";
    const keys = Object.keys(localStorage)
      .filter((k) => k.startsWith(scopePrefix))
      .map((k) => k.slice(scopePrefix.length))
      .filter((k) => k.startsWith(prefix));
    return { keys, prefix, shared };
  },
};

if (typeof window !== "undefined") {
  window.storage = storage;
}

export default storage;
