// Scope the canonical Firestore server timestamp to NEW Hybrid Delivery
// cashier confirmations. All legacy, takeaway, table and POS flows retain
// their old payment timestamps and state machine.
export function cashierPaidAt(order, tenant, legacyNowIso, timestampFactory) {
  if (order?.orderType !== "delivery" || tenant?.billingPolicyVersion !== "hybrid_v1") {
    return legacyNowIso;
  }
  // Firestore assigns clock time on the server; never trust browser Date.now()
  // for the Hybrid Delivery billing-cycle boundary.
  if (typeof timestampFactory !== "function") {
    throw new TypeError("HYBRID_SERVER_TIMESTAMP_REQUIRED");
  }
  return timestampFactory();
}
