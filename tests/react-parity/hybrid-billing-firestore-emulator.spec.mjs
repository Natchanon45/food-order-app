// REAL Firestore Emulator integration UAT. NEVER run against production.
// Run ONLY via: npm run test:hybrid-billing:emulator
import test from "node:test";
import assert from "node:assert/strict";
import { hybridDeliveryCashierRoute } from "../../react-app/src/data/hybridCodCashierRoute.mjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const PROJECT_ID = "demo-penguin-hybrid-uat";
if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || "")
  || process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== PROJECT_ID
  || !PROJECT_ID.startsWith("demo-")) {
  throw new Error("HYBRID_EMULATOR_REQUIRED: refusing any real Firebase project or non-loopback host");
}
const functionsRequire = createRequire(new URL("../../functions/hybrid-billing-ledger.js", import.meta.url));
const { initializeApp, deleteApp } = functionsRequire("firebase-admin/app");
const { getFirestore, Timestamp } = functionsRequire("firebase-admin/firestore");
const { issueHybridInvoicesForClosedDay } = require("../../functions/hybrid-billing-ledger.js");
const { reconcileHybridArrears } = require("../../functions/hybrid-billing-arrears.js");
const { approveHybridRecovery } = require("../../functions/hybrid-billing-recovery.js");
const { runHybridBillingDaily } = require("../../functions/hybrid-billing-daily.js");
const { makeHybridFinanceHandler } = require("../../functions/hybrid-billing-finance-api.js");
const { scanHybridPaidReceiptExceptions, inspectHybridClosedDayAdjustments } = require("../../functions/hybrid-billing-receipt-audit.js");
const { submitHybridPaymentEvidence, reviewHybridPaymentEvidence } =
  require("../../functions/hybrid-billing-payments.js");
const { paidOrdersInWindow, auditPaidDeliveryReceiptCoverage, previewHybridCycle } = require("../../functions/hybrid-billing-preview.js");

const app = initializeApp({ projectId: PROJECT_ID }, "hybrid-billing-emulator-uat");
const db = getFirestore(app);
const cycleId = "2026-10-16";
const tenant = id => db.collection("tenants").doc(id);
const stamp = date => Timestamp.fromDate(new Date(date));
const now = value => new Date(value);
const midnightAfterTrigger = "2026-10-20T17:01:00.000Z"; // 21 Oct, 00:01 Bangkok
const settings = { monthlyFee: 590, deliveryThreshold: 10000,
  deliveryShareRate: 5, monthlySlipQuota: 100 };

async function activate(id, extra = {}) {
  const ref = tenant(id);
  await ref.create({
    active: true, billingPolicyVersion: "hybrid_v1", hybridBillingEnabled: true,
    hybridBillingStartDate: cycleId, hybridBillingSnapshot: settings, ...extra,
  });
  return ref;
}
async function order(ref, id, paidAt, merchandise, extra = {}) {
  await ref.collection("orders").doc(id).create({
    orderType: "delivery", paymentStatus: "paid", status: "delivered",
    paidAt: stamp(paidAt), subtotalAmount: merchandise,
    deliveryFee: 40, totalAmount: merchandise + 40,
    ...extra,
  });
}
const issue = (id, timestamp) => issueHybridInvoicesForClosedDay({
  db, tenantId: id, cycleId, now: now(timestamp),
});
const invoices = async ref => (await ref.collection("hybridBillingInvoices").get()).docs.map(d => d.data());

test("emulator: full trigger day 15500 -> 775 baht only after Bangkok midnight", async () => {
  const id = "tenant-emu-trigger-01", ref = await activate(id);
  await order(ref, "morning-09", "2026-10-20T02:00:00Z", 10000);
  const premature = await issue(id, "2026-10-20T10:00:00Z"); // 17:00 Oct20
  assert.equal(premature.issued.length, 0);
  await order(ref, "evening-23", "2026-10-20T16:00:00Z", 5500);
  const issued = await issue(id, midnightAfterTrigger);
  assert.deepEqual(issued.issued, [cycleId + ":delivery:trigger"]);
  const one = await invoices(ref);
  assert.equal(one.length, 1);
  assert.equal(one[0].baseCents, 1550000);
  assert.equal(one[0].amountCents, 77500);
  assert.equal(one[0].dueDate, "2026-10-20");
  assert.equal(one[0].suspendFrom, "2026-10-21");
  assert.deepEqual((await issue(id, midnightAfterTrigger)).issued, []);
  assert.equal((await invoices(ref)).length, 1);
  await order(ref, "after-midnight", "2026-10-20T17:00:00Z", 2000);
  assert.equal((await issue(id, "2026-10-20T17:05:00Z")).issued.length, 0);
  const next = await issue(id, "2026-10-21T17:01:00Z");
  assert.deepEqual(next.issued, [cycleId + ":delivery:2026-10-21"]);
  const list = await invoices(ref);
  assert.deepEqual(list.map(row => row.amountCents).sort((a, b) => a - b), [10000, 77500]);
});

test("emulator: changed historical refund after a day seal blocks silent rebilling", async () => {
  const id = "tenant-emu-refund-02", ref = await activate(id);
  await order(ref, "paid-a", "2026-10-20T02:00:00Z", 10000);
  await issue(id, midnightAfterTrigger);
  await ref.collection("orders").doc("paid-a").update({ refundTotal: 1000 });
  await assert.rejects(issue(id, "2026-10-21T17:01:00Z"),
    /HYBRID_CLOSED_DAY_CHANGED_REQUIRES_ADJUSTMENT/);
  assert.equal((await invoices(ref)).length, 1);
});

test("emulator: outstanding 775 THB suspends next day; slip alone does NOT settle", async () => {
  const id = "tenant-emu-arrears-03", ref = await activate(id);
  await order(ref, "paid-b", "2026-10-20T02:00:00Z", 15500);
  await issue(id, midnightAfterTrigger);
  const invoiceId = cycleId + ":delivery:trigger";
  const attemptId = "evidence-emu-1234";
  const owner = { uid: "owner-emu-123", tenantId: id, role: "owner", active: true };
  const reviewer = { uid: "super-emu-123", role: "super_admin", active: true };
  // verifiedStorage is a mock trusted wrapper input here; NO real Storage verification.
  const slip = "tenants/" + id + "/hybrid-billing-slips/" + attemptId + "/test.png";
  await submitHybridPaymentEvidence({
    db, tenantId: id, invoiceId, attemptId, slipPath: slip,
    verifiedStorage: true, actor: owner,
  });
  assert.equal((await ref.collection("hybridBillingSettlements").get()).size, 0);
  const suspended = await reconcileHybridArrears({
    db, tenantId: id, now: now(midnightAfterTrigger),
  });
  assert.equal(suspended.status, "suspended");
  assert.equal((await ref.get()).data().active, false);
  assert.equal((await ref.get()).data().hybridBillingSuspended, true);
  await reviewHybridPaymentEvidence({
    db, tenantId: id, attemptId, actor: reviewer, decision: "approve",
    confirmedAmountCents: 77500, recipientConfirmed: true,
    bankTxnRef: "EMULATOR-BANK-REF-ONLY-12345",
  });
  const waiting = await reconcileHybridArrears({ db, tenantId: id, now: now(midnightAfterTrigger) });
  assert.equal(waiting.status, "settled_waiting_for_safe_recovery");
  assert.equal((await ref.get()).data().active, false); // manual recovery gate
});

test("emulator: 520 paidAt receipts page correctly inside real Firestore transaction", async () => {
  const id = "tenant-emu-pages-04", ref = await activate(id);
  const orders = ref.collection("orders");
  for (let start = 0; start < 520; start += 260) {
    const batch = db.batch();
    for (let i = start; i < Math.min(520, start + 260); i++) {
      batch.create(orders.doc("page-" + String(i).padStart(4, "0")), {
        paidAt: stamp("2026-10-20T02:00:00Z"), orderType: "delivery",
        paymentStatus: "paid", status: "delivered",
        totalAmount: 1.40, deliveryFee: 0.40, subtotalAmount: 1,
      });
    }
    await batch.commit();
  }
  const start = now("2026-10-16T00:00:00+07:00");
  const end = now("2026-11-16T00:00:00+07:00");
  const audit = await db.runTransaction(tx =>
    auditPaidDeliveryReceiptCoverage(ref, { transaction: tx, maxRecords: 520 }));
  assert.equal(audit.scanned, 520);
  await assert.rejects(db.runTransaction(tx =>
    auditPaidDeliveryReceiptCoverage(ref, { transaction: tx, maxRecords: 500 })),
  /HYBRID_RECEIPT_AUDIT_LIMIT/);
  const result = await db.runTransaction(async tx =>
    paidOrdersInWindow(ref, start, end, { transaction: tx, includeIds: true, maxRecords: 520 }));
  assert.equal(result.length, 520);
  assert.equal(new Set(result.map(row => row.id)).size, 520);
  await assert.rejects(db.runTransaction(async tx =>
    paidOrdersInWindow(ref, start, end, { transaction: tx, maxRecords: 500 })),
  /resource-exhausted|safe limit/i);
});

test("emulator: legacy/non-activated tenants stay outside Hybrid billing", async () => {
  const id = "tenant-emu-legacy-05";
  await db.collection("tenants").doc(id).create({
    billingPolicyVersion: "legacy", active: true, hybridBillingEnabled: false,
    hybridBillingStartDate: cycleId,
  });
  await assert.rejects(issue(id, midnightAfterTrigger), /HYBRID_TENANT_NOT_ACTIVATED/);
  assert.equal((await invoices(tenant(id))).length, 0);
});

test.after(async () => { await deleteApp(app); });

test("emulator: simultaneous close-day invoice jobs create only one immutable invoice", async () => {
  const id = "tenant-emu-concurrent-06", ref = await activate(id);
  await order(ref, "paid-09", "2026-10-20T02:00:00Z", 10000);
  await order(ref, "paid-23", "2026-10-20T16:00:00Z", 5500);
  const attempts = await Promise.allSettled([
    issue(id, midnightAfterTrigger), issue(id, midnightAfterTrigger),
    issue(id, midnightAfterTrigger),
  ]);
  const successes = attempts.filter(row => row.status === "fulfilled");
  assert.ok(successes.length >= 1,
    "At least one invoice job must succeed under concurrent transactions");
  assert.equal(successes.reduce((n, row) => n + row.value.issued.length, 0), 1);
  assert.deepEqual((await invoices(ref)).map(row => row.amountCents), [77500]);
  assert.equal((await issue(id, midnightAfterTrigger)).issued.length, 0);
});

test("emulator: old-cycle overdue invoice persists after signup-anniversary rollover", async () => {
  const id = "tenant-emu-prior-cycle-07", ref = await activate(id);
  const invoiceId = "2026-10-16:delivery:trigger";
  await ref.collection("hybridBillingInvoices").doc(invoiceId).create({
    tenantId: id, invoiceId, policyVersion: "hybrid_v1", amountCents: 77500,
    currency: "THB", suspendFrom: "2026-11-15", serviceDate: "2026-10-20",
  });
  const state = await reconcileHybridArrears({
    db, tenantId: id, now: now("2026-11-16T02:00:00Z"),
  });
  assert.equal(state.status, "suspended");
  assert.deepEqual(state.outstandingIds, [invoiceId]);
  assert.equal((await ref.get()).data().active, false);
});

test("emulator: one bank reference cannot approve two different cycle invoices", async () => {
  const id = "tenant-emu-bankref-08", ref = await activate(id);
  const first = cycleId + ":delivery:trigger";
  const second = cycleId + ":delivery:2026-10-21";
  for (const invoiceId of [first, second]) {
    await ref.collection("hybridBillingInvoices").doc(invoiceId).create({
      tenantId: id, invoiceId, policyVersion: "hybrid_v1", amountCents: 77500,
      currency: "THB",
    });
  }
  const owner = { uid: "owner-bankref-8", role: "owner", tenantId: id, active: true };
  const reviewer = { uid: "super-bankref-8", role: "super_admin", active: true };
  const evidence = async (invoiceId, attemptId) => submitHybridPaymentEvidence({
    db, tenantId: id, invoiceId, attemptId, actor: owner, verifiedStorage: true,
    slipPath: "tenants/" + id + "/hybrid-billing-slips/" + attemptId + "/test.png",
  });
  const attemptA = "attempt-bankref-0008A", attemptB = "attempt-bankref-0008B";
  await evidence(first, attemptA);
  await evidence(second, attemptB);
  const args = attemptId => ({
    db, tenantId: id, attemptId, actor: reviewer, decision: "approve",
    bankTxnRef: "BANK-ONLY-EMULATOR-REF-0008",
    confirmedAmountCents: 77500, recipientConfirmed: true,
  });
  await reviewHybridPaymentEvidence(args(attemptA));
  await assert.rejects(reviewHybridPaymentEvidence(args(attemptB)),
    /HYBRID_DUPLICATE_BANK_REFERENCE/);
  assert.equal((await ref.collection("hybridBillingSettlements").get()).size, 1);
});

test("emulator race: paidAt order inserted after tenant reads but BEFORE query scan is handled safely", async () => {
  const id = "tenant-emu-race-before-query-09", ref = await activate(id);
  await order(ref, "morning-09", "2026-10-20T02:00:00Z", 10000);
  let attempts = 0;
  let injected = false;
  let result;
  let failure;
  try {
    result = await issueHybridInvoicesForClosedDay({
      db, tenantId: id, cycleId, now: now(midnightAfterTrigger),
      auditReceipts: async (tenantRef, options) => {
        // Insert BEFORE the source audit first reads the order collection.
        // A writer awaited after an active transactional query can deadlock.
        if (!injected) {
          injected = true;
          await order(ref, "late-23", "2026-10-20T16:00:00Z", 5500);
        }
        return auditPaidDeliveryReceiptCoverage(tenantRef, options);
      },
      readOrders: async (tenantRef, start, end, options) => {
        attempts++;
        assert.equal(typeof options.transaction?.get, "function");
        return paidOrdersInWindow(tenantRef, start, end, options);
      },
    });
  } catch (error) {
    failure = error;
  }
  if (failure) {
    assert.equal((await invoices(ref)).length, 0,
      "aborted invoice transaction must not leave an incomplete invoice");
  } else {
    const rows = await invoices(ref);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].baseCents, 1550000,
      "paidAt insert before transactional query must not cause an underbilled immutable invoice");
    assert.equal(rows[0].amountCents, 77500);
    assert.deepEqual(result.issued, [cycleId + ":delivery:trigger"]);
  }
  assert.equal(injected, true);
  assert.ok(attempts >= 1);
});

test("emulator: backdated paid order AFTER a closed-day seal fails closed, never revises original bill", async () => {
  const id = "tenant-emu-race-after-close-10", ref = await activate(id);
  await order(ref, "morning-09", "2026-10-20T02:00:00Z", 10000);
  const initial = await issue(id, midnightAfterTrigger);
  assert.deepEqual(initial.issued, [cycleId + ":delivery:trigger"]);
  assert.equal((await invoices(ref))[0].amountCents, 50000);
  await order(ref, "backdated-23", "2026-10-20T16:00:00Z", 5500);
  await assert.rejects(issue(id, "2026-10-21T17:01:00Z"),
    /HYBRID_CLOSED_DAY_CHANGED_REQUIRES_ADJUSTMENT/);
  const after = await invoices(ref);
  assert.equal(after.length, 1);
  assert.equal(after[0].amountCents, 50000);
});

test("emulator race: refund writer overlaps the invoice transaction paidAt scan", async () => {
  const id = "tenant-emu-race-refund-11", ref = await activate(id);
  await order(ref, "paid-09", "2026-10-20T02:00:00Z", 15500);
  const document = ref.collection("orders").doc("paid-09");
  let writePromise;
  let started = false;
  let outcome;
  try {
    outcome = await issueHybridInvoicesForClosedDay({
      db, tenantId: id, cycleId, now: now(midnightAfterTrigger),
      readOrders: async (tenantRef, start, end, options) => {
        const rows = await paidOrdersInWindow(tenantRef, start, end, options);
        if (!started) {
          started = true;
          // Start a genuinely concurrent writer AFTER the receipt query read.
          // Do not await it inside this transaction, or a Firestore read lock
          // would stall both parties instead of exercising contention.
          writePromise = document.update({ refundTotal: 500 });
        }
        return rows;
      },
    });
  } catch (error) {
    outcome = { failed: error };
  }
  assert.equal(started, true);
  assert.ok(writePromise);
  await writePromise;
  const persisted = await document.get();
  assert.equal(persisted.data().refundTotal, 500);
  const list = await invoices(ref);
  assert.ok(list.length === 0 || list.length === 1);
  if (list.length === 1) {
    assert.ok([75000, 77500].includes(list[0].amountCents),
      "only pre-refund or post-refund snapshot can be committed");
    // The old snapshot is never rewritten automatically. If a refund commits
    // later, subsequent day-close MUST raise adjustment-required instead.
    if (list[0].amountCents === 77500) {
      await assert.rejects(issue(id, "2026-10-21T17:01:00Z"),
        /HYBRID_CLOSED_DAY_CHANGED_REQUIRES_ADJUSTMENT/);
    } else {
      const unchanged = await issue(id, "2026-10-21T17:01:00Z");
      assert.equal(unchanged.issued.length, 0);
    }
  }
});

test("emulator race: two invoice jobs plus one overlapping late paid-order writer never duplicate IDs", async () => {
  const id = "tenant-emu-race-async-order-12", ref = await activate(id);
  await order(ref, "paid-09", "2026-10-20T02:00:00Z", 10000);
  let started = false;
  let insertPromise;
  const readOrders = async (tenantRef, start, end, options) => {
    const rows = await paidOrdersInWindow(tenantRef, start, end, options);
    if (!started) {
      started = true;
      insertPromise = order(ref, "paid-23", "2026-10-20T16:00:00Z", 5500);
    }
    return rows;
  };
  const inputs = () => ({
    db, tenantId: id, cycleId, now: now(midnightAfterTrigger), readOrders,
  });
  await Promise.allSettled([
    issueHybridInvoicesForClosedDay(inputs()),
    issueHybridInvoicesForClosedDay(inputs()),
  ]);
  assert.equal(started, true);
  await insertPromise;
  const list = await invoices(ref);
  assert.ok(list.length <= 1, "no duplicate invoices are allowed during contention");
  if (list.length === 1) {
    if (list[0].amountCents === 50000) {
      await assert.rejects(issue(id, "2026-10-21T17:01:00Z"),
        /HYBRID_CLOSED_DAY_CHANGED_REQUIRES_ADJUSTMENT/);
    } else {
      assert.equal(list[0].amountCents, 77500);
      assert.equal((await issue(id, "2026-10-21T17:01:00Z")).issued.length, 0);
    }
  }
});

test.todo("RELEASE BLOCKER: fix cashier non-PromptPay paidAt at trusted source; audit now stops invoices but does not canonicalize, migrate or scale");
test.todo("RELEASE BLOCKER: Firestore client writes for suspended Hybrid tenant must be denied by actual production-rule candidate and backend guards");

test("emulator P0 guard: paid Delivery ISO string paidAt is NOT silently left out of invoice", async () => {
  const id = "tenant-emu-noncanonical-13", ref = await activate(id);
  await order(ref, "valid-09", "2026-10-20T02:00:00Z", 10000);
  await ref.collection("orders").doc("legacy-paid-string").create({
    orderType: "delivery", paymentStatus: "paid", status: "delivered",
    paidAt: "2026-10-20T16:00:00Z", subtotalAmount: 5500,
    totalAmount: 5540, deliveryFee: 40,
  });
  await assert.rejects(issue(id, midnightAfterTrigger),
    /HYBRID_PAID_DELIVERY_NONCANONICAL_TIMESTAMP:legacy-paid-string/);
  assert.equal((await invoices(ref)).length, 0, "No underbilled 500 THB invoice");
  await assert.rejects(previewHybridCycle(ref, (await ref.get()).data(), cycleId, db),
    /HYBRID_PAID_DELIVERY_NONCANONICAL_TIMESTAMP:legacy-paid-string/);
  assert.equal((await ref.collection("hybridBillingPeriods").get()).size, 0,
    "Failure must not write or seal a partial period");
  await ref.collection("orders").doc("legacy-paid-string").delete();
  await ref.collection("orders").doc("missing-paid-at").create({
    orderType: "delivery", paymentStatus: "paid", status: "delivered",
    subtotalAmount: 5500, totalAmount: 5540, deliveryFee: 40,
  });
  await assert.rejects(issue(id, midnightAfterTrigger),
    /HYBRID_PAID_DELIVERY_NONCANONICAL_TIMESTAMP:missing-paid-at/);
  assert.equal((await invoices(ref)).length, 0);
});

test("emulator P0 guard: canonical paidAt coverage scans all Delivery receipts, excludes POS", async () => {
  const id = "tenant-emu-coverage-14", ref = await activate(id);
  await order(ref, "canonical-09", "2026-10-20T02:00:00Z", 10000);
  await order(ref, "pos-iso", "2026-10-20T16:00:00Z", 5000,
    { orderType: "pos", paidAt: "2026-10-20T16:00:00Z" });
  const coverage = await db.runTransaction(tx =>
    auditPaidDeliveryReceiptCoverage(ref, { transaction: tx }));
  assert.equal(coverage.scanned, 1);
  const result = await issue(id, midnightAfterTrigger);
  assert.deepEqual(result.issued, [cycleId + ":delivery:trigger"]);
  assert.equal((await invoices(ref))[0].amountCents, 50000);
});

