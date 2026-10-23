import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  isSafeHybridDemoRuntime, submitDemoHybridEvidence,
} from "../../react-app/src/data/hybridDemoProofTransport.js";

const tenantId = "demo-hybrid-browser";
const invoice = { id: "2026-10-24:monthly:fixed", status: "issued", amount: 590 };
const file = { name: "synthetic-proof.png", type: "image/png", size: 32 };
const runtime = { dev: true, emulatorFlag: true, demoFlag: true,
  projectId: "demo-penguin-hybrid" };
const attemptId = "server_generated_1234567890123";
const slipPath = "tenants/" + tenantId + "/hybrid-billing-slips/" + invoice.id
  + "/" + attemptId + "/evidence.png";
const grant = () => ({
  tenantId, invoiceId: invoice.id, attemptId, slipPath,
  contentType: "image/png", maxSize: file.size, uploadEnabled: false,
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
});
function fixture(overrides = {}) {
  const events = [];
  const args = {
    runtime, tenantId, invoice, file, onStep: step => events.push(step),
    requestGrant: async p => {
      events.push("grant");
      assert.deepEqual(p, { tenantId, invoiceId: invoice.id,
        contentType: file.type, fileSize: file.size });
      return grant();
    },
    uploadEvidence: async ({ slipPath: path, file: bytes }) => {
      events.push("upload");
      assert.equal(path, slipPath);
      assert.equal(bytes, file);
    },
    submitProof: async p => {
      events.push("callable");
      assert.deepEqual(p, { tenantId, invoiceId: invoice.id, attemptId, slipPath });
      return { status: "pending_review", invoiceId: invoice.id, attemptId };
    },
    ...overrides,
  };
  return { args, events };
}

test("demo runner requires development, both emulator flags and exact demo project", async () => {
  assert.equal(isSafeHybridDemoRuntime(runtime), true);
  for (const change of [{ dev: false }, { emulatorFlag: false }, { demoFlag: false },
    { projectId: "chat-45754" }, { projectId: "other-demo" }]) {
    const f = fixture({ runtime: { ...runtime, ...change } });
    await assert.rejects(submitDemoHybridEvidence(f.args), /HYBRID_DEMO_ONLY_LOCAL_EMULATOR/);
    assert.deepEqual(f.events, [], "Never call Firebase for unsafe environment");
  }
});

test("server-generated grant stages only pending review in canonical order", async () => {
  const f = fixture();
  const result = await submitDemoHybridEvidence(f.args);
  assert.deepEqual(result, { status: "pending_review", invoiceId: invoice.id, attemptId });
  assert.deepEqual(f.events, ["reserving", "grant", "uploading", "upload", "submitting", "callable"]);
});

test("ineligible invoice and invalid file fail before requesting a grant", async () => {
  for (const bad of [
    { invoice: { ...invoice, status: "paid" } },
    { invoice: { ...invoice, status: "pending_review" } },
    { invoice: { ...invoice, amount: 0 } },
    { file: { ...file, size: 0 } },
    { file: { ...file, type: "text/html" } },
  ]) {
    const f = fixture(bad);
    await assert.rejects(submitDemoHybridEvidence(f.args));
    assert.deepEqual(f.events, []);
  }
});

test("reject stolen, altered or expired grants before any Storage upload", async () => {
  for (const mutate of [
    { slipPath: "tenants/forged/path.png" }, { tenantId: "other-shop" },
    { maxSize: 33 }, { contentType: "application/pdf" },
    { uploadEnabled: true }, { attemptId: "../invalid" },
    { expiresAt: "2000-01-01T00:00:00.000Z" },
  ]) {
    const f = fixture({ requestGrant: async () => ({ ...grant(), ...mutate }) });
    await assert.rejects(submitDemoHybridEvidence(f.args), /HYBRID_DEMO_/);
    assert.ok(!f.events.includes("upload"), "Never upload with a tampered grant");
  }
});

