import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const config = JSON.parse(read("firebase.hybrid-functions-emulator.json"));
const pkg = JSON.parse(read("package.json"));
const demoPackage = JSON.parse(read("functions/emulator-hybrid/package.json"));
const entrypoint = read("functions/emulator-hybrid/index.cjs");
const transport = read("tests/firebase-emulator/hybrid-callable-transport.spec.mjs");
const production = read("functions/bootstrap.js") +
  "\n" + read("functions/index.js");
const callableCode = read("functions/hybrid-billing-payment-callables.js");

test("Functions Emulator uses a separate test-only source and demo project", () => {
  const cmd = pkg.scripts["test:hybrid-functions-emulator"];
  assert.match(cmd, /--project demo-penguin-hybrid\b/);
  assert.match(cmd, /--config firebase\.hybrid-functions-emulator\.json/);
  assert.match(cmd, /--only auth,firestore,storage,functions/);
  assert.match(cmd, /HYBRID_DEMO_FUNCTIONS_ONLY=1 firebase emulators:exec/);
  assert.doesNotMatch(cmd, /firebase deploy|chat-45754/);
  assert.equal(config.functions.source, "functions/emulator-hybrid");
  assert.equal(demoPackage.main, "index.cjs");
  assert.equal(demoPackage.engines.node, "22");
  assert.equal(config.firestore.rules, "firestore.rules");
  assert.equal(config.storage.rules, "storage.rules");
});

test("All four emulators bind loopback, Functions on port 5001", () => {
  for (const service of ["auth", "firestore", "storage", "functions"]) {
    assert.equal(config.emulators[service].host, "127.0.0.1");
    assert.ok(Number.isSafeInteger(config.emulators[service].port));
    assert.ok(config.emulators[service].port > 0);
  }
  assert.equal(config.emulators.functions.port, 5001);
});

test("demo loader rejects any real project, nonlocal service or missing explicit test flag", () => {
  assert.match(entrypoint, /project !== "demo-penguin-hybrid"/);
  assert.match(entrypoint, /HYBRID_DEMO_FUNCTIONS_ONLY/);
  for (const key of ["FIRESTORE_EMULATOR_HOST",
    "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"]) {
    assert.ok(entrypoint.includes('localHost("' + key + '")'));
  }
  assert.match(entrypoint, /HYBRID_DEMO_FUNCTIONS_FORBIDDEN_OUTSIDE_LOCAL_EMULATORS/);
  const initAt = entrypoint.indexOf("initializeApp({");
  const guardAt = entrypoint.indexOf("throw new Error(");
  assert.ok(guardAt > 0 && initAt > guardAt, "Safety check must occur before Admin SDK initialization");
});

test("demo entrypoint uses fake bank verification and never loads live Slip2Go credentials", () => {
  assert.match(entrypoint, /async function fakeBankVerifier\(/);
  assert.match(entrypoint, /inspect: fakeBankVerifier/);
  assert.match(entrypoint, /enabled: true, \/\/ ONLY within the guarded demo entrypoint/);
  assert.doesNotMatch(entrypoint, /inspectSlip\(|slip2GoSecret|google_vision|fetch\(|Authorization/);
  assert.match(entrypoint, /enforceAppCheck: false/);
  assert.match(callableCode, /enforceAppCheck: true/);
});

test("no production export, client reference or release gates change", () => {
  assert.doesNotMatch(production, /emulator-hybrid|demoHybridSubmitProof|demoHybridReviewProof/);
  assert.doesNotMatch(production, /hybrid-billing-payment-callables/);
  assert.match(callableCode, /HYBRID_PAYMENT_CALLABLE_READY = false/);
  assert.match(read("react-app/src/data/hybridPaymentActions.js"),
    /HYBRID_PAYMENT_UI_READY = false/);
  assert.match(read("functions/hybrid-billing-reconciler.js"),
    /HYBRID_INVOICE_ISSUANCE_READY = false/);
});

test("real Firebase client transport includes Auth and has negative and positive tests", () => {
  assert.match(transport, /connectAuthEmulator\(/);
  assert.match(transport, /connectFunctionsEmulator\(/);
  assert.match(transport, /httpsCallable\(/);
  assert.match(transport, /REFUSE_NONLOCAL_EMULATOR_/);
  assert.match(transport, /actual Callable transport denies unsigned, cashier, inactive and cross-tenant submit/);
  assert.match(transport, /only Super Admin can settle once/);
  assert.match(transport, /global SHA-256 claim prevents reuse/);
  assert.match(transport, /tenant\.subscriptionStatus, "suspended"/);
  assert.doesNotMatch(transport, /chat-45754|firebase deploy/);
});

test("test-only source is not part of the configured production Functions directory", () => {
  const liveConfig = JSON.parse(read("firebase.json"));
  // Existing live Functions source/main stays unchanged.
  const prodSrc = typeof liveConfig.functions === "object" && !Array.isArray(liveConfig.functions)
    ? liveConfig.functions.source : "";
  assert.notEqual(prodSrc, "functions/emulator-hybrid");
  assert.notEqual(read("functions/package.json").includes('"main": "bootstrap.js"'), false);
});
