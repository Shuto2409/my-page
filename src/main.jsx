import "./storage.js";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// If this page was opened via a "connect this device" link (?sync=...),
// decode the embedded Supabase config and save it before the app mounts,
// so the very first data fetch already uses it. Then strip the param from
// the URL bar so the credentials don't linger in history/bookmarks.
(function applySyncLinkIfPresent() {
  try {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("sync");
    if (encoded) {
      const decoded = JSON.parse(atob(decodeURIComponent(encoded)));
      if (decoded && decoded.url && decoded.key) {
        window.storage.setSyncConfig({ url: decoded.url, key: decoded.key });
      }
      params.delete("sync");
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
      window.history.replaceState({}, "", newUrl);
    }
  } catch (e) {
    // malformed link; ignore and continue with whatever config already exists
  }
})();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