const { settleHybridCodDeliveryPayment } = require("../../functions/hybrid-billing-cod-payment.js");
async function codActor(uid, tenantId, role = "cashier") {
  await db.collection("users").doc(uid).set({ uid, tenantId, role, active: true });
}
async function unpaidCod(tenantRef, id, subtotal, extra = {}) {
  await tenantRef.collection("orders").doc(id).create({
    tenantId: tenantRef.id, orderType: "delivery", paymentMethod: "cod",
    paymentStatus: "unpaid", status: "served", items: [{ menuId: "m1", qty: 1 }],
    subtotalAmount: subtotal, deliveryFee: 40, totalAmount: subtotal + 40, ...extra,
  });
}
test("emulator Phase3I: authorized Hybrid COD cashier stamps Timestamp exactly once", async () => {
  const id = "tenant-emu-cod-server-15", ref = await activate(id);
  const uid = "cashier-cod-emu-001", orderId = "cod-order-server-001";
  await codActor(uid, id);
  await unpaidCod(ref, orderId, 15500);
  const args = { db, tenantId: id, orderId, actorUid: uid };
  const results = await Promise.all([
    settleHybridCodDeliveryPayment(args), settleHybridCodDeliveryPayment(args),
  ]);
  assert.deepEqual(results.map(x => x.alreadyPaid).sort(), [false, true]);
  const written = (await ref.collection("orders").doc(orderId).get()).data();
  assert.equal(written.paymentStatus, "paid");
  assert.equal(written.paymentReceiptSource, "hybrid_cod_cashier_server");
  assert.equal(written.paymentReceivedByUid, uid);
  assert.ok(written.paidAt?.toDate?.() instanceof Date);
  // Live server time is different from the synthetic Oct billing-cycle dates.
  assert.deepEqual(await db.runTransaction(tx =>
    auditPaidDeliveryReceiptCoverage(ref, { transaction: tx })),
    { scanned: 1, source: "all_paid_delivery" });
});

test("emulator Phase3I: COD cashier blocks cross-tenant actor and suspended tenant", async () => {
  const id = "tenant-emu-cod-denied-16", ref = await activate(id);
  const uid = "cashier-cod-emu-002", orderId = "cod-order-server-002";
  await codActor(uid, "unrelated-tenant-001");
  await unpaidCod(ref, orderId, 900);
  const payment = () => settleHybridCodDeliveryPayment({
    db, tenantId: id, orderId, actorUid: uid,
  });
  await assert.rejects(payment(), /HYBRID_COD_CASHIER_NOT_AUTHORIZED/);
  await codActor(uid, id);
  await ref.collection("orders").doc(orderId).update({ paymentStatus: "pending_verification" });
  await assert.rejects(payment(), /HYBRID_COD_PAYMENT_STATUS_CONFLICT/);
  await ref.collection("orders").doc(orderId).update({ paymentStatus: "unpaid" });
  await ref.update({ active: false, hybridBillingSuspended: true });
  await assert.rejects(payment(), /HYBRID_COD_TENANT_NOT_ENABLED/);
  const record = (await ref.collection("orders").doc(orderId).get()).data();
  assert.equal(record.paidAt, undefined);
  assert.equal(record.paymentStatus, "unpaid");
});

test("emulator Phase3I: Lalamove COMPLETED never settles COD funds without independent bank proof", async () => {
  const id = "tenant-emu-cod-lalamove-17", ref = await activate(id);
  const uid = "cashier-cod-emu-003", orderId = "cod-order-lalamove-003";
  await codActor(uid, id);
  await unpaidCod(ref, orderId, 1000, {
    deliveryProvider: "lalamove", lalamoveOrderStatus: "PICKED_UP",
    status: "ready",
  });
  const payment = () => settleHybridCodDeliveryPayment({ db, tenantId: id, orderId, actorUid: uid });
  await assert.rejects(payment(), /HYBRID_COD_LALAMOVE_PROVIDER_SETTLEMENT_REQUIRED/);
  // Browser-forged COMPLETED alone must never settle money.
  await ref.collection("orders").doc(orderId).update({ lalamoveOrderStatus: "COMPLETED" });
  await assert.rejects(payment(), /HYBRID_COD_LALAMOVE_PROVIDER_SETTLEMENT_REQUIRED/);
  // This synthetic Admin SDK write models trusted webhook/refresh status,
  // NOT proof that COD proceeds ever reached merchant's bank.
  await ref.collection("orders").doc(orderId).update({
    lalamoveCodEnabled: true,
    lalamoveOrderId: "LALAMOVE-TEST-ID-003",
    lalamoveCompletedAt: "2026-10-20T12:00:00Z",
    lalamoveCodDeliveryCompletedAt: "2026-10-20T12:00:00Z",
  });
  await assert.rejects(payment(), /HYBRID_COD_LALAMOVE_PROVIDER_SETTLEMENT_REQUIRED/);
  const record = (await ref.collection("orders").doc(orderId).get()).data();
  assert.equal(record.paymentStatus, "unpaid");
  assert.equal(record.lalamoveCodSettlementStatus, undefined);
  assert.equal(record.paidAt, undefined);
  assert.equal((await ref.collection("hybridBillingReceiptEvents").get()).size, 0);
});

test("emulator Phase3I: preexisting paid ISO receipt requires manual reconciliation", async () => {
  const id = "tenant-emu-cod-legacy-18", ref = await activate(id);
  const uid = "cashier-cod-emu-004", orderId = "cod-order-legacy-004";
  await codActor(uid, id);
  await unpaidCod(ref, orderId, 900);
  await ref.collection("orders").doc(orderId).update({
    paymentStatus: "paid", paidAt: "2026-10-20T16:00:00Z",
  });
  await assert.rejects(settleHybridCodDeliveryPayment({
    db, tenantId: id, orderId, actorUid: uid,
  }), /HYBRID_COD_EXISTING_PAYMENT_REQUIRES_RECONCILIATION/);
  assert.equal((await ref.collection("orders").doc(orderId).get()).data().paidAt,
    "2026-10-20T16:00:00Z");
});
test("emulator Phase3I: COD handler does not change legacy tenant invoices or payments", async () => {
  const id = "tenant-emu-cod-original-19";
  await db.collection("tenants").doc(id).create({
    active: true, billingPolicyVersion: "legacy", businessType: "both",
  });
  const ref = tenant(id), uid = "cashier-cod-emu-005";
  await codActor(uid, id);
  await unpaidCod(ref, "cod-order-legacy-005", 15000);
  await assert.rejects(settleHybridCodDeliveryPayment({
    db, tenantId: id, orderId: "cod-order-legacy-005", actorUid: uid,
  }), /HYBRID_COD_TENANT_NOT_ENABLED/);
  assert.equal((await ref.collection("orders").doc("cod-order-legacy-005").get())
    .data().paymentStatus, "unpaid");
});

test("emulator Phase3J: callable handler uses Auth-shaped UID and real transactional COD receipt", async () => {
  const { makeHybridCodCallableHandler } = require("../../functions/hybrid-billing-cod-callable.js");
  const id = "tenant-emu-callable-20", ref = await activate(id);
  const uid = "cashier-callable-006", orderId = "cod-order-callable-006";
  await codActor(uid, id);
  await unpaidCod(ref, orderId, 15500);
  const handle = makeHybridCodCallableHandler({ getDb: () => db });
  const request = { auth: { uid }, data: { tenantId: id, orderId } };
  const response = await handle(request);
  assert.equal(response.ok, true);
  assert.equal(response.alreadyPaid, false);
  const paid = (await ref.collection("orders").doc(orderId).get()).data();
  assert.equal(paid.paymentReceivedByUid, uid);
  assert.ok(paid.paidAt?.toDate?.() instanceof Date);
  assert.equal((await handle(request)).alreadyPaid, true);
  await assert.rejects(handle({
    ...request, data: { ...request.data, actorUid: "another-user-999" },
  }), /HYBRID_COD_ALLOWED_FIELDS_TENANT_AND_ORDER_ONLY/);
});
test("emulator Phase3J: callable handler denies other tenant and inactive cashier", async () => {
  const { makeHybridCodCallableHandler } = require("../../functions/hybrid-billing-cod-callable.js");
  const id = "tenant-emu-callable-deny-21", ref = await activate(id);
  const uid = "cashier-callable-007", orderId = "cod-order-callable-007";
  await codActor(uid, "unrelated-demo-tenant");
  await unpaidCod(ref, orderId, 200);
  const handle = makeHybridCodCallableHandler({ getDb: () => db });
  const request = { auth: { uid }, data: { tenantId: id, orderId } };
  await assert.rejects(handle(request), error =>
    error.code === "permission-denied" && /HYBRID_COD_CASHIER_NOT_AUTHORIZED/.test(error.message));
  await codActor(uid, id);
  await db.collection("users").doc(uid).update({ active: false });
  await assert.rejects(handle(request), error => error.code === "permission-denied");
  assert.equal((await ref.collection("orders").doc(orderId).get()).data().paymentStatus, "unpaid");
});

test("emulator vertical slice: COD cashier -> trusted receipt -> 775 THB invoice -> bank review -> safe recovery gate", async () => {
  const { makeHybridCodCallableHandler } = require("../../functions/hybrid-billing-cod-callable.js");
  const id = "tenant-emu-vertical-22", ref = await activate(id);
  const uid = "cashier-vertical-008";
  await codActor(uid, id);
  const morning = "cod-vertical-morning-008", evening = "cod-vertical-evening-008";
  await unpaidCod(ref, morning, 10000);
  await unpaidCod(ref, evening, 5500);
  const tenantData = (await ref.get()).data();
  assert.equal(hybridDeliveryCashierRoute(tenantData, {
    orderType: "delivery", paymentMethod: "cod", id: morning,
  }), "cutover_not_released", "source Cashier gate remains OFF");

  // Emulator time-travel ONLY: inject simulated trusted receipt timestamps for
  // this fixed 2026-10-20 anniversary-cycle UAT. Separate tests confirm that
  // the real backend defaults to FieldValue.serverTimestamp() in production.
  const handle = makeHybridCodCallableHandler({
    getDb: () => db,
    settle: async input => settleHybridCodDeliveryPayment({
      ...input, serverTimestamp: () => stamp(
        input.orderId === morning ? "2026-10-20T02:00:00Z" : "2026-10-20T16:00:00Z"
      ),
    }),
  });
  for (const orderId of [morning, evening]) {
    const result = await handle({ auth: { uid }, data: { tenantId: id, orderId } });
    assert.equal(result.ok, true);
    assert.equal(result.alreadyPaid, false);
    const snapshot = (await ref.collection("orders").doc(orderId).get()).data();
    assert.equal(snapshot.paymentStatus, "paid");
    assert.equal(snapshot.paymentReceiptSource, "hybrid_cod_cashier_server");
    assert.ok(snapshot.paidAt?.toDate?.() instanceof Date);
  }

  const closed = await issue(id, midnightAfterTrigger);
  const invoiceId = cycleId + ":delivery:trigger";
  assert.deepEqual(closed.issued, [invoiceId]);
  const invoice = (await ref.collection("hybridBillingInvoices").doc(invoiceId).get()).data();
  assert.equal(invoice.baseCents, 1550000);
  assert.equal(invoice.amountCents, 77500);
  assert.equal((await issue(id, midnightAfterTrigger)).issued.length, 0);

  const attemptId = "vertical-slip-008";
  const owner = { uid: "owner-vertical-008", tenantId: id, role: "owner", active: true };
  await submitHybridPaymentEvidence({
    db, tenantId: id, invoiceId, attemptId,
    slipPath: "tenants/" + id + "/hybrid-billing-slips/" + attemptId + "/proof.png",
    verifiedStorage: true, actor: owner,
  });
  const overdue = await reconcileHybridArrears({ db, tenantId: id,
    now: now(midnightAfterTrigger) });
  assert.equal(overdue.status, "suspended");
  assert.equal((await ref.get()).data().active, false);
  await reviewHybridPaymentEvidence({
    db, tenantId: id, attemptId, decision: "approve",
    actor: { uid: "super-vertical-008", role: "super_admin", active: true },
    confirmedAmountCents: 77500, recipientConfirmed: true,
    bankTxnRef: "EMULATOR-VERTICAL-TRANSFER-REF-008",
  });
  const after = await reconcileHybridArrears({ db, tenantId: id,
    now: now(midnightAfterTrigger) });
  assert.equal(after.status, "settled_waiting_for_safe_recovery");
  assert.equal((await ref.get()).data().active, false);
  // verifiedStorage and reviewed bank transfer are mock attestations here,
  // not provider API verification or a finished merchant-facing payment UI.
});

test("emulator end-to-end: only verified Super Admin can recover after all bank-settled arrears", async () => {
  const id = "tenant-emu-recovery-full-23", ref = await activate(id);
  await order(ref, "receipt-recovery-023", "2026-10-20T03:00:00Z", 15500);
  await issue(id, midnightAfterTrigger);
  const invoiceId = cycleId + ":delivery:trigger";
  const result = await reconcileHybridArrears({ db, tenantId: id, now: now(midnightAfterTrigger) });
  assert.equal(result.status, "suspended");
  const uid = "reviewer-recovery-023", reviewId = "hybrid-review-recover-023";
  await db.collection("users").doc(uid).create({ uid, role: "super_admin", active: true });
  const recover = () => approveHybridRecovery({
    db, tenantId: id, reviewerUid: uid, reviewId,
    now: now(midnightAfterTrigger),
  });
  await assert.rejects(recover(), /HYBRID_RECOVERY_UNPAID/);
  const invoice = (await ref.collection("hybridBillingInvoices").doc(invoiceId).get()).data();
  assert.equal(invoice.amountCents, 77500);
  const attemptId = "receipt-recovery-bank-023";
  await submitHybridPaymentEvidence({
    db, tenantId: id, invoiceId, attemptId,
    slipPath: "tenants/" + id + "/hybrid-billing-slips/" + attemptId + "/proof.png",
    verifiedStorage: true,
    actor: { uid: "owner-recovery-023", tenantId: id, role: "owner", active: true },
  });
  await reviewHybridPaymentEvidence({
    db, tenantId: id, attemptId, decision: "approve",
    actor: { uid, role: "super_admin", active: true },
    bankTxnRef: "RECONCILED-EMULATOR-BANK-023",
    confirmedAmountCents: 77500, recipientConfirmed: true,
  });
  await assert.rejects(approveHybridRecovery({
    db, tenantId: id, reviewerUid: "non-admin-023", reviewId: "review-unauthorized-023",
    now: now(midnightAfterTrigger),
  }), /HYBRID_RECOVERY_SUPER_ADMIN_REQUIRED/);
  const recovered = await recover();
  assert.equal(recovered.status, "reactivated");
  const state = (await ref.get()).data();
  assert.equal(state.active, true);
  assert.equal(state.hybridBillingSuspended, false);
  assert.equal(state.hybridBillingRecoveredBy, uid);
  assert.equal((await recover()).status, "already_reviewed");
  assert.equal((await ref.collection("hybridBillingRecoveryReviews").get()).size, 1);
});
test("emulator recovery: no automatic reactivation for a manual Super Admin hold", async () => {
  const id = "tenant-emu-recovery-hold-024", ref = await activate(id);
  await order(ref, "receipt-manual-hold-024", "2026-10-20T02:30:00Z", 15500);
  await issue(id, midnightAfterTrigger);
  await reconcileHybridArrears({ db, tenantId: id, now: now(midnightAfterTrigger) });
  await ref.update({ hybridBillingManualHold: true });
  const uid = "reviewer-hold-024";
  await db.collection("users").doc(uid).set({ uid, role: "super_admin", active: true });
  await assert.rejects(approveHybridRecovery({
    db, tenantId: id, reviewerUid: uid, reviewId: "manual-hold-024",
    now: now(midnightAfterTrigger),
  }), /HYBRID_RECOVERY_NOT_ELIGIBLE/);
  assert.equal((await ref.get()).data().active, false);
});

test("emulator daily orchestration: Bangkok close issues and suspends exact previous-cycle invoice", async () => {
  const id = "tenant-emu-daily-25", ref = await activate(id);
  await order(ref, "morning-daily-025", "2026-10-20T02:00:00Z", 10000);
  await order(ref, "evening-daily-025", "2026-10-20T16:00:00Z", 5500);
  const readTenants = async () => ({ docs: [await ref.get()], size: 1 });
  const run = () => runHybridBillingDaily({
    db, readTenants, now: new Date("2026-10-20T17:31:00Z"),
  });
  const outcome = await run();
  assert.equal(outcome.today, "2026-10-21");
  assert.equal(outcome.previous, "2026-10-20");
  assert.equal(outcome.scanned, 1);
  assert.deepEqual(outcome.outcomes[0].closeResult.issued,
    [cycleId + ":delivery:trigger"]);
  assert.equal(outcome.outcomes[0].arrears, "suspended");
  const row = (await ref.collection("hybridBillingInvoices")
    .doc(cycleId + ":delivery:trigger").get()).data();
  assert.equal(row.amountCents, 77500);
  const retry = await run();
  assert.deepEqual(retry.outcomes[0].closeResult.issued, []);
  assert.equal((await ref.collection("hybridBillingInvoices").get()).size, 1);
  assert.equal((await ref.get()).data().active, false);
});

test("emulator integrated finance API: owner proof -> Super Admin bank approval -> supervised recovery", async () => {
  const id = "tenant-emu-finance-api-26", ref = await activate(id);
  await order(ref, "receipt-finance-api-026", "2026-10-20T02:00:00Z", 15500);
  await issue(id, midnightAfterTrigger);
  const invoiceId = cycleId + ":delivery:trigger";
  await reconcileHybridArrears({ db, tenantId: id, now: now(midnightAfterTrigger) });
  const ownerUid = "owner-finance-api-026", adminUid = "admin-finance-api-026";
  await db.collection("users").doc(ownerUid).set({
    uid: ownerUid, active: true, role: "owner", tenantId: id,
  });
  await db.collection("users").doc(adminUid).set({
    uid: adminUid, active: true, role: "super_admin",
  });
  const handle = makeHybridFinanceHandler({
    getDb: () => db, ready: true,
    clock: () => new Date(midnightAfterTrigger),
    getBucket: () => ({ file: () => ({ getMetadata: async () => [{
      size: "12500", contentType: "image/png", metadata: { uploadedByUid: ownerUid },
    }] }) }),
  });
  const owner = data => handle({ auth: { uid: ownerUid }, data: { tenantId: id, ...data } });
  const reviewer = data => handle({ auth: { uid: adminUid }, data: { tenantId: id, ...data } });
  const list = await owner({ action: "list" });
  assert.equal(list.rows.length, 1);
  assert.equal(list.rows[0].status, "unpaid");
  assert.equal(list.rows[0].amountCents, 77500);
  await assert.rejects(owner({
    action: "review", attemptId: "proof-finance-026", decision: "approve",
    bankTxnRef: "FAKE-OWNER-023", confirmedAmountCents: 77500, recipientConfirmed: true,
  }), error => error.code === "permission-denied");
  const attemptId = "proof-finance-026";
  const evidence = await owner({ action: "submit", invoiceId, attemptId,
    slipPath: "tenants/" + id + "/hybrid-billing-slips/" + attemptId + "/proof.png" });
  assert.equal(evidence.status, "pending_review");
  await assert.rejects(owner({ action: "queue" }),
    error => error.code === "permission-denied");
  const pendingQueue = await reviewer({ action: "queue" });
  assert.equal(pendingQueue.rows.length, 1);
  assert.equal(pendingQueue.rows[0].attemptId, attemptId);
  assert.equal(pendingQueue.rows[0].amountCents, 77500);
  assert.equal((await ref.get()).data().active, false);
  const review = await reviewer({ action: "review", attemptId, decision: "approve",
    bankTxnRef: "BANK-RECONCILED-IN-TEST-026", confirmedAmountCents: 77500,
    recipientConfirmed: true,
  });
  assert.equal(review.decision, "approve");
  assert.equal((await reviewer({ action: "queue" })).rows.length, 0);
  assert.equal((await owner({ action: "list" })).rows[0].status, "paid");
  // Finance wrapper deliberately uses a live Server clock for recovery.
  const recovered = await reviewer({ action: "recover", reviewId: "recovery-review-026" });
  assert.equal(recovered.status, "reactivated");
  assert.equal((await ref.get()).data().active, true);
  await assert.rejects(owner({
    action: "submit", invoiceId, attemptId,
    slipPath: "tenants/" + id + "/hybrid-billing-slips/" + attemptId + "/proof.png",
    actorUid: adminUid,
  }), error => error.code === "invalid-argument");
});

