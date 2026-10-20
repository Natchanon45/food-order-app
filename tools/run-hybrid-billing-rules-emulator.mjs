#!/usr/bin/env node
// TEMPORARY rules candidate only: never modify the checked-in Production rules.
// Synthetic Firebase Auth + Firestore emulator test, localhost and demo project.
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT = "demo-penguin-hybrid-rules-uat";
if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST
  || !PROJECT.startsWith("demo-")) {
  throw new Error("HYBRID_RULES_EMULATOR_ISOLATION_REQUIRED");
}
const before = readFileSync(path.join(ROOT, "firestore.rules"), "utf8");
const oldStart = `      return superAdminRole()
        || (tenant.get('businessType', 'both') == 'both'`;
const newStart = `      // Fast path: check Hybrid suspension and ordinary business enablement
      // BEFORE expanding the expensive Super Admin profile/role policy.
      // Super Admin fallback is preserved only when business type mismatches.
      return (tenant.get('billingPolicyVersion', 'legacy') != 'hybrid_v1'
          || (tenant.get('hybridBillingSuspended', false) != true
            && tenant.get('active', true) != false))
        && ((tenant.get('businessType', 'both') == 'both'`;
const oldEnd = `          || (business == 'order_delivery' && tenant.get('businessType', 'both') == 'restaurant_cafe'));
    }
    function tenantMembershipPath`;
const newEnd = `          || (business == 'order_delivery' && tenant.get('businessType', 'both') == 'restaurant_cafe'))
          || superAdminRole());
    }
    function tenantMembershipPath`;
if (before.split(oldStart).length !== 2 || before.split(oldEnd).length !== 2) {
  throw new Error("HYBRID_RULES_CANDIDATE_SOURCE_DRIFT: inspect firewall policy manually");
}
// TEMP candidate: introduce a simple first-expression operational write gate
// before evaluating the large existing role/business expressions. This is an
// investigation only; it does not touch firestore.rules or deploy anything.
let candidate = before.replace(oldStart, newStart).replace(oldEnd, newEnd);
const sourceBoundary = "    match /tenants/{tenantId} {";
const guardedBoundary = `    match /tenants/{tenantId} {
      function hybridOperationalWriteAllowed() {
        let t = get(/databases/$(database)/documents/tenants/$(tenantId)).data;
        return t.get('billingPolicyVersion', 'legacy') != 'hybrid_v1'
          || (t.get('hybridBillingSuspended', false) != true
            && t.get('active', true) != false);
      }
      // Candidate-only payment and amount integrity guard for Delivery orders:
      // client SDKs cannot mark Hybrid receipts paid or rewrite source prices.
      // Admin SDK trusted payment callable intentionally bypasses client Rules.
      function hybridDeliveryReceiptFieldsUnchanged() {
        let t = get(/databases/$(database)/documents/tenants/$(tenantId)).data;
        return t.get('billingPolicyVersion', 'legacy') != 'hybrid_v1'
          || resource.data.get('orderType', '') != 'delivery'
          || !request.resource.data.diff(resource.data).affectedKeys().hasAny([
            'paymentStatus', 'paidAt', 'paymentMethod',
            'totalAmount', 'subtotalAmount', 'deliveryFee', 'items',
            'refundTotal', 'paymentReceivedByUid', 'paymentReceiptSource',
            'lalamoveCodSettlementStatus', 'lalamoveCodSettledAt',
            'lalamoveOrderId', 'lalamoveOrderStatus',
            'lalamoveCodEnabled', 'deliveryProvider',
            'lalamoveCompletedAt', 'lalamoveCodDeliveryCompletedAt',
            'lalamoveWebhookLastEventId', 'lalamoveOrderLastSyncedAt'
          ]);
      }`;
if (candidate.split(sourceBoundary).length !== 2) {
  throw new Error("HYBRID_RULES_CANDIDATE_TENANT_PATH_DRIFT");
}
candidate = candidate.replace(sourceBoundary, guardedBoundary);
for (const expected of [
  "allow update: if tenantBusinessEnabled(tenantId, 'order_delivery')",
  "allow create: if tenantBusinessEnabled(tenantId, 'retail_pos')",
]) {
  if (!candidate.includes(expected)) throw Error("HYBRID_RULES_CANDIDATE_WRITE_PATH_DRIFT");
  candidate = candidate.replaceAll(expected,
    expected.replace("if tenantBusinessEnabled", "if hybridOperationalWriteAllowed() && tenantBusinessEnabled"));
}
// Apply receipt tamper guard only to the tenant-local Delivery order UPDATE
// policy, preserving the legacy/top-level /orders matcher and all other rules.
const tenantOrderUpdate = "allow update: if hybridOperationalWriteAllowed() && tenantBusinessEnabled(tenantId, 'order_delivery')";
const tenantOrderStart = "match /orders/{orderId} { allow get: if tenantBusinessEnabled(tenantId, 'order_delivery')";
const index = candidate.indexOf(tenantOrderStart);
if (index < 0 || candidate.indexOf(tenantOrderStart, index + 1) !== -1) {
  throw new Error("HYBRID_RULES_CANDIDATE_ORDER_PATH_DRIFT");
}
const lineEnd = candidate.indexOf("\n", index);
const orderLine = candidate.slice(index, lineEnd);
if (!orderLine.includes(tenantOrderUpdate)) {
  throw new Error("HYBRID_RULES_CANDIDATE_ORDER_UPDATE_DRIFT");
}
const guardedLine = orderLine.replace(tenantOrderUpdate,
  "allow update: if hybridOperationalWriteAllowed() && hybridDeliveryReceiptFieldsUnchanged() && tenantBusinessEnabled(tenantId, 'order_delivery')");
