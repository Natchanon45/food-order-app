import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  HYBRID_FINANCE_UI_READY,
  createHybridFinanceClient,
  hybridFinanceSlipPath,
  validateHybridFinanceSlip,
} from "../../react-app/src/data/hybridFinanceStaging.mjs";

const slip = { type: "image/png", size: 1024 };
const tenantId = "tenant-stage-test-001";
const attemptId = "slip_00000000000000000000000000";

test("finance UI remains OFF while backend endpoints are unexported", async () => {
  assert.equal(HYBRID_FINANCE_UI_READY, false);
  let calls = 0;
  const invoke = async () => { calls++; return { data: { ok: true } }; };
  const finance = createHybridFinanceClient(invoke);
  await assert.rejects(finance({ tenantId, action: "queue" }), /HYBRID_FINANCE_UI_NOT_RELEASED/);
  assert.equal(calls, 0);
  const index = readFileSync("functions/index.js", "utf8");
  const financeSource = readFileSync("functions/hybrid-billing-finance-api.js", "utf8");
  assert.doesNotMatch(index, /hybrid-billing-finance-api|manageHybridFinanceCandidate/);
  assert.match(financeSource, /HYBRID_FINANCE_API_READY = false/);
  assert.match(readFileSync("functions/hybrid-billing-settings.js", "utf8"),
    /HYBRID_REGISTRATION_READY = false/);
});

test("staging client exact outbound payload is injectable only when explicitly enabled in tests", async () => {
  let request;
  const finance = createHybridFinanceClient(async data => {
    request = data;
    return { data: { ok: true, rows: [] } };
  }, { ready: true });
  const payload = { tenantId, action: "list" };
  assert.deepEqual(await finance(payload), { ok: true, rows: [] });
  assert.deepEqual(request, payload);
  await assert.rejects(finance({ tenantId: "wrong/tenant", action: "list" }),
    /HYBRID_FINANCE_INVALID_REQUEST/);
  await assert.rejects(createHybridFinanceClient(null, { ready: true })(payload),
    /HYBRID_FINANCE_CALLABLE_NOT_REGISTERED/);
});

test("slip validation restricts path, MIME and byte-size", () => {
  assert.equal(validateHybridFinanceSlip(slip), "png");
  assert.equal(hybridFinanceSlipPath({ tenantId, attemptId, file: slip }),
    `tenants/${tenantId}/hybrid-billing-slips/${attemptId}/proof.png`);
  for (const bad of [
    { type: "text/html", size: 20 },
    { type: "image/png", size: 0 },
    { type: "image/png", size: 11 * 1024 * 1024 },
    { type: "image/jpeg", size: NaN },
  ]) assert.throws(() => validateHybridFinanceSlip(bad), /HYBRID_FINANCE_INVALID_SLIP/);
  assert.throws(() => hybridFinanceSlipPath({
    tenantId: "tenant/../../etc", attemptId, file: slip,
  }), /HYBRID_FINANCE_INVALID_PATH/);
});

test("existing Owner report and Super Admin tenants use staged finance panel, no callable bypass", () => {
  const report = readFileSync("react-app/src/pages/HybridBillingReportPage.jsx", "utf8");
  const admin = readFileSync("react-app/src/pages/AdminTenantsPage.jsx", "utf8");
  const panel = readFileSync("react-app/src/components/HybridBillingFinancePanel.jsx", "utf8");
  assert.match(report, /<HybridBillingFinancePanel tenantId=\{tenant.id\} mode="owner"/);
  assert.match(admin, /<HybridBillingFinancePanel tenantId=\{tenantId\} mode="admin"/);
  assert.match(panel, /HYBRID_FINANCE_UI_READY && typeof invoke === "function"/);
  assert.match(panel, /mode === "admin" \? "queue" : "list"/);
  assert.match(panel, /action: "submit", tenantId, attemptId/);
  assert.match(panel, /action: "review", tenantId, attemptId: row.attemptId/);
  assert.match(panel, /action: "recover", tenantId, reviewId/);
  assert.match(panel, /action: "audit", tenantId, afterId/);
  assert.match(panel, /action: "adjustments", tenantId, cycleId: adjustmentCycle/);
  assert.match(panel, /manual|อ่านอย่างเดียว/);
  assert.match(panel, /uploadedByUid: auth.currentUser.uid/);
  assert.doesNotMatch(panel, /httpsCallable\(/);
  assert.doesNotMatch(panel, /updateDoc\(|setDoc\(/);
});

test("Finance backend queue is Super Admin-only and storage review stays fail closed", () => {
  const source = readFileSync("functions/hybrid-billing-finance-api.js", "utf8");
  assert.match(source, /"queue", "audit", "adjustments", "review", "recover", "close", "arrears"/);
  assert.match(source, /HYBRID_FINANCE_QUEUE_PAGINATION_REQUIRED/);
  assert.match(source, /scanHybridPaidReceiptExceptions/);
  assert.match(source, /inspectHybridClosedDayAdjustments/);
  assert.match(source, /HYBRID_FINANCE_STORAGE_PROOF_INVALID/);
  assert.match(source, /metadata\.metadata\?\.uploadedByUid !== uid/);
  assert.doesNotMatch(readFileSync("functions/index.js", "utf8"),
    /hybrid-billing-finance-api/);
});
