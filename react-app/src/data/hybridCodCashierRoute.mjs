// Phase 3K, SOURCE ONLY. Keep false until secure Rules + Auth/AppCheck
// integration and staging approval. Do not use client flags as authorization.
export const HYBRID_COD_CASHIER_CUTOVER_READY = false;

/**
 * Do not allow Hybrid paid Delivery to fall back to browser-side
 * paymentStatus/paidAt updates. Legacy is unchanged; PromptPay stays on its
 * existing independent proof review callable.
 */
export function hybridDeliveryCashierRoute(tenant, order) {
  if (tenant?.billingPolicyVersion !== "hybrid_v1"
    || order?.orderType !== "delivery") return "legacy";
  if (order.paymentMethod === "promptpay") return "proof_review";
  if (order.paymentMethod !== "cod") return "unsupported_hybrid_payment";
  if (tenant.hybridBillingEnabled !== true || tenant.active !== true
    || tenant.hybridBillingSuspended === true) return "hybrid_disabled";
  return HYBRID_COD_CASHIER_CUTOVER_READY ? "server" : "cutover_not_released";
}
