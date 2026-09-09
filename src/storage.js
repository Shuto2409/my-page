// Storage shim used by the app's window.storage.get/set/delete/list calls.
//
// By default everything is stored in the browser's localStorage (single
// device only). If the person connects a free Supabase project (see the
// in-app "sync" settings), every write is also sent to a small key-value
// table there, and reads prefer the cloud copy when it's reachable. That's
// what makes the same data show up on a second device: both devices point
// at the same Supabase project.

const CONFIG_KEY = "pd_sync_config";

function scopedKey(key, shared) {
  return shared ? `shared:${key}` : `personal:${key}`;
}

function getConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setConfig(cfg) {
  if (cfg) localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  else localStorage.removeItem(CONFIG_KEY);
}

function cleanUrl(url) {
  return (url || "").trim().replace(/\/+$/, "");
}

async function supaFetch(cfg, path, options = {}) {
  const res = await fetch(`${cleanUrl(cfg.url)}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase ${res.status}: ${text.slice(0, 200)}`);
  }
  return res;
}

const storage = {
  async get(key, shared = false) {
    const sk = scopedKey(key, shared);
    const cfg = getConfig();
    if (cfg) {
      try {
        const res = await supaFetch(cfg, `dashboard_kv?key=eq.${encodeURIComponent(sk)}&select=value`);
        const rows = await res.json();
        if (rows && rows.length > 0) {
          localStorage.setItem(sk, rows[0].value);
          return { key, value: rows[0].value, shared };
        }
      } catch (e) {
        // offline or misconfigured: fall through to the local cache below
      }
    }
    const raw = localStorage.getItem(sk);
    if (raw === null) return null;
    return { key, value: raw, shared };
  },

  async set(key, value, shared = false) {
    const sk = scopedKey(key, shared);
    localStorage.setItem(sk, value);
    const cfg = getConfig();
    if (cfg) {
      try {
        await supaFetch(cfg, `dashboard_kv?on_conflict=key`, {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify([{ key: sk, value, updated_at: new Date().toISOString() }]),
        });
      } catch (e) {
        // offline: the local save above already succeeded
      }
    }
    return { key, value, shared };
  },

  async delete(key, shared = false) {
    const sk = scopedKey(key, shared);
    localStorage.removeItem(sk);
    const cfg = getConfig();
    if (cfg) {
      try {
        await supaFetch(cfg, `dashboard_kv?key=eq.${encodeURIComponent(sk)}`, { method: "DELETE" });
      } catch (e) {
        // offline: local delete above already succeeded
      }
    }
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

  // --- extras used by the in-app sync settings panel (not part of the
  // standard window.storage interface) ---
  getSyncConfig() {
    return getConfig();
  },
  setSyncConfig(cfg) {
    setConfig(cfg);
  },
  async testSyncConfig(cfg) {
    // A read-only check isn't enough: a table with Row Level Security left
    // enabled (no policies) still returns success on SELECT but silently
    // fails on INSERT/UPDATE. Actually try a harmless write so permission
    // problems are caught here instead of on every real save.
    await supaFetch(cfg, "dashboard_kv?on_conflict=key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify([{ key: "__connection_test__", value: "ok", updated_at: new Date().toISOString() }]),
    });
    return true;
  },
  async pushAllLocalToCloud(cfg) {
    const items = [];
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("personal:") || k.startsWith("shared:")) {
        items.push({ key: k, value: localStorage.getItem(k), updated_at: new Date().toISOString() });
      }
    }
    if (items.length === 0) return 0;
    await supaFetch(cfg, "dashboard_kv?on_conflict=key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(items),
    });
    return items.length;
  },
};

if (typeof window !== "undefined") {
  window.storage = storage;
}

export default storage;