test("emulator: paginated legacy receipt exceptions report never writes to historical paidAt", async () => {
  const id = "tenant-emu-receipt-audit-27", ref = await activate(id);
  await order(ref, "receipt-01", "2026-10-20T02:00:00Z", 10000);
  await ref.collection("orders").doc("receipt-02").create({
    orderType: "delivery", paymentStatus: "paid", status: "delivered",
    paidAt: "2026-10-20T16:00:00Z", subtotalAmount: 5500,
    deliveryFee: 40, totalAmount: 5540,
  });
  await ref.collection("orders").doc("receipt-03").create({
    orderType: "delivery", paymentStatus: "paid", status: "delivered",
    subtotalAmount: 150, deliveryFee: 40, totalAmount: 190,
  });
  await order(ref, "receipt-04", "2026-10-20T13:00:00Z", 500, {
    subtotalAmount: -100,
  });
  await order(ref, "pos-ignored", "2026-10-20T09:00:00Z", 1000, {
    orderType: "pos", paidAt: "2026-10-20T09:00:00Z",
  });
  const first = await scanHybridPaidReceiptExceptions({ db, tenantId: id, pageSize: 2 });
  assert.equal(first.scanned, 2);
  assert.equal(first.hasMore, true);
  assert.deepEqual(first.issues, [{
    orderId: "receipt-02", reason: "noncanonical_paid_at",
  }]);
  assert.equal(first.nextAfterId, "receipt-02");
  const next = await scanHybridPaidReceiptExceptions({
    db, tenantId: id, pageSize: 2, afterId: first.nextAfterId,
  });
  assert.equal(next.scanned, 2);
  assert.equal(next.hasMore, false);
  assert.deepEqual(next.issues, [
    { orderId: "receipt-03", reason: "noncanonical_paid_at" },
    { orderId: "receipt-04", reason: "invalid_financial_fields" },
  ]);
  const iso = (await ref.collection("orders").doc("receipt-02").get()).data();
  assert.equal(typeof iso.paidAt, "string", "audit must not silently convert ISO to Timestamp");
  await assert.rejects(issue(id, midnightAfterTrigger),
    /HYBRID_PAID_DELIVERY_NONCANONICAL_TIMESTAMP/);
  assert.equal((await invoices(ref)).length, 0);
});

test("emulator: only authenticated Super Admin can inventory exceptions through finance handler", async () => {
  const id = "tenant-emu-finance-audit-28", ref = await activate(id);
  await ref.collection("orders").doc("receipt-iso-01").create({
    orderType: "delivery", paymentStatus: "paid", status: "delivered",
    paidAt: "2026-10-20T03:00:00Z",
    subtotalAmount: 1000, deliveryFee: 0, totalAmount: 1000,
  });
  const ownerId = "owner-audit-28", reviewerId = "super-audit-28";
  await db.collection("users").doc(ownerId).create({
    uid: ownerId, role: "owner", active: true, tenantId: id,
  });
  await db.collection("users").doc(reviewerId).create({
    uid: reviewerId, role: "super_admin", active: true,
  });
  const handle = makeHybridFinanceHandler({ getDb: () => db, ready: true });
  const payload = { action: "audit", tenantId: id, afterId: null };
  await assert.rejects(handle({ auth: { uid: ownerId }, data: payload }),
    error => error.code === "permission-denied");
  const result = await handle({ auth: { uid: reviewerId }, data: payload });
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, [{ orderId: "receipt-iso-01", reason: "noncanonical_paid_at" }]);
  assert.equal(result.note, "read_only_requires_verified_payment_provenance");
  await assert.rejects(handle({ auth: { uid: reviewerId },
    data: { ...payload, autoFix: true } }), error => error.code === "invalid-argument");
  await assert.rejects(handle({ auth: { uid: reviewerId },
    data: { ...payload, afterId: "../tenant" } }), error =>
    /HYBRID_RECEIPT_SCAN_INVALID_REQUEST/.test(error.message));
  assert.equal((await ref.collection("orders").doc("receipt-iso-01").get()).data().paidAt,
    "2026-10-20T03:00:00Z");
});

test("emulator: sealed-day refunds are reported for human credit-note review without mutating invoices", async () => {
  const id = "tenant-emu-adjustments-29", ref = await activate(id);
  await order(ref, "paid-adjust-29", "2026-10-20T02:00:00Z", 15500);
  assert.deepEqual((await issue(id, midnightAfterTrigger)).issued,
    [cycleId + ":delivery:trigger"]);
  const baseline = await inspectHybridClosedDayAdjustments({
    db, tenantId: id, cycleId,
  });
  assert.equal(baseline.requiresReview, false);
  assert.deepEqual(baseline.changed, []);
  assert.equal(baseline.sealedDays, 5);
  await ref.collection("orders").doc("paid-adjust-29").update({ refundTotal: 1000 });
  const adjustment = await inspectHybridClosedDayAdjustments({
    db, tenantId: id, cycleId,
  });
  assert.equal(adjustment.requiresReview, true);
  assert.deepEqual(adjustment.changed, [{
    day: "2026-10-20", originalBaseCents: 1550000,
    currentBaseCents: 1450000, deltaCents: -100000,
    originalReceiptCount: 1, currentReceiptCount: 1,
  }]);
  const existing = (await ref.collection("hybridBillingInvoices")
    .doc(cycleId + ":delivery:trigger").get()).data();
  assert.equal(existing.amountCents, 77500,
    "an immutable original invoice cannot silently be replaced with a credit");
  await assert.rejects(issue(id, "2026-10-21T17:01:00Z"),
    /HYBRID_CLOSED_DAY_CHANGED_REQUIRES_ADJUSTMENT/);
  assert.equal((await ref.collection("hybridBillingInvoices").get()).size, 1);
});

test("emulator: late closed-day paid receipt appears as a debit/review warning without rewriting bills", async () => {
  const id = "tenant-emu-late-audit-30", ref = await activate(id);
  await order(ref, "paid-first-30", "2026-10-20T02:00:00Z", 10000);
  await issue(id, midnightAfterTrigger);
  await order(ref, "paid-late-30", "2026-10-20T16:00:00Z", 5500);
  const result = await inspectHybridClosedDayAdjustments({ db, tenantId: id, cycleId });
  assert.equal(result.requiresReview, true);
  assert.deepEqual(result.changed, [{
    day: "2026-10-20", originalBaseCents: 1000000,
    currentBaseCents: 1550000, deltaCents: 550000,
    originalReceiptCount: 1, currentReceiptCount: 2,
  }]);
  assert.equal((await ref.collection("hybridBillingInvoices")
    .doc(cycleId + ":delivery:trigger").get()).data().amountCents, 50000);
});

test("emulator: only Super Admin can inspect historical adjustment inventory", async () => {
  const id = "tenant-emu-admin-adjust-31", ref = await activate(id);
  await order(ref, "paid-admin-adjust-31", "2026-10-20T02:00:00Z", 15500);
  await issue(id, midnightAfterTrigger);
  const ownerUid = "owner-admin-adjust-31", adminUid = "super-admin-adjust-31";
  await db.collection("users").doc(ownerUid).set({
    uid: ownerUid, active: true, role: "owner", tenantId: id,
  });
  await db.collection("users").doc(adminUid).set({
    uid: adminUid, active: true, role: "super_admin",
  });
  const handle = makeHybridFinanceHandler({ getDb: () => db, ready: true });
  const request = { action: "adjustments", tenantId: id, cycleId };
  await assert.rejects(handle({ auth: { uid: ownerUid }, data: request }),
    error => error.code === "permission-denied");
  const allowed = await handle({ auth: { uid: adminUid }, data: request });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.requiresReview, false);
  await assert.rejects(handle({ auth: { uid: adminUid }, data: {
    ...request, creditAmountCents: 7000,
  } }), error => error.code === "invalid-argument");
  assert.equal((await ref.collection("hybridBillingInvoices").get()).size, 1);
});


test("emulator: independently attested historical paidAt correction is immutable, idempotent and does not modify sealed invoices", async () => {
  const { reconcileHybridHistoricalPaidReceipt } = require("../../functions/hybrid-billing-historical-repair.js");
  const id = "tenant-emu-history-38", ref = await activate(id);
  const uid = "super-history-review-001";
  await db.collection("users").doc(uid).set({ active: true, role: "super_admin" });
  await order(ref, "sealed-first", "2026-10-20T02:00:00Z", 10000);
  await issue(id, midnightAfterTrigger);
  const invoiceId = cycleId + ":delivery:trigger";
  const beforeInvoice = (await ref.collection("hybridBillingInvoices").doc(invoiceId).get()).data();
  const afterSeal = (await ref.collection("hybridBillingPeriods").doc(cycleId).get()).data().daySeals;
  await ref.collection("orders").doc("iso-paid-legacy").create({
    orderType: "delivery", paymentStatus: "paid", status: "delivered",
    paidAt: "2026-10-20T12:00:00.000Z", subtotalAmount: 5500,
    deliveryFee: 40, totalAmount: 5540,
  });
  const request = {
    db, tenantId: id, orderId: "iso-paid-legacy", caseId: "history-case-0001",
    reviewerUid: uid, now: new Date("2026-10-21T03:00:00Z"),
    resolveIndependentPayment: async () => ({
      verified: true, source: "independent_bank_record",
      tenantId: id, orderId: "iso-paid-legacy", currency: "THB",
      recipientConfirmed: true, platformBankAccountVerified: true,
      reference: "BANK-INDEPENDENT-HISTORY-0001",
      evidenceSha256: "b".repeat(64), grossAmountCents: 554000,
      paidAt: new Date("2026-10-20T12:00:00Z"),
      checkedAt: new Date("2026-10-21T02:59:00Z"),
    }),
  };
  await assert.rejects(issue(id, "2026-10-21T17:01:00Z"), /NONCANONICAL|MISSING_SERVER_TIMESTAMP|SOURCE|COVERAGE|PAID_AT/i);
  const a = await reconcileHybridHistoricalPaidReceipt(request);
  assert.equal(a.corrected, true);
  const row = (await ref.collection("orders").doc("iso-paid-legacy").get()).data();
  assert.ok(row.paidAt instanceof Timestamp);
  assert.equal(row.paidAt.toMillis(), Date.parse("2026-10-20T12:00:00Z"));
  assert.equal(row.hybridPaidAtCorrectionCase, request.caseId);
  const repeat = await reconcileHybridHistoricalPaidReceipt(request);
  assert.equal(repeat.alreadyCorrected, true);
  const correction = (await ref.collection("hybridBillingReceiptCorrections").doc(request.caseId).get()).data();
  assert.equal(correction.adjustmentReviewRequired, true);
  assert.deepEqual((await ref.collection("hybridBillingInvoices").doc(invoiceId).get()).data(), beforeInvoice);
  assert.deepEqual((await ref.collection("hybridBillingPeriods").doc(cycleId).get()).data().daySeals, afterSeal);
  const difference = await inspectHybridClosedDayAdjustments({ db, tenantId: id, cycleId });
  assert.equal(difference.requiresReview, true);
  assert.ok(difference.changed.some(d => d.deltaCents === 550000));
  await assert.rejects(issue(id, "2026-10-21T17:01:00Z"), /CLOSED_DAY_CHANGED_REQUIRES_ADJUSTMENT/);
});
test("emulator: historical receipt correction refuses forged reviewer, amount and reused provider reference", async () => {
  const { reconcileHybridHistoricalPaidReceipt } = require("../../functions/hybrid-billing-historical-repair.js");
  const id = "tenant-emu-history-39", ref = await activate(id);
  const uid = "super-history-review-002";
  await db.collection("users").doc(uid).set({ active: true, role: "owner", tenantId: id });
  for (const key of ["receipt-a", "receipt-b"]) {
    await ref.collection("orders").doc(key).create({
      orderType: "delivery", paymentStatus: "paid", status: "delivered",
      paidAt: "2026-10-20T02:00:00Z", subtotalAmount: 100,
      deliveryFee: 10, totalAmount: 110,
    });
  }
  const now = new Date("2026-10-20T10:00:00Z");
  const req = (orderId, amountCents) => ({
    db, tenantId: id, orderId, caseId: "history-case-" + orderId,
    reviewerUid: uid, now, resolveIndependentPayment: async () => ({
      verified: true, source: "independent_bank_record",
      tenantId: id, orderId, currency: "THB",
      recipientConfirmed: true, platformBankAccountVerified: true,
      reference: "BANK-INDEPENDENT-HISTORY-0002",
      evidenceSha256: "c".repeat(64), grossAmountCents: amountCents,
      paidAt: new Date("2026-10-20T02:00:00Z"),
      checkedAt: new Date("2026-10-20T09:59:00Z"),
    }),
  });
  await assert.rejects(reconcileHybridHistoricalPaidReceipt(req("receipt-a", 11000)),
    /SUPER_ADMIN_REQUIRED/);
  await db.collection("users").doc(uid).update({ role: "super_admin" });
  await assert.rejects(reconcileHybridHistoricalPaidReceipt(req("receipt-a", 9999)),
    /AMOUNT_MISMATCH/);
  const good = await reconcileHybridHistoricalPaidReceipt(req("receipt-a", 11000));
  assert.equal(good.corrected, true);
  await assert.rejects(reconcileHybridHistoricalPaidReceipt(req("receipt-b", 11000)),
    /REFERENCE_ALREADY_USED/);
  assert.equal(typeof (await ref.collection("orders").doc("receipt-b").get()).data().paidAt, "string");
});


test("emulator: immutable credit note candidate derives 50 THB from verified 1,000 THB refund without issuing a refund", async () => {
  const { recordHybridReviewedAdjustment } = require("../../functions/hybrid-billing-adjustments.js");
  const id = "tenant-emu-adjust-credit-40", ref = await activate(id);
  const uid = "super-adjust-credit-040";
  await db.collection("users").doc(uid).set({ active: true, role: "super_admin" });
  await order(ref, "sale-adjust-credit", "2026-10-20T02:00:00Z", 15500);
  await issue(id, midnightAfterTrigger);
  const invoiceId = cycleId + ":delivery:trigger";
  const invoiceBefore = (await ref.collection("hybridBillingInvoices").doc(invoiceId).get()).data();
  const period = (await ref.collection("hybridBillingPeriods").doc(cycleId).get()).data();
  await ref.collection("orders").doc("sale-adjust-credit").update({ refundTotal: 1000 });
  const changed = await inspectHybridClosedDayAdjustments({ db, tenantId: id, cycleId });
  assert.equal(changed.changed[0].deltaCents, -100000);
  const { planClosedDay } = require("../../functions/hybrid-billing-ledger.js");
  const ordersNow = (await ref.collection("orders").get()).docs.map(d => ({ id: d.id, data: d.data() }));
  const plan = planClosedDay({ orders: ordersNow, tenantId: id, signupDate: cycleId,
    cycleId, throughDay: "2026-10-20", settings: period.configSnapshot });
  const req = { db, tenantId: id, cycleId, invoiceId, reviewId: "review-adjust-credit-040",
    reviewerUid: uid, now: new Date("2026-10-21T03:00:00Z"),
    resolveIndependentAdjustment: async () => ({
      tenantId: id, cycleId, invoiceId, verified: true, sourceType: "verified_refund",
      evidenceSha256: "d".repeat(64),
      originalSealDigest: period.daySeals["2026-10-20"].digest,
      currentSealDigest: plan.seals["2026-10-20"].digest,
      checkedAt: new Date("2026-10-21T02:59:00Z"),
    }) };
  const recorded = await recordHybridReviewedAdjustment(req);
  assert.equal(recorded.amountCents, 5000);
  assert.equal(recorded.kind, "credit_note_candidate");
  assert.equal(recorded.applied, false);
  assert.equal((await recordHybridReviewedAdjustment(req)).alreadyRecorded, true);
  const note = (await ref.collection("hybridBillingAdjustments").doc(invoiceId).get()).data();
  assert.equal(note.status, "approved_unapplied");
  assert.equal(note.signedDeltaCents, -5000);
  assert.equal(note.refundInitiated, false);
  assert.equal((await ref.collection("hybridBillingSettlements").get()).size, 0);
  assert.deepEqual((await ref.collection("hybridBillingInvoices").doc(invoiceId).get()).data(), invoiceBefore);
  assert.deepEqual((await ref.collection("hybridBillingPeriods").doc(cycleId).get()).data().daySeals, period.daySeals);
  await assert.rejects(issue(id, "2026-10-21T17:01:00Z"), /CLOSED_DAY_CHANGED_REQUIRES_ADJUSTMENT/);
  await assert.rejects(recordHybridReviewedAdjustment({
    ...req, reviewId: "review-adjust-changed-040",
  }), /IMMUTABLE_CONFLICT/);
});
test("emulator: 5,500 THB late paid sale creates only 275 THB unapplied debit candidate", async () => {
  const { recordHybridReviewedAdjustment } = require("../../functions/hybrid-billing-adjustments.js");
  const id = "tenant-emu-adjust-debit-41", ref = await activate(id);
  const uid = "super-adjust-debit-041";
  await db.collection("users").doc(uid).set({ active: true, role: "super_admin" });
  await order(ref, "sale-first-debit", "2026-10-20T02:00:00Z", 10000);
  await issue(id, midnightAfterTrigger);
  const period = (await ref.collection("hybridBillingPeriods").doc(cycleId).get()).data();
  const invoiceId = cycleId + ":delivery:trigger";
  await order(ref, "sale-late-debit", "2026-10-20T16:00:00Z", 5500);
  const { planClosedDay } = require("../../functions/hybrid-billing-ledger.js");
  const rows = (await ref.collection("orders").get()).docs.map(d => ({ id: d.id, data: d.data() }));
  const plan = planClosedDay({ orders: rows, tenantId: id, signupDate: cycleId,
    cycleId, throughDay: "2026-10-20", settings: period.configSnapshot });
  const req = { db, tenantId: id, cycleId, invoiceId, reviewId: "review-adjust-debit-041",
    reviewerUid: uid, now: new Date("2026-10-21T03:00:00Z"),
    resolveIndependentAdjustment: async () => ({
      tenantId: id, cycleId, invoiceId, verified: true,
      sourceType: "verified_late_paid_receipt", evidenceSha256: "e".repeat(64),
      originalSealDigest: period.daySeals["2026-10-20"].digest,
      currentSealDigest: plan.seals["2026-10-20"].digest,
      checkedAt: new Date("2026-10-21T02:59:00Z"),
    }) };
  const debit = await recordHybridReviewedAdjustment(req);
  assert.equal(debit.kind, "debit_note_candidate");
  assert.equal(debit.amountCents, 27500);
  assert.equal(debit.applied, false);
  await assert.rejects(recordHybridReviewedAdjustment({ ...req,
    resolveIndependentAdjustment: async () => ({
      ...await req.resolveIndependentAdjustment(),
      sourceType: "verified_refund",
    }),
  }), /PROVENANCE_DIRECTION/);
});
test("emulator: adjustment refuses owner, mismatched original seal and threshold change", async () => {
  const { recordHybridReviewedAdjustment } = require("../../functions/hybrid-billing-adjustments.js");
  const id = "tenant-emu-adjust-deny-42", ref = await activate(id);
  const uid = "reviewer-adjust-deny-042";
  await db.collection("users").doc(uid).set({ active: true, role: "owner", tenantId: id });
  await order(ref, "first-order", "2026-10-20T02:00:00Z", 10000);
  await issue(id, midnightAfterTrigger);
  const invoiceId = cycleId + ":delivery:trigger";
  await ref.collection("orders").doc("first-order").update({ refundTotal: 2000 });
  const period = (await ref.collection("hybridBillingPeriods").doc(cycleId).get()).data();
  const base = { db, tenantId: id, cycleId, invoiceId,
    reviewId: "review-adjust-deny-042", reviewerUid: uid,
    now: new Date("2026-10-21T03:00:00Z"),
    resolveIndependentAdjustment: async () => ({
      verified: true, tenantId: id, cycleId, invoiceId, sourceType: "verified_refund",
      evidenceSha256: "f".repeat(64), originalSealDigest: period.daySeals["2026-10-20"].digest,
      currentSealDigest: "0".repeat(64),
      checkedAt: new Date("2026-10-21T02:59:00Z"),
    }) };
  await assert.rejects(recordHybridReviewedAdjustment(base), /SUPER_ADMIN_REQUIRED/);
  await db.collection("users").doc(uid).update({ role: "super_admin" });
  await assert.rejects(recordHybridReviewedAdjustment(base), /THRESHOLD_TOPOLOGY_CHANGED/);
  assert.equal((await ref.collection("hybridBillingAdjustments").get()).size, 0);
});


