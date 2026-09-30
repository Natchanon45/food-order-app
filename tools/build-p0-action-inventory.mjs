import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MASTER = "/Users/natchanonsripleng/Desktop/Sites/food-order-app-php80";
const registryPath = path.join(ROOT, "react-app/migration/master-registry.json");
const matrixPath = path.join(ROOT, "react-app/migration/parity-verification-matrix.json");
const appPath = path.join(ROOT, "react-app/src/app/App.jsx");

const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const matrix = JSON.parse(fs.readFileSync(matrixPath, "utf8"));
const app = fs.readFileSync(appPath, "utf8");

const imports = new Map();
for (const match of app.matchAll(/import\s+\{\s*([A-Za-z0-9_]+)\s*\}\s+from\s+"@\/pages\/([^"]+)";/g)) {
  imports.set(match[1], `react-app/src/pages/${match[2]}.jsx`);
}
const routeComponents = new Map();
for (const match of app.matchAll(/<Route\s+path="([^"]+)"\s+element=\{<([A-Za-z0-9_]+)\s*\/>\}\s*\/>/g)) {
  routeComponents.set(match[1], match[2]);
}

const MASTER_SOURCE_ALIASES = Object.freeze({
  "/admin/revenue-share": { laravelView: "migrated.admin__revenue_share", canonicalRoute: "/reports/revenue-share" },
  "/cashier/waiting-queue": { publicPath: "public/waiting-queue/index.html", canonicalRoute: "/waiting-queue" },
});

