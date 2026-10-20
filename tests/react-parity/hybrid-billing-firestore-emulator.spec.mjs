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