candidate = candidate.slice(0, index) + guardedLine + candidate.slice(lineEnd);
// The real legacy POS matcher shares create/update validation. Firebase may
// evaluate both permissions for setDoc() upserts; a new sale has no resource.
// Reject update cheaply for non-existent documents BEFORE expanding multi-role
// product/return validation (which can otherwise exhaust 1000 expressions).
const salesMatch = "match /sales/{saleId} {";
const salesAt = candidate.indexOf(salesMatch);
if (salesAt < 0 || candidate.indexOf(salesMatch, salesAt + 1) !== -1) {
  throw Error("HYBRID_RULES_CANDIDATE_POS_SALES_DRIFT");
}
const salesEnd = candidate.indexOf("\n", salesAt);
const salesLine = candidate.slice(salesAt, salesEnd);
// Factor the duplicated retailTenantWrite() role/membership expansion out
// of both ordinary enrichment and returns. This is a Boolean-equivalent
// transformation of the existing Legacy policy, candidate only.
const salesUpdate = "allow update: if tenantBusinessEnabled(tenantId, 'retail_pos') && ((tenantAdminRole(tenantId) && tenantResourceMatches(tenantId)) || (retailTenantWrite(tenantId) && validRetailSaleEnrichment(tenantId)) || (retailTenantWrite(tenantId) && validRetailReturnSaleUpdate(tenantId)))";
if (!salesLine.includes(salesUpdate)) {
  throw Error("HYBRID_RULES_CANDIDATE_POS_UPDATE_DRIFT");
}
candidate = candidate.slice(0, salesAt)
  + salesLine.replace(salesUpdate,
    "allow update: if resource != null && tenantBusinessEnabled(tenantId, 'retail_pos') && ((tenantAdminRole(tenantId) && tenantResourceMatches(tenantId)) || (retailTenantWrite(tenantId) && (validRetailSaleEnrichment(tenantId) || validRetailReturnSaleUpdate(tenantId))))")
  + candidate.slice(salesEnd);
// Diagnostic mode runs the UNCHANGED production rules in the demo emulator
// to distinguish a pre-existing evaluation-budget problem from Hybrid edits.
// It never deploys, changes or rewrites the repository's firestore.rules.
const baselineDiagnostic = process.env.HYBRID_RULES_BASELINE_DIAGNOSTIC === "1";
if (baselineDiagnostic) candidate = before;
const suite = baselineDiagnostic
  ? "tests/react-parity/hybrid-billing-rules-baseline.spec.mjs"
  : "tests/react-parity/hybrid-billing-rules-emulator.spec.mjs";
const homeCandidates = [process.env.JAVA_HOME,
  "/Applications/Android Studio.app/Contents/jbr/Contents/Home",
  "/opt/homebrew/opt/openjdk@21"].filter(Boolean);
const javaHome = homeCandidates.find(home => {
  const executable = path.join(home, "bin/java");
  if (!existsSync(executable)) return false;
  const version = spawnSync(executable, ["-version"], { encoding: "utf8" });
  const match = (version.stderr || "").match(/version ["'](\d+)(?:\.|["'])/);
  return version.status === 0 && match && Number(match[1]) >= 21;
});
if (!javaHome) throw new Error("HYBRID_JDK21_REQUIRED");
const folder = mkdtempSync(path.join(os.tmpdir(), "penguin-hybrid-rules-uat-"));
try {
  const ruleFile = path.join(folder, "firestore.rules");
  const config = path.join(folder, "firebase.json");
  writeFileSync(ruleFile, candidate);
  writeFileSync(config, JSON.stringify({
    firestore: { rules: ruleFile },
    emulators: {
      auth: { host: "127.0.0.1", port: 9098 },
      firestore: { host: "127.0.0.1", port: 8188 },
      ui: { enabled: false },
    },
  }, null, 2) + "\n");
  console.log(baselineDiagnostic
    ? "HYBRID ORIGINAL RULES BASELINE | demo emulator ONLY | READ-ONLY rules"
    : "HYBRID RULES UAT | candidate in TEMP only | synthetic Auth + Firestore");
  console.log("Production firestore.rules is READ ONLY.");
  const result = spawnSync("firebase", [
    "emulators:exec", "--only", "auth,firestore",
    "--project", PROJECT, "--config", config, "--log-verbosity", "QUIET",
    "node --test " + suite,
  ], {
    cwd: ROOT, stdio: "pipe", encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, GCLOUD_PROJECT: PROJECT, JAVA_HOME: javaHome,
      PATH: path.join(javaHome, "bin") + path.delimiter + (process.env.PATH || "") },
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  const ruleBudgetExceeded = /maximum of 1000 expressions/i.test(
    String(result.stdout || "") + String(result.stderr || ""));
  if (ruleBudgetExceeded) {
    console.error(baselineDiagnostic
      ? "HYBRID_BASELINE_RULES_BLOCKED: original rules also hit 1000-expression evaluation errors."
      : "HYBRID_RULES_CANDIDATE_BLOCKED: denied writes hit the Firestore Rules evaluation limit; denial cannot count as security approval.");
  }
  // A passing assertion is NOT sufficient when Firestore internally failed to
  // evaluate policy. Preserve a nonzero exit code until this is corrected.
  process.exitCode = ruleBudgetExceeded ? 2 : (result.status ?? 1);
} finally {
  rmSync(folder, { recursive: true, force: true });
}
