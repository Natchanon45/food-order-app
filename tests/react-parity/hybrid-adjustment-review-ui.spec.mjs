import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const source = fs.readFileSync("react-app/src/data/hybridInvoiceReviewData.js", "utf8");
const table = fs.readFileSync("react-app/src/pages/HybridBillingReviewPage.jsx", "utf8");

// Node safety tests inject only fake Firebase read transports. There is no
// Firebase client initialization, real bank endpoint or network operation.
const withoutImports = source.replace(/^import\s+[\s\S]*?\s+from\s+["'][^"']+["'];\s*/gm, "")
  .replace(/\bexport async function\b/g, "async function");
function queryHarness(rows = {}) {
  const requests = [];
  const collection = (_db, ...parts) => parts.join("/");
  const orderBy = (...args) => ({ orderBy: args });
  const queryLimit = n => ({ limit: n });
  const startAfter = value => ({ startAfter: value });
  const query = (...xs) => ({ xs });
  const getDocs = async request => {
    requests.push(request);
    const path = request.xs[0];
    const limit = request.xs.find(x => x && typeof x === "object" && "limit" in x)?.limit || 30;
    const found = (rows[path] || []).slice(0, limit);
    return { docs: found.map(([id, data]) => ({ id, data: () => data })),
      size: found.length };
  };
  const code = new Function("collection", "documentId", "getDocs",
    "queryLimit", "orderBy", "query", "startAfter", "db",
    withoutImports + ";return {listHybridAdjustments,listHybridAdjustmentReviewEvents};");
  return { api: code(collection, () => "id", getDocs, queryLimit, orderBy, query,
    startAfter, {}), requests };
}

const tenantId = "demo-shop", base = "tenants/" + tenantId;
const proposal = {
  tenantId, invoiceId: "2026-10-24:monthly:fixed",
  kind: "refund_request", amount: 250, status: "approved",
  proposedBy: "super-one", reviewedBy: "super-two",
  reasonSummary: "Verify account 123-456-7890 before settlement",
  proposedAt: { seconds: 100000 }, externallySettled: true,
  bankAccount: "SECRET", payoutReference: "SECRET",
  rawOCR: "SECRET", slipPath: "SECRET", approvedBy: "SECRET",
};
const review = {
  adjustmentId: "adjustment_12345678901234", invoiceId: proposal.invoiceId,
  action: "approve", resultStatus: "approved", reviewerId: "super-two",
  reviewedAt: { seconds: 100001 },
  note: "Transfer ref 123 456 789012 checked manually",
  externallySettled: true, payoutReference: "SECRET",
  bankAccount: "SECRET", rawOCR: "SECRET",
};

test("only whitelisted, masked and tenant-scoped proposal data reaches React", async () => {
  const h = queryHarness({ [base + "/hybridBillingAdjustments"]: [
    ["adjustment_12345678901234", proposal],
  ] });
  const out = await h.api.listHybridAdjustments(tenantId);
  assert.equal(out.items.length, 1);
  assert.equal(out.items[0].id, "adjustment_12345678901234");
  assert.equal(out.items[0].amount, 250);
  assert.equal(out.items[0].status, "approved");
  assert.equal(out.items[0].payoutConfirmed, false, "Historical source flags are never bank proof");
  assert.match(out.items[0].reasonPreview, /\[redacted\]/);
  for (const forbidden of ["bankAccount", "payoutReference", "slipPath",
    "rawOCR", "approvedBy", "externallySettled"]) {
    assert.equal(Object.hasOwn(out.items[0], forbidden), false);
  }
  assert.equal(h.requests[0].xs[0], base + "/hybridBillingAdjustments");
  assert.equal(h.requests[0].xs[1].orderBy[0], "proposedAt");
  assert.equal(out.cursor.id, "adjustment_12345678901234");
});

test("adjustment review events show independent reviewer but never payout claim", async () => {
  const h = queryHarness({ [base + "/hybridBillingAdjustmentEvents"]: [
    ["adjustment_12345678901234-review", review],
  ] });
  const out = await h.api.listHybridAdjustmentReviewEvents(tenantId);
  assert.equal(out.items[0].reviewerId, "super-two");
  assert.equal(out.items[0].resultStatus, "approved");
  assert.equal(out.items[0].payoutConfirmed, false);
  assert.match(out.items[0].notePreview, /\[redacted\]/);
  for (const forbidden of ["bankAccount", "payoutReference", "rawOCR",
    "externallySettled"]) assert.equal(Object.hasOwn(out.items[0], forbidden), false);
  assert.equal(h.requests[0].xs[0], base + "/hybridBillingAdjustmentEvents");
  assert.equal(h.requests[0].xs[1].orderBy[0], "reviewedAt");
});

test("unknown status, invalid amount, forged payout and bank credentials never surface", async () => {
  const h = queryHarness({ [base + "/hybridBillingAdjustments"]: [
    ["adjustment_fake_123456789", { ...proposal, amount: Infinity,
      kind: "bank_transfer", status: "settled" }],
  ] });
  const row = (await h.api.listHybridAdjustments(tenantId)).items[0];
  assert.equal(row.amount, 0);
  assert.equal(row.kind, "unknown");
  assert.equal(row.status, "unknown");
  assert.equal(row.payoutConfirmed, false);
});

test("invalid tenant ID/page size rejects before issuing any Firebase request", async () => {
  const h = queryHarness();
  for (const fn of [h.api.listHybridAdjustments, h.api.listHybridAdjustmentReviewEvents]) {
    for (const id of ["../another-shop", "", "a"]) {
      await assert.rejects(fn(id), /INVALID_TENANT_ID/);
    }
    for (const pageSize of [0, 51, 2.5]) {
      await assert.rejects(fn(tenantId, { pageSize }), /INVALID_LIMIT/);
    }
  }
  assert.equal(h.requests.length, 0);
});

test("UI distinguishes internal finance approval, does not mutate bank or invoice", () => {
  assert.match(table, /Internally approved only/);
  assert.match(table, /No confirmed payout/);
  assert.match(table, /Payout not confirmed/);
  assert.match(table, /loadMoreDetails\("adjustments", adjustmentCursor,/);
  assert.match(table, /loadMoreDetails\("adjustment-events", adjustmentEventCursor,/);
  assert.match(table, /visibleAdjustments = detailsReady \? adjustments : \[\]/);
  assert.match(table, /visibleAdjustmentEvents = detailsReady \? adjustmentEvents : \[\]/);
  assert.doesNotMatch(table, /setDoc\(|updateDoc\(|deleteDoc\(|addDoc\(|uploadBytes\(/);
});