test("emulator: 3,001 historical paid Delivery receipts fail closed while paged read-only inventory completes", async () => {
  const id = "tenant-emu-volume-43", ref = await activate(id);
  // Emulator-only bulk fixture; all rows have canonical server-like Timestamp.
  // The billing engine must NEVER simply raise its 3,000-record limit.
  for (let offset = 0; offset < 3001; offset += 400) {
    const batch = db.batch();
    for (let i = offset; i < Math.min(offset + 400, 3001); i++) {
      batch.create(ref.collection("orders").doc("bulk-" + String(i).padStart(5, "0")), {
        orderType: "delivery", paymentStatus: "paid", status: "delivered",
        paidAt: stamp("2026-10-20T02:00:00Z"),
        subtotalAmount: 1, deliveryFee: 0, totalAmount: 1,
      });
    }
    await batch.commit();
  }
  let read = 0, cursor = null, pages = 0;
  do {
    const page = await scanHybridPaidReceiptExceptions({
      db, tenantId: id, afterId: cursor, pageSize: 250,
    });
    assert.equal(page.issueCount, 0);
    assert.ok(page.scanned > 0 && page.scanned <= 250);
    read += page.scanned;
    pages++;
    cursor = page.nextAfterId;
    if (!page.hasMore) break;
    assert.ok(cursor);
  } while (pages <= 13);
  assert.equal(read, 3001);
  assert.equal(pages, 13);
  await assert.rejects(issue(id, midnightAfterTrigger),
    /HYBRID_RECEIPT_AUDIT_LIMIT/);
  assert.equal((await ref.collection("hybridBillingInvoices").get()).size, 0);
  assert.equal((await ref.collection("hybridBillingPeriods").get()).size, 0);
});


test("emulator: COD transaction atomically creates exactly one immutable receipt and shard version",async()=>{
 const {settleHybridCodDeliveryPayment}=require("../../functions/hybrid-billing-cod-payment.js");
 const {shardOf}=require("../../functions/hybrid-billing-receipt-journal.js");
 const id="tenant-journal-atomic-044", t=await activate(id),uid="cashier-journal-044";
 await db.collection("users").doc(uid).set({role:"cashier",tenantId:id,active:true});
 const ref=t.collection("orders").doc("order-journal-atomic-044");
 await ref.set({orderType:"delivery",paymentMethod:"cod",paymentStatus:"unpaid",
  status:"delivered",totalAmount:105,subtotalAmount:100,deliveryFee:5,items:[{id:"x",quantity:1}]});
 const args={db,tenantId:id,orderId:ref.id,actorUid:uid};
 const results=await Promise.all([settleHybridCodDeliveryPayment(args),settleHybridCodDeliveryPayment(args)]);
 assert.equal(results.filter(x=>x.alreadyPaid===false).length,1);
 const receipt=(await t.collection("hybridBillingReceiptEvents").doc("cod-"+ref.id).get()).data();
 const paid=(await ref.get()).data();
 assert.equal(receipt.source,"hybrid_cod_cashier_server");
 assert.equal(receipt.grossCents,10500);
 assert.equal(receipt.merchandiseCents,10000);
 assert.equal(receipt.paidAt.toMillis(),paid.paidAt.toMillis());
 const shard=shardOf(ref.id);
 const fence=(await t.collection("hybridBillingReceiptFences").doc("shard-"+String(shard).padStart(2,"0")).get()).data();
 assert.equal(fence.version,1);
 assert.equal((await t.collection("hybridBillingReceiptEvents").get()).size,1);
});
test("emulator: strict journal source mode rejects uncertified tenant without financial writes",async()=>{
 const id="tenant-journal-strict-045",t=await activate(id,{hybridReceiptJournalMode:"strict_v1",
   hybridReceiptJournalCoverageReady:false});
 await order(t,"paid-without-journal","2026-10-20T02:00:00Z",15500);
 await assert.rejects(issue(id,midnightAfterTrigger),/HYBRID_JOURNAL_COVERAGE_NOT_CERTIFIED/);
 assert.equal((await t.collection("hybridBillingInvoices").get()).size,0);
 await t.update({hybridReceiptJournalCoverageReady:true});
 await assert.rejects(issue(id,midnightAfterTrigger),/HYBRID_JOURNAL_SOURCE_INCOMPLETE/);
 assert.equal((await t.collection("hybridBillingInvoices").get()).size,0);
 // A legacy paid order cannot be certified by simply editing the flag; strict
 // writer coverage of every paid source is still a separate release blocker.
});

test("emulator: strict journal COD payment proves source coverage of full 15,500 closed trigger day",async()=>{
 const {settleHybridCodDeliveryPayment}=require("../../functions/hybrid-billing-cod-payment.js");
 const id="tenant-journal-trigger-046",t=await activate(id,{
   hybridReceiptJournalMode:"strict_v1",hybridReceiptJournalCoverageReady:true});
 const uid="cashier-journal-046",date=new Date("2026-10-20T12:30:00Z");
 await db.collection("users").doc(uid).set({role:"cashier",tenantId:id,active:true});
 for(const [name,gross,goods] of [["one",10040,10000],["two",5540,5500]]){
   const orderId="order-journal-"+name+"-046";
   await t.collection("orders").doc(orderId).set({orderType:"delivery",paymentMethod:"cod",
     paymentStatus:"unpaid",status:"delivered",totalAmount:gross,
     subtotalAmount:goods,deliveryFee:40,items:[{id:"i",quantity:1}]});
   await settleHybridCodDeliveryPayment({db,tenantId:id,orderId,actorUid:uid,
     clock:()=>date,serverTimestamp:()=>Timestamp.fromDate(date)});
 }
 const result=await issue(id,midnightAfterTrigger);
 assert.deepEqual(result.issued,[cycleId+":delivery:trigger"]);
 assert.equal((await invoices(t))[0].amountCents,77500);
 assert.equal((await t.collection("hybridBillingReceiptEvents").get()).size,2);
 assert.deepEqual((await issue(id,midnightAfterTrigger)).issued,[]);
});


test("emulator: concurrent sharded COD/close either includes receipt or flags immutable late adjustment",async()=>{
 const {settleHybridCodDeliveryPayment}=require("../../functions/hybrid-billing-cod-payment.js");
 const id="tenant-journal-concurrent-047",t=await activate(id,{
   hybridReceiptJournalMode:"strict_v1",hybridReceiptJournalCoverageReady:true});
 const uid="cashier-journal-047",date=new Date("2026-10-20T12:30:00Z");
 await db.collection("users").doc(uid).set({active:true,role:"cashier",tenantId:id});
 const setup=async (name,gross,goods)=>{
   const orderId="journal-race-"+name+"-047";
   await t.collection("orders").doc(orderId).set({orderType:"delivery",paymentMethod:"cod",
     paymentStatus:"unpaid",status:"delivered",totalAmount:gross,
     subtotalAmount:goods,deliveryFee:40,items:[{id:"item1",quantity:1}]});
   return {db,tenantId:id,orderId,actorUid:uid,
     clock:()=>date,serverTimestamp:()=>Timestamp.fromDate(date)};
 };
 const first=await setup("first",10040,10000);
 const second=await setup("second",5540,5500);
 await settleHybridCodDeliveryPayment(first);
 let release,entered,hasPaused=false;
 const blocked=new Promise(resolve=>{release=resolve;});
 const enteredPromise=new Promise(resolve=>{entered=resolve;});
 const close=issueHybridInvoicesForClosedDay({
   db,tenantId:id,cycleId,now:now(midnightAfterTrigger),
   readOrders:async (...params)=>{
     if(!hasPaused){
       hasPaused=true;
       entered();
       await blocked;
     }
     return paidOrdersInWindow(...params);
   },
 });
 // Submit the writer while the closing transaction is paused. IMPORTANT:
 // release the pause BEFORE awaiting the writer, otherwise Firestore's
 // normal read locks correctly block the writer and the test deadlocks.
 await enteredPromise;
 const writer=settleHybridCodDeliveryPayment(second);
 release();
 const [closed,paid]=await Promise.allSettled([close,writer]);
 assert.equal(paid.status,"fulfilled","trusted COD writer must eventually succeed");
 assert.equal((await t.collection("hybridBillingReceiptEvents").get()).size,2);
 const billed=await invoices(t);
 assert.ok(billed.length<=1);
 if(!billed.length){
   // Aborted close was safe. A fresh close sees both paid receipts.
   const retry=await issue(id,midnightAfterTrigger);
   assert.equal(retry.issued.length,1);
   assert.equal((await invoices(t))[0].amountCents,77500);
 }else if(billed[0].amountCents===50000){
   // The writer committed AFTER the first close. Original immutable invoice
   // stays at 500, and a later attempt MUST flag the late receipt for review.
   // No silent overwrite/automatic debit is allowed.
   await assert.rejects(issue(id,"2026-10-21T17:01:00Z"),
     /HYBRID_CLOSED_DAY_CHANGED_REQUIRES_ADJUSTMENT/);
   assert.equal((await invoices(t))[0].amountCents,50000);
 }else{
   assert.equal(billed[0].amountCents,77500);
 }
 if(closed.status==="rejected"){
   assert.equal((await invoices(t)).length,1);
 }
});


test("emulator: read-only receipt enrollment audit pages historical COD and legacy exceptions without certifying",async()=>{
 const {settleHybridCodDeliveryPayment}=require("../../functions/hybrid-billing-cod-payment.js");
 const {inspectHybridJournalCoveragePage}=require("../../functions/hybrid-billing-receipt-journal.js");
 const id="tenant-journal-audit-048",t=await activate(id);
 const uid="cashier-journal-audit-048";
 await db.collection("users").doc(uid).set({role:"cashier",active:true,tenantId:id});
 const cod=t.collection("orders").doc("journal-audit-01");
 await cod.set({orderType:"delivery",paymentMethod:"cod",paymentStatus:"unpaid",
   status:"delivered",totalAmount:105,deliveryFee:5,subtotalAmount:100,
   items:[{id:"item-01",quantity:1}]});
 await settleHybridCodDeliveryPayment({db,tenantId:id,orderId:cod.id,actorUid:uid});
 await t.collection("orders").doc("journal-audit-02").set({
   orderType:"delivery",paymentStatus:"paid",status:"delivered",
   paidAt:"2026-10-20T02:00:00Z",totalAmount:200,deliveryFee:0,subtotalAmount:200,
 });
 await t.collection("orders").doc("journal-audit-03").set({
   orderType:"delivery",paymentStatus:"paid",status:"delivered",
   paidAt:stamp("2026-10-20T02:00:00Z"),totalAmount:300,deliveryFee:0,subtotalAmount:300,
 });
 await t.collection("orders").doc("journal-audit-pos").set({
   orderType:"pos",paymentStatus:"paid",paidAt:stamp("2026-10-20T02:00:00Z"),
 });
 const first=await inspectHybridJournalCoveragePage({db,tenantId:id,pageSize:2});
 assert.equal(first.scanned,2);
 assert.equal(first.coverageCertified,false);
 assert.equal(first.hasMore,true);
 assert.deepEqual(first.issues,[{orderId:"journal-audit-02",reason:"noncanonical_paid_at"}]);
 const last=await inspectHybridJournalCoveragePage({db,tenantId:id,pageSize:2,afterId:first.nextAfterId});
 assert.equal(last.scanned,1);
 assert.equal(last.hasMore,false);
 assert.deepEqual(last.issues,[{orderId:"journal-audit-03",reason:"unsupported_payment_source"}]);
 assert.equal((await t.get()).data().hybridReceiptJournalCoverageReady,undefined);
 assert.equal((await t.collection("hybridBillingInvoices").get()).size,0);
 await assert.rejects(inspectHybridJournalCoveragePage({db,tenantId:id,pageSize:500}),
   /HYBRID_JOURNAL_AUDIT_BAD_REQUEST/);
});
test("emulator: strict closed-day rejects forged gross and sourceDay despite existing COD journal",async()=>{
 const {settleHybridCodDeliveryPayment}=require("../../functions/hybrid-billing-cod-payment.js");
 const id="tenant-journal-forged-049",t=await activate(id,{
   hybridReceiptJournalMode:"strict_v1",hybridReceiptJournalCoverageReady:true});
 const uid="cashier-journal-forged-049",orderId="order-journal-forged-049",date=new Date("2026-10-20T12:30:00Z");
 await db.collection("users").doc(uid).set({role:"cashier",active:true,tenantId:id});
 await t.collection("orders").doc(orderId).set({orderType:"delivery",paymentMethod:"cod",
   paymentStatus:"unpaid",status:"delivered",totalAmount:15540,deliveryFee:40,
   subtotalAmount:15500,items:[{id:"item-01",quantity:1}]});
 await settleHybridCodDeliveryPayment({db,tenantId:id,orderId,actorUid:uid,
   clock:()=>date,serverTimestamp:()=>Timestamp.fromDate(date)});
 const e=t.collection("hybridBillingReceiptEvents").doc("cod-"+orderId);
 const recorded=(await e.get()).data();
 await e.update({grossCents:1,sourceDay:"2026-10-21"});
 await assert.rejects(issue(id,midnightAfterTrigger),/HYBRID_JOURNAL_SOURCE_INCOMPLETE/);
 assert.equal((await t.collection("hybridBillingInvoices").get()).size,0);
 // Emulated privileged tampering restored only for this synthetic test.
 await e.update({grossCents:recorded.grossCents,sourceDay:recorded.sourceDay});
 assert.deepEqual((await issue(id,midnightAfterTrigger)).issued,[cycleId+":delivery:trigger"]);
});

test("emulator: read-only journal audit pagination accepts short legacy order IDs as cursors",async()=>{
 const {inspectHybridJournalCoveragePage}=require("../../functions/hybrid-billing-receipt-journal.js");
 const id="tenant-journal-legacycursor-050",t=await activate(id);
 for(const name of ["a","b","c"]){
   await t.collection("orders").doc(name).set({orderType:"delivery",paymentStatus:"paid",
     status:"delivered",paidAt:stamp("2026-10-20T02:00:00Z"),
     totalAmount:100,deliveryFee:0,subtotalAmount:100});
 }
 const p1=await inspectHybridJournalCoveragePage({db,tenantId:id,pageSize:2});
 assert.equal(p1.nextAfterId,"b");
 assert.equal(p1.coverageCertified,false);
 const p2=await inspectHybridJournalCoveragePage({db,tenantId:id,pageSize:2,afterId:p1.nextAfterId});
 assert.equal(p2.scanned,1);
 assert.deepEqual(p2.issues,[{orderId:"c",reason:"unsupported_payment_source"}]);
});


test("emulator: independent bank PromptPay candidate writes one trusted journal and refuses bank replay",async()=>{
 const {recordHybridVerifiedPromptPay}=require("../../functions/hybrid-billing-promptpay-payment.js");
 const id="tenant-bankpay-051",t=await activate(id),uid="super-bankpay-051";
 await db.collection("users").doc(uid).set({role:"super_admin",active:true});
 const date=new Date("2026-10-20T12:30:00Z");
 const makeOrder=async orderId=>t.collection("orders").doc(orderId).set({
   orderType:"delivery",paymentMethod:"promptpay",paymentStatus:"unpaid",
   status:"delivered",totalAmount:15540,subtotalAmount:15500,deliveryFee:40,
   items:[{id:"item1",quantity:1}]});
 const first="bank-pay-order-051",second="bank-pay-order-052";
 await Promise.all([makeOrder(first),makeOrder(second)]);
 const reference="BANK-INDEPENDENT-PRP-051";
 const args=orderId=>({db,tenantId:id,orderId,reviewerUid:uid,
   now:new Date("2026-10-21T03:00:00Z"),
   resolveIndependentBankPayment:async()=>({
     verified:true,source:"independent_bank_record",tenantId:id,orderId,
     currency:"THB",recipientConfirmed:true,platformBankAccountVerified:true,
     reference,evidenceSha256:"a".repeat(64),grossAmountCents:1554000,
     paidAt:date,checkedAt:new Date("2026-10-21T02:59:00Z")}),
 });
 assert.equal((await recordHybridVerifiedPromptPay(args(first))).alreadyPaid,false);
 assert.equal((await recordHybridVerifiedPromptPay(args(first))).alreadyPaid,true);
 await assert.rejects(recordHybridVerifiedPromptPay(args(second)),/BANK_REFERENCE_ALREADY_USED/);
 const order=(await t.collection("orders").doc(first).get()).data();
 const event=(await t.collection("hybridBillingReceiptEvents").doc("bank-"+first).get()).data();
 assert.equal(order.paidAt.toMillis(),date.getTime());
 assert.equal(event.paidAt.toMillis(),date.getTime());
 assert.equal(event.grossCents,1554000);
 assert.equal(event.merchandiseCents,1550000);
 assert.equal(event.referenceHash,order.paymentBankReferenceHash);
 assert.equal((await t.collection("hybridBillingReceiptEvents").get()).size,1);
 assert.equal((await t.collection("orders").doc(second).get()).data().paymentStatus,"unpaid");
});
test("emulator: strict journal accepts jointly verified COD and bank PromptPay trigger-day receipts",async()=>{
 const {recordHybridVerifiedPromptPay}=require("../../functions/hybrid-billing-promptpay-payment.js");
 const {settleHybridCodDeliveryPayment}=require("../../functions/hybrid-billing-cod-payment.js");
 const id="tenant-bank-cod-mixed-053",t=await activate(id,{
   hybridReceiptJournalMode:"strict_v1",hybridReceiptJournalCoverageReady:true});
 const uid="super-bank-cod-053",date=new Date("2026-10-20T12:30:00Z");
 await db.collection("users").doc(uid).set({role:"super_admin",active:true});
 const codId="cod-bank-mixed-053",bankId="promptpay-bank-mixed-053";
 await t.collection("orders").doc(codId).set({orderType:"delivery",paymentMethod:"cod",
   paymentStatus:"unpaid",status:"delivered",totalAmount:10040,subtotalAmount:10000,
   deliveryFee:40,items:[{id:"a",quantity:1}]});
 await settleHybridCodDeliveryPayment({db,tenantId:id,orderId:codId,actorUid:uid,
   clock:()=>date,serverTimestamp:()=>Timestamp.fromDate(date)});
 await t.collection("orders").doc(bankId).set({orderType:"delivery",paymentMethod:"promptpay",
   paymentStatus:"unpaid",status:"delivered",totalAmount:5540,subtotalAmount:5500,
   deliveryFee:40,items:[{id:"b",quantity:1}]});
 await recordHybridVerifiedPromptPay({db,tenantId:id,orderId:bankId,reviewerUid:uid,
   now:new Date("2026-10-21T03:00:00Z"),
   resolveIndependentBankPayment:async()=>({verified:true,source:"independent_bank_record",
     tenantId:id,orderId:bankId,currency:"THB",recipientConfirmed:true,
     platformBankAccountVerified:true,reference:"BANK-PRP-MIX-053",
     evidenceSha256:"b".repeat(64),grossAmountCents:554000,
     paidAt:date,checkedAt:new Date("2026-10-21T02:59:00Z")})});
 assert.deepEqual((await issue(id,midnightAfterTrigger)).issued,[cycleId+":delivery:trigger"]);
 assert.equal((await invoices(t))[0].amountCents,77500);
 const bankEvent=t.collection("hybridBillingReceiptEvents").doc("bank-"+bankId);
 await bankEvent.update({evidenceSha256:"0".repeat(64)});
 await assert.rejects(issue(id,"2026-10-21T17:01:00Z"),/HYBRID_JOURNAL_SOURCE_INCOMPLETE/);
});


test("emulator: corrupt COD journal is never treated as idempotent successful payment",async()=>{
 const {settleHybridCodDeliveryPayment}=require("../../functions/hybrid-billing-cod-payment.js");
 const id="tenant-replay-cod-054",t=await activate(id),uid="cashier-replay-cod-054";
 await db.collection("users").doc(uid).set({role:"cashier",active:true,tenantId:id});
 const orderId="order-cod-replay-054";
 await t.collection("orders").doc(orderId).set({
   orderType:"delivery",paymentMethod:"cod",paymentStatus:"unpaid",
   status:"delivered",totalAmount:110,subtotalAmount:100,deliveryFee:10,
   items:[{id:"x",quantity:1}]});
 const args={db,tenantId:id,orderId,actorUid:uid};
 await settleHybridCodDeliveryPayment(args);
 await t.collection("hybridBillingReceiptEvents").doc("cod-"+orderId).update({grossCents:1});
 await assert.rejects(settleHybridCodDeliveryPayment(args),/HYBRID_COD_JOURNAL_MISSING/);
 assert.equal((await t.collection("hybridBillingReceiptEvents").get()).size,1);
});
test("emulator: tampered bank journal cannot be replayed as verified PromptPay",async()=>{
 const {recordHybridVerifiedPromptPay}=require("../../functions/hybrid-billing-promptpay-payment.js");
 const id="tenant-replay-bank-055",t=await activate(id),uid="super-replay-bank-055";
 const orderId="order-bank-replay-055",date=new Date("2026-10-20T12:30:00Z");
 await db.collection("users").doc(uid).set({role:"super_admin",active:true});
 await t.collection("orders").doc(orderId).set({orderType:"delivery",
   paymentMethod:"promptpay",paymentStatus:"unpaid",status:"delivered",
   totalAmount:110,subtotalAmount:100,deliveryFee:10,
   items:[{id:"x",quantity:1}]});
 const args={db,tenantId:id,orderId,reviewerUid:uid,
   now:new Date("2026-10-21T03:00:00Z"),
   resolveIndependentBankPayment:async()=>({
     verified:true,source:"independent_bank_record",tenantId:id,orderId,
     currency:"THB",recipientConfirmed:true,platformBankAccountVerified:true,
     reference:"BANK-REPLAY-055",evidenceSha256:"f".repeat(64),
     grossAmountCents:11000,paidAt:date,
     checkedAt:new Date("2026-10-21T02:59:00Z")})};
 await recordHybridVerifiedPromptPay(args);
 await t.collection("hybridBillingReceiptEvents").doc("bank-"+orderId).update({sourceDay:"2026-10-21"});
 await assert.rejects(recordHybridVerifiedPromptPay(args),/HYBRID_PROMPTPAY_EXISTING_PAYMENT_CONFLICT/);
 assert.equal((await t.collection("hybridBillingReceiptEvents").get()).size,1);
});


