// Read-only, cashier-facing explanation of why automated verification did not
// release a paid-on-proof Delivery order. Never present review as bank approval.
export function cashierSlipReviewSummary(order = {}, t = key => key) {
  if (order.orderType !== "delivery" || order.paymentMethod !== "promptpay"
    || order.paymentStatus === "paid" || order.paymentReviewRequired !== true) return null;
  const reason = String(order.paymentReviewPrimaryReason || order.paymentReviewReason || "").trim();
  const code = String(order.paymentReviewProviderCode || "").trim();
  const messages = {
    delivery_fee_requires_cashier_review: "slip_manual_fee",
    delivery_fee_mismatch: "slip_manual_fee",
    slip2go_config_required: "slip_manual_config",
    slip2go_config_invalid: "slip_manual_config",
    slip2go_package_expired: "slip_manual_package_expired",
    merchant_promptpay_receiver_not_supported: "slip_manual_receiver",
    slip2go_receiver_mismatch: "slip_manual_receiver",
    slip2go_date_mismatch: "slip_manual_old",
    slip2go_quota_exhausted: "slip_manual_quota",
    slip2go_rate_limited: "slip_manual_quota",
    slip2go_request_rate_limit: "slip_manual_quota",
    slip2go_fallback_vision: "slip_manual_fallback",
    slip2go_unavailable: "slip_manual",
    slip2go_error: "slip_manual",
    slip2go_verified_payload_incomplete: "slip_manual",
    slip2go_found_unverified: "slip_manual_unverified",
    slip2go_condition_request_invalid: "slip_manual_condition_request",
    slip2go_bank_error: "slip_manual",
    verification_expired: "slip_manual",
  };
  const key = "delivery.checkout.payment." + (messages[reason] || "slip_manual");
  return {
    text: t(key),
    reason: reason || "manual_review",
    code: /^\d{6}$/.test(code) ? code : "",
  };
}
