import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const config = JSON.parse(fs.readFileSync("firebase.hybrid-emulator.json", "utf8"));
const src = fs.readFileSync("tests/firebase-emulator/hybrid-finance-security.spec.mjs", "utf8");
const boot = fs.readFileSync("functions/bootstrap.js", "utf8");
const privateIssuer = fs.readFileSync("functions/hybrid-billing-reconciler.js", "utf8");
const registry = fs.readFileSync("functions/finance-slip-claims.js", "utf8");
const storageRules = fs.readFileSync("storage.rules", "utf8");
const javaGuard = fs.readFileSync("tools/check-firebase-emulator-java.mjs", "utf8");

test("emulator script always targets an explicitly named demo project and not production", () => {
  const script = pkg.scripts["test:firebase-hybrid-emulator"];
  assert.ok(script);
  assert.match(script, /^node tools\/check-firebase-emulator-java\.mjs && /);
  assert.match(script, /--project demo-penguin-hybrid\b/);
  assert.match(script, /--config firebase\.hybrid-emulator\.json/);
  assert.match(script, /--only auth,firestore,storage/);
  assert.match(script, /node --test tests\/firebase-emulator\/hybrid-finance-security\.spec\.mjs/);
  assert.doesNotMatch(script, /--project chat-45754|firebase deploy|--only functions/);
  assert.doesNotMatch(JSON.stringify(config), /chat-45754|web\.app|firebaseapp\.com/);
});

test("isolated config loads real repository security rules on loopback-only emulators", () => {
  assert.equal(config.firestore.rules, "firestore.rules");
  assert.equal(config.storage.rules, "storage.rules");
  for (const name of ["auth", "firestore", "storage"]) {
    assert.equal(config.emulators[name].host, "127.0.0.1");
    assert.ok(Number.isInteger(config.emulators[name].port));
    assert.ok(config.emulators[name].port > 0);
  }
  assert.ok(!("functions" in config), "No production/cloud Functions may run in this test");
});

test("test harness requires all emulators and seeds only a demo-project datastore", () => {
  assert.match(src, /const projectId = "demo-penguin-hybrid"/);
  assert.match(src, /requireEmulators\(\); \/\/ fail before creating any Firebase client/);
  for (const name of ["FIRESTORE_EMULATOR_HOST",
    "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"]) {
    assert.ok(src.includes(name), "Missing explicit env guard " + name);
  }
  assert.match(src, /if \(!projectId\.startsWith\("demo-"\)\)/);
  assert.doesNotMatch(src, /chat-45754|https:\/\/firestore\.googleapis\.com/);
});

test("emulator integration checks permission barriers and real Admin claim/invoice transactions", () => {
  assert.match(src, /Firestore grants invoice read\/list only to own tenant/);
  assert.match(src, /All Browser roles including Super Admin are denied billing/);
  assert.match(src, /Global bank\/slip claims cannot be read or forged/);
  assert.match(src, /Storage permits own owner\/admin write-once slip/);
  assert.match(src, /Storage rejects invalid MIME/);
  assert.match(src, /Actual Admin Firestore transactions serialize cross-channel/);
  assert.match(src, /Real Admin transaction stages slip as pending/);
  assert.match(src, /Actual Admin Firestore invoice writer is idempotent/);
  assert.match(src, /FieldValue\.serverTimestamp\(\)/);
  assert.match(storageRules, /function hybridInvoiceAcceptsEvidence\(tenantId, invoiceId\)/);
  assert.match(storageRules, /firestore\.exists\(invoicePath\)/);
  assert.match(storageRules, /\['issued', 'rejected'\]/);
  assert.match(storageRules, /&& hybridInvoiceAcceptsEvidence\(tenantId, invoiceId\)/);
  // Storage uploads may be classified as CREATE even when replacing an object.
  // A storage resource existence condition is necessary for immutability.
  assert.match(storageRules, /allow create: if resource == null\s*&& tenantBillingAdmin\(tenantId\)/);
  assert.match(src, /await denied\(updateMetadata\(target,/);
  assert.match(src, /alteredImage/);
  assert.match(src, /Rejected overwrites must preserve the original slip bytes/);
});

test("production automatic issuer and privileged public endpoints remain disabled", () => {
  assert.match(privateIssuer, /const HYBRID_INVOICE_ISSUANCE_READY = false/);
  assert.doesNotMatch(boot, /hybrid-billing-(payment|reconciler|persistence)/);
  assert.doesNotMatch(registry, /onCall\(|onSchedule\(/);
});

test("Firebase Emulator refuses JDK 17 before starting Firebase CLI", () => {
  assert.match(javaGuard, /spawnSync\("java", \["-version"\]/);
  assert.match(javaGuard, /major < 21/);
  assert.match(javaGuard, /brew install openjdk@21/);
  assert.match(javaGuard, /process\.exit\(1\)/);
});