test("emulator: verified settled refund creates immutable linked journal, preserves original invoice and flags late adjustment",async()=>{
 const {settleHybridCodDeliveryPayment}=require("../../functions/hybrid-billing-cod-payment.js");
 const {recordHybridVerifiedRefund}=require("../../functions/hybrid-billing-refund-reversal.js");
 const id="tenant-refund-056",t=await activate(id),uid="super-refund-056";
 const orderId="order-refund-056",date=new Date("2026-10-20T12:30:00Z");
 await db.collection("users").doc(uid).set({role:"super_admin",active:true});
 await t.collection("orders").doc(orderId).set({orderType:"delivery",paymentMethod:"cod",
   paymentStatus:"unpaid",status:"delivered",totalAmount:15540,subtotalAmount:15500,
   deliveryFee:40,items:[{id:"x",quantity:1}]});
 await settleHybridCodDeliveryPayment({db,tenantId:id,orderId,actorUid:uid,
   clock:()=>date,serverTimestamp:()=>Timestamp.fromDate(date)});
 await issue(id,midnightAfterTrigger);
 const before=(await invoices(t))[0];
 const periodBefore=(await t.collection("hybridBillingPeriods").doc(cycleId).get()).data();
 const req={db,tenantId:id,orderId,reviewerUid:uid,now:new Date("2026-10-21T03:00:00Z"),
   resolveIndependentRefund:async()=>({verified:true,source:"independent_bank_refund_record",
     tenantId:id,orderId,currency:"THB",refundSettled:true,
     recipientConfirmed:true,platformDebitConfirmed:true,
     reference:"BANK-REFUND-056",evidenceSha256:"a".repeat(64),
     refundAmountCents:100000,refundAt:new Date("2026-10-21T02:30:00Z"),
     checkedAt:new Date("2026-10-21T02:59:00Z")})};
 const result=await recordHybridVerifiedRefund(req);
 assert.equal(result.refundCents,100000);
 assert.equal(result.refundInitiated,false);
 assert.equal(result.invoiceApplied,false);
 assert.equal((await recordHybridVerifiedRefund(req)).alreadyRecorded,true);
 const order=(await t.collection("orders").doc(orderId).get()).data();
 const original=(await t.collection("hybridBillingReceiptEvents").doc("cod-"+orderId).get()).data();
 const refund=(await t.collection("hybridBillingReceiptEvents").doc("refund-"+orderId).get()).data();
 assert.equal(order.refundTotal,1000);
 assert.equal(original.merchandiseCents,1550000);
 assert.equal(refund.originalMerchandiseCents,1550000);
 assert.equal(refund.refundCents,100000);
 assert.deepEqual((await invoices(t))[0],before);
 assert.deepEqual((await t.collection("hybridBillingPeriods").doc(cycleId).get()).data().daySeals,periodBefore.daySeals);
 await assert.rejects(issue(id,"2026-10-21T17:01:00Z"),
   /HYBRID_CLOSED_DAY_CHANGED_REQUIRES_ADJUSTMENT/);
 assert.equal((await invoices(t))[0].amountCents,77500);
});
test("emulator: refund rejects forged actor, over-refund and second or tampered event",async()=>{
 const {settleHybridCodDeliveryPayment}=require("../../functions/hybrid-billing-cod-payment.js");
 const {recordHybridVerifiedRefund}=require("../../functions/hybrid-billing-refund-reversal.js");
 const id="tenant-refund-deny-057",t=await activate(id),uid="staff-refund-057";
 const orderId="order-refund-deny-057",date=new Date("2026-10-20T12:30:00Z");
 await db.collection("users").doc(uid).set({role:"owner",active:true,tenantId:id});
 await t.collection("orders").doc(orderId).set({orderType:"delivery",paymentMethod:"cod",
   paymentStatus:"unpaid",status:"delivered",totalAmount:1010,subtotalAmount:1000,
   deliveryFee:10,items:[{id:"x",quantity:1}]});
 await settleHybridCodDeliveryPayment({db,tenantId:id,orderId,actorUid:uid,
   clock:()=>date,serverTimestamp:()=>Timestamp.fromDate(date)});
 const req=(ref,amount=30000)=>({db,tenantId:id,orderId,reviewerUid:uid,
   now:new Date("2026-10-21T03:00:00Z"),resolveIndependentRefund:async()=>({
     verified:true,source:"independent_bank_refund_record",tenantId:id,orderId,
     currency:"THB",refundSettled:true,recipientConfirmed:true,platformDebitConfirmed:true,
     reference:ref,evidenceSha256:"b".repeat(64),refundAmountCents:amount,
     refundAt:new Date("2026-10-21T02:30:00Z"),
     checkedAt:new Date("2026-10-21T02:59:00Z")})});
 await assert.rejects(recordHybridVerifiedRefund(req("BANK-RFD-057")),/SUPER_ADMIN_REQUIRED/);
 await db.collection("users").doc(uid).update({role:"super_admin"});
 await assert.rejects(recordHybridVerifiedRefund(req("BANK-RFD-057",110000)),/AMOUNT_EXCEEDS_MERCHANDISE/);
 await assert.rejects(recordHybridVerifiedRefund({...req("BANK-RFD-057"),
   resolveIndependentRefund:async()=>({...await req("BANK-RFD-057").resolveIndependentRefund(),
     refundAt:new Date("2026-10-20T01:00:00Z")})}),
   /REFUND_BEFORE_ORIGINAL_PAYMENT/);
 assert.equal((await t.collection("hybridBillingReceiptEvents").get()).size,1);
 await recordHybridVerifiedRefund(req("BANK-RFD-057"));
 await assert.rejects(recordHybridVerifiedRefund(req("BANK-OTHER-057")),/EXISTING_CONFLICT/);
 await t.collection("hybridBillingReceiptEvents").doc("refund-"+orderId).update({refundCents:1});
 await assert.rejects(recordHybridVerifiedRefund(req("BANK-RFD-057")),/EXISTING_CONFLICT/);
 assert.equal((await t.collection("orders").doc(orderId).get()).data().refundTotal,300);
});

 
test("emulator: two extra independently settled partial refunds form a verified hash chain and preserve sealed invoice",async()=>{
 const {settleHybridCodDeliveryPayment}=require("../../functions/hybrid-billing-cod-payment.js");
 const {recordHybridVerifiedRefund}=require("../../functions/hybrid-billing-refund-reversal.js");
 const {appendHybridVerifiedPartialRefund}=require("../../functions/hybrid-billing-multi-refund.js");
 const {journalReceiptIssue,loadRefundChain}=require("../../functions/hybrid-billing-receipt-journal.js");
 const id="tenant-refund-chain-058",t=await activate(id,{hybridReceiptJournalMode:"strict_v1",
   hybridReceiptJournalCoverageReady:true});
 const uid="super-refund-chain-058",orderId="order-refund-chain-058";
 const paidAt=new Date("2026-10-20T12:30:00Z");
 await db.collection("users").doc(uid).set({role:"super_admin",active:true});
 await t.collection("orders").doc(orderId).set({orderType:"delivery",paymentMethod:"cod",
   paymentStatus:"unpaid",status:"delivered",totalAmount:15540,subtotalAmount:15500,
   deliveryFee:40,items:[{id:"x",quantity:1}]});
 await settleHybridCodDeliveryPayment({db,tenantId:id,orderId,actorUid:uid,
   clock:()=>paidAt,serverTimestamp:()=>Timestamp.fromDate(paidAt)});
 const invoice=await issue(id,midnightAfterTrigger);
 assert.deepEqual(invoice.issued,[cycleId+":delivery:trigger"]);
 const immutable=(await invoices(t))[0];
 const period=(await t.collection("hybridBillingPeriods").doc(cycleId).get()).data();
 const dates=["2026-10-21T02:00:00Z","2026-10-21T02:10:00Z","2026-10-21T02:20:00Z"];
 const amounts=[100000,200000,50000],refs=["BANK-CHAIN-058-1","BANK-CHAIN-058-2","BANK-CHAIN-058-3"];
 const request=i=>({db,tenantId:id,orderId,reviewerUid:uid,
  now:new Date("2026-10-21T03:00:00Z"),
  resolveIndependentRefund:async()=>({verified:true,source:"independent_bank_refund_record",
    tenantId:id,orderId,currency:"THB",refundSettled:true,recipientConfirmed:true,
    platformDebitConfirmed:true,reference:refs[i],evidenceSha256:String(i+1).repeat(64),
    refundAmountCents:amounts[i],refundAt:new Date(dates[i]),
    checkedAt:new Date("2026-10-21T02:59:00Z")})});
 await recordHybridVerifiedRefund(request(0));
 assert.equal((await appendHybridVerifiedPartialRefund(request(1))).sequence,2);
 assert.equal((await appendHybridVerifiedPartialRefund(request(1))).alreadyRecorded,true);
 assert.equal((await appendHybridVerifiedPartialRefund(request(2))).sequence,3);
 const after=(await t.collection("orders").doc(orderId).get()).data();
 assert.equal(after.refundTotal,3500);
 assert.equal(after.refundChainCount,3);
 const paid=(await t.collection("hybridBillingReceiptEvents").doc("cod-"+orderId).get()).data();
 const first=(await t.collection("hybridBillingReceiptEvents").doc("refund-"+orderId).get()).data();
 const chain=await loadRefundChain(ref=>ref.get(),t,orderId,after);
 assert.equal(chain.parts.length,2);
 assert.equal(journalReceiptIssue(orderId,after,paid,id,first,chain),null);
 assert.equal((await t.collection("hybridBillingReceiptEvents").get()).size,4);
 assert.deepEqual((await invoices(t))[0],immutable);
 assert.deepEqual((await t.collection("hybridBillingPeriods").doc(cycleId).get()).data().daySeals,period.daySeals);
 await assert.rejects(issue(id,"2026-10-21T17:01:00Z"),/HYBRID_CLOSED_DAY_CHANGED_REQUIRES_ADJUSTMENT/);
 await t.collection("hybridBillingReceiptEvents").doc("refundpart-"+orderId+"-000002")
   .update({refundCents:1});
 await assert.rejects(appendHybridVerifiedPartialRefund(request(2)),/CHAIN_INTEGRITY/);
 await assert.rejects(issue(id,"2026-10-21T17:01:00Z"),/HYBRID_JOURNAL_SOURCE_INCOMPLETE/);
});
test("emulator: two concurrent partial refunds cannot exceed original merchandise or duplicate global reference",async()=>{
 const {settleHybridCodDeliveryPayment}=require("../../functions/hybrid-billing-cod-payment.js");
 const {recordHybridVerifiedRefund}=require("../../functions/hybrid-billing-refund-reversal.js");
 const {appendHybridVerifiedPartialRefund}=require("../../functions/hybrid-billing-multi-refund.js");
 const id="tenant-refund-race-059",t=await activate(id),uid="super-refund-race-059";
 const orderId="order-refund-race-059",paidAt=new Date("2026-10-20T12:30:00Z");
 await db.collection("users").doc(uid).set({role:"super_admin",active:true});
 await t.collection("orders").doc(orderId).set({orderType:"delivery",
   paymentMethod:"cod",paymentStatus:"unpaid",status:"delivered",
   totalAmount:1010,subtotalAmount:1000,deliveryFee:10,
   items:[{id:"i",quantity:1}]});
 await settleHybridCodDeliveryPayment({db,tenantId:id,orderId,actorUid:uid,
   clock:()=>paidAt,serverTimestamp:()=>Timestamp.fromDate(paidAt)});
 const req=(reference,amount,at)=>({db,tenantId:id,orderId,reviewerUid:uid,
  now:new Date("2026-10-21T03:00:00Z"),
  resolveIndependentRefund:async()=>({verified:true,source:"independent_bank_refund_record",
   tenantId:id,orderId,currency:"THB",refundSettled:true,recipientConfirmed:true,
   platformDebitConfirmed:true,reference,evidenceSha256:"a".repeat(64),
   refundAmountCents:amount,refundAt:new Date(at),
   checkedAt:new Date("2026-10-21T02:59:00Z")})});
 await recordHybridVerifiedRefund(req("BANK-RACE-059-A",40000,"2026-10-21T02:00:00Z"));
 const settled=await Promise.allSettled([
   appendHybridVerifiedPartialRefund(req("BANK-RACE-059-B",40000,"2026-10-21T02:10:00Z")),
   appendHybridVerifiedPartialRefund(req("BANK-RACE-059-C",40000,"2026-10-21T02:11:00Z")),
 ]);
 assert.equal(settled.filter(x=>x.status==="fulfilled").length,1);
 assert.equal((await t.collection("orders").doc(orderId).get()).data().refundTotal,800);
 assert.equal((await t.collection("hybridBillingReceiptEvents").get()).size,3);
 const order=(await t.collection("orders").doc(orderId).get()).data();
 assert.equal(order.refundChainCount,2);
 await assert.rejects(appendHybridVerifiedPartialRefund(req("BANK-RACE-059-OVER",30000,
  "2026-10-21T02:20:00Z")),/OVERREFUND/);
});


test("emulator: signed Lalamove COMPLETED plus fresh authenticated lookup creates delivery-only immutable proof",async()=>{
 const {createHmac}=require("node:crypto");
 const {recordHybridLalamoveCodCompletionCandidate}=require(
   "../../functions/hybrid-billing-lalamove-cod-verification.js");
 const id="tenant-ll-cod-proof-060",scope="c".repeat(64);
 const t=await activate(id,{lalamoveAccountScopeSha256:scope});
 const uid="super-ll-cod-proof-060",orderId="order-ll-cod-proof-060";
 const llId="LL-PROVIDER-ORDER-060",now=new Date("2026-10-20T12:30:00Z");
 await db.collection("users").doc(uid).set({role:"super_admin",active:true});
 await t.collection("orders").doc(orderId).set({orderType:"delivery",
   deliveryProvider:"lalamove",lalamoveOrderId:llId,lalamoveCodEnabled:true,
   lalamoveOrderStatus:"COMPLETED",paymentMethod:"cod",paymentStatus:"unpaid",
   status:"completed",totalAmount:15540,subtotalAmount:15500,
   deliveryFee:40,items:[{id:"x",quantity:1}]});
 const credentials={apiKey:"pk_test_codiary_060",apiSecret:"sk_test_codiary_060"};
 const payload={apiKey:credentials.apiKey,timestamp:Math.trunc(now.getTime()/1000),
   eventId:"LL-DELIVERY-COMPLETE-060",eventType:"ORDER_STATUS_CHANGED",
   data:{order:{orderId:llId,status:"COMPLETED"}}};
 payload.signature=createHmac("sha256",credentials.apiSecret)
   .update(String(payload.timestamp)+"\r\nPOST\r\n/api/lalamove/webhook\r\n\r\n"+
     JSON.stringify(payload.data)).digest("hex");
 const args={db,tenantId:id,orderId,reviewerUid:uid,payload,credentials,now,
   resolveProviderOrder:async()=>({source:"authenticated_lalamove_order_lookup",
     authenticated:true,tenantId:id,orderId:llId,status:"COMPLETED",market:"TH",
     accountScopeSha256:scope,evidenceSha256:"d".repeat(64),checkedAt:now})};
 const first=await recordHybridLalamoveCodCompletionCandidate(args);
 assert.deepEqual(first,{tenantId:id,orderId,alreadyRecorded:false,
   deliveryVerified:true,codSettlementVerified:false,paymentChanged:false});
 const replay=await recordHybridLalamoveCodCompletionCandidate(args);
 assert.equal(replay.alreadyRecorded,true);
 const original=(await t.collection("orders").doc(orderId).get()).data();
 assert.equal(original.paymentStatus,"unpaid");
 assert.equal(original.paidAt,undefined);
 assert.equal(original.lalamoveCodSettlementStatus,undefined);
 assert.equal((await t.collection("hybridBillingReceiptEvents").get()).size,0);
 assert.equal((await t.collection("hybridBillingInvoices").get()).size,0);
 const proof=(await t.collection("hybridLalamoveCodCompletionProof").doc(orderId).get()).data();
 assert.equal(proof.status,"delivery_verified_settlement_pending");
 assert.equal(proof.codSettlementVerified,false);
 assert.equal((await db.collection("platformHybridLalamoveEventClaims").get()).size>=1,true);
 await assert.rejects(recordHybridLalamoveCodCompletionCandidate({...args,
   resolveProviderOrder:async()=>({...await args.resolveProviderOrder(),
     evidenceSha256:"e".repeat(64)})}),/HYBRID_LALAMOVE_PROOF_CONFLICT/);
});
test("emulator: Lalamove candidate rejects forged actor, provider mismatch and signed event replay across orders",async()=>{
 const {createHmac}=require("node:crypto");
 const {recordHybridLalamoveCodCompletionCandidate}=require(
  "../../functions/hybrid-billing-lalamove-cod-verification.js");
 const scope="f".repeat(64),id="tenant-ll-deny-061",
   second="tenant-ll-deny-062",uid="reviewer-ll-deny-061",providerId="LL-ORDER-061";
 const t=await activate(id,{lalamoveAccountScopeSha256:scope});
 const t2=await activate(second,{lalamoveAccountScopeSha256:scope});
 await db.collection("users").doc(uid).set({role:"owner",active:true,tenantId:id});
 const orderId="order-ll-deny-061",otherOrder="order-ll-deny-062";
 for(const [ref,order] of [[t,orderId],[t2,otherOrder]]){
   await ref.collection("orders").doc(order).set({orderType:"delivery",
     deliveryProvider:"lalamove",lalamoveOrderId:providerId,
     lalamoveCodEnabled:true,lalamoveOrderStatus:"COMPLETED",
     paymentMethod:"cod",paymentStatus:"unpaid",status:"completed",
     totalAmount:1010,subtotalAmount:1000,deliveryFee:10,items:[{id:"i",quantity:1}]});
 }
 const now=new Date("2026-10-20T12:30:00Z");
 const credentials={apiKey:"pk_test_lldeny_061",apiSecret:"sk_test_lldeny_061"};
 const payload={apiKey:credentials.apiKey,timestamp:Math.trunc(now.getTime()/1000),
   eventId:"LL-COMPLETE-EVENT-061",eventType:"ORDER_STATUS_CHANGED",
   data:{order:{orderId:providerId,status:"COMPLETED"}}};
 payload.signature=createHmac("sha256",credentials.apiSecret).update(
   String(payload.timestamp)+"\r\nPOST\r\n/api/lalamove/webhook\r\n\r\n"+
     JSON.stringify(payload.data)).digest("hex");
 const request=(tenantId,order)=>({db,tenantId,orderId:order,
   reviewerUid:uid,payload,credentials,now,resolveProviderOrder:async()=>({
     source:"authenticated_lalamove_order_lookup",authenticated:true,
     tenantId,orderId:providerId,status:"COMPLETED",market:"TH",
     accountScopeSha256:scope,evidenceSha256:"b".repeat(64),checkedAt:now})});
 await assert.rejects(recordHybridLalamoveCodCompletionCandidate(request(id,orderId)),
   /SUPER_ADMIN_REQUIRED/);
 await db.collection("users").doc(uid).update({role:"super_admin"});
 await assert.rejects(recordHybridLalamoveCodCompletionCandidate({
   ...request(id,orderId),resolveProviderOrder:async()=>({
     ...await request(id,orderId).resolveProviderOrder(),status:"PICKED_UP"
   })}),/AUTHENTICATED_ORDER_LOOKUP_REQUIRED/);
 await recordHybridLalamoveCodCompletionCandidate(request(id,orderId));
 await assert.rejects(recordHybridLalamoveCodCompletionCandidate(request(second,otherOrder)),
  /HYBRID_LALAMOVE_EVENT_REPLAY_CONFLICT/);
 assert.equal((await t2.collection("hybridLalamoveCodCompletionProof").get()).size,0);
 assert.equal((await t2.collection("orders").doc(otherOrder).get()).data().paymentStatus,"unpaid");
});


