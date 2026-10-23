import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { runInNewContext } from "node:vm";

const read = path => fs.readFileSync(path, "utf8");
const config = JSON.parse(read("firebase.hybrid-functions-emulator.json"));
const pkg = JSON.parse(read("package.json"));
const demoPackage = JSON.parse(read("functions/emulator-hybrid/package.json"));
const entrypoint = read("functions/emulator-hybrid/index.cjs");
const demoEnv = read("functions/emulator-hybrid/.env.local");
const transport = read("tests/firebase-emulator/hybrid-callable-transport.spec.mjs");
const production = read("functions/bootstrap.js") +
  "\n" + read("functions/index.js");
const callableCode = read("functions/hybrid-billing-payment-callables.js");
const uploadGrant = read("functions/hybrid-billing-upload-grant.js");
const firestoreRules = read("firestore.rules");

test("Functions Emulator uses a separate test-only source and demo project", () => {
  const cmd = pkg.scripts["test:hybrid-functions-emulator"];
  assert.match(cmd, /--project demo-penguin-hybrid\b/);
  assert.match(cmd, /--config firebase\.hybrid-functions-emulator\.json/);
  assert.match(cmd, /--only auth,firestore,storage,functions/);
  assert.match(cmd, /HYBRID_DEMO_FUNCTIONS_ONLY=1/);
  assert.match(cmd, /GCLOUD_PROJECT=demo-penguin-hybrid/);
  assert.match(cmd, /GCP_PROJECT=demo-penguin-hybrid/);
  for (const [name, address] of Object.entries({
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
    FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
    FIREBASE_FUNCTIONS_EMULATOR_HOST: "127.0.0.1:5001",
  })) {
    assert.ok(cmd.includes(name + "=" + address),
      "Demo runner must set " + name + " BEFORE Functions discovery");
  }
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
  assert.match(entrypoint, /demoProject: project === "demo-penguin-hybrid"/);
  assert.match(entrypoint, /HYBRID_DEMO_FUNCTIONS_ONLY/);
  for (const key of ["FIRESTORE_EMULATOR_HOST",
    "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"]) {
    assert.ok(entrypoint.includes('localHost("' + key + '")'));
  }
  assert.match(entrypoint, /HYBRID_DEMO_FUNCTIONS_HOST === "127\.0\.0\.1:5001"/);
  assert.match(entrypoint, /nativeFunctionsHostSafe:/);
  assert.match(entrypoint, /HYBRID_DEMO_FUNCTIONS_FORBIDDEN_OUTSIDE_LOCAL_EMULATORS/);
  assert.match(entrypoint, /unsafe\.join\(", "\)/);
  assert.match(entrypoint, /Object\.entries\(demoConditions\)/);
  assert.doesNotMatch(entrypoint, /console\.log\(process\.env|console\.error\(process\.env/);
  assert.match(entrypoint, /knownProjects.some\(value => value !== "demo-penguin-hybrid"\)/);
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
  assert.match(transport, /function reviewData\(submission, action, note,/);
  assert.match(transport, /const \{ tenantId, invoiceId, attemptId \} = submission/);
  assert.doesNotMatch(transport, /review\("super-admin", \{ \.\.\.payload,/);
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

test("runtime guard fails before loading Firebase modules for real project or nonlocal emulator", () => {
  function evaluate(env) {
    const imported = [];
    const fakeRequire = name => {
      imported.push(name);
      throw new Error("TEST_GUARD_MUST_PRECEDE_MODULE_LOAD");
    };
    assert.throws(() => runInNewContext(entrypoint, {
      process: { env },
      require: fakeRequire,
      exports: {},
    }), /HYBRID_DEMO_FUNCTIONS_FORBIDDEN_OUTSIDE_LOCAL_EMULATORS/);
    assert.deepEqual(imported, [], "No Firebase Admin, Storage or payment modules may load");
  }
  const baseline = {
    GCLOUD_PROJECT: "demo-penguin-hybrid",
    HYBRID_DEMO_FUNCTIONS_ONLY: "1",
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
    FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
    FIREBASE_FUNCTIONS_EMULATOR_HOST: "127.0.0.1:5001",
    HYBRID_DEMO_FUNCTIONS_HOST: "127.0.0.1:5001",
  };
  evaluate({ ...baseline, GCLOUD_PROJECT: "chat-45754" });
  evaluate({ ...baseline, HYBRID_DEMO_FUNCTIONS_ONLY: "" });
  evaluate({ ...baseline, FIRESTORE_EMULATOR_HOST: "production.example:443" });
  evaluate({ ...baseline, FIREBASE_STORAGE_EMULATOR_HOST: "" });
  evaluate({ ...baseline, FIREBASE_FUNCTIONS_EMULATOR_HOST: "prod.example:443" });
  evaluate({ ...baseline, HYBRID_DEMO_FUNCTIONS_HOST: "prod.example:443" });
  evaluate({ ...baseline, GCP_PROJECT: "chat-45754" });
  evaluate({ ...baseline, FIREBASE_CONFIG: '{"projectId":"chat-45754"}' });
});


test("explicit local demo CLI environment passes guard and reaches ONLY the first module import", () => {
  const imported = [];
  const env = {
    GCLOUD_PROJECT: "demo-penguin-hybrid",
    GCP_PROJECT: "demo-penguin-hybrid",
    FIREBASE_CONFIG: '{"projectId":"demo-penguin-hybrid"}',
    HYBRID_DEMO_FUNCTIONS_ONLY: "1",
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
    FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
    FIREBASE_FUNCTIONS_EMULATOR_HOST: "127.0.0.1:5001",
    HYBRID_DEMO_FUNCTIONS_HOST: "127.0.0.1:5001",
  };
  assert.throws(() => runInNewContext(entrypoint, {
    process: { env },
    require: name => {
      imported.push(name);
      throw new Error("TEST_STOP_BEFORE_LOADING_ANY_DEPENDENCY");
    },
    exports: {},
  }), /TEST_STOP_BEFORE_LOADING_ANY_DEPENDENCY/);
  assert.deepEqual(imported, ["node:crypto"]);
});


test("unsafe demo discovery errors identify failed checks but never reveal values or tokens", () => {
  const baseline = {
    GCLOUD_PROJECT: "demo-penguin-hybrid",
    GCP_PROJECT: "demo-penguin-hybrid",
    HYBRID_DEMO_FUNCTIONS_ONLY: "1",
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
    FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
    FIREBASE_FUNCTIONS_EMULATOR_HOST: "127.0.0.1:5001",
    HYBRID_DEMO_FUNCTIONS_HOST: "127.0.0.1:5001",
  };
  let error;
  try {
    runInNewContext(entrypoint, {
      process: { env: { ...baseline,
        FIREBASE_FUNCTIONS_EMULATOR_HOST: "remote-secret.invalid:443" } },
      require: () => { throw Error("must not reach dependency loading"); },
      exports: {},
    });
  } catch (e) { error = e; }
  assert.ok(error);
  assert.match(error.message, /nativeFunctionsHostSafe/);
  assert.doesNotMatch(error.message, /remote-secret|\\.invalid|443|chat-45754|ADC|token/);
});


test("emulator-only dotenv contains no reserved Firebase keys, credentials or real project", () => {
  const variables = Object.fromEntries(demoEnv.split("\n")
    .filter(line => line.trim() && !line.trim().startsWith("#"))
    .map(line => line.split("=", 2)));
  assert.deepEqual(variables, {
    HYBRID_DEMO_FUNCTIONS_ONLY: "1",
    HYBRID_DEMO_FUNCTIONS_HOST: "127.0.0.1:5001",
  });
  for (const name of Object.keys(variables)) {
    assert.doesNotMatch(name, /^(FIREBASE_|X_GOOGLE_|EXT_|GCP_PROJECT$|GCLOUD_PROJECT$)/);
  }
  assert.doesNotMatch(demoEnv, /chat-45754|PRIVATE_KEY|GOOGLE_APPLICATION_CREDENTIALS|secret=/i);
});

test("Firebase discovery with omitted reserved host and shell flag succeeds only after local dotenv injection", () => {
  // Real Mac CLI omitted HYBRID_DEMO_FUNCTIONS_ONLY and native Functions
  // host in function discovery. Firebase loads only the two nonreserved
  // values above from .env.local; the remaining hosts came from CLI.
  const env = {
    GCLOUD_PROJECT: "demo-penguin-hybrid",
    GCP_PROJECT: "demo-penguin-hybrid",
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
    FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
    ...Object.fromEntries(demoEnv.split("\n")
      .filter(line => line.trim() && !line.trim().startsWith("#"))
      .map(line => line.split("=", 2))),
  };
  const loaded = [];
  assert.throws(() => runInNewContext(entrypoint, {
    process: { env }, require: name => {
      loaded.push(name);
      throw new Error("TEST_STOP_AFTER_LOCAL_DEMO_GUARDS");
    },
    exports: {},
  }), /TEST_STOP_AFTER_LOCAL_DEMO_GUARDS/);
  assert.deepEqual(loaded, ["node:crypto"]);
  assert.equal(env.FIREBASE_FUNCTIONS_EMULATOR_HOST, undefined);
});

test("Phase 10 upload grant exists only behind test-only authenticated Callable", () => {
  assert.match(entrypoint, /exports\.demoHybridPrepareUpload = onCall\(options/);
  assert.match(entrypoint, /if \(!request\.auth\?\.uid\)/);
  assert.match(entrypoint, /issueTrustedHybridUploadGrant\(/);
  assert.doesNotMatch(production, /demoHybridPrepareUpload|hybrid-billing-upload-grant/);
  assert.match(uploadGrant, /randomBytes\(24\)\.toString\("base64url"\)/);
  assert.match(uploadGrant, /await tenantAdmin\(db, auth, tenantId\)/);
  assert.match(uploadGrant, /await db\.runTransaction\(async tx =>/);
  assert.match(uploadGrant, /tx\.create\(grantRef,/);
  assert.match(uploadGrant, /uploadEnabled: false/);
  assert.match(firestoreRules, /match \/hybridBillingUploadGrants\/\{attemptId\} \{\s*allow read, write: if false;/);
  // Source comments may describe why global claims are intentionally NOT
  // touched. Scan executable source, not comments, for forbidden operations.
  const executableGrant = uploadGrant.replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(executableGrant, /\buploadBytes\s*\(|\bonCall\s*\(|financeSlipClaims/);
  // Preserve the positive boundary: grants are private Firestore reservations
  // only, never a financial claim or an unregistered Callable.
  assert.match(executableGrant, /tx\.create\(grantRef,/);
  assert.doesNotMatch(executableGrant, /\btx\.(?:create|set|update)\s*\([^)]*financeSlipClaims/);
});

test("trusted proof submit requires unexpired grant before verification and consumes it atomically", () => {
  const service = read("functions/hybrid-billing-payment-service.js");
  const payment = read("functions/hybrid-billing-payment.js");
  assert.match(service, /assertTrustedHybridUploadGrant\(\{/);
  assert.match(service, /requireUploadGrant: true/);
  assert.match(payment, /requireUploadGrant = true/);
  assert.match(payment, /const grantSnap = requireUploadGrant \? await tx\.get\(grantRef\)/);
  assert.match(payment, /const actorSnap = requireUploadGrant \? await tx\.get\(actorRef\)/);
  assert.match(payment, /assertTrustedHybridUploadGrant\(\{/);
  assert.match(payment, /tx\.update\(grantRef, \{/);
  assert.match(payment, /status: "consumed"/);
  assert.match(transport, /reserveAndUpload\(/);
  assert.doesNotMatch(transport, /await upload\(/);
});
