#!/usr/bin/env node
/**
 * READ-ONLY Firestore billing inventory for manual legacy cutover review.
 * No set/update/delete, no sign-up changes, no Firebase deployment.
 *
 * Requirements: functions/node_modules installed, application-default
 * Google credentials with Firestore read permission, explicit --project.
 * Save reports OUTSIDE the Git working tree; they contain financial metadata.
 */
import fs from "node:fs/promises";
import { resolve, dirname, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { analyzeTenant } from "./billing-anniversary-audit-core.mjs";

const require = createRequire(new URL("../functions/package.json", import.meta.url));
const repoRoot = resolve(new URL("..", import.meta.url).pathname);
function argsFrom(argv) {
  const parsed = {};
  const recognized = new Set(["project", "out", "max-tenants", "payments-limit", "tenant"]);
  for (let i = 0; i < argv.length; i += 2) {
    if (!String(argv[i]).startsWith("--") || i + 1 >= argv.length) {
      throw new Error("Expected --project ID --out PATH [--max-tenants N] [--payments-limit N] [--tenant ID]");
    }
    const key = argv[i].slice(2);
    if (!recognized.has(key) || parsed[key]) throw new Error("Invalid or repeated argument: " + key);
    parsed[key] = argv[i + 1];
  }
  if (!/^[a-z][a-z0-9-]{2,50}$/.test(parsed.project || "")) throw new Error("--project is required");
  if (!parsed.out || !String(parsed.out).endsWith(".json")) throw new Error("--out must name a .json file");
  const out = resolve(parsed.out);
  if (out === repoRoot || out.startsWith(repoRoot + sep)) throw new Error("Save financial audit outside repository");
  const max = Number(parsed["max-tenants"] || 500);
  const limit = Number(parsed["payments-limit"] || 200);
  if (!Number.isSafeInteger(max) || max < 1 || max > 2000) throw new Error("--max-tenants must be 1..2000");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new Error("--payments-limit must be 1..500");
  if (parsed.tenant && !/^[a-zA-Z0-9_-]{3,160}$/.test(parsed.tenant)) throw new Error("Invalid tenant id");
  return { project: parsed.project, out, max, limit, tenantId: parsed.tenant || "" };
}
async function run(argv = process.argv.slice(2)) {
  const { project, out, max, limit, tenantId } = argsFrom(argv);
  // Require scoped credentials (ADC or GOOGLE_APPLICATION_CREDENTIALS),
  // never service account JSON copied into repository.
  const { initializeApp, applicationDefault, getApps } = require("firebase-admin/app");
  const { getFirestore } = require("firebase-admin/firestore");
  if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: project });
  const db = getFirestore();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map(p => [p.type, p.value]));
  const asOf = parts.year + "-" + parts.month + "-" + parts.day;
  let docs, tenantsTruncated = false;
  if (tenantId) {
    const doc = await db.collection("tenants").doc(tenantId).get();
    docs = doc.exists ? [doc] : [];
  } else {
    const snapshot = await db.collection("tenants").orderBy("__name__").limit(max + 1).get();
    tenantsTruncated = snapshot.size > max;
    docs = snapshot.docs.slice(0, max);
  }
  const tenants = [];
  for (const doc of docs) {
    const tenant = doc.data() || {};
    const paymentsRef = doc.ref.collection("revenueSharePayments");
    const paymentDocs = await paymentsRef.orderBy("createdAt", "desc").limit(limit + 1).get();
    const paymentsCapped = paymentDocs.size > limit;
    const payments = paymentDocs.docs.slice(0, limit)
      .map(payment => ({ id: payment.id, ...(payment.data() || {}) }));
    tenants.push(analyzeTenant(doc.id, tenant, payments, asOf, paymentsCapped));
  }
  const flagged = tenants.filter(t => t.riskFlags.length);
  const flagTotals = {};
  for (const row of tenants) for (const key of row.riskFlags) flagTotals[key] = (flagTotals[key] || 0) + 1;
  const result = {
    format: "penguin-anniversary-inventory-v1",
    generatedAt: new Date().toISOString(), asOfBangkok: asOf,
    firestoreProject: project, tenantCountInspected: tenants.length,
    tenantScanTruncated: tenantsTruncated, flaggedTenants: flagged.length,
    riskFlagTotals: flagTotals,
    WARNING: "READ-ONLY INVENTORY. NOT AN INVOICE, NOT APPROVAL TO MIGRATE. Payments inspected are bounded; independently verify all historic invoice periods before cutover.",
    tenants,
  };
  await fs.mkdir(dirname(out), { recursive: true });
  await fs.writeFile(out, JSON.stringify(result, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log("Firestore billing audit (READ ONLY):", result.tenantCountInspected, "tenants;");
  console.log(result.flaggedTenants, "require review;", "history incomplete:", tenantsTruncated || tenants.some(t => t.riskFlags.includes("payment_history_scan_truncated")));
  console.log("Saved locally:", out);
  console.log("No Firestore writes or Firebase deployments were performed.");
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  run().catch(err => {
    console.error("Billing audit failed:", err.message);
    process.exitCode = 1;
  });
}
export { argsFrom };