test("emulator: read-only manifest witnesses valid paginated COD journals with no production activation",async()=>{
 const {settleHybridCodDeliveryPayment}=require("../../functions/hybrid-billing-cod-payment.js");
 const {previewHybridJournalManifest}=require("../../functions/hybrid-billing-manifest-preview.js");
 const id="tenant-manifest-readonly-063",t=await activate(id),uid="cashier-manifest-063";
 await db.collection("users").doc(uid).set({role:"cashier",active:true,tenantId:id});
 for(let i=0;i<3;i++){
  const orderId="order-manifest-063-"+i;
  await t.collection("orders").doc(orderId).set({
   orderType:"delivery",paymentStatus:"unpaid",paymentMethod:"cod",
   status:"delivered",totalAmount:105,deliveryFee:5,subtotalAmount:100,
   items:[{id:"food",quantity:1}]});
  const date=new Date("2026-10-20T12:30:00Z");
  await settleHybridCodDeliveryPayment({db,tenantId:id,orderId,actorUid:uid,
   clock:()=>date,serverTimestamp:()=>Timestamp.fromDate(date)});
 }
 const args={db,tenantId:id,pageSize:2};
 const first=await previewHybridJournalManifest(args);
 const second=await previewHybridJournalManifest(args);
 assert.equal(first.scanned,3);
 assert.equal(first.pages,2);
 assert.equal(first.issueCount,0);
 assert.equal(first.rootDigest,second.rootDigest);
 assert.equal(first.coverageCertified,false);
 assert.equal(first.canIssueInvoice,false);
 assert.equal((await t.get()).data().hybridReceiptJournalCoverageReady,undefined);
 assert.equal((await t.collection("hybridBillingInvoices").get()).size,0);
});
test("emulator: trusted payment during manifest pagination changes writer fence and fails closed",async()=>{
 const {settleHybridCodDeliveryPayment}=require("../../functions/hybrid-billing-cod-payment.js");
 const {previewHybridJournalManifest}=require("../../functions/hybrid-billing-manifest-preview.js");
 const id="tenant-manifest-race-064",t=await activate(id),uid="cashier-manifest-064";
 await db.collection("users").doc(uid).set({role:"cashier",active:true,tenantId:id});
 const date=new Date("2026-10-20T12:30:00Z");
 for(const orderId of ["order-manifest-race-064-1","order-manifest-race-064-2"]){
  await t.collection("orders").doc(orderId).set({
    orderType:"delivery",paymentMethod:"cod",paymentStatus:"unpaid",
    status:"delivered",totalAmount:105,deliveryFee:5,subtotalAmount:100,
    items:[{id:"food",quantity:1}]});
 }
 await settleHybridCodDeliveryPayment({db,tenantId:id,
    orderId:"order-manifest-race-064-1",actorUid:uid,
    clock:()=>date,serverTimestamp:()=>Timestamp.fromDate(date)});
 await assert.rejects(previewHybridJournalManifest({db,tenantId:id,pageSize:1,
   afterPage:async({pageIndex})=>{
     if(pageIndex===0)await settleHybridCodDeliveryPayment({db,tenantId:id,
      orderId:"order-manifest-race-064-2",actorUid:uid,
      clock:()=>date,serverTimestamp:()=>Timestamp.fromDate(date)});
   }}),/HYBRID_MANIFEST_WRITER_RACE/);
 assert.equal((await t.collection("hybridBillingInvoices").get()).size,0);
 assert.equal((await t.get()).data().hybridReceiptJournalCoverageReady,undefined);
});


test("emulator: demo writer epoch opens for enrolled synthetic source and seals without financial certification",async()=>{
 const {initializeHybridEpochCandidate,sealHybridEpochCandidate,
   requireHybridEpochAdmissionCandidate,reviewHybridWriterRegistryCandidate}=
  require("../../functions/hybrid-billing-writer-epoch-candidate.js");
 const id="tenant-epoch-demo-065",t=await activate(id),uid="super-epoch-demo-065";
 await db.collection("users").doc(uid).set({role:"super_admin",active:true});
 const opened=await initializeHybridEpochCandidate({db,tenantId:id,reviewerUid:uid});
 assert.equal(opened.status,"open");
 assert.equal(opened.coverageCertified,false);
 const probe=t.collection("hybridBillingEpochProbes").doc("synthetic-test-only");
 await db.runTransaction(async tx=>{
   const gate=await requireHybridEpochAdmissionCandidate({
     tx,tenantRef:t,sourceKey:"cod_cashier"});
   assert.equal(gate.canIssueInvoice,false);
   tx.create(probe,{sourceKey:"cod_cashier",epoch:gate.epoch,candidateOnly:true});
 });
 assert.equal((await probe.get()).exists,true);
 const seal=await sealHybridEpochCandidate({db,tenantId:id,reviewerUid:uid});
 assert.equal(seal.status,"sealed");
 assert.equal(seal.writerParticipationComplete,false);
 assert.equal(seal.canIssueInvoice,false);
 assert.equal((await sealHybridEpochCandidate({db,tenantId:id,reviewerUid:uid})).alreadySealed,true);
 await assert.rejects(db.runTransaction(async tx=>{
   await requireHybridEpochAdmissionCandidate({
     tx,tenantRef:t,sourceKey:"refund_partial"});
   tx.create(t.collection("hybridBillingEpochProbes").doc("must-not-write"),{bad:true});
 }),/HYBRID_EPOCH_CLOSED/);
 assert.equal((await t.collection("hybridBillingEpochProbes").doc("must-not-write").get()).exists,false);
 assert.equal(reviewHybridWriterRegistryCandidate().sourcesActuallyWired,0);
 assert.equal((await t.get()).data().hybridReceiptJournalCoverageReady,undefined);
 assert.equal((await t.collection("hybridBillingInvoices").get()).size,0);
});
test("emulator: concurrent epoch admission and seal serialize or deny subsequent synthetic writes",async()=>{
 const {initializeHybridEpochCandidate,sealHybridEpochCandidate,
  requireHybridEpochAdmissionCandidate}=require(
  "../../functions/hybrid-billing-writer-epoch-candidate.js");
 const id="tenant-epoch-race-066",t=await activate(id),uid="super-epoch-race-066";
 await db.collection("users").doc(uid).set({role:"super_admin",active:true});
 await initializeHybridEpochCandidate({db,tenantId:id,reviewerUid:uid});
 const marker=t.collection("hybridBillingEpochProbes").doc("race-marker");
 const outcomes=await Promise.allSettled([
   db.runTransaction(async tx=>{
     await requireHybridEpochAdmissionCandidate({
       tx,tenantRef:t,sourceKey:"promptpay_bank"});
     tx.create(marker,{sourceKey:"promptpay_bank",candidateOnly:true});
   }),
   sealHybridEpochCandidate({db,tenantId:id,reviewerUid:uid})
 ]);
 assert.equal(outcomes[1].status,"fulfilled");
 assert.equal(outcomes[1].value.coverageCertified,false);
 // Serial order may admit the synthetic writer before seal; after seal every
 // further writer MUST be rejected and no real invoice/coverage may change.
 assert.equal((await marker.get()).exists,outcomes[0].status==="fulfilled");
 if(outcomes[0].status==="rejected")
   assert.match(String(outcomes[0].reason),/HYBRID_EPOCH_CLOSED|ABORTED|contention/i);
 await assert.rejects(db.runTransaction(tx=>requireHybridEpochAdmissionCandidate({
   tx,tenantRef:t,sourceKey:"refund_initial"})),/HYBRID_EPOCH_CLOSED/);
 const seal=(await t.collection("hybridBillingEpochCandidates").doc("active").get()).data();
 assert.equal(seal.status,"sealed");
 assert.equal(seal.canIssueInvoice,false);
 assert.equal((await t.get()).data().hybridReceiptJournalCoverageReady,undefined);
 assert.equal((await t.collection("hybridBillingInvoices").get()).size,0);
});


test("emulator Phase 3X guarded COD and PromptPay plus first/partial Refund commit before seal and reject AFTER seal",async()=>{
 const {settleHybridCodDeliveryPayment}=require("../../functions/hybrid-billing-cod-payment.js");
 const {recordHybridVerifiedPromptPay}=require("../../functions/hybrid-billing-promptpay-payment.js");
 const {recordHybridVerifiedRefund}=require("../../functions/hybrid-billing-refund-reversal.js");
 const {appendHybridVerifiedPartialRefund}=require("../../functions/hybrid-billing-multi-refund.js");
 const {initializeHybridEpochCandidate,sealHybridEpochCandidate,
   reviewHybridWriterRegistryCandidate}=require("../../functions/hybrid-billing-writer-epoch-candidate.js");
 const id="tenant-phase3x-guard-071",t=await activate(id),uid="super-phase3x-071";
 const paidAt=new Date("2026-10-20T12:30:00Z"),reviewNow=new Date("2026-10-21T03:00:00Z");
 await db.collection("users").doc(uid).set({role:"super_admin",active:true});
 await initializeHybridEpochCandidate({db,tenantId:id,reviewerUid:uid});
 const codA="cod-phase3x-071",bankA="bank-phase3x-071";
 const newCod="cod-phase3x-072",newBank="bank-phase3x-072";
 const makeOrder=(oid,method)=>t.collection("orders").doc(oid).set({
   orderType:"delivery",paymentMethod:method,paymentStatus:"unpaid",
   status:"delivered",totalAmount:1010,subtotalAmount:1000,deliveryFee:10,
   items:[{id:"item",quantity:1}]});
 for(const [oid,method] of [[codA,"cod"],[bankA,"promptpay"],
   [newCod,"cod"],[newBank,"promptpay"]])await makeOrder(oid,method);
 const codArgs=oid=>({db,tenantId:id,orderId:oid,actorUid:uid,
   clock:()=>paidAt,serverTimestamp:()=>Timestamp.fromDate(paidAt),
   epochAdmissionDemo:true});
 const bankArgs=oid=>({db,tenantId:id,orderId:oid,reviewerUid:uid,epochAdmissionDemo:true,
   now:reviewNow,resolveIndependentBankPayment:async()=>({
     verified:true,source:"independent_bank_record",tenantId:id,orderId:oid,
     currency:"THB",recipientConfirmed:true,platformBankAccountVerified:true,
     reference:"EPOCH-TRANSFER-"+oid,evidenceSha256:"a".repeat(64),
     grossAmountCents:101000,paidAt,checkedAt:new Date("2026-10-21T02:59:00Z")
   })});
 const refundArgs=(oid,reference,amount,instant)=>({
   db,tenantId:id,orderId:oid,reviewerUid:uid,epochAdmissionDemo:true,
   now:reviewNow,resolveIndependentRefund:async()=>({
     verified:true,source:"independent_bank_refund_record",
     tenantId:id,orderId:oid,currency:"THB",refundSettled:true,
     recipientConfirmed:true,platformDebitConfirmed:true,
     reference,evidenceSha256:"b".repeat(64),refundAmountCents:amount,
     refundAt:new Date(instant),checkedAt:new Date("2026-10-21T02:59:00Z")
   })});
 assert.equal((await settleHybridCodDeliveryPayment(codArgs(codA))).alreadyPaid,false);
 assert.equal((await recordHybridVerifiedPromptPay(bankArgs(bankA))).alreadyPaid,false);
 assert.equal((await recordHybridVerifiedRefund(refundArgs(
   codA,"EPOCH-REFUND-071-A",20000,"2026-10-21T02:00:00Z"))).alreadyRecorded,false);
 assert.equal((await appendHybridVerifiedPartialRefund(refundArgs(
   codA,"EPOCH-REFUND-071-B",10000,"2026-10-21T02:10:00Z"))).sequence,2);
 assert.equal((await t.collection("orders").doc(codA).get()).data().refundTotal,300);
 assert.equal((await t.collection("orders").doc(bankA).get()).data().paymentStatus,"paid");
 const receiptsBefore=(await t.collection("hybridBillingReceiptEvents").get()).size;
 assert.equal(receiptsBefore,4);
 const sealed=await sealHybridEpochCandidate({db,tenantId:id,reviewerUid:uid});
 assert.equal(sealed.canIssueInvoice,false);
 assert.equal(sealed.writerParticipationComplete,false);
 await assert.rejects(settleHybridCodDeliveryPayment(codArgs(newCod)),/HYBRID_EPOCH_CLOSED/);
 await assert.rejects(recordHybridVerifiedPromptPay(bankArgs(newBank)),/HYBRID_EPOCH_CLOSED/);
 await assert.rejects(recordHybridVerifiedRefund(refundArgs(
   bankA,"EPOCH-REFUND-071-C",10000,"2026-10-21T02:30:00Z")),
   /HYBRID_EPOCH_CLOSED/);
 await assert.rejects(appendHybridVerifiedPartialRefund(refundArgs(
   codA,"EPOCH-REFUND-071-D",10000,"2026-10-21T02:40:00Z")),
   /HYBRID_EPOCH_CLOSED/);
 assert.equal((await t.collection("hybridBillingReceiptEvents").get()).size,receiptsBefore);
 assert.equal((await t.collection("orders").doc(newCod).get()).data().paymentStatus,"unpaid");
 assert.equal((await t.collection("orders").doc(newBank).get()).data().paymentStatus,"unpaid");
 assert.equal((await t.collection("orders").doc(codA).get()).data().refundTotal,300);
 assert.equal((await t.get()).data().hybridReceiptJournalCoverageReady,undefined);
 assert.equal((await t.collection("hybridBillingInvoices").get()).size,0);
 assert.equal(reviewHybridWriterRegistryCandidate().writerParticipationComplete,false);
});
test("emulator Phase 3X real opt-in COD writer racing seal cannot commit AFTER seal",async()=>{
 const {settleHybridCodDeliveryPayment}=require("../../functions/hybrid-billing-cod-payment.js");
 const {initializeHybridEpochCandidate,sealHybridEpochCandidate}=require(
   "../../functions/hybrid-billing-writer-epoch-candidate.js");
 const id="tenant-phase3x-race-073",t=await activate(id),uid="super-phase3x-073";
 const dt=new Date("2026-10-20T12:30:00Z");
 await db.collection("users").doc(uid).set({role:"super_admin",active:true});
 await initializeHybridEpochCandidate({db,tenantId:id,reviewerUid:uid});
 const createUnpaid=async oid=>t.collection("orders").doc(oid).set({
   orderType:"delivery",paymentMethod:"cod",paymentStatus:"unpaid",
   status:"delivered",totalAmount:105,subtotalAmount:100,deliveryFee:5,
   items:[{id:"test",quantity:1}]});
 const a="order-phase3x-race-073",b="order-phase3x-race-074";
 await createUnpaid(a);await createUnpaid(b);
 const args=oid=>({db,tenantId:id,orderId:oid,actorUid:uid,
    clock:()=>dt,serverTimestamp:()=>Timestamp.fromDate(dt),
    epochAdmissionDemo:true});
 const races=await Promise.allSettled([
   settleHybridCodDeliveryPayment(args(a)),
   sealHybridEpochCandidate({db,tenantId:id,reviewerUid:uid})
 ]);
 assert.equal(races[1].status,"fulfilled");
 assert.equal(races[1].value.status,"sealed");
 if(races[0].status==="rejected")
   assert.match(String(races[0].reason),/HYBRID_EPOCH_CLOSED|ABORTED|contention/i);
 const paidA=(await t.collection("orders").doc(a).get()).data().paymentStatus==="paid";
 assert.equal(paidA,races[0].status==="fulfilled");
 await assert.rejects(settleHybridCodDeliveryPayment(args(b)),/HYBRID_EPOCH_CLOSED/);
 assert.equal((await t.collection("orders").doc(b).get()).data().paymentStatus,"unpaid");
 assert.equal((await t.get()).data().hybridReceiptJournalCoverageReady,undefined);
 assert.equal((await t.collection("hybridBillingInvoices").get()).size,0);
});


test("emulator Phase 3Y: real 3001 paid Delivery Firestore docs expose legacy source and preserve >3000 invoice refusal",async()=>{
 const {inspectHybridPaidWriterSourcesCandidate}=require(
  "../../functions/hybrid-billing-paid-source-inventory.js");
 const {previewHybridJournalManifest}=require(
  "../../functions/hybrid-billing-manifest-preview.js");
 const id="tenant-phase3y-3001-081",t=await activate(id),orders=t.collection("orders");
 const count=3001,paymentAt=stamp("2026-10-20T02:00:00Z");
 const start=Date.now();
 // 3001 ACTUAL Firestore Emulator document writes, not generated JS mock pages.
 // Batches remain <500. These are deliberately UNTRUSTED legacy paid records
 // with no receipt journals. Never seed the 16 journal fences or tenant flags.
 for(let offset=0;offset<count;offset+=400){
  const batch=db.batch();
  for(let i=offset;i<Math.min(count,offset+400);i++){
   const id="paid-legacy-"+String(i).padStart(5,"0");
   batch.create(orders.doc(id),{
     orderType:"delivery",paymentStatus:"paid",status:"delivered",
     paymentReceiptSource:"legacy_import_unattested",
     paymentMethod:"cod",paidAt:paymentAt,
     totalAmount:105,subtotalAmount:100,deliveryFee:5,
     items:[{id:"item",quantity:1}]
   });
  }
  await batch.commit();
 }
 const loadMs=Date.now()-start;
 const actual=await orders.count().get();
 assert.equal(actual.data().count,count);
 const scanStarted=Date.now();
 const inventory=await inspectHybridPaidWriterSourcesCandidate({
   db,tenantId:id,pageSize:200,maxRows:3200});
 assert.equal(inventory.scanned,count);
 assert.equal(inventory.unregisteredCount,count);
 assert.equal(inventory.unregisteredSources.legacy_import_unattested,count);
 assert.equal(inventory.nonCanonicalPaidAtCount,0);
 assert.equal(inventory.sourceCompletenessProven,false);
 assert.equal(inventory.coverageCertified,false);
 const inventoryMs=Date.now()-scanStarted;
 const manifestStarted=Date.now();
 const manifest=await previewHybridJournalManifest({
   db,tenantId:id,pageSize:200,maxPages:20});
 const manifestMs=Date.now()-manifestStarted;
 assert.equal(manifest.scanned,count);
 assert.equal(manifest.pages,16);
 assert.equal(manifest.issueCount,count);
 assert.equal(manifest.coverageCertified,false);
 assert.equal(manifest.canIssueInvoice,false);
 assert.match(manifest.rootDigest,/^[a-f0-9]{64}$/);
 // Existing invoice path MUST stop before recording financial documents.
 await assert.rejects(issue(id,midnightAfterTrigger),/HYBRID_RECEIPT_AUDIT_LIMIT|resource-exhausted/i);
 assert.equal((await t.collection("hybridBillingInvoices").get()).size,0);
 assert.equal((await t.get()).data().hybridReceiptJournalCoverageReady,undefined);
 console.log("HYBRID_PHASE3Y_REAL_EMULATOR_SCALE",JSON.stringify({
   orders:count,loadMs,inventoryMs,manifestMs,
   pages:manifest.pages,untrusted:inventory.unregisteredCount,
   issueCount:manifest.issueCount,coverageCertified:false,canIssueInvoice:false
 }));
});


test("emulator Phase 3Y: 10000 actual Firestore fake-trusted sources are NOT certified without journal proof",async()=>{
 const {inspectHybridPaidWriterSourcesCandidate}=require(
   "../../functions/hybrid-billing-paid-source-inventory.js");
 const {previewHybridJournalManifest}=require(
   "../../functions/hybrid-billing-manifest-preview.js");
 const tenantId="tenant-phase3y-10k-082",t=await activate(tenantId);
 const count=10000,ts=stamp("2026-10-20T02:00:00Z");
 const orders=t.collection("orders");
 const writeStart=Date.now();
 for(let i=0;i<count;i+=400){
  const batch=db.batch();
  for(let j=i;j<Math.min(count,i+400);j++){
   batch.create(orders.doc("alleged-cod-"+String(j).padStart(5,"0")),{
    orderType:"delivery",paymentMethod:"cod",paymentStatus:"paid",
    paymentReceiptSource:"hybrid_cod_cashier_server",
    paidAt:ts,status:"delivered",totalAmount:105,subtotalAmount:100,
    deliveryFee:5,items:[{id:"item",quantity:1}]
   });
  }
  await batch.commit();
 }
 const loadMs=Date.now()-writeStart;
 assert.equal((await orders.count().get()).data().count,count);
 const sourceStart=Date.now();
 const inventory=await inspectHybridPaidWriterSourcesCandidate({
   db,tenantId,pageSize:200,maxRows:10000});
 const sourceMs=Date.now()-sourceStart;
 assert.equal(inventory.scanned,count);
 assert.equal(inventory.unregisteredCount,0);
 assert.equal(inventory.approvedSources.hybrid_cod_cashier_server,count);
 assert.equal(inventory.sourceCompletenessProven,false);
 assert.equal(inventory.coverageCertified,false);
 const manifestStart=Date.now();
 const manifest=await previewHybridJournalManifest({
   db,tenantId,pageSize:200,maxPages:55});
 const manifestMs=Date.now()-manifestStart;
 assert.equal(manifest.scanned,count);
 assert.equal(manifest.pages,50);
 assert.equal(manifest.issueCount,count,
  "Claiming a trusted source in Order fields is NOT proof of immutable journals");
 assert.equal(manifest.coverageCertified,false);
 assert.equal(manifest.canIssueInvoice,false);
 assert.equal((await t.collection("hybridBillingInvoices").get()).size,0);
 assert.equal((await t.get()).data().hybridReceiptJournalCoverageReady,undefined);
 console.log("HYBRID_PHASE3Y_10000_REAL_EMULATOR_SCALE",JSON.stringify({
  count,loadMs,sourceMs,manifestMs,pages:manifest.pages,
  apparentTrustedSource:count,missingJournalIssues:manifest.issueCount,
  coverageCertified:false,canIssueInvoice:false
 }));
});


