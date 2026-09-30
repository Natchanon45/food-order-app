import { copyFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const reactOutDir = fileURLToPath(new URL("./public/react", import.meta.url));
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

export default defineConfig({
  root: fileURLToPath(new URL("./react-app", import.meta.url)),
  base: "/react/",
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
  server: { host: "0.0.0.0", port: 5174 },
  preview: { host: "0.0.0.0", port: 4174 },
});
