// A paid takeaway must remain visible in Cashier until physically handed over.
// Payment settlement is canonical and independent from the pickup action.
export function paidTakeawayAwaitingHandover(order) {
  return order?.orderType === "takeaway"
    && order?.paymentStatus === "paid"
    && ["ready", "served"].includes(String(order?.status || "").toLowerCase())
    && order?.pickupStatus !== "picked_up";
}
