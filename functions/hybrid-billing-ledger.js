"use strict";

// Hybrid platform-fee lifecycle. It never modifies customer orders/payment
// status or the existing Revenue Share, Cashier, POS and Lalamove workflows.
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { dateKey, validDate, billingCycle } = require("./hybrid-billing-core");
const { previewHybridCycle, signupStartDateForPreview } = require("./hybrid-billing-preview");

const REGION = "asia-southeast1";
const BILLING_COLLECTION = "hybridBillingInvoices";
const PROOF_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const DESTINATION_DOC = "hybridBillingPayment";
const ID_RE = /^[a-zA-Z0-9:_-]{12,130}$/;
const tenantIdValid = id => /^[a-zA-Z0-9_-]{8,128}$/.test(id);
const amountSatang = value => Math.round(Number(value) * 100);
const dayBefore = date => new Date(Date.parse(validDate(date) + "T00:00:00Z") - 86400000)
  .toISOString().slice(0, 10);
const dayAfter = date => new Date(Date.parse(validDate(date) + "T00:00:00Z") + 86400000)
  .toISOString().slice(0, 10);

function normalizedDestination(input = {}) {
  const bankName = String(input.bankName || "").trim().slice(0, 100);
  const accountName = String(input.accountName || "").trim().slice(0, 180);
  const accountNumber = String(input.accountNumber || "").replace(/[ -]/g, "");
  if (!bankName || !accountName || !/^[0-9]{8,16}$/.test(accountNumber)) {
    throw new HttpsError("invalid-argument", "HYBRID_BANK_DETAILS_INVALID");
  }
  return { bankName, accountName, accountNumber };
}
async function configuredDestination(db) {
  const snap = await db.collection("platformSettings").doc(DESTINATION_DOC).get();
  if (!snap.exists) return null;
  try { return normalizedDestination(snap.data()); } catch { return null; }
}
function sameBillingPrices(locked, candidate) {
  if (!locked || !candidate) return false;
  return ["monthlyFee", "deliveryThreshold", "deliveryShareRate",
    "monthlySlipQuota", "timezone", "policyVersion"].every(
    key => locked[key] === candidate[key],
  );
}
function stateForInvoice(invoice = {}) {
  if (invoice.status === "paid") return "paid";
  if (invoice.status === "void") return "void";
  if (invoice.paymentStatus === "pending") return "review";
  return "outstanding";
}
function safeInvoiceSummary(id, row = {}) {
  return {
    id, cycleId: String(row.cycleId || ""), kind: String(row.kind || ""),
    date: String(row.date || ""), dueDate: String(row.dueDate || ""),
    suspendFrom: String(row.suspendFrom || ""),
    base: Number(row.calculationBase || 0), amount: Number(row.amount || 0),
    state: stateForInvoice(row), status: String(row.status || "issued"),
    paymentStatus: String(row.paymentStatus || ""), paymentId: String(row.paymentId || ""),
    paidAt: row.paidAt?.toDate?.()?.toISOString() || "",
    issuedAt: row.issuedAt?.toDate?.()?.toISOString() || "",
    paymentDestination: row.paymentDestination || null,
  };
}
function eligibleForIssuance(estimate, today) {
  validDate(today);
  if (!estimate || !Array.isArray(estimate.invoices)) throw new TypeError("Invalid Hybrid estimate");
  return estimate.invoices.filter(x => Number(x.amount) > 0
    && validDate(x.date) < today
    && (!x.issueAtCycleClose || validDate(estimate.cycleEnd) <= today));
}
async function viewer(request, options = {}) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  const db = getFirestore();
  const user = (await db.collection("users").doc(uid).get()).data();
  if (!user || user.active === false) throw new HttpsError("permission-denied", "PROFILE_INACTIVE");
  const superAdmin = user.role === "super_admin";
  const id = superAdmin ? String(request.data?.tenantId || "").trim()
    : String(user.tenantId || "").trim();
  if (!tenantIdValid(id) || (!superAdmin && !["owner", "admin"].includes(user.role))) {
    throw new HttpsError("permission-denied", "HYBRID_BILLING_PERMISSION_REQUIRED");
  }
  if (!superAdmin && request.data?.tenantId && request.data.tenantId !== id) {
    throw new HttpsError("permission-denied", "CROSS_TENANT_DENIED");
  }
  if (options.superAdmin && !superAdmin) throw new HttpsError("permission-denied", "SUPER_ADMIN_REQUIRED");
  const ref = db.collection("tenants").doc(id);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.billingPolicyVersion !== "hybrid_v1") {
    throw new HttpsError("failed-precondition", "HYBRID_TENANT_REQUIRED");
  }
  return { db, ref, tenant: { id, ...snap.data() }, user: { uid, ...user }, superAdmin };
}
function assertLive(tenant) {
  if (tenant.hybridBillingLive !== true) {
    throw new HttpsError("failed-precondition", "HYBRID_LIVE_BILLING_NOT_ENABLED");
  }
}
async function adminAuth(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  const db = getFirestore();
  const user = (await db.collection("users").doc(auth.uid).get()).data();
  if (!user || user.active === false || user.role !== "super_admin") {
    throw new HttpsError("permission-denied", "SUPER_ADMIN_REQUIRED");
  }
  return { uid: auth.uid, db };
}
async function verifiedEstimate(db, ref, tenant, throughDate) {
  const start = await signupStartDateForPreview(db, tenant);
  const today = dateKey(new Date());
  validDate(throughDate);
  if (throughDate < start || throughDate >= today) {
    throw new HttpsError("failed-precondition", "HYBRID_REQUIRES_CLOSED_BANGKOK_DAY");
  }
  return previewHybridCycle(ref, tenant, throughDate, db, start);
}
async function issueForTenant(db, ref, tenant, throughDate, { attest, actor } = {}) {
  assertLive(tenant);
  // Source validation always precedes any monetary write. Preview fails closed
  // on noncanonical paid timestamps, >10k Delivery docs or invalid amounts.
  const estimate = await verifiedEstimate(db, ref, tenant, throughDate);
  if (attest !== "RECONCILED_DELIVERY_SOURCE") {
    throw new HttpsError("failed-precondition", "HYBRID_RECONCILIATION_ATTESTATION_REQUIRED");
  }
  const today = dateKey(new Date());
  const lines = eligibleForIssuance(estimate, today);
  if (!lines.length) return { inserted: [], skipped: [], cycleId: estimate.cycleId, selectedDate: throughDate };
  const destination = await configuredDestination(db);
  if (!destination) throw new HttpsError("failed-precondition", "HYBRID_PAYMENT_BANK_REQUIRED");
  // Preserve the pricing snapshot used for the FIRST invoice in the cycle.
  const periodRef = ref.collection("hybridBillingPeriods").doc(estimate.cycleId);
  const period = await periodRef.get();
  if (!period.exists) {
    try {
      await periodRef.create({
        configSnapshot: estimate.config, cycleStart: estimate.cycleStart, cycleEnd: estimate.cycleEnd,
        createdAt: FieldValue.serverTimestamp(), createdBy: actor,
      });
    } catch (error) {
      if (![6, "6", "already-exists", "ALREADY_EXISTS"].includes(error.code)) throw error;
    }
  }
  const locked = await periodRef.get();
  if (!locked.exists || !sameBillingPrices(locked.data().configSnapshot, estimate.config)) {
    throw new HttpsError("failed-precondition", "HYBRID_CYCLE_PRICING_CHANGED_RETRY");
  }
  // If historical orders move the trigger day or change an already-issued
  // amount, require finance reconciliation instead of issuing a second bill.
  const issued = await ref.collection(BILLING_COLLECTION)
    .where("cycleId", "==", estimate.cycleId).limit(100).get();
  if (issued.size >= 100) throw new HttpsError("resource-exhausted", "HYBRID_CYCLE_INVOICE_SCAN_LIMIT");
  const wanted = new Map(lines.map(line => [line.id, line]));
  for (const doc of issued.docs) {
    const item = doc.data(), matching = wanted.get(doc.id);
    if (item.status === "void") continue;
    if (!matching || item.date !== matching.date
      || item.kind !== matching.kind
      || amountSatang(item.amount) !== amountSatang(matching.amount)) {
      throw new HttpsError("failed-precondition", "HYBRID_ISSUED_INVOICE_RECONCILIATION_REQUIRED");
    }
  }
  const inserted = [], skipped = [];
  for (const line of lines) {
    const invoiceRef = ref.collection(BILLING_COLLECTION).doc(line.id);
    const payload = {
      tenantId: tenant.id, policyVersion: "hybrid_v1", cycleId: estimate.cycleId,
      cycleStart: estimate.cycleStart, cycleEnd: estimate.cycleEnd,
      kind: line.kind, date: line.date,
      // Charge is not payable before it exists: allow a full calendar day
      // after issuance before suspending a tenant.
      dueDate: today, suspendFrom: dayAfter(today),
      calculationBase: line.calculationBase, amount: line.amount, status: "issued",
      paymentStatus: "", paymentId: "",
      configSnapshot: estimate.config,
      paymentDestination: destination,
      pricingSource: estimate.source,
      coverageCertified: false, // Operator attested; not a certified immutable payment feed.
      reconciledBy: actor, reconciliationAttestation: attest,
      issuedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    };
    try {
      await invoiceRef.create(payload);
      inserted.push(safeInvoiceSummary(line.id, payload));
    } catch (error) {
      const code = String(error.code || "");
      if (code === "6" || code === "already-exists" || code === "ALREADY_EXISTS") {
        // Never change an already-issued bill when late orders or configuration changes.
        const existing = await invoiceRef.get();
        if (existing.exists && amountSatang(existing.data()?.amount) !== amountSatang(line.amount)) {
          throw new HttpsError("failed-precondition", "HYBRID_ISSUED_INVOICE_AMOUNT_MISMATCH");
        }
        skipped.push(line.id);
        continue;
      }
      throw error;
    }
  }
  return { inserted, skipped, cycleId: estimate.cycleId, selectedDate: throughDate };
}
exports.getHybridBillingPaymentDestination = onCall({ region: REGION }, async request => {
  const { db } = await viewer(request);
  return { ok: true, destination: await configuredDestination(db) };
});
exports.updateHybridBillingPaymentDestination = onCall({ region: REGION }, async request => {
  const { db, uid } = await adminAuth(request.auth);
  const destination = normalizedDestination(request.data || {});
  await db.collection("platformSettings").doc(DESTINATION_DOC).set({
    ...destination, updatedAt: FieldValue.serverTimestamp(), updatedBy: uid,
  }, { merge: true });
  return { ok: true, destination };
});
exports.getPlatformHybridPaymentDestination = onCall({ region: REGION }, async request => {
  const { db } = await adminAuth(request.auth);
  return { ok: true, destination: await configuredDestination(db) };
});
exports.getTenantHybridInvoices = onCall({ region: REGION }, async request => {
  const { ref } = await viewer(request);
  const docs = await ref.collection(BILLING_COLLECTION).orderBy("issuedAt", "desc").limit(100).get();
  return { ok: true, items: docs.docs.map(d => safeInvoiceSummary(d.id, d.data())) };
});
exports.getPlatformHybridInvoices = onCall({ region: REGION }, async request => {
  const { ref, tenant } = await viewer(request, { superAdmin: true });
  const docs = await ref.collection(BILLING_COLLECTION).orderBy("issuedAt", "desc").limit(100).get();
  const items = [];
  for (const d of docs.docs) {
    const data = d.data();
    const invoice = safeInvoiceSummary(d.id, data);
    if (data.paymentId) {
      const paymentSnap = await d.ref.collection("payments").doc(data.paymentId).get();
      if (paymentSnap.exists) invoice.payment = {
        ...{ id: paymentSnap.id, status: paymentSnap.data().status },
        slipPath: paymentSnap.data().slipPath || "",
        slipName: paymentSnap.data().slipName || "",
      };
    }
    items.push(invoice);
  }
  return { ok: true, items, live: tenant.hybridBillingLive === true };
});
exports.issueTenantHybridInvoices = onCall({ region: REGION, timeoutSeconds: 120 }, async request => {
  const { db, ref, tenant, user } = await viewer(request, { superAdmin: true });
  const day = String(request.data?.throughDate || "");
  const result = await issueForTenant(db, ref, tenant, day, {
    actor: user.uid, attest: String(request.data?.attestation || ""),
  });
  return { ok: true, ...result };
});
exports.setTenantHybridBillingLive = onCall({ region: REGION, timeoutSeconds: 90 }, async request => {
  const { db, ref, tenant, user } = await viewer(request, { superAdmin: true });
  const enabled = request.data?.enabled === true;
  const confirmation = String(request.data?.confirmation || "");
  if (enabled && confirmation !== "ENABLE_HYBRID_LIVE_BILLING") {
    throw new HttpsError("failed-precondition", "HYBRID_EXPLICIT_ENABLE_CONFIRMATION_REQUIRED");
  }
  if (enabled) {
    const destination = await configuredDestination(db);
    if (!destination) throw new HttpsError("failed-precondition", "HYBRID_BANK_DESTINATION_REQUIRED");
    await verifiedEstimate(db, ref, tenant, dayBefore(dateKey(new Date())));
  }
  await ref.update({
    hybridBillingLive: enabled, hybridBillingLiveUpdatedBy: user.uid,
    hybridBillingLiveUpdatedAt: FieldValue.serverTimestamp(),
  });
  // Pausing fees must not trap a previously billing-suspended Tenant.
  if (!enabled && tenant.hybridBillingSuspended === true) {
    await reconcileTenantAccess(db, ref, { ...tenant, hybridBillingLive: false });
  }
  return { ok: true, enabled };
});
exports.submitTenantHybridPayment = onCall({ region: REGION, timeoutSeconds: 45 }, async request => {
  const { db, ref, tenant, user } = await viewer(request);
  // Existing issued invoices can still be settled if new billing is paused.
  const invoiceId = String(request.data?.invoiceId || "");
  const paymentId = String(request.data?.paymentId || "");
  const path = String(request.data?.slipPath || "");
  if (!ID_RE.test(invoiceId) || !ID_RE.test(paymentId)
    || !path.startsWith(`tenants/${tenant.id}/hybrid-billing-slips/${invoiceId}/${paymentId}/`)) {
    throw new HttpsError("invalid-argument", "HYBRID_PAYMENT_PATH_INVALID");
  }
  const file = getStorage().bucket().file(path);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError("not-found", "HYBRID_PAYMENT_SLIP_NOT_FOUND");
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size || 0);
  const mime = String(metadata.contentType || "").toLowerCase();
  if (size <= 0 || size > MAX_PROOF_BYTES || !PROOF_MIMES.has(mime)) {
    throw new HttpsError("invalid-argument", "HYBRID_PAYMENT_SLIP_INVALID");
  }
  const invoiceRef = ref.collection(BILLING_COLLECTION).doc(invoiceId);
  const paymentRef = invoiceRef.collection("payments").doc(paymentId);
  await db.runTransaction(async tx => {
    const [invoice, existingPayment] = await Promise.all([
      tx.get(invoiceRef), tx.get(paymentRef),
    ]);
    if (!invoice.exists || invoice.data().status !== "issued" || invoice.data().paymentStatus === "pending") {
      throw new HttpsError("failed-precondition", "HYBRID_INVOICE_NOT_PAYABLE");
    }
    if (existingPayment.exists) throw new HttpsError("already-exists", "HYBRID_PAYMENT_ALREADY_SUBMITTED");
    tx.create(paymentRef, {
      invoiceId, tenantId: tenant.id, paymentId,
      amount: invoice.data().amount, slipPath: path,
      slipName: String(request.data?.slipName || "").slice(0, 180),
      slipMime: mime, slipSize: size, status: "pending", submittedBy: user.uid,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    tx.update(invoiceRef, {
      paymentId, paymentStatus: "pending", updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { ok: true, invoiceId, paymentId, status: "pending" };
});
exports.reviewTenantHybridPayment = onCall({ region: REGION }, async request => {
  const { db, ref, tenant, user } = await viewer(request, { superAdmin: true });
  const invoiceId = String(request.data?.invoiceId || "");
  const paymentId = String(request.data?.paymentId || "");
  const action = String(request.data?.action || "");
  if (!ID_RE.test(invoiceId) || !ID_RE.test(paymentId) || !["approve", "reject"].includes(action)) {
    throw new HttpsError("invalid-argument", "HYBRID_REVIEW_INVALID");
  }
  const invoiceRef = ref.collection(BILLING_COLLECTION).doc(invoiceId);
  const paymentRef = invoiceRef.collection("payments").doc(paymentId);
  const status = action === "approve" ? "approved" : "rejected";
  await db.runTransaction(async tx => {
    const [invoice, payment] = await Promise.all([tx.get(invoiceRef), tx.get(paymentRef)]);
    if (!invoice.exists || !payment.exists || invoice.data().status !== "issued"
      || invoice.data().paymentStatus !== "pending" || invoice.data().paymentId !== paymentId
      || payment.data().status !== "pending" || payment.data().tenantId !== tenant.id
      || payment.data().invoiceId !== invoiceId) {
      throw new HttpsError("failed-precondition", "HYBRID_PAYMENT_REVIEW_CONFLICT");
    }
    tx.update(paymentRef, {
      status, reviewedBy: user.uid,
      reviewNote: String(request.data?.note || "").slice(0, 400),
      reviewedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    tx.update(invoiceRef, {
      status: action === "approve" ? "paid" : "issued",
      paymentStatus: status,
      paidAt: action === "approve" ? FieldValue.serverTimestamp() : null,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  // Access changes are always derived from ALL remaining issued bills,
  // not a single approved slip.
  await reconcileTenantAccess(db, ref, tenant);
  return { ok: true, status };
});
async function reconcileTenantAccess(db, ref, _tenantHint) {
  // Re-read current Tenant, invoices, and slug *inside the same transaction*.
  // Callers may hold stale Tenant snapshots after a review or an admin change.
  return db.runTransaction(async tx => {
    const tenantSnap = await tx.get(ref);
    if (!tenantSnap.exists) return { action: "none", reason: "tenant_missing" };
    const tenant = tenantSnap.data();
    if (tenant.billingPolicyVersion !== "hybrid_v1") {
      return { action: "none", reason: "not_hybrid" };
    }
    if (tenant.hybridBillingLive !== true && tenant.hybridBillingSuspended !== true) {
      return { action: "none", reason: "not_enabled" };
    }

    const invoices = await tx.get(ref.collection(BILLING_COLLECTION)
      .where("status", "==", "issued").limit(200));
    if (invoices.size >= 200) return { action: "none", reason: "invoice_scan_limit" };

    const today = dateKey(new Date());
    // A bank slip awaiting Super Admin approval is NOT a paid invoice.
    // Only a reviewed/paid invoice can release an existing suspension.
    const overdue = tenant.hybridBillingLive === true && invoices.docs.some(d =>
      d.data().suspendFrom <= today && Number(d.data().amount) > 0);
    const changed = overdue ? tenant.hybridBillingSuspended !== true
      : tenant.hybridBillingSuspended === true;
    if (!changed) return { action: "none", overdue };

    // A separately disabled store must never be re-enabled by Hybrid billing.
    if (overdue && tenant.active === false && tenant.hybridBillingSuspended !== true) {
      return { action: "none", reason: "independently_disabled" };
    }

    const slugRef = tenant.slug
      ? db.collection("tenantSlugs").doc(String(tenant.slug)) : null;
    const slugSnap = slugRef ? await tx.get(slugRef) : null;
    if (slugSnap?.exists && slugSnap.data()?.tenantId !== ref.id) {
      // Never alter a slug belonging to another Tenant or recreate a missing slug.
      throw new HttpsError("failed-precondition", "HYBRID_TENANT_SLUG_OWNERSHIP_CHANGED");
    }

    const patch = overdue
      ? { active: false, hybridBillingSuspended: true,
          hybridBillingWasActive: tenant.active !== false,
          hybridBillingSuspendedAt: FieldValue.serverTimestamp() }
      : { active: tenant.hybridBillingWasActive === true,
          hybridBillingSuspended: false,
          hybridBillingWasActive: FieldValue.delete(),
          hybridBillingSuspendedAt: FieldValue.delete() };
    tx.set(ref, { ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (slugSnap?.exists) {
      tx.update(slugRef, { active: patch.active, updatedAt: FieldValue.serverTimestamp() });
    }
    return { action: overdue ? "suspended" : "restored", overdue };
  });
}
exports.reconcileTenantHybridBilling = onCall({ region: REGION }, async request => {
  const { db, ref, tenant } = await viewer(request, { superAdmin: true });
  return { ok: true, ...(await reconcileTenantAccess(db, ref, tenant)) };
});
// Daily automated processing ONLY for explicitly opted-in Hybrid Tenants.
// No live Tenant is opted in merely by deployment or ordinary registration.
exports.processHybridBillingDaily = onSchedule(
  { region: REGION, schedule: "15 0 * * *", timeZone: "Asia/Bangkok",
    timeoutSeconds: 540, memory: "512MiB" },
  async () => {
    const db = getFirestore();
    const yesterday = dayBefore(dateKey(new Date()));
    const tenants = await db.collection("tenants")
      .where("billingPolicyVersion", "==", "hybrid_v1").limit(500).get();
    if (tenants.size >= 500) {
      // Full-scan safety: never silently omit unprocessed active pilot Tenants.
      throw new Error("HYBRID_DAILY_TENANT_SCAN_LIMIT");
    }
    for (const doc of tenants.docs) {
      const tenant = { id: doc.id, ...doc.data() };
      if (tenant.hybridBillingLive !== true) continue;
      try {
        await issueForTenant(db, doc.ref, tenant, yesterday,
          { attest: "RECONCILED_DELIVERY_SOURCE", actor: "system:daily" });
        await reconcileTenantAccess(db, doc.ref, tenant);
      } catch (error) {
        console.error("HYBRID_BILLING_DAILY_BLOCKED", { tenantId: doc.id, error: error.message });
      }
    }
  },
);

async function reserveHybridSlipCredit(db, tenantRef, tenant, orderId) {
  if (tenant.billingPolicyVersion !== "hybrid_v1" || tenant.hybridBillingLive !== true) return true;
  const today = dateKey(new Date());
  const start = await signupStartDateForPreview(db, tenant);
  const estimate = await previewHybridCycle(tenantRef, tenant, today, db, start);
  if (estimate.slipUnlimited) return true;
  const quota = Number(estimate.slipQuota);
  const period = estimate.cycleId;
  const usageRef = tenantRef.collection("hybridSlipUsage").doc(period);
  const creditRef = tenantRef.collection("hybridSlipCredits").doc(orderId);
  return db.runTransaction(async tx => {
    const [usage, credit] = await Promise.all([tx.get(usageRef), tx.get(creditRef)]);
    if (credit.exists) return credit.data()?.cycleId === period;
    const used = Number(usage.data()?.count || 0);
    if (!Number.isSafeInteger(used) || used < 0 || used >= quota) return false;
    tx.create(creditRef, { cycleId: period, orderId, createdAt: FieldValue.serverTimestamp() });
    tx.set(usageRef, { cycleId: period, count: used + 1,
      updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });
}
exports.reserveHybridSlipCredit = reserveHybridSlipCredit;
exports.getTenantHybridSlipUsage = onCall({ region: REGION }, async request => {
  const { db, ref, tenant } = await viewer(request);
  const signupDate = await signupStartDateForPreview(db, tenant);
  const cycle = billingCycle(signupDate, dateKey(new Date()));
  const usage = await ref.collection("hybridSlipUsage").doc(cycle.id).get();
  return { ok: true, cycleId: cycle.id,
    used: Number(usage.data()?.count || 0) };
});

exports._test = { eligibleForIssuance, stateForInvoice, safeInvoiceSummary, normalizedDestination, sameBillingPrices, issueForTenant, reconcileTenantAccess };
