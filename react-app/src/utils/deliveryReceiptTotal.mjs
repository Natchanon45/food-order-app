// One authoritative display convention for Customer, Cashier, Kitchen and print.
// This is only a presentation subtotal. Never alter verified order totals.
const toCents = value => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
};
export function deliveryReceiptTotals(order, displayedFoodSubtotal) {
  const fee = toCents(order?.deliveryFee) ?? 0;
  const discount = toCents(order?.deliveryPromotionDiscount) ?? 0;
  const net = toCents(order?.totalAmount) ?? 0;
  const supplied = displayedFoodSubtotal ?? order?.subtotalAmount;
  const food = (supplied !== null && supplied !== undefined && toCents(supplied) !== null)
    ? toCents(supplied)
    : Math.max(0, net - fee + discount);
  return { food: food / 100, deliveryFee: fee / 100, beforeDiscount: (food + fee) / 100, discount: discount / 100 };
}
