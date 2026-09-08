import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: if you deploy to https://<username>.github.io/<repo-name>/
// set base to "/<repo-name>/" (with slashes on both sides).
// If you deploy to https://<username>.github.io/ (a user/org page repo
// literally named <username>.github.io), leave base as "/".
export default defineConfig({
  plugins: [react()],
  base: "/my-page/",
});
