import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(fs.readFileSync(path.join(root, "react-app/migration/master-registry.json"), "utf8"));

function walk(dir, rows = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, rows);
    else rows.push(full);
  }
  return rows;
}

function htmlRoute(file) {
  const rel = path.relative(path.join(root, "public"), file).split(path.sep).join("/");
  if (rel === "index.html") return "/";
  const dir = path.posix.dirname(rel);
  return "/" + dir;
}

const registryRoutes = new Set(registry.routes.map(item => item.route));
const htmlRoutes = walk(path.join(root, "public"))
  .filter(file => file.endsWith("/index.html") || file.endsWith("\\index.html"))
  .filter(file => !file.includes(path.join("public", "react") + path.sep))
  .map(htmlRoute);

for (const route of htmlRoutes) {
  if (!registryRoutes.has(route)) {
    throw new Error("LEGACY_HTML_ROUTE_NOT_IN_REACT_REGISTRY: " + route);
  }
}

for (const required of [
  "/",
  "/cashier",
  "/cashier/quick-order",
  "/cashier/receipt",
  "/cashier/table-qr",
  "/cashier/waiting-queue",
  "/kitchen",
  "/delivery",
  "/takeaway",
  "/order",
  "/admin",
  "/platform",
  "/pos",
  "/pos/backup",
  "/pos/products",
  "/pos/catalog",
  "/pos/customer-display",
  "/pos/customers",
  "/pos/payables",
  "/pos/purchases",
  "/pos/returns",
  "/pos/sales",
  "/pos/settings",
  "/pos/shifts",
  "/pos/stock-counts",
  "/pos/stock-movements",
  "/pos/suppliers",
  "/pos/tax-invoice",
  "/pos/tax-invoices",
  "/pos/users",
]) {
  if (!registryRoutes.has(required)) {
    throw new Error("REQUIRED_REACT_ROUTE_MISSING: " + required);
  }
}

if (registry.policy?.uiParity !== "1:1") throw new Error("UI_PARITY_POLICY_MUST_BE_1_TO_1");
if (registry.policy?.redesignAllowed !== false) throw new Error("REDESIGN_MUST_BE_DISABLED");
if (registry.policy?.replaceLegacyHtmlJs !== true) throw new Error("LEGACY_REPLACEMENT_POLICY_REQUIRED");
if (registry.policy?.firebaseHostingRequired !== true) throw new Error("FIREBASE_HOSTING_REQUIRED");
if (registry.policy?.preserveExistingUrls !== true) throw new Error("EXISTING_URLS_MUST_BE_PRESERVED");

for (const item of registry.routes) {
  if (item.target !== "react") throw new Error("NON_REACT_TARGET_FOUND: " + item.route);
}

const posCount = registry.routes.filter(item => item.group === "pos").length;
if (posCount !== 21) throw new Error("POS_ROUTE_COUNT_CHANGED: " + posCount);

console.log("React migration coverage: PASS");
console.log("Routes:", registry.routes.length, "| POS:", posCount, "| Legacy HTML:", htmlRoutes.length);
