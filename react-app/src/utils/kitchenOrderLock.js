const LALAMOVE_RETRYABLE_TERMINAL = new Set([
  "CANCELED",
  "CANCELLED",
  "REJECTED",
  "EXPIRED",
]);

export function lalamoveStatus(order) {
  return String(order?.lalamoveOrderStatus || "").trim().toUpperCase();
}

export function hasLalamoveDispatchEvidence(order) {
  return Boolean(
    String(order?.lalamoveOrderId || "").trim()
    || String(order?.lalamoveDispatchPlacedAt || "").trim()
    || lalamoveStatus(order)
    || String(order?.lalamoveShareLink || "").trim()
    || String(order?.lalamoveDriverId || "").trim()
  );
}

export function isLalamoveDelivery(order) {
  if (String(order?.orderType || "").toLowerCase() !== "delivery") return false;
  return String(order?.deliveryProvider || "").toLowerCase() === "lalamove"
    || hasLalamoveDispatchEvidence(order);
}

export function lalamoveDispatchActive(order) {
  if (!isLalamoveDelivery(order) || !hasLalamoveDispatchEvidence(order)) return false;
  return !LALAMOVE_RETRYABLE_TERMINAL.has(lalamoveStatus(order));
}

export function isKitchenLocked(order) {
  const status = String(order?.status || "").toLowerCase();
  return ["served", "paid", "completed", "cancelled"].includes(status)
    || lalamoveDispatchActive(order);
}
