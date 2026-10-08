// Walk-in orders created and paid by the cashier must still reach Kitchen,
// but must never sound like *incoming unpaid* orders to that same cashier.
export function cashierOrderAlertEligible(order, surface) {
  if (surface !== "cashier") return true;
  return !(
    String(order?.orderType || "").toLowerCase() === "walkin"
    && String(order?.orderSource || "").toLowerCase() === "cashier_walkin"
    && String(order?.paymentStatus || "").toLowerCase() === "paid"
  );
}
