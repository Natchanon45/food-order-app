// Phase 3AL after Phase 3K, SOURCE ONLY. Keep false until secure Rules + Auth/AppCheck
// integration and staging approval. Do not use client flags as authorization.
export const HYBRID_COD_CASHIER_CUTOVER_READY = false;

/**
 * Do not allow Hybrid paid Delivery to fall back to browser-side
 * paymentStatus/paidAt updates. Legacy is unchanged; PromptPay stays on its
 * existing independent proof review callable.
 */
export function hybridDeliveryCashierRoute(tenant, order) {
  // Non-Delivery financial paths remain under their existing legacy policy.
  if (order?.orderType !== "delivery") return "legacy";
  // Missing tenant context MUST NOT authorize a browser paidAt write.
  if (!tenant || typeof tenant !== "object" || Array.isArray(tenant))
    return "hybrid_tenant_unknown";
  // Phase3AL: partial migrations and any recorded journal claim are financial
  // trust-boundary signals. Never route them to the legacy browser writer.
  const hybridSignaled = tenant.billingPolicyVersion === "hybrid_v1"
    || tenant.hybridBillingEnabled === true
    || tenant.hybridReceiptJournalCoverageReady === true
    || (tenant.hybridReceiptJournalMode !== undefined
      && tenant.hybridReceiptJournalMode !== null);
  if (!hybridSignaled) return "legacy";
  if (tenant.billingPolicyVersion !== "hybrid_v1"
    || tenant.hybridBillingEnabled !== true)
    return "hybrid_incomplete_migration";
  // Fail closed BEFORE PromptPay/manual review and before any proof lookup.
  if (tenant.active !== true || tenant.hybridBillingSuspended === true)
    return "hybrid_disabled";
  if (order.paymentMethod === "promptpay") return "proof_review";
  if (order.paymentMethod !== "cod") return "unsupported_hybrid_payment";
  return HYBRID_COD_CASHIER_CUTOVER_READY ? "server" : "cutover_not_released";
}
