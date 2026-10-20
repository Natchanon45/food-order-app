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

test("emulator Phase3I: Lalamove COD requires completion and saves server receipt", async () => {
  const id = "tenant-emu-cod-lalamove-17", ref = await activate(id);
  const uid = "cashier-cod-emu-003", orderId = "cod-order-lalamove-003";
  await codActor(uid, id);
  await unpaidCod(ref, orderId, 1000, {
    deliveryProvider: "lalamove", lalamoveOrderStatus: "PICKED_UP",
    status: "ready",
  });
  const payment = () => settleHybridCodDeliveryPayment({ db, tenantId: id, orderId, actorUid: uid });
  await assert.rejects(payment(), /HYBRID_COD_DELIVERY_NOT_COMPLETED/);
  // Browser-forged COMPLETED alone must never settle money.
  await ref.collection("orders").doc(orderId).update({ lalamoveOrderStatus: "COMPLETED" });
  await assert.rejects(payment(), /HYBRID_COD_DELIVERY_NOT_COMPLETED/);
  // This synthetic Admin SDK write models the trusted webhook/refresh path,
  // NOT proof that the live browser cannot modify these fields yet.
  await ref.collection("orders").doc(orderId).update({
    lalamoveCodEnabled: true,
    lalamoveOrderId: "LALAMOVE-TEST-ID-003",
    lalamoveCompletedAt: "2026-10-20T12:00:00Z",
    lalamoveCodDeliveryCompletedAt: "2026-10-20T12:00:00Z",
  });
  const outcome = await payment();
  assert.equal(outcome.alreadyPaid, false);
  const record = (await ref.collection("orders").doc(orderId).get()).data();
  assert.equal(record.paymentStatus, "paid");
  assert.equal(record.status, "paid");
  assert.equal(record.lalamoveCodSettlementStatus, "received");
  assert.ok(record.lalamoveCodSettledAt?.toDate?.() instanceof Date);
  assert.ok(record.paidAt?.toDate?.() instanceof Date);
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
