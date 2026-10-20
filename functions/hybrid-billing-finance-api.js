"use strict";

// Protected OWNER / Super Admin finance API candidate. Deliberately NOT
// re-exported by functions/index.js until Storage/Auth/AppCheck staging UAT,
// rule review and bank reconciliation procedures receive approval.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { submitHybridPaymentEvidence, reviewHybridPaymentEvidence } = require("./hybrid-billing-payments");
const { approveHybridRecovery } = require("./hybrid-billing-recovery");
const { issueHybridInvoicesForClosedDay } = require("./hybrid-billing-ledger");
const { reconcileHybridArrears } = require("./hybrid-billing-arrears");
const { scanHybridPaidReceiptExceptions, inspectHybridClosedDayAdjustments } = require("./hybrid-billing-receipt-audit");

const HYBRID_FINANCE_API_READY = false; // KEEP FALSE until full external UAT.
const ID = /^[A-Za-z0-9_-]{8,128}$/;
const paths = {
  list: ["action", "tenantId"],
  queue: ["action", "tenantId"],
  audit: ["action", "tenantId", "afterId"],
  adjustments: ["action", "tenantId", "cycleId"],
  submit: ["action", "tenantId", "invoiceId", "attemptId", "slipPath"],
  review: ["action", "tenantId", "attemptId", "decision", "bankTxnRef",
    "confirmedAmountCents", "recipientConfirmed"],
  recover: ["action", "tenantId", "reviewId"],
  close: ["action", "tenantId", "cycleId"],
  arrears: ["action", "tenantId"],
};
const deny = (status, error) => { throw new HttpsError(status, error); };
function exactFields(data, names) {
  return names.length === Object.keys(data).length
    && names.every(name => Object.hasOwn(data, name));
}
function makeHybridFinanceHandler({
  getDb = getFirestore,
  getBucket = () => getStorage().bucket(),
  ready = HYBRID_FINANCE_API_READY,
  clock = () => new Date(),
} = {}) {
  return async request => {
    if (ready !== true) deny("failed-precondition", "HYBRID_FINANCE_NOT_RELEASED");
    const uid = request?.auth?.uid;
    if (typeof uid !== "string" || !ID.test(uid)) deny("unauthenticated", "HYBRID_FINANCE_AUTH_REQUIRED");
    const data = request?.data;
    if (!data || typeof data !== "object" || Array.isArray(data)
      || !Object.hasOwn(paths, data.action) || !exactFields(data, paths[data.action])
      || typeof data.tenantId !== "string" || !ID.test(data.tenantId)) {
      deny("invalid-argument", "HYBRID_FINANCE_FIELDS_INVALID");
    }
    const db = getDb(), tenantId = data.tenantId;
    const actorSnapshot = await db.collection("users").doc(uid).get();
    const actor = actorSnapshot.data() || {};
    if (!actorSnapshot.exists || actor.active !== true || !["owner", "admin", "super_admin"].includes(actor.role)) {
      deny("permission-denied", "HYBRID_FINANCE_FORBIDDEN");
    }
    const superAdmin = actor.role === "super_admin";
    if (!superAdmin && actor.tenantId !== tenantId) {
      deny("permission-denied", "HYBRID_FINANCE_CROSS_TENANT_DENIED");
    }
    const action = data.action;
    if (["queue", "audit", "adjustments", "review", "recover", "close", "arrears"].includes(action) && !superAdmin) {
      deny("permission-denied", "HYBRID_FINANCE_SUPER_ADMIN_REQUIRED");
    }
    if (action === "list") {
      const t = await db.collection("tenants").doc(tenantId).get();
      if (!t.exists || t.data()?.billingPolicyVersion !== "hybrid_v1") {
        deny("failed-precondition", "HYBRID_FINANCE_NOT_HYBRID");
      }
      const tenantRef = db.collection("tenants").doc(tenantId);
      const snap = await tenantRef.collection("hybridBillingInvoices")
        .orderBy("__name__").limit(201).get();
      if (snap.size > 200) deny("resource-exhausted", "HYBRID_FINANCE_PAGINATION_REQUIRED");
      const rows = await Promise.all(snap.docs.map(async doc => {
        const inv = doc.data() || {};
        const paid = await tenantRef.collection("hybridBillingSettlements").doc(doc.id).get();
        return { invoiceId: doc.id, kind: inv.kind, serviceDate: inv.serviceDate,
          dueDate: inv.dueDate, amountCents: inv.amountCents,
          currency: inv.currency, status: paid.exists ? "paid" : "unpaid" };
      }));
      return { ok: true, rows };
    }
    if (action === "adjustments") {
      return { ok: true, ...(await inspectHybridClosedDayAdjustments({
        db, tenantId, cycleId: data.cycleId,
      })) };
    }
    if (action === "audit") {
      return { ok: true, ...(await scanHybridPaidReceiptExceptions({
        db, tenantId, afterId: data.afterId,
      })) };
    }
    if (action === "queue") {
      const tenantRef = db.collection("tenants").doc(tenantId);
      const tenant = await tenantRef.get();
      if (!tenant.exists || tenant.data()?.billingPolicyVersion !== "hybrid_v1") {
        deny("failed-precondition", "HYBRID_FINANCE_NOT_HYBRID");
      }
      const evidence = await tenantRef.collection("hybridBillingEvidence")
        .orderBy("__name__").limit(101).get();
      if (evidence.size > 100) {
        deny("resource-exhausted", "HYBRID_FINANCE_QUEUE_PAGINATION_REQUIRED");
      }
      const rows = await Promise.all(evidence.docs.map(async doc => {
        const data = doc.data() || {};
        if (data.tenantId !== tenantId || data.attemptId !== doc.id
          || data.status !== "pending_review" || typeof data.slipPath !== "string"
          || !data.slipPath.startsWith("tenants/" + tenantId + "/hybrid-billing-slips/" + doc.id + "/")) {
          deny("failed-precondition", "HYBRID_FINANCE_EVIDENCE_INTEGRITY");
        }
        const prior = await tenantRef.collection("hybridBillingReviews").doc(doc.id).get();
        if (prior.exists) return null;
        return { attemptId: doc.id, invoiceId: data.invoiceId,
          amountCents: data.amountCents, slipPath: data.slipPath,
          submittedBy: data.submittedBy };
      }));
      return { ok: true, rows: rows.filter(Boolean) };
    }
    if (action === "submit") {
      if (superAdmin) deny("permission-denied", "HYBRID_FINANCE_TENANT_OWNER_REQUIRED");
      if (typeof data.attemptId !== "string" || !ID.test(data.attemptId)
        || typeof data.invoiceId !== "string"
        || typeof data.slipPath !== "string"
        || !data.slipPath.startsWith("tenants/" + tenantId + "/hybrid-billing-slips/" + data.attemptId + "/")) {
        deny("invalid-argument", "HYBRID_FINANCE_SLIP_PATH_INVALID");
      }
      const [metadata] = await getBucket().file(data.slipPath).getMetadata();
      const bytes = Number(metadata.size);
      if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > 10 * 1024 * 1024
        || !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(metadata.contentType)
        || metadata.metadata?.uploadedByUid !== uid) {
        deny("failed-precondition", "HYBRID_FINANCE_STORAGE_PROOF_INVALID");
      }
      return { ok: true, ...await submitHybridPaymentEvidence({
        db, tenantId, invoiceId: data.invoiceId, attemptId: data.attemptId,
        slipPath: data.slipPath, verifiedStorage: true,
        actor: { uid, role: actor.role, active: actor.active, tenantId },
      }) };
    }
    if (action === "review") {
      if (!["approve", "reject"].includes(data.decision)
        || typeof data.attemptId !== "string" || !ID.test(data.attemptId)
        || typeof data.bankTxnRef !== "string"
        || !Number.isSafeInteger(data.confirmedAmountCents)
        || typeof data.recipientConfirmed !== "boolean") {
        deny("invalid-argument", "HYBRID_FINANCE_REVIEW_FIELDS_INVALID");
      }
      return { ok: true, ...await reviewHybridPaymentEvidence({
        db, tenantId, attemptId: data.attemptId, decision: data.decision,
        bankTxnRef: data.bankTxnRef, confirmedAmountCents: data.confirmedAmountCents,
        recipientConfirmed: data.recipientConfirmed,
        actor: { uid, role: actor.role, active: actor.active },
      }) };
    }
    if (action === "recover") {
      return { ok: true, ...await approveHybridRecovery({
        db, tenantId, reviewerUid: uid, reviewId: data.reviewId, now: clock(),
      }) };
    }
    if (action === "close") {
      return { ok: true, ...await issueHybridInvoicesForClosedDay({
        db, tenantId, cycleId: data.cycleId, now: clock(),
      }) };
    }
    if (action === "arrears") {
      return { ok: true, ...await reconcileHybridArrears({ db, tenantId, now: clock() }) };
    }
    deny("invalid-argument", "HYBRID_FINANCE_UNKNOWN_ACTION");
  };
}

const manageHybridFinanceCandidate = onCall({
  region: "asia-southeast1", enforceAppCheck: true, timeoutSeconds: 120,
}, makeHybridFinanceHandler());
module.exports = { HYBRID_FINANCE_API_READY, makeHybridFinanceHandler, manageHybridFinanceCandidate };
