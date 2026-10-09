// Presentation helpers: never mutate payment verification or order fields.
export function deliveryReceiptPaymentLabel(order, t) {
  if (order?.paymentStatus === "paid") return t("delivery.success.payment.paid");
  if (order?.paymentMethod === "cod") return t("delivery.success.payment.cod");
  if (order?.paymentStatus === "pending_verification") {
    return t("delivery.success.payment.pending_verification");
  }
  return t("delivery.success.payment.unpaid");
}

export function deliveryReceiptZoneLabel(order, t) {
  return String(order?.deliveryProvider || "").toLowerCase() === "lalamove"
    ? t("delivery.success.receipt.lalamove_delivery")
    : order?.deliveryZoneLabel || "-";
}

export function deliveryReceiptItemLabel(item) {
  return String(item?.name || "") + " x " + Number(item?.qty || 0);
}
