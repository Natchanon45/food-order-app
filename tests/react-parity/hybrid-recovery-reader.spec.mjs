import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { prepareTrustedHybridRecoveryReview } =
  require("../../functions/hybrid-billing-recovery-reader.js");

const tenantId = "demo-shop";
const tenant = { id: tenantId, billingPolicyVersion: "hybrid_v1",
  billingCycleAnchorAt: new Date("2026-09-22T00:00:00+07:00"),
  hybridBillingSuspended: true, active: false,
  suspensionReason: "manual_review" };
const SEP = "2026-09-22:monthly:fixed";
const OCT = "2026-10-22:delivery:trigger";
const invoice = (id, status, dueDate, suspendFrom) => ({
  id, tenantId, status, version: "hybrid-invoice-v1",
  signature: "b".repeat(64), amount: 590, dueDate, suspendFrom,
});
const first = invoice(SEP, "paid", "2026-10-21", "2026-10-22");
const second = invoice(OCT, "paid", "2026-10-23", "2026-10-24");
function fixture({ missing = "", corrupt = false, extras = [], statuses = {} } = {}) {
  const rows = [first, second].map(i => ({ ...i, status: statuses[i.id] || i.status }))
    .concat(extras);
  const periods = new Map([
    ["2026-09-22", { version: "hybrid-invoice-v1",
      cycleStartDate: "2026-09-22", cycleEndExclusiveDate: "2026-10-22",
      invoiceIds: [SEP] }],
    ["2026-10-22", { version: "hybrid-invoice-v1",
      cycleStartDate: "2026-10-22", cycleEndExclusiveDate: "2026-11-22",
      invoiceIds: [OCT] }],
  ]);
  if (missing) periods.delete(missing);
  if (corrupt) periods.get("2026-09-22").invoiceIds.push(SEP);
  const tenantRef = {
    id: tenantId,
    collection: name => name === "hybridBillingPeriods" ? {
      doc: id => ({ get: async () => ({
        exists: periods.has(id), data: () => periods.get(id),
      }) }),
    } : name === "hybridBillingInvoices" ? {
      get: async () => ({ docs: rows.map(i => ({ id: i.id, data: () => i })) }),
    } : (() => { throw Error("unexpected collection"); })(),
  };
  return { tenantRef, tenant, now: new Date("2026-10-24T17:00:00+07:00") };
}

test("complete anniversary history allows clearing Hybrid hold only", async () => {
  const result = await prepareTrustedHybridRecoveryReview(fixture());
  assert.equal(result.periodCount, 2);
  assert.equal(result.invoiceCount, 2);
  assert.equal(result.action, "release_hybrid_hold_only");
  assert.deepEqual(result.patch, { hybridBillingSuspended: false });
  assert.equal(result.separateHoldExists, true);
  assert.equal(result.writesPerformed, false);
});

test("past cycle debt blocks recovery after all other invoices are PAID", async () => {
  const result = await prepareTrustedHybridRecoveryReview(fixture({
    statuses: { [SEP]: "issued" },
  }));
  assert.equal(result.action, "unchanged");
  assert.deepEqual(result.overdueInvoiceIds, [SEP]);
});

test("missing current or historic period fails closed rather than assuming zero debt", async () => {
  for (const missing of ["2026-09-22", "2026-10-22"]) {
    await assert.rejects(prepareTrustedHybridRecoveryReview(fixture({ missing })),
      /INCOMPLETE_PERIOD_HISTORY/);
  }
});

test("unindexed, duplicate and corrupt index data blocks recovery", async () => {
  await assert.rejects(prepareTrustedHybridRecoveryReview(fixture({
    extras: [invoice("2026-10-22:delivery:2026-10-23", "paid", "2026-10-23", "2026-10-24")],
  })), /INVOICE_COVERAGE_INCOMPLETE/);
  await assert.rejects(prepareTrustedHybridRecoveryReview(fixture({ corrupt: true })),
    /PERIOD_INDEX_INVALID/);
  await assert.rejects(prepareTrustedHybridRecoveryReview(fixture({
    extras: [first],
  })), /INVOICE_COVERAGE_INCOMPLETE/);
});

test("reader is private read-only, never wired to production Callable or scheduler", () => {
  const source = fs.readFileSync("functions/hybrid-billing-recovery-reader.js", "utf8");
  const boot = fs.readFileSync("functions/bootstrap.js", "utf8") +
    fs.readFileSync("functions/index.js", "utf8");
  assert.match(source, /invoicesCollection\.get\(\)/);
  assert.match(source, /coverageVerified: true/);
  assert.doesNotMatch(source, /runTransaction\(|tx\.set\(|tx\.update\(|onCall\(|onSchedule\(/);
  assert.doesNotMatch(boot, /hybrid-billing-recovery-reader/);
});