test("emulator Phase 3Z: enforced demo gateway admits real COD and bank, then sealed read-only audit remains uncertified",async()=>{
 const {executeHybridDemoEnforcedWriter,describeHybridDemoGateway}=require(
  "../../functions/hybrid-billing-demo-enforced-writer.js");
 const {auditHybridSealedEpochCandidate}=require(
  "../../functions/hybrid-billing-demo-sealed-audit.js");
 const {initializeHybridEpochCandidate,sealHybridEpochCandidate}=require(
  "../../functions/hybrid-billing-writer-epoch-candidate.js");
 const tenantId="tenant-phase3z-gateway-101",t=await activate(tenantId);
 const uid="super-phase3z-gateway-101",date=new Date("2026-10-20T12:30:00Z");
 await db.collection("users").doc(uid).set({role:"super_admin",active:true});
 await initializeHybridEpochCandidate({db,tenantId,reviewerUid:uid});
 const codId="cod-phase3z-gateway-101",bankId="bank-phase3z-gateway-101";
 for(const [id,method] of [[codId,"cod"],[bankId,"promptpay"]]){
  await t.collection("orders").doc(id).set({
   orderType:"delivery",paymentMethod:method,paymentStatus:"unpaid",
   status:"delivered",totalAmount:1010,subtotalAmount:1000,deliveryFee:10,
   items:[{id:"item",quantity:1}]
  });
 }
 const codArgs=id=>({db,tenantId,orderId:id,actorUid:uid,
  clock:()=>date,serverTimestamp:()=>Timestamp.fromDate(date)});
 const bankArgs={db,tenantId,orderId:bankId,reviewerUid:uid,
  now:new Date("2026-10-21T03:00:00Z"),
  resolveIndependentBankPayment:async()=>({
    verified:true,source:"independent_bank_record",tenantId,orderId:bankId,
    currency:"THB",recipientConfirmed:true,platformBankAccountVerified:true,
    reference:"BANK-GATEWAY-PHASE3Z-101",evidenceSha256:"a".repeat(64),
    grossAmountCents:101000,paidAt:date,
    checkedAt:new Date("2026-10-21T02:59:00Z")
  })};
 assert.equal((await executeHybridDemoEnforcedWriter({
  sourceKey:"cod_cashier",args:codArgs(codId)})).alreadyPaid,false);
 assert.equal((await executeHybridDemoEnforcedWriter({
  sourceKey:"promptpay_bank",args:bankArgs})).alreadyPaid,false);
 const refundArgs=(orderId,reference,amount,at)=>({
  db,tenantId,orderId,reviewerUid:uid,
  now:new Date("2026-10-21T03:00:00Z"),
  resolveIndependentRefund:async()=>({
   verified:true,source:"independent_bank_refund_record",tenantId,orderId,
   currency:"THB",refundSettled:true,recipientConfirmed:true,
   platformDebitConfirmed:true,reference,evidenceSha256:"b".repeat(64),
   refundAmountCents:amount,refundAt:new Date(at),
   checkedAt:new Date("2026-10-21T02:59:00Z")
  })
 });
 assert.equal((await executeHybridDemoEnforcedWriter({
  sourceKey:"refund_initial",
  args:refundArgs(codId,"BANK-GATEWAY-REFUND-101-A",20000,"2026-10-21T02:00:00Z")
 })).alreadyRecorded,false);
 assert.equal((await executeHybridDemoEnforcedWriter({
  sourceKey:"refund_partial",
  args:refundArgs(codId,"BANK-GATEWAY-REFUND-101-B",10000,"2026-10-21T02:10:00Z")
 })).sequence,2);
 await sealHybridEpochCandidate({db,tenantId,reviewerUid:uid});
 await assert.rejects(executeHybridDemoEnforcedWriter({
  sourceKey:"refund_initial",
  args:refundArgs(bankId,"BANK-GATEWAY-REFUND-101-C",5000,"2026-10-21T02:20:00Z")
 }),/HYBRID_EPOCH_CLOSED/);
 await assert.rejects(executeHybridDemoEnforcedWriter({
  sourceKey:"refund_partial",
  args:refundArgs(codId,"BANK-GATEWAY-REFUND-101-D",5000,"2026-10-21T02:30:00Z")
 }),/HYBRID_EPOCH_CLOSED/);
 const audit=await auditHybridSealedEpochCandidate({db,tenantId,pageSize:1});
 assert.equal(audit.observedIssues.totalPaidOrders,2);
 assert.equal(audit.observedIssues.journal,0);
 assert.equal(audit.observedIssues.unknownPaidSources,0);
 assert.equal(audit.writerParticipationComplete,false);
 assert.equal(audit.immutableFinancialDayManifest,false);
 assert.equal(audit.coverageCertified,false);
 assert.equal(audit.canIssueInvoice,false);
 assert.equal(describeHybridDemoGateway().legacyPathsUnenrolled,true);
 const later="cod-phase3z-gateway-102";
 await t.collection("orders").doc(later).set({
  orderType:"delivery",paymentMethod:"cod",paymentStatus:"unpaid",
  status:"delivered",totalAmount:1010,subtotalAmount:1000,deliveryFee:10,
  items:[{id:"item",quantity:1}]
 });
 await assert.rejects(executeHybridDemoEnforcedWriter({
   sourceKey:"cod_cashier",args:codArgs(later)}),/HYBRID_EPOCH_CLOSED/);
 assert.equal((await t.collection("orders").doc(later).get()).data().paymentStatus,"unpaid");
 assert.equal((await t.collection("hybridBillingInvoices").get()).size,0);
 assert.equal((await t.get()).data().hybridReceiptJournalCoverageReady,undefined);
});
test("emulator Phase 3Z: legacy bypass after sealed epoch is DETECTABLE but seal NEVER claims global enforcement",async()=>{
 const {auditHybridSealedEpochCandidate}=require(
  "../../functions/hybrid-billing-demo-sealed-audit.js");
 const {initializeHybridEpochCandidate,sealHybridEpochCandidate}=require(
  "../../functions/hybrid-billing-writer-epoch-candidate.js");
 const tenantId="tenant-phase3z-bypass-103",t=await activate(tenantId);
 const uid="super-phase3z-bypass-103";
 await db.collection("users").doc(uid).set({role:"super_admin",active:true});
 await initializeHybridEpochCandidate({db,tenantId,reviewerUid:uid});
 await assert.rejects(auditHybridSealedEpochCandidate({
  db,tenantId}),/HYBRID_SEALED_AUDIT_EPOCH_NOT_SEALED/);
 await sealHybridEpochCandidate({db,tenantId,reviewerUid:uid});
 const before=await auditHybridSealedEpochCandidate({db,tenantId});
 assert.equal(before.observedIssues.totalPaidOrders,0);
 assert.equal(before.coverageCertified,false);
 // Simulate an unregistered legacy writer Bypassing opt-in after seal.
 // This is a deliberate negative security fixture, NOT a real payment.
 const ref=t.collection("orders").doc("unregistered-after-seal-103");
 await ref.set({orderType:"delivery",paymentMethod:"cod",status:"delivered",
  paymentStatus:"paid",paymentReceiptSource:"hybrid_cod_cashier_server",
  paidAt:Timestamp.fromDate(new Date("2026-10-20T12:30:00Z")),
  totalAmount:100,subtotalAmount:95,deliveryFee:5,
  items:[{id:"item",quantity:1}]});
 const after=await auditHybridSealedEpochCandidate({db,tenantId});
 assert.equal(after.observedIssues.totalPaidOrders,1);
 assert.equal(after.observedIssues.unknownPaidSources,0,
  "Spoofed claimed source alone cannot detect bypass");
 assert.equal(after.observedIssues.journal,1,
  "Missing immutable receipt must reveal bypass");
 assert.equal(after.writerParticipationComplete,false);
 assert.equal(after.coverageCertified,false);
 assert.equal(after.canIssueInvoice,false);
 assert.equal((await t.collection("hybridBillingInvoices").get()).size,0);
 assert.equal((await t.get()).data().hybridReceiptJournalCoverageReady,undefined);
});



test("emulator Phase3AD: day cutoff admits all four real demo financial writers and then seals atomically", async () => {
  const { executeHybridDemoEnforcedWriter } = require("../../functions/hybrid-billing-demo-enforced-writer.js");
  const {
    initializeHybridEpochCandidate, initializeHybridDemoDayCutoffCandidate,
    sealHybridDemoDayCutoffCandidate,
  } = require("../../functions/hybrid-billing-writer-epoch-candidate.js");
  const tenantId = "tenant-phase3ad-daycutoff-104", t = await activate(tenantId);
  const reviewerUid = "super-phase3ad-daycutoff-104", day = "2026-10-20";
  await db.collection("users").doc(reviewerUid).set({
    role: "super_admin", active: true, tenantId,
  });
  await initializeHybridEpochCandidate({ db, tenantId, reviewerUid });
  await assert.rejects(initializeHybridDemoDayCutoffCandidate({
    db, tenantId, reviewerUid, day: "2026-02-30",
  }), /HYBRID_DAY_CUTOFF_BAD_REQUEST/);
  await initializeHybridDemoDayCutoffCandidate({ db, tenantId, reviewerUid, day });
  await assert.rejects(initializeHybridDemoDayCutoffCandidate({
    db, tenantId, reviewerUid, day,
  }), /HYBRID_DAY_CUTOFF_ALREADY_ACTIVE/);
  const codId = "cod-phase3ad-daycutoff-104";
  const laterId = "cod-phase3ad-afterseal-104";
  const bankId = "bank-phase3ad-daycutoff-104";
  for (const [id, method] of [[codId, "cod"], [laterId, "cod"], [bankId, "promptpay"]]) {
    await t.collection("orders").doc(id).create({
      orderType: "delivery", paymentMethod: method, paymentStatus: "unpaid",
      status: "delivered", totalAmount: 1010, subtotalAmount: 1000,
      deliveryFee: 10, items: [{ id: "item", quantity: 1 }],
    });
  }
  const paidAt = new Date("2026-10-20T12:30:00Z");
  const codArgs = (id, date = paidAt) => ({
    db, tenantId, orderId: id, actorUid: reviewerUid,
    clock: () => date, serverTimestamp: () => Timestamp.fromDate(date),
  });
  await assert.rejects(executeHybridDemoEnforcedWriter({
    sourceKey: "cod_cashier",
    args: codArgs(laterId, new Date("2026-10-21T12:30:00Z")),
  }), /HYBRID_DAY_CUTOFF_DAY_MISMATCH/);
  assert.equal((await t.collection("orders").doc(laterId).get()).data().paymentStatus, "unpaid");

  const cod = await executeHybridDemoEnforcedWriter({
    sourceKey: "cod_cashier", args: codArgs(codId),
  });
  assert.equal(cod.alreadyPaid, false);
  const bank = await executeHybridDemoEnforcedWriter({
    sourceKey: "promptpay_bank", args: {
      db, tenantId, orderId: bankId, reviewerUid,
      now: new Date("2026-10-20T13:00:00Z"),
      resolveIndependentBankPayment: async () => ({
        verified: true, source: "independent_bank_record",
        tenantId, orderId: bankId, currency: "THB",
        recipientConfirmed: true, platformBankAccountVerified: true,
        reference: "BANK-PHASE3AD-DAYCUTOFF-104", evidenceSha256: "a".repeat(64),
        grossAmountCents: 101000, paidAt,
        checkedAt: new Date("2026-10-20T12:59:00Z"),
      }),
    },
  });
  assert.equal(bank.alreadyPaid, false);

  const refundArgs = (reference, amount, at) => ({
    db, tenantId, orderId: codId, reviewerUid,
    now: new Date("2026-10-20T13:30:00Z"),
    resolveIndependentRefund: async () => ({
      verified: true, source: "independent_bank_refund_record",
      tenantId, orderId: codId, currency: "THB", refundSettled: true,
      recipientConfirmed: true, platformDebitConfirmed: true,
      reference, evidenceSha256: "b".repeat(64),
      refundAmountCents: amount, refundAt: new Date(at),
      checkedAt: new Date("2026-10-20T13:29:00Z"),
    }),
  });
  const refund = await executeHybridDemoEnforcedWriter({
    sourceKey: "refund_initial",
    args: refundArgs("BANK-RFD-PHASE3AD-104-A", 20000, "2026-10-20T13:05:00Z"),
  });
  assert.equal(refund.alreadyRecorded, false);
  const part = await executeHybridDemoEnforcedWriter({
    sourceKey: "refund_partial",
    args: refundArgs("BANK-RFD-PHASE3AD-104-B", 10000, "2026-10-20T13:10:00Z"),
  });
  assert.equal(part.sequence, 2);
  const dayBefore = (await t.collection("hybridBillingDayCutoffCandidates").doc(day).get()).data();
  assert.equal(dayBefore.status, "open");
  const sealed = await sealHybridDemoDayCutoffCandidate({ db, tenantId, reviewerUid, day });
  assert.equal(sealed.status, "sealed");
  assert.equal(sealed.coverageCertified, false);
  assert.equal(sealed.immutableFinancialDayManifest, false);
  assert.equal((await t.collection("hybridBillingEpochCandidates").doc("active").get()).data().status, "open",
    "Day seal is separate from the existing global demonstration epoch");
  await assert.rejects(executeHybridDemoEnforcedWriter({
    sourceKey: "cod_cashier", args: codArgs(laterId),
  }), /HYBRID_DAY_CUTOFF_CLOSED/);
  await assert.rejects(executeHybridDemoEnforcedWriter({
    sourceKey: "refund_partial",
    args: refundArgs("BANK-RFD-PHASE3AD-104-C", 5000, "2026-10-20T13:15:00Z"),
  }), /HYBRID_DAY_CUTOFF_CLOSED/);
  assert.equal((await t.collection("orders").doc(laterId).get()).data().paymentStatus, "unpaid");
  assert.equal((await t.collection("hybridBillingReceiptEvents").get()).size, 4,
    "COD + bank receipt + initial refund + partial refund only");
  assert.equal((await t.collection("hybridBillingInvoices").get()).size, 0);
  assert.equal((await t.get()).data().hybridReceiptJournalCoverageReady, undefined);
});


test("emulator Phase3AE: sealed demo day manifest witnesses real journals once and catches later Admin paid bypass", async () => {
 const {executeHybridDemoEnforcedWriter}=require(
   "../../functions/hybrid-billing-demo-enforced-writer.js");
 const {initializeHybridEpochCandidate,initializeHybridDemoDayCutoffCandidate,
   sealHybridDemoDayCutoffCandidate}=require(
   "../../functions/hybrid-billing-writer-epoch-candidate.js");
 const {previewHybridSealedDayManifestCandidate,
   freezeHybridSealedDayManifestCandidate,
   recheckHybridFrozenDayManifestCandidate}=require(
   "../../functions/hybrid-billing-demo-day-manifest.js");
 const tenantId="tenant-phase3ae-manifest-105",t=await activate(tenantId);
 const reviewerUid="super-phase3ae-manifest-105",day="2026-10-20";
 await db.collection("users").doc(reviewerUid).set({
   role:"super_admin",active:true,tenantId
 });
 await initializeHybridEpochCandidate({db,tenantId,reviewerUid});
 await initializeHybridDemoDayCutoffCandidate({db,tenantId,reviewerUid,day});
 const stampAt=new Date("2026-10-20T12:30:00Z");
 const codArgs=id=>({
   db,tenantId,orderId:id,actorUid:reviewerUid,
   clock:()=>stampAt,serverTimestamp:()=>Timestamp.fromDate(stampAt)
 });
 const first="cod-phase3ae-manifest-105-a",second="cod-phase3ae-manifest-105-b";
 for(const id of [first,second]){
   await t.collection("orders").doc(id).create({
     orderType:"delivery",paymentMethod:"cod",paymentStatus:"unpaid",
     status:"delivered",subtotalAmount:1000,deliveryFee:10,totalAmount:1010,
     items:[{id:"item",quantity:1}]
   });
 }
 await assert.rejects(previewHybridSealedDayManifestCandidate({
   db,tenantId,day,pageSize:1
 }),/HYBRID_DEMO_DAY_MANIFEST_DAY_NOT_SEALED/);
 for(const id of [first,second]){
   assert.equal((await executeHybridDemoEnforcedWriter({
     sourceKey:"cod_cashier",args:codArgs(id)
   })).alreadyPaid,false);
 }
 await sealHybridDemoDayCutoffCandidate({db,tenantId,reviewerUid,day});
 const before=await previewHybridSealedDayManifestCandidate({
   db,tenantId,day,pageSize:1
 });
 assert.equal(before.scannedPaidOrders,2);
 assert.equal(before.totalEvents,2);
 assert.equal(before.dayEvents,2);
 assert.equal(before.paymentCount,2);
 assert.equal(before.refundCount,0);
 assert.equal(before.dayGrossCents,202000);
 assert.equal(before.coverageCertified,false);
 assert.equal(before.canIssueInvoice,false);
 const frozen=await freezeHybridSealedDayManifestCandidate({
   db,tenantId,day,reviewerUid,pageSize:1
 });
 assert.equal(frozen.frozen,true);
 assert.equal(frozen.candidateDigest,before.candidateDigest);
 const doc=t.collection("hybridBillingDayManifestCandidates").doc(day);
 const firstSnapshot=await doc.get();
 assert.equal(firstSnapshot.data().candidateOnly,true);
 assert.equal(firstSnapshot.data().coverageCertified,false);
 assert.equal(firstSnapshot.data().canIssueInvoice,false);
 assert.equal((await recheckHybridFrozenDayManifestCandidate({
   db,tenantId,day,pageSize:1
 })).unchanged,true);
 await assert.rejects(freezeHybridSealedDayManifestCandidate({
   db,tenantId,day,reviewerUid,pageSize:1
 }),/HYBRID_DEMO_DAY_MANIFEST_ALREADY_FROZEN/);
 // ADMIN SDK BYPASS: no day barrier and no receipt journal.
 // Detect this dangerous route, DO NOT claim the candidate proves global enforcement.
 await t.collection("orders").doc("legacy-phase3ae-bypass-105").set({
   orderType:"delivery",paymentMethod:"cod",paymentStatus:"paid",
   paymentReceiptSource:"hybrid_cod_cashier_server",status:"delivered",
   paidAt:Timestamp.fromDate(stampAt),subtotalAmount:500,
   deliveryFee:10,totalAmount:510,items:[{id:"item",quantity:1}]
 });
 await assert.rejects(recheckHybridFrozenDayManifestCandidate({
   db,tenantId,day,pageSize:1
 }),/HYBRID_DEMO_DAY_MANIFEST_UNRECONCILED/);
 const still=await doc.get();
 assert.equal(still.data().candidateDigest,frozen.candidateDigest,
   "Frozen candidate must never be rewritten after an unenrolled Admin bypass");
 assert.equal(still.updateTime.toMillis(),firstSnapshot.updateTime.toMillis());
 assert.equal((await t.collection("hybridBillingInvoices").get()).size,0);
 assert.equal((await t.get()).data().hybridReceiptJournalCoverageReady,undefined);
});

test("emulator Phase3AE: manifest freeze fails closed for pre-existing paid order without immutable journal", async () => {
 const {initializeHybridEpochCandidate,initializeHybridDemoDayCutoffCandidate,
   sealHybridDemoDayCutoffCandidate}=require(
   "../../functions/hybrid-billing-writer-epoch-candidate.js");
 const {freezeHybridSealedDayManifestCandidate}=require(
   "../../functions/hybrid-billing-demo-day-manifest.js");
 const tenantId="tenant-phase3ae-bypass-106",t=await activate(tenantId);
 const reviewerUid="super-phase3ae-bypass-106",day="2026-10-20";
 await db.collection("users").doc(reviewerUid).set({
  role:"super_admin",active:true,tenantId
 });
 await initializeHybridEpochCandidate({db,tenantId,reviewerUid});
 await initializeHybridDemoDayCutoffCandidate({db,tenantId,reviewerUid,day});
 await order(t,"legacy-phase3ae-unpaid-journal-106",
   "2026-10-20T12:00:00Z",1000,{
     paymentReceiptSource:"hybrid_cod_cashier_server",paymentMethod:"cod"
   });
 await sealHybridDemoDayCutoffCandidate({db,tenantId,reviewerUid,day});
 await assert.rejects(freezeHybridSealedDayManifestCandidate({
   db,tenantId,day,reviewerUid
 }),/HYBRID_DEMO_DAY_MANIFEST_UNRECONCILED/);
 assert.equal((await t.collection("hybridBillingDayManifestCandidates").get()).size,0);
 assert.equal((await t.collection("hybridBillingInvoices").get()).size,0);
 assert.equal((await t.get()).data().hybridReceiptJournalCoverageReady,undefined);
});


