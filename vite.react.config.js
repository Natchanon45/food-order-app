import { copyFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const reactOutDir = fileURLToPath(new URL("./public/react", import.meta.url));
const hostingPublicDir = fileURLToPath(new URL("./public", import.meta.url));
const canonicalSuperAdminEntries = [
  "./public/platform/index.html",
  "./public/platform/owners/index.html",
  "./public/platform/contact/index.html",
  "./public/platform/pricing/index.html",
  "./public/admin/tenants/index.html",
  "./public/super-admin/saas-setup/index.html",
].map(path => fileURLToPath(new URL(path, import.meta.url)));

function syncCanonicalSuperAdminEntries() {
  const source = fileURLToPath(new URL("./public/react/index.html", import.meta.url));
  canonicalSuperAdminEntries.forEach(destination => {
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
  });
}

export default defineConfig(({ command }) => ({
  root: fileURLToPath(new URL("./react-app", import.meta.url)),
  // Production Hosting serves /react/assets; Dev Vite must serve canonical
  // routes /login, /platform, / and the complete /react/parity CSS tree.
  // Vite's /react/ base otherwise redirects / -> /react/, while main.jsx
  // deliberately redirects /react/ -> / (an unstyled entry/redirect loop).
  base: command === "serve" ? "/" : "/react/",
  // Dev uses the same shared CSS/fonts/icons as canonical Hosting routes.
  // Build still uses react-app/public and retains all existing output paths.
  publicDir: command === "serve" ? hostingPublicDir : undefined,
  plugins: [
    react(),
    {
      name: "sync-canonical-super-admin-entrypoints",
      closeBundle: syncCanonicalSuperAdminEntries,
    },
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./react-app/src", import.meta.url)) } },
  build: {
    outDir: reactOutDir,
    // Keep previous hashed bundles so an already-open tab never requests a
    // just-deleted entry chunk while Firebase Hosting Emulator is rebuilding.
    emptyOutDir: false,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/@firebase/") || id.includes("/node_modules/firebase/")) return "firebase";
          if (id.includes("/node_modules/react") || id.includes("/node_modules/react-router")) return "react-vendor";
        },
      },
    },
  },
  server: { host: "0.0.0.0", port: 5174, strictPort: true },
  preview: { host: "0.0.0.0", port: 4174 },
}));
