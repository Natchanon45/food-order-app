import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const source = fs.readFileSync("react-app/src/data/hybridInvoiceReviewData.js", "utf8");
const page = fs.readFileSync("react-app/src/pages/HybridBillingReviewPage.jsx", "utf8");
const code = source.replace(/^import\s+[\s\S]*?\s+from\s+["'][^"']+["'];\s*/gm, "")
  .replace(/\bexport async function\b/g, "async function");

function readOnlyFixture(rows) {
  const queries = [];
  const collection = (_db, ...parts) => parts.join("/");
  const query = (...parts) => ({ parts });
  const limit = size => ({ limit: size });
  const orderBy = (...parts) => ({ orderBy: parts });
  const startAfter = token => ({ startAfter: token });
  const getDocs = async request => {
    queries.push(request);
    const documents = (rows[request.parts[0]] || []).slice(0,
      request.parts.find(p => typeof p === "object" && p.limit)?.limit ?? 30);
    return { docs: documents.map(([id, data]) => ({ id, data: () => data })),
      size: documents.length };
  };
  const fn = new Function("collection", "documentId", "getDocs", "queryLimit",
    "orderBy", "query", "startAfter", "db",
    code + "; return {listHybridRefundCandidates,listHybridAdjustments,listHybridAdjustmentReviewEvents};");
  const api = fn(collection, () => "__id", getDocs, limit, orderBy, query,
    startAfter, {});
  return { api, queries };
}
const tenantId = "demo-shop";
const invoiceId = "2026-10-24:monthly:fixed";
const candidate = {
  invoiceId, amount: 250, createdAt: "2026-10-24T12:00:00Z",
  observedBy: "superadmin_1234567890", bankReferenceHash: "a".repeat(64),
  instructionHash: "b".repeat(64), destinationFingerprint: "c".repeat(64),
  bankAccountNumber: "1234567890", rawStatement: "SECRET",
  instructionId: "real_instruction_1234567890",
  state: "settled", settlementConfirmed: true, sourceIntegrationReady: true,
  payoutReceipt: "SECRET",
};
test("refund candidate UI keeps invoice identifier and never shows private bank fields", async () => {
  const f = readOnlyFixture({
    ["tenants/" + tenantId + "/hybridBillingRefundCandidates"]:
      [["adjustment_12345678901234", candidate]],
  });
  const result = await f.api.listHybridRefundCandidates(tenantId);
  assert.equal(result.items.length, 1);
  const row = result.items[0];
  assert.equal(row.invoiceId, invoiceId, "Do not redact invoice dates");
  assert.equal(row.observedBy, candidate.observedBy, "Do not redact reviewer IDs");
  assert.equal(row.state, "awaiting_independent_bank_attestation");
  assert.equal(row.payoutConfirmed, false);
  assert.equal(row.bankSourceConfirmed, false);
  for (const field of ["bankReferenceHash", "instructionHash", "destinationFingerprint",
    "bankAccountNumber", "rawStatement", "instructionId", "settlementConfirmed",
    "sourceIntegrationReady", "payoutReceipt"]) {
    assert.equal(Object.hasOwn(row, field), false);
  }
  assert.equal(f.queries[0].parts[0],
    "tenants/" + tenantId + "/hybridBillingRefundCandidates");
  assert.equal(f.queries[0].parts[1].orderBy[0], "createdAt");
});
test("read-only proposal and review histories preserve invoice and adjustment IDs", async () => {
  const f = readOnlyFixture({
    ["tenants/" + tenantId + "/hybridBillingAdjustments"]: [[
      "adjustment_12345678901234", {
        invoiceId, amount: 250, kind: "refund_request", status: "approved",
        proposedBy: "superadmin_1234567890",
        reasonSummary: "Transfer to bank 123-456-7890 was disputed",
      },
    ]],
    ["tenants/" + tenantId + "/hybridBillingAdjustmentEvents"]: [[
      "adjustment_12345678901234-review", {
        invoiceId, adjustmentId: "adjustment_12345678901234",
        reviewerId: "superadmin_9876543210", action: "approve",
        resultStatus: "approved",
        note: "Please review bank account 123-456-7890 for refund",
      },
    ]],
  });
  const proposals = await f.api.listHybridAdjustments(tenantId);
  const reviews = await f.api.listHybridAdjustmentReviewEvents(tenantId);
  assert.equal(proposals.items[0].invoiceId, invoiceId);
  assert.equal(proposals.items[0].proposedBy, "superadmin_1234567890");
  assert.match(proposals.items[0].reasonPreview, /\[redacted\]/);
  assert.equal(reviews.items[0].invoiceId, invoiceId);
  assert.equal(reviews.items[0].adjustmentId, "adjustment_12345678901234");
  assert.equal(reviews.items[0].reviewerId, "superadmin_9876543210");
  assert.match(reviews.items[0].notePreview, /\[redacted\]/);
});
test("refund candidate list fails closed before query for malformed tenant or pagination", async () => {
  const f = readOnlyFixture({});
  for (const tenant of ["", "a", "../another-tenant"]) {
    await assert.rejects(f.api.listHybridRefundCandidates(tenant), /INVALID_TENANT_ID/);
  }
  for (const pageSize of [0, 51, 2.5]) {
    await assert.rejects(f.api.listHybridRefundCandidates(tenantId, { pageSize }),
      /INVALID_LIMIT/);
  }
  assert.equal(f.queries.length, 0);
});
test("page has no actions that could promote an unverified candidate to settled", () => {
  assert.match(page, /listHybridRefundCandidates\(selectedId\)/);
  assert.match(page, /loadMoreDetails\("refund-candidates", refundCandidateCursor,/);
  assert.match(page, /visibleRefundCandidates = detailsReady \? refundCandidates : \[\]/);
  assert.match(page, /setRefundCandidates\(\[\]\)/);
  assert.match(page, /Bank attestation pending/);
  assert.match(page, /Payout not confirmed/);
  assert.doesNotMatch(page, /setDoc\(|updateDoc\(|deleteDoc\(|uploadBytes\(/);
});