test("emulator Phase3AE: orphan journal/fence mismatch and falsely dated source refuse day freeze", async () => {
 const {initializeHybridEpochCandidate,initializeHybridDemoDayCutoffCandidate,
   sealHybridDemoDayCutoffCandidate}=require(
   "../../functions/hybrid-billing-writer-epoch-candidate.js");
 const {freezeHybridSealedDayManifestCandidate}=require(
   "../../functions/hybrid-billing-demo-day-manifest.js");
 const tenantId="tenant-phase3ae-orphan-107",t=await activate(tenantId);
 const reviewerUid="super-phase3ae-orphan-107",day="2026-10-20";
 await db.collection("users").doc(reviewerUid).set({
   role:"super_admin",active:true,tenantId
 });
 await initializeHybridEpochCandidate({db,tenantId,reviewerUid});
 await initializeHybridDemoDayCutoffCandidate({db,tenantId,reviewerUid,day});
 const orderId="orphan-phase3ae-107";
 const orphan=t.collection("hybridBillingReceiptEvents").doc("cod-"+orderId);
 await orphan.create({
   tenantId,orderId,source:"hybrid_cod_cashier_server",
   actorUid:reviewerUid,shard:0,sourceDay:day,
   merchandiseCents:10000,grossCents:10040,currency:"THB",
   paidAt:Timestamp.fromDate(new Date("2026-10-20T12:30:00Z"))
 });
 await sealHybridDemoDayCutoffCandidate({db,tenantId,reviewerUid,day});
 await assert.rejects(freezeHybridSealedDayManifestCandidate({
   db,tenantId,day,reviewerUid
 }),/HYBRID_DEMO_DAY_MANIFEST_EVENT_FENCE_MISMATCH/,
   "An orphan Admin-created journal without an atomic shard fence must not freeze");
 await orphan.update({
   paidAt:Timestamp.fromDate(new Date("2026-10-21T12:30:00Z"))
 });
 await assert.rejects(freezeHybridSealedDayManifestCandidate({
   db,tenantId,day,reviewerUid
 }),/HYBRID_DEMO_DAY_MANIFEST_UNVERIFIED_EVENT/,
   "Day must be sourced from event's actual financial timestamp, not a forged sourceDay");
 assert.equal((await t.collection("hybridBillingDayManifestCandidates").get()).size,0);
 assert.equal((await t.collection("hybridBillingInvoices").get()).size,0);
 assert.equal((await t.get()).data().hybridReceiptJournalCoverageReady,undefined);
});


test("emulator Phase3AF: pending late-source exception is append-only and links frozen original day without posting money", async()=>{
 const {initializeHybridEpochCandidate,initializeHybridDemoDayCutoffCandidate,
   sealHybridDemoDayCutoffCandidate}=require(
    "../../functions/hybrid-billing-writer-epoch-candidate.js");
 const {freezeHybridSealedDayManifestCandidate}=require(
    "../../functions/hybrid-billing-demo-day-manifest.js");
 const {recordHybridDemoLateExceptionCandidate}=require(
    "../../functions/hybrid-billing-demo-late-exception.js");
 const tenantId="tenant-phase3af-late-108",t=await activate(tenantId);
 const reviewerUid="super-phase3af-late-108",originalDay="2026-10-20";
 await db.collection("users").doc(reviewerUid).set({
   role:"super_admin",active:true,tenantId
 });
 await initializeHybridEpochCandidate({db,tenantId,reviewerUid});
 await initializeHybridDemoDayCutoffCandidate({
   db,tenantId,reviewerUid,day:originalDay
 });
 await sealHybridDemoDayCutoffCandidate({
   db,tenantId,reviewerUid,day:originalDay
 });
 const witness=await freezeHybridSealedDayManifestCandidate({
   db,tenantId,day:originalDay,reviewerUid
 });
 const originalRef=t.collection("hybridBillingDayManifestCandidates").doc(originalDay);
 const originalSnap=await originalRef.get();
 const args={db,tenantId,reviewerUid,originalDay,bookingDay:"2026-10-21",
   sourceType:"lalamove_cod_paid_out",
   sourceAt:new Date("2026-10-20T15:00:00Z"),
   postedAt:new Date("2026-10-21T02:00:00Z"),
   amountCents:19900,referenceHash:"a".repeat(64),
   sourceEvidenceSha256:"b".repeat(64),postedEvidenceSha256:"c".repeat(64)};
 const first=await recordHybridDemoLateExceptionCandidate(args);
 assert.equal(first.alreadyRecorded,false);
 assert.equal(first.pending,true);
 const second=await recordHybridDemoLateExceptionCandidate(args);
 assert.equal(second.alreadyRecorded,true);
 assert.equal(second.id,first.id);
 const late=t.collection("hybridBillingLateExceptionCandidates").doc(first.id);
 const saved=(await late.get()).data();
 assert.equal(saved.originalManifestDigest,witness.candidateDigest);
 assert.equal(saved.status,"pending_independent_review");
 assert.equal(saved.sourceAttested,false);
 assert.equal(saved.bankCreditVerified,false);
 assert.equal(saved.settlementPosted,false);
 assert.equal(saved.financialDayReopened,false);
 assert.equal(saved.canIssueInvoice,false);
 const claim=await db.collection("hybridBillingDemoLateReferenceClaims").doc(first.id).get();
 assert.equal(claim.data().eventPath,late.path);
 await assert.rejects(recordHybridDemoLateExceptionCandidate({
   ...args,amountCents:19800
 }),/HYBRID_DEMO_LATE_REFERENCE_REPLAY_OR_TAMPER/);
 assert.equal((await t.collection("hybridBillingLateExceptionCandidates").get()).size,1);
 assert.equal((await originalRef.get()).updateTime.toMillis(),
   originalSnap.updateTime.toMillis(),"Original sealed day witness must not be rewritten");
 assert.equal((await t.collection("orders").get()).size,0);
 assert.equal((await t.collection("hybridBillingInvoices").get()).size,0);
 assert.equal((await t.get()).data().hybridReceiptJournalCoverageReady,undefined);
});

test("emulator Phase3AF: missing original frozen witness and non-Super Admin cannot record late exception",async()=>{
 const {initializeHybridEpochCandidate,initializeHybridDemoDayCutoffCandidate,
   sealHybridDemoDayCutoffCandidate}=require(
    "../../functions/hybrid-billing-writer-epoch-candidate.js");
 const {freezeHybridSealedDayManifestCandidate}=require(
    "../../functions/hybrid-billing-demo-day-manifest.js");
 const {recordHybridDemoLateExceptionCandidate}=require(
    "../../functions/hybrid-billing-demo-late-exception.js");
 const tenantId="tenant-phase3af-deny-109",t=await activate(tenantId);
 const reviewerUid="super-phase3af-deny-109",staffUid="staff-phase3af-deny-109";
 await db.collection("users").doc(reviewerUid).set({role:"super_admin",active:true,tenantId});
 await db.collection("users").doc(staffUid).set({role:"cashier",active:true,tenantId});
 const args={db,tenantId,reviewerUid,originalDay:"2026-10-20",
   bookingDay:"2026-10-21",sourceType:"promptpay_bank_posted",
   sourceAt:new Date("2026-10-20T14:00:00Z"),
   postedAt:new Date("2026-10-21T09:00:00Z"),
   amountCents:10000,referenceHash:"d".repeat(64),
   sourceEvidenceSha256:"e".repeat(64),postedEvidenceSha256:"f".repeat(64)};
 await initializeHybridEpochCandidate({db,tenantId,reviewerUid});
 await initializeHybridDemoDayCutoffCandidate({
   db,tenantId,reviewerUid,day:"2026-10-20"
 });
 await sealHybridDemoDayCutoffCandidate({
   db,tenantId,reviewerUid,day:"2026-10-20"
 });
 await assert.rejects(recordHybridDemoLateExceptionCandidate(args),
   /HYBRID_DEMO_DAY_MANIFEST_NOT_FROZEN/);
 await freezeHybridSealedDayManifestCandidate({
   db,tenantId,day:"2026-10-20",reviewerUid
 });
 await assert.rejects(recordHybridDemoLateExceptionCandidate({
   ...args,reviewerUid:staffUid
 }),/HYBRID_DEMO_LATE_SUPER_ADMIN_REQUIRED/);
 assert.equal((await t.collection("hybridBillingLateExceptionCandidates").get()).size,0);
 assert.equal((await t.collection("hybridBillingInvoices").get()).size,0);
});


test("emulator Phase3AG: isolated Lalamove 2-order PAID_OUT batch + bank POSTED proof preview never mutates paid state",async()=>{
 const {previewHybridLalamoveCodBatch}=require(
   "../../functions/hybrid-billing-lalamove-batch-preview.js");
 const tenantId="tenant-phase3ag-batch-110",reviewerUid="super-phase3ag-batch-110";
 const a="a".repeat(64),b="b".repeat(64),c="c".repeat(64),
   d="d".repeat(64),e="e".repeat(64),f="f".repeat(64);
 const t=await activate(tenantId,{
   lalamoveAccountScopeSha256:a,lalamoveCodRecipientAccountSha256:b
 });
 await db.collection("users").doc(reviewerUid).set({role:"super_admin",active:true});
 const orderIds=["order-phase3ag-batch-a-110","order-phase3ag-batch-b-110"];
 const amounts=[500,300],providerIds=["LL-BATCH-101","LL-BATCH-102"];
 for(let i=0;i<2;i++){
   await t.collection("orders").doc(orderIds[i]).create({
     orderType:"delivery",deliveryProvider:"lalamove",
     paymentMethod:"cod",lalamoveCodEnabled:true,paymentStatus:"unpaid",
     lalamoveOrderId:providerIds[i],totalAmount:amounts[i]
   });
   await t.collection("hybridLalamoveCodCompletionProof").doc(orderIds[i]).create({
     tenantId,orderId:orderIds[i],providerOrderId:providerIds[i],
     accountScopeSha256:a,providerEvidenceSha256:e,eventHash:f,
     deliveryVerified:true,codSettlementVerified:false,bankReconciled:false,
     status:"delivery_verified_settlement_pending"
   });
 }
 const now=new Date("2026-10-21T08:00:00Z"),batchId="batch-phase3ag-110";
 let providerCalls=0,bankCalls=0;
 const provider={source:"authenticated_lalamove_batch_remittance_lookup",
   authenticated:true,tenantId,batchId,market:"TH",currency:"THB",
   status:"PAID_OUT",batchPayout:true,orderCount:2,
   allocations:[
    {orderId:orderIds[0],providerOrderId:providerIds[0],
     collectedCodCents:50000,feeCents:1000,remittedCents:49000},
    {orderId:orderIds[1],providerOrderId:providerIds[1],
     collectedCodCents:30000,feeCents:500,remittedCents:29500}
   ],accountScopeSha256:a,recipientAccountSha256:b,
   transferReferenceSha256:c,evidenceSha256:d,checkedAt:now,
   paidOutAt:new Date(now.getTime()-120000),
   collectedCodCents:80000,feeCents:1500,remittedCents:78500};
 const bank={source:"independent_bank_posted_credit_lookup",
   authenticated:true,tenantId,status:"POSTED",currency:"THB",
   recipientConfirmed:true,recipientAccountSha256:b,bankAccountScopeSha256:b,
   transferReferenceSha256:c,evidenceSha256:e,
   creditedCents:78500,checkedAt:now,postedAt:new Date(now.getTime()-60000)};
 const args={db,tenantId,batchId,orderIds,reviewerUid,now,
   resolveProviderBatch:async()=>{providerCalls++;return provider;},
   resolveIndependentBankCredit:async()=>{bankCalls++;return bank;}};
 const found=await previewHybridLalamoveCodBatch(args);
 assert.equal(found.orderCount,2);
 assert.equal(found.matchedPostedCreditCents,78500);
 assert.equal(found.canMarkPaid,false);
 assert.equal(found.coverageCertified,false);
 assert.equal(found.sourceAttested,false);
 assert.equal(providerCalls,1);assert.equal(bankCalls,1);
 for(const id of orderIds){
   assert.equal((await t.collection("orders").doc(id).get()).data().paymentStatus,"unpaid");
 }
 assert.equal((await t.collection("hybridBillingReceiptEvents").get()).size,0);
 assert.equal((await t.collection("hybridBillingInvoices").get()).size,0);
 assert.equal((await t.collection("hybridBillingLateExceptionCandidates").get()).size,0);
 assert.equal((await t.get()).data().hybridReceiptJournalCoverageReady,undefined);
 const {reserveHybridDemoCodBatchCandidate}=require(
   "../../functions/hybrid-billing-demo-batch-reservation.js");
 const first=await reserveHybridDemoCodBatchCandidate(args);
 assert.equal(first.alreadyReserved,false);
 assert.equal(first.canMarkPaid,false);
 assert.equal((await reserveHybridDemoCodBatchCandidate(args)).alreadyReserved,true);
 const doc=t.collection("hybridBillingDemoCodBatchCandidates").doc(batchId);
 const recorded=(await doc.get()).data();
 assert.equal(recorded.status,"pending_independent_review");
 assert.equal(recorded.sourceAttested,false);
 assert.equal(recorded.bankCreditVerified,false);
 assert.equal(recorded.settlementPosted,false);
 assert.equal(recorded.canMarkPaid,false);
 assert.equal(recorded.canIssueInvoice,false);
 assert.equal(recorded.coverageCertified,false);
 assert.equal((await t.collection("hybridBillingDemoCodOrderClaims").get()).size,2);
 assert.equal((await db.collection("hybridBillingDemoBatchTransferClaims").doc(c).get()).data().batchId,batchId);
 // Same bank credit cannot be allocated again under a second batch ID;
 // different bank reference for same orders also cannot allocate again.
 provider.batchId="batch-phase3ag-second-110";
 await assert.rejects(reserveHybridDemoCodBatchCandidate({
   ...args,batchId:"batch-phase3ag-second-110"
 }),/HYBRID_DEMO_BATCH_REFERENCE_OR_ORDER_REPLAY/);
 provider.batchId=batchId;
 provider.transferReferenceSha256="1".repeat(64);
 bank.transferReferenceSha256="1".repeat(64);
 await assert.rejects(reserveHybridDemoCodBatchCandidate({
   ...args,batchId:"batch-phase3ag-second-110",
   resolveProviderBatch:async()=>({...provider,batchId:"batch-phase3ag-second-110"})
 }),/HYBRID_DEMO_BATCH_REFERENCE_OR_ORDER_REPLAY/);
 // A mismatched bank amount must fail BEFORE claiming anything.
 provider.transferReferenceSha256=c;
 bank.transferReferenceSha256=c;
 bank.creditedCents=78499;
 await assert.rejects(previewHybridLalamoveCodBatch(args),
   /HYBRID_LALAMOVE_BATCH_INDEPENDENT_POSTED_CREDIT_REQUIRED/);
 assert.equal((await t.collection("hybridBillingInvoices").get()).size,0);
 assert.equal((await t.collection("hybridBillingReceiptEvents").get()).size,0);
 assert.equal((await t.collection("orders").doc(orderIds[0]).get()).data().paymentStatus,"unpaid");
});
test("emulator Phase3AG: cashier cannot access privileged batch evidence lookups",async()=>{
 const {previewHybridLalamoveCodBatch}=require(
   "../../functions/hybrid-billing-lalamove-batch-preview.js");
 const tenantId="tenant-phase3ag-deny-111",uid="cashier-phase3ag-deny-111";
 const t=await activate(tenantId);
 await db.collection("users").doc(uid).set({role:"cashier",active:true,tenantId});
 let calls=0;
 const args={db,tenantId,batchId:"batch-phase3ag-deny-111",
   orderIds:["order-phase3ag-deny-a-111","order-phase3ag-deny-b-111"],
   reviewerUid:uid,now:new Date("2026-10-21T08:00:00Z"),
   resolveProviderBatch:async()=>{calls++;return{};},
   resolveIndependentBankCredit:async()=>{calls++;return{};}};
 await assert.rejects(previewHybridLalamoveCodBatch(args),
   /HYBRID_LALAMOVE_BATCH_SUPER_ADMIN_REQUIRED/);
 assert.equal(calls,0,"Unprivileged caller must not invoke provider/bank lookups");
 assert.equal((await t.collection("orders").get()).size,0);
 assert.equal((await t.collection("hybridBillingInvoices").get()).size,0);
});


test("emulator Phase3AH: global provider-order claim prevents replay across Hybrid tenants despite different batch and bank transfers",async()=>{
 const {reserveHybridDemoCodBatchCandidate}=require(
  "../../functions/hybrid-billing-demo-batch-reservation.js");
 const commonProviderId="LL-GLOBAL-REPLAY-PROVIDER-120",at=new Date("2026-10-21T08:00:00Z");
 const account="a".repeat(64),recipient="b".repeat(64),firstTransfer="c".repeat(64),
  secondTransfer="1".repeat(64),providerDigest="d".repeat(64),bankDigest="e".repeat(64);
 async function prepare(n,transfer){
  const tenantId="tenant-phase3ah-global-"+n,reviewerUid="super-phase3ah-global-"+n;
  const batchId="batch-phase3ah-global-"+n,tenantRef=await activate(tenantId,{
   lalamoveAccountScopeSha256:account,lalamoveCodRecipientAccountSha256:recipient
  });
  await db.collection("users").doc(reviewerUid).set({role:"super_admin",active:true});
  const orderIds=["order-phase3ah-global-"+n+"-a","order-phase3ah-global-"+n+"-b"];
  const providerIds=[commonProviderId,"LL-OTHER-"+n];
  const amounts=[500,300];
  for(let i=0;i<2;i++){
   await tenantRef.collection("orders").doc(orderIds[i]).create({
    orderType:"delivery",deliveryProvider:"lalamove",paymentMethod:"cod",
    lalamoveCodEnabled:true,paymentStatus:"unpaid",
    lalamoveOrderId:providerIds[i],totalAmount:amounts[i]
   });
   await tenantRef.collection("hybridLalamoveCodCompletionProof").doc(orderIds[i]).create({
    tenantId,orderId:orderIds[i],providerOrderId:providerIds[i],
    accountScopeSha256:account,providerEvidenceSha256:providerDigest,
    eventHash:"f".repeat(64),deliveryVerified:true,
    codSettlementVerified:false,bankReconciled:false,
    status:"delivery_verified_settlement_pending"
   });
  }
  const provider={source:"authenticated_lalamove_batch_remittance_lookup",
   authenticated:true,tenantId,batchId,market:"TH",currency:"THB",
   status:"PAID_OUT",batchPayout:true,orderCount:2,
   allocations:[
    {orderId:orderIds[0],providerOrderId:providerIds[0],
     collectedCodCents:50000,feeCents:1000,remittedCents:49000},
    {orderId:orderIds[1],providerOrderId:providerIds[1],
     collectedCodCents:30000,feeCents:500,remittedCents:29500}
   ],
   accountScopeSha256:account,recipientAccountSha256:recipient,
   transferReferenceSha256:transfer,evidenceSha256:providerDigest,
   checkedAt:at,paidOutAt:new Date(at.getTime()-120000),
   collectedCodCents:80000,feeCents:1500,remittedCents:78500
  };
  const bank={source:"independent_bank_posted_credit_lookup",
   authenticated:true,tenantId,status:"POSTED",currency:"THB",
   recipientConfirmed:true,recipientAccountSha256:recipient,
   bankAccountScopeSha256:recipient,transferReferenceSha256:transfer,
   evidenceSha256:bankDigest,creditedCents:78500,checkedAt:at,
   postedAt:new Date(at.getTime()-60000)
  };
  return {args:{db,tenantId,batchId,orderIds,reviewerUid,now:at,
   resolveProviderBatch:async()=>provider,
   resolveIndependentBankCredit:async()=>bank},tenantRef};
 }
 const first=await prepare("120",firstTransfer),second=await prepare("121",secondTransfer);
 assert.equal((await reserveHybridDemoCodBatchCandidate(first.args)).alreadyReserved,false);
 assert.equal((await reserveHybridDemoCodBatchCandidate(first.args)).alreadyReserved,true);
 await assert.rejects(reserveHybridDemoCodBatchCandidate(second.args),
  /HYBRID_DEMO_BATCH_REFERENCE_OR_ORDER_REPLAY/,
  "A different tenant, transfer and batch may not reassign an already claimed Lalamove provider order");
 assert.equal((await second.tenantRef.collection("hybridBillingDemoCodBatchCandidates").get()).size,0);
 assert.equal((await second.tenantRef.collection("hybridBillingDemoCodOrderClaims").get()).size,0);
 assert.equal((await second.tenantRef.collection("hybridBillingReceiptEvents").get()).size,0);
 for(const id of second.args.orderIds)
  assert.equal((await second.tenantRef.collection("orders").doc(id).get()).data().paymentStatus,"unpaid");
 const globallyClaimed=(await db.collection("hybridBillingDemoLalamoveProviderOrderClaims").get()).docs;
 assert.equal(globallyClaimed.filter(s=>s.data().batchId===first.args.batchId).length,2);
 assert.equal(globallyClaimed.filter(s=>s.data().batchId===second.args.batchId).length,0);
 // A privileged bypass may delete a claim; the idempotent retry must NOT silently fill it.
 const removed=globallyClaimed.find(s=>s.data().providerOrderId===commonProviderId);
 await removed.ref.delete();
 await assert.rejects(reserveHybridDemoCodBatchCandidate(first.args),
  /HYBRID_DEMO_BATCH_REFERENCE_OR_ORDER_REPLAY/,
  "Missing global claim is a broken proof, not a reason to recreate an earlier reservation");
 assert.equal((await first.tenantRef.collection("hybridBillingInvoices").get()).size,0);
 assert.equal((await second.tenantRef.collection("hybridBillingInvoices").get()).size,0);
});
