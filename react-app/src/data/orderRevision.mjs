// Signed Go order-payload history for display ONLY. Never infer a refund.
const finite = value => value !== null && value !== undefined && value !== ""
  && Number.isFinite(Number(value)) ? Number(value) : null;
const changed = (a, b) => Math.abs(a - b) > 0.009;
export function originalItemRevision(item = {}) {
  if (item.cancelled === true) return null; // Existing cancellation layout wins.
  const originalQty = finite(item.originalQty);
  const originalUnitPrice = finite(item.originalPrice);
  const originalTotal = finite(item.originalLineTotal);
  const qty = finite(item.qty);
  const price = finite(item.price);
  if (qty === null || price === null || originalQty === null) return null;
  const oldPrice = originalUnitPrice ?? price;
  const oldAmount = originalTotal ?? originalQty * oldPrice;
  const newAmount = qty * price;
  const oldName = String(item.originalName || item.replacedFromName || item.name || "");
  const newName = String(item.name || "");
  if (!changed(oldAmount, newAmount) && originalQty === qty && oldName === newName) return null;
  return { qty: originalQty, price: oldPrice, amount: oldAmount, name: oldName,
    currentAmount: newAmount };
}
export function originalNetRevision(order = {}) {
  if (order.status === "cancelled") return null; // Actor watermark is the display.
  const oldNet = finite(order.originalTotalAmount ?? order.originalPaidTotal ?? order.originalUnpaidTotal);
  const net = finite(order.totalAmount);
  return oldNet !== null && net !== null && changed(oldNet, net) ? oldNet : null;
}
export function originalCombinedNetRevision(orders = []) {
  if (!orders.length || orders.some(o => o.status === "cancelled")) return null;
  let changedAny = false;
  let sum = 0;
  for (const order of orders) {
    const net = finite(order.totalAmount);
    if (net === null) return null;
    const original = originalNetRevision(order);
    if (original !== null) changedAny = true;
    sum += original ?? net;
  }
  return changedAny ? sum : null;
}