const publicFallback = route => {
  const alias = MASTER_SOURCE_ALIASES[route];
  if (alias?.publicPath) {
    const aliased = path.join(MASTER, alias.publicPath);
    if (fs.existsSync(aliased)) return aliased;
  }
  const clean = route.replace(/^\//, "");
  const masterCandidate = path.join(MASTER, "public", clean, "index.html");
  if (fs.existsSync(masterCandidate)) return masterCandidate;
  const localCandidate = path.join(ROOT, "public", clean, "index.html");
  return fs.existsSync(localCandidate) ? localCandidate : null;
};

const bladePath = laravelView => {
  if (!laravelView) return null;
  const name = laravelView.replace(/^migrated\./, "");
  const candidate = path.join(MASTER, "resources/views/migrated", `${name}.blade.php`);
  return fs.existsSync(candidate) ? candidate : null;
};

const strip = value => String(value || "")
  .replace(/<[^>]*>/g, " ")
  .replace(/\{\{[\s\S]*?\}\}/g, " ")
  .replace(/\{[^{}]*\}/g, " ")
  .replace(/&[a-zA-Z0-9#]+;/g, " ")
  .replace(/\s+/g, " ")
  .trim();

function attrsMap(raw = "") {
  const out = {};
  for (const m of raw.matchAll(/([:@A-Za-z0-9_\-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g)) {
    out[m[1]] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return out;
}

function translationKey(value = "") {
  const text = String(value || "");
  const patterns = [
    /\bt\(\s*["']([^"']+)["']/,
    /\b__\(\s*["']([^"']+)["']/,
    /\btrans\(\s*["']([^"']+)["']/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return "";
}

function semanticDataAction(attrs = {}, rawAttrs = "") {
  const patterns = [
    /^data-(?:queue-action|subscription-action|review-(?:approve|reject|view-slip)|delete-tenant|edit-tenant|share-tenant|unlock-revenue-share)$/i,
    /^data-(?:lalamove-(?:cancel|quote|refresh|place|approval|wallet)|wallet-(?:topup-)?(?:approve|reject|view-slip)|payment-id|table-payment|pickup-(?:call|done)|walkin-assign)$/i,
    /^data-(?:open|close|save|delete|edit|print|copy|submit|action)(?:-|$)/i,
    /^data-[a-z0-9-]*(?:action|delete|edit|print|copy|save|open|close)[a-z0-9-]*$/i,
  ];
  const keys = [
    ...Object.keys(attrs),
    ...[...String(rawAttrs || "").matchAll(/\b(data-[A-Za-z0-9_-]+)\b/g)].map(match => match[1]),
  ];
  for (const pattern of patterns) {
    const key = keys.find(item => pattern.test(item));
    if (key) return key;
  }
  return "";
}

function semanticNavigation(rawAttrs = "") {
  const raw = String(rawAttrs || "");
  if (raw.includes('href="/s/${encodeURIComponent(tenant.slug') || raw.includes("href=\'/s/${encodeURIComponent(tenant.slug")) {
    return "route:tenant-storefront";
  }
  return "";
}

function extractActions(source = "", kind = "html") {
  const actions = [];
  const tagRe = /<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let index = 0;
  for (const match of source.matchAll(tagRe)) {
    const tag = match[1].toLowerCase();
    const attrs = attrsMap(match[2]);
    const inner = match[3];
    const cls = attrs.class || attrs.className || "";
    if (tag === "a" && !/\bbtn\b|menu|nav|action|link|card/i.test(cls) && !attrs.id && !attrs.href && !attrs.to) continue;
    const rawAttrs = match[2];
    const labelKey = translationKey(inner) || translationKey(rawAttrs) || translationKey(attrs["aria-label"]) || translationKey(attrs.title);
    const visibleLabel = strip(inner);
    const semanticAction = semanticDataAction(attrs, rawAttrs);
    const navigation = semanticNavigation(rawAttrs);
    const meaningfulVisible = /[\p{L}\p{N}]/u.test(visibleLabel) && !visibleLabel.includes("${") ? visibleLabel : "";
    const label = labelKey || meaningfulVisible || attrs["aria-label"] || attrs.title || attrs.id || semanticAction || navigation || `${tag}-${index+1}`;
    const stable = attrs.id
      || semanticAction
      || navigation
      || (labelKey ? `t:${labelKey}` : "")
      || attrs.href || attrs.to || `${tag}-${index+1}`;
    actions.push({
      id: String(stable).slice(0, 180),
      label: String(label).slice(0, 180),
      labelKey: labelKey || null,
      actionAttribute: semanticAction || null,
      navigation: navigation || null,
      element: tag,
      href: attrs.href || attrs.to || null,
      classes: String(cls).slice(0, 220),
      sourceKind: kind,
    });
    index += 1;
  }
  return actions;
}

const MASTER_INFRASTRUCTURE_SCRIPTS = new Set([
  "page-guard.js",
  "sweet-dialog.js",
  "locale-switcher.js",
  "retail-toast-status.js",
  "waiting-queue-i18n.js",
  "waiting-queue-print-i18n.js",
  "order-completion-finalizer.js",
]);

function masterScriptFiles(source = "") {
  const files = [];
  for (const match of source.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    const raw = String(match[1] || "").trim();
    const pathname = raw.split("?")[0];
    if (!pathname.startsWith("/assets/js/")) continue;
    const candidate = path.join(MASTER, "public", pathname.replace(/^\//, ""));
    if (MASTER_INFRASTRUCTURE_SCRIPTS.has(path.basename(candidate))) continue;
    if (fs.existsSync(candidate)) files.push(candidate);
  }
  return [...new Set(files)];
}

function dedupe(actions) {
  const seen = new Set();
  return actions.filter(action => {
    const key = `${action.element}|${action.id}|${action.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const p0 = registry.routes.filter(route => {
  const rec = matrix.routes.find(x => x.route === route.route);
  return rec?.priority === "P0";
});

const report = [];
for (const item of p0) {
  const sourceAlias = MASTER_SOURCE_ALIASES[item.route] || null;
  const masterView = bladePath(sourceAlias?.laravelView || item.laravelView);
  const fallback = masterView ? null : publicFallback(item.route);
  const masterFile = masterView || fallback;
  const masterSource = masterFile ? fs.readFileSync(masterFile, "utf8") : "";
  const masterScripts = masterScriptFiles(masterSource);
  const masterActions = dedupe([
    ...extractActions(masterSource, masterView ? "laravel_blade" : "legacy_html"),
    ...masterScripts.flatMap(script => extractActions(fs.readFileSync(script, "utf8"), "laravel_js")),
  ]);

  const component = routeComponents.get(item.route) || null;
  const reactRel = component ? imports.get(component) || null : null;
  const reactFile = reactRel ? path.join(ROOT, reactRel) : null;
  const reactSource = reactFile && fs.existsSync(reactFile) ? fs.readFileSync(reactFile, "utf8") : "";
  const reactActions = dedupe(extractActions(reactSource, "react_jsx"));

  const record = matrix.routes.find(x => x.route === item.route);
  const existingActions = new Map((record.actionInventory || []).map(action => [`${action.id}|${action.label}`, action]));
  record.actionInventory = masterActions.map((action, i) => {
    const base = {
      id: action.id || `master-action-${i+1}`,
      label: action.label,
      actorRole: "pending",
      precondition: "pending",
      masterBehavior: "pending",
      reactBehavior: "pending",
      expectedUiResult: "pending",
      expectedDataMutation: "pending",
      failureBehavior: "pending",
      browserCoverage: "pending",
      dataVerification: "pending",
      inventorySource: action.sourceKind,
      labelKey: action.labelKey || null,
      actionAttribute: action.actionAttribute || null,
      navigation: action.navigation || null,
    };
    return {
      ...base,
      ...(existingActions.get(`${base.id}|${base.label}`) || {}),
      inventorySource: action.sourceKind,
      labelKey: action.labelKey || null,
      actionAttribute: action.actionAttribute || null,
      navigation: action.navigation || null,
    };
  });
  record.notes = Array.isArray(record.notes) ? record.notes.filter(note => !String(note).startsWith("STATIC_INVENTORY:")) : [];
  record.notes.push(`STATIC_INVENTORY: master=${masterActions.length}, react=${reactActions.length}, reactRoute=${component ? "yes" : "no"}`);
  if (sourceAlias?.canonicalRoute) record.notes.push(`STATIC_INVENTORY: MASTER canonical source is ${sourceAlias.canonicalRoute}.`);
  if (!component) record.notes.push("STATIC_INVENTORY: React App route is missing.");
  if (!masterFile) record.notes.push("STATIC_INVENTORY: MASTER/legacy source file was not resolved.");

  report.push({
    route: item.route,
    masterFile: masterFile ? path.relative(MASTER, masterFile).replace(/^\.\.\//, "") : null,
    reactComponent: component,
    reactFile: reactRel,
    masterActionCount: masterActions.length,
    masterScripts: masterScripts.map(file => path.relative(MASTER, file)),
    reactActionCount: reactActions.length,
    reactRoutePresent: Boolean(component),
    masterActions,
    reactActions,
  });
}

fs.writeFileSync(matrixPath, JSON.stringify(matrix, null, 2) + "\n");
fs.writeFileSync(
  path.join(ROOT, "react-app/migration/p0-static-action-inventory.json"),
  JSON.stringify({ generatedAt: "2026-09-29", routes: report }, null, 2) + "\n",
);

console.log("P0 static action inventory generated");
for (const row of report) {
  console.log(`${row.route}: MASTER ${row.masterActionCount} | React ${row.reactActionCount} | route ${row.reactRoutePresent ? "yes" : "MISSING"}`);
}