test("Storage error never submits; forged paid response is rejected", async () => {
  const f = fixture({ uploadEvidence: async () => { throw Error("STORAGE_DENIED"); } });
  await assert.rejects(submitDemoHybridEvidence(f.args), /STORAGE_DENIED/);
  assert.ok(!f.events.includes("callable"));
  const g = fixture({ submitProof: async () => ({
    status: "paid", invoiceId: invoice.id, attemptId,
  }) });
  await assert.rejects(submitDemoHybridEvidence(g.args), /UNEXPECTED_FINANCIAL_RESULT/);
});

test("changing session during upload/grant cancels downstream submission", async () => {
  for (const phase of ["grant", "upload"]) {
    let current = true;
    const f = fixture({
      isCurrent: () => current,
      ...(phase === "grant"
        ? { requestGrant: async () => { current = false; return grant(); } }
        : { uploadEvidence: async () => { current = false; } }),
    });
    await assert.rejects(submitDemoHybridEvidence(f.args), /SESSION_CHANGED/);
    assert.ok(!f.events.includes("callable"));
  }
});

test("demo is excluded from Production and immutable release flags remain disabled", () => {
  const firebase = fs.readFileSync("react-app/src/firebase/client.js", "utf8");
  const adapter = fs.readFileSync("react-app/src/data/hybridDemoProofClient.js", "utf8");
  const panel = fs.readFileSync("react-app/src/components/HybridTenantProofPanel.jsx", "utf8");
  const prod = fs.readFileSync("functions/index.js", "utf8") +
    fs.readFileSync("functions/bootstrap.js", "utf8");
  const draft = fs.readFileSync("react-app/src/data/hybridTenantPaymentDraft.js", "utf8");
  const seed = fs.readFileSync("tools/seed-hybrid-browser-demo.mjs", "utf8");
  assert.match(firebase, /import\.meta\.env\.DEV === true/);
  assert.match(firebase, /VITE_HYBRID_DEMO_PAYMENT_E2E === "true"/);
  assert.match(firebase, /projectId: "demo-penguin-hybrid"/);
  assert.match(adapter, /httpsCallable\(functions, DEMO_ENDPOINTS\.prepare\)/);
  assert.match(adapter, /httpsCallable\(functions, DEMO_ENDPOINTS\.submit\)/);
  assert.match(adapter, /uploadBytes\(storageRef\(storage, slipPath\)/);
  assert.match(panel, /isHybridDemoMode \? \(/);
  assert.match(panel, /onClick=\{runDemoSubmission\}/);
  assert.doesNotMatch(prod, /demoHybridPrepareUpload|demoHybridSubmitProof/);
  assert.match(draft, /HYBRID_TENANT_PROOF_SUBMISSION_READY = false/);
  assert.match(seed, /HYBRID_DEMO_SEED_REFUSES_NONLOCAL_ENVIRONMENT/);
  assert.match(seed, /FIRESTORE_EMULATOR_HOST/);
  assert.doesNotMatch(seed, /chat-45754|firebase deploy/);
});

test("Super Admin review wiring is emulator-only; real review adapter remains hard-disabled", () => {
  const client = fs.readFileSync("react-app/src/data/hybridDemoProofClient.js", "utf8");
  const panel = fs.readFileSync("react-app/src/components/HybridReviewDecisionPanel.jsx", "utf8");
  const page = fs.readFileSync("react-app/src/pages/HybridBillingReviewPage.jsx", "utf8");
  const seed = fs.readFileSync("tools/seed-hybrid-browser-demo.mjs", "utf8");
  const real = fs.readFileSync("react-app/src/data/hybridPaymentActions.js", "utf8");
  assert.match(client, /httpsCallable\(functions, DEMO_ENDPOINTS\.review\)/);
  assert.match(client, /HYBRID_DEMO_ONLY_LOCAL_EMULATOR/);
  assert.match(panel, /isHybridDemoMode \? \(/);
  assert.match(panel, /reviewHybridDemoPayment\(payload\)/);
  assert.match(page, /isHybridDemoMode/);
  assert.match(seed, /hybrid-reviewer@demo\.invalid/);
  assert.match(real, /HYBRID_PAYMENT_UI_READY = false/);
  assert.match(real, /HYBRID_PAYMENT_NOT_RELEASED/);
});
