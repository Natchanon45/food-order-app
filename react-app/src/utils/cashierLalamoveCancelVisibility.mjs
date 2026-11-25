const RETRYABLE_PROVIDER_END_STATES = new Set(["CANCELED", "CANCELLED", "REJECTED", "EXPIRED"]);
const ACTIVE_ATTEMPTS = new Set(["placing", "confirmation_unknown", "placed"]);

// Never present whole-order cancellation while an active/uncertain Lalamove
// booking exists. Staff should cancel the courier explicitly first.
export function hideCashierWholeOrderCancel(order, placingNow = false) {
  // External provider reservation always wins, including during a race
  // where displayed order.deliveryProvider is being changed in another tab.
  if(order?.lalamoveDispatchReservation?.id ||
     order?.lalamoveWalletDebitPending === true) return true;
  if (String(order?.orderType || "").toLowerCase() !== "delivery" ||
      String(order?.deliveryProvider || "").toLowerCase() !== "lalamove") return false;
  if (placingNow) return true;
  const providerStatus = String(order?.lalamoveOrderStatus || "").trim().toUpperCase();
  if (RETRYABLE_PROVIDER_END_STATES.has(providerStatus)) return false;
  const attemptState = String(order?.lalamoveDispatchAttemptState || "").trim().toLowerCase();
  const dispatchState = String(order?.lalamoveDispatchStatus || "").trim().toLowerCase();
  if (ACTIVE_ATTEMPTS.has(attemptState) || ACTIVE_ATTEMPTS.has(dispatchState)) return true;
  return Boolean(String(order?.lalamoveOrderId || "").trim());
}
