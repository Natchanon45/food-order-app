import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
if (!getApps().length) initializeApp({ projectId: "demo-penguin-hybrid" });
const db = getFirestore();
const callable = require("./tenant-admin");
const { verifyOnePeriod, readTenantFinanceEvidence } =
  require("./tenant-finance-source-evidence");
const { LEDGER_VERSION, invoiceSignature } = require("./hybrid-billing-ledger");
const admin = { auth: { uid: "p1-finance-evidence-admin" } };
const tenantId = "p1-finance-evidence-tenant";
const tenantRef = db.collection("tenants").doc(tenantId);
const cycleStartDate = "2026-10-18";
const cycleEndExclusiveDate = "2026-11-18";
const id = cycleStartDate + ":delivery:2026-11-01";
const period = {
  version: LEDGER_VERSION, cycleStartDate, cycleEndExclusiveDate,
  sealedSalesDigest: "a".repeat(64),
  invoiceIds: [id],
};
const draft = {
  id, version: LEDGER_VERSION,
  cycleStartDate, cycleEndExclusiveDate,
  cycleEndDate: "2026-11-17",
  kind: "delivery_daily",
  date: "2026-11-01", dueDate: "2026-11-02",
  suspendFrom: "2026-11-03",
  calculationBase: 100, amount: 5,
  status: "issued",
};
const signed = {
  ...draft, signature: invoiceSignature(draft, period),
};
test("M7 evidence is not inferred for absent or legacy Hybrid policies", async () => {
  await db.collection("users").doc(admin.auth.uid)
    .set({ role: "super_admin", active: true });
  await db.collection("users").doc("p1-finance-evidence-owner")
    .set({ role: "owner", active: true });
  await tenantRef.set({ name: "P1 evidence source shop", slug: tenantId,
    billingPolicyVersion: "legacy" });
  const absent = await callable.getPlatformTenantHybridInvoiceEvidence.run({
    ...admin, data: { tenantId },
  });
  assert.equal(absent.ok, true);
  assert.equal(absent.available, false);
  assert.equal(absent.invoiceEvidence, null);
  assert.equal(absent.canSettleMoney, false);
  assert.equal(absent.canReleaseTenant, false);
  assert.equal(absent.canIssueRealInvoice, false);
  await assert.rejects(
    callable.getPlatformTenantHybridInvoiceEvidence.run({
      auth: { uid: "p1-finance-evidence-owner" }, data: { tenantId },
    }), error => error.code === "permission-denied",
  );
  await tenantRef.update({ billingPolicyVersion: "hybrid_v1" });
  const missing = await readTenantFinanceEvidence({
    tenantRef, tenant: (await tenantRef.get()).data(),
  });
  assert.equal(missing.available, false);
  assert.equal(missing.reason, "NO_INDEXED_PERIOD");
});
test("indexed and signed Hybrid invoice yields factual one-cycle readonly source evidence", async () => {
  const periodRef = tenantRef.collection("hybridBillingPeriods").doc(cycleStartDate);
  await periodRef.set(period);
  await tenantRef.collection("hybridBillingInvoices").doc(id).set(signed);
  const response = await callable.getPlatformTenantHybridInvoiceEvidence.run({
    ...admin, data: { tenantId },
  });
  assert.equal(response.ok, true);
  assert.equal(response.status, "source_records_only");
  assert.equal(response.invoiceEvidence.invoiceCount, 1);
  assert.equal(response.invoiceEvidence.recordedAmountCents, 500);
  assert.equal(response.invoiceEvidence.recordedOpenAmountCents, 500);
  assert.equal(response.invoiceEvidence.invoices[0].status, "issued");
  assert.equal(response.invoiceEvidence.invoices[0].bankVerified, false);
  assert.equal(response.bankSourceVerified, false);
  assert.equal(response.originalSignupVerified, false);
  assert.equal(response.canSettleMoney, false);
  assert.equal(response.canIssueRealInvoice, false);
  assert.equal(response.canReleaseTenant, false);
  assert.equal(JSON.stringify(response).includes("bankAccountNumber"), false);
  assert.equal(JSON.stringify(response).includes("slipPath"), false);
  assert.equal((await tenantRef.collection("hybridBillingInvoices").doc(id).get())
    .data().status, "issued");
});
test("signature drift, missing index, unindexed extra invoice and fake paid statuses fail closed", async () => {
  const invoiceRef = tenantRef.collection("hybridBillingInvoices").doc(id);
  await invoiceRef.update({ amount: 999 });
  await assert.rejects(callable.getPlatformTenantHybridInvoiceEvidence.run({
    ...admin, data: { tenantId },
  }), error => error.code === "failed-precondition");
  await invoiceRef.set(signed);
  await invoiceRef.update({ status: "bank_certified" });
  await assert.rejects(callable.getPlatformTenantHybridInvoiceEvidence.run({
    ...admin, data: { tenantId },
  }), error => error.code === "failed-precondition");
  await invoiceRef.set(signed);
  const extraId = cycleStartDate + ":monthly:extra";
  await tenantRef.collection("hybridBillingInvoices").doc(extraId).set({
    ...signed, id: extraId,
  });
  await assert.rejects(callable.getPlatformTenantHybridInvoiceEvidence.run({
    ...admin, data: { tenantId },
  }), error => error.code === "failed-precondition");
  await tenantRef.collection("hybridBillingInvoices").doc(extraId).delete();
  await invoiceRef.delete();
  await assert.rejects(callable.getPlatformTenantHybridInvoiceEvidence.run({
    ...admin, data: { tenantId },
  }), error => error.code === "failed-precondition");
  const forged = { ...signed, status: "paid" };
  assert.doesNotThrow(() => verifyOnePeriod(period,
    [{id, data: forged}], [{id}]));
  // Even a persisted "paid" state does NOT become bank-source verified.
  assert.equal(verifyOnePeriod(period, [{ id, data: forged }], [{ id }])
    .invoices[0].bankVerified, false);
});
