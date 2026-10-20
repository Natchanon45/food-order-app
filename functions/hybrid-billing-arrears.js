"use strict";

// Phase 3C: pure arrears evaluator + guarded internal tenant state transaction.
// NOT scheduled/exposed. Backend guard and manual-admin-hold integration required.
const { FieldValue } = require("firebase-admin/firestore");
const { dateKey, validDate } = require("./hybrid-billing-core");

function unresolvedDueInvoices(invoices, settledIds, onDay) {
  validDate(onDay);
  const paid = new Set(settledIds);
  return invoices.filter(row => {
    if (!row || !Number.isSafeInteger(row.amountCents) || row.amountCents <= 0
      || row.policyVersion !== "hybrid_v1" || !row.invoiceId
      || !row.suspendFrom) throw Error("HYBRID_ARREARS_BAD_INVOICE");
    validDate(row.suspendFrom);
    return row.suspendFrom <= onDay && !paid.has(row.invoiceId);
  }).map(row => row.invoiceId).sort();
}

async function reconcileHybridArrears({ db, tenantId, now = new Date(),
  serverTimestamp = () => FieldValue.serverTimestamp(), maximumInvoices = 350 }) {
  if (!db || !/^[A-Za-z0-9_-]{8,128}$/.test(String(tenantId || ""))
    || !(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw Error("HYBRID_ARREARS_INVALID_INPUT");
  }
  if (!Number.isSafeInteger(maximumInvoices) || maximumInvoices < 1 || maximumInvoices > 1000) {
    throw Error("HYBRID_ARREARS_BAD_LIMIT");
  }
  const today = dateKey(now);
  const tenantRef = db.collection("tenants").doc(tenantId);
  return db.runTransaction(async tx => {
    const tenantSnap = await tx.get(tenantRef);
    const tenant = tenantSnap.data() || {};
    if (!tenantSnap.exists || tenant.billingPolicyVersion !== "hybrid_v1"
      || tenant.hybridBillingEnabled !== true) throw Error("HYBRID_TENANT_NOT_ACTIVATED");
    // Read invoice scan AND settlements in the same consistent Firestore
    // transaction; otherwise newly issued overdue bills can be missed between
    // a pre-transaction query and the suspension decision.
    const snap = await tx.get(tenantRef.collection("hybridBillingInvoices")
      .where("suspendFrom", "<=", today).orderBy("suspendFrom").limit(maximumInvoices + 1));
    if (!snap || !Array.isArray(snap.docs) || snap.size !== snap.docs.length) {
      throw Error("HYBRID_ARREARS_SCAN_INCOMPLETE");
    }
    if (snap.size > maximumInvoices) throw Error("HYBRID_ARREARS_SCAN_LIMIT");
    const invoices = snap.docs.map(doc => doc.data());
    for (const inv of invoices) {
      if (inv.tenantId !== tenantId) throw Error("HYBRID_ARREARS_TENANT_CONFLICT");
    }
    const settlementRefs = invoices.map(row => tenantRef.collection("hybridBillingSettlements").doc(row.invoiceId));
    const settlementSnaps = await Promise.all(settlementRefs.map(ref => tx.get(ref)));
    const paid = settlementSnaps.flatMap((doc, i) => {
      if (!doc.exists) return [];
      const row = doc.data() || {}, inv = invoices[i];
      if (row.tenantId !== tenantId || row.invoiceId !== inv.invoiceId
        || row.amountCents !== inv.amountCents || !row.approvedAt) {
        throw Error("HYBRID_SETTLEMENT_INVALID");
      }
      return [inv.invoiceId];
    });
    const outstandingIds = unresolvedDueInvoices(invoices, paid, today);
    if (outstandingIds.length > 0) {
      if (tenant.hybridBillingSuspended === true) {
        return { status: "already_suspended", outstandingIds, changed: false };
      }
      if (tenant.active === false) {
        // Do not supersede a Super Admin's separate manual disable.
        return { status: "manual_hold", outstandingIds, changed: false };
      }
      tx.update(tenantRef, {
        active: false, hybridBillingSuspended: true,
        hybridBillingSuspensionSource: "hybrid_v1",
        hybridBillingSuspendedAt: serverTimestamp(),
        hybridBillingSuspendedDueIds: outstandingIds,
        hybridBillingRecoveryRequiresReview: true,
      });
      return { status: "suspended", outstandingIds, changed: true };
    }
    if (tenant.hybridBillingSuspended === true) {
      // No automatic active:true until separate admin-disable interaction and
      // verified settlement/recovery workflow are integrated. Fail closed.
      return { status: "settled_waiting_for_safe_recovery", outstandingIds: [], changed: false };
    }
    return { status: "clear", outstandingIds: [], changed: false };
  });
}
module.exports = { unresolvedDueInvoices, reconcileHybridArrears };
