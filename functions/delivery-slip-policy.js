const cents = value => Math.round(Number(value) * 100);
const normalizedItems = rows => JSON.stringify([...rows].map(item => ({
  id: String(item.id || item.menuId || "").trim(),
  qty: Number(item.qty),
  priceCents: Number.isFinite(item.priceCents) ? item.priceCents : cents(item.price),
})).sort((a,b) => a.id.localeCompare(b.id)));

function slipDecision(result = {}) {
  const status = String(result.status || "");
  if (status === "matched" && result.amountMatched === false) return "mismatch";
  if (status === "manual_review" && result.fallbackAllowed !== true) return "invalid";
  if (["duplicate", "mismatch", "invalid", "receiver_mismatch"].includes(status)) return status;
  if (status === "matched") {
    return result.provider === "slip2go" && result.reason === "slip2go_verified"
      && result.amountMatched === true && (result.transRef || result.referenceId)
      ? "matched" : "manual_review";
  }
  return ["manual_review", "config_required", "config_invalid"].includes(status) ? "manual_review" : "manual_review";
}

function proofBoundToOrder(order = {}, proof = {}) {
  if (order.orderType !== "delivery" || order.paymentMethod !== "promptpay"
    || !proof.slipPath || order.paymentSlipPath !== proof.slipPath) return false;
  const paidItems = (Array.isArray(order.items) ? order.items : []).filter(item => item.isGift !== true);
  if (normalizedItems(paidItems) !== proof.itemsSignature) return false;
  return cents(order.subtotalAmount) === proof.foodCents
    && cents(order.deliveryFee) === proof.feeCents
    && cents(order.totalAmount) === proof.amountCents;
}

function proofValidForOrder(order = {}, proof = {}, now = Date.now()) {
  if (order.paymentStatus !== "pending_verification"
    || proof.status !== "matched" || proof.provider !== "slip2go"
    || !proof.transRef || !proofBoundToOrder(order, proof)) return false;
  const checkedAt = proof.checkedAt?.toMillis?.() || Number(proof.checkedAtMillis || 0);
  return Boolean(checkedAt && now >= checkedAt && now - checkedAt <= 15 * 60 * 1000);
}

function kitchenAdmitted(order = {}) {
  return order.orderType === "delivery"
    && (order.paymentMethod === "cod" || order.paymentStatus === "paid")
    && !["cancelled", "canceled"].includes(String(order.status || "").toLowerCase());
}
module.exports = { cents, normalizedItems, slipDecision, proofBoundToOrder, proofValidForOrder, kitchenAdmitted };
