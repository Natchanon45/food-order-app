/* Shared operational/Kitchen/Cashier Walk-in lifecycle.
   Payment receipt is NOT evidence of cooking/serving/closing a table. */
const terminal = new Set(["cancelled", "voided", "deleted", "completed"]);
const cooking = new Set(["pending", "accepted", "cooking", "ready"]);
const text = value => String(value || "").trim().toLowerCase();

export function unfinishedWalkInItems(order = {}) {
  return (Array.isArray(order.items) ? order.items : [])
    .some(item => item && item.cancelled !== true && item.served !== true && item.kitchenPreviouslyServed !== true);
}
export function walkInKitchenPending(order = {}) {
  if (text(order.orderType) !== "walkin" || terminal.has(text(order.status))) return false;
  if (cooking.has(text(order.status))) return true;
  // Compatibility: a legacy payment-first bill can incorrectly carry
  // order.status="paid" while its kitchen items are still unserved.
  if (text(order.status) === "paid" && !order.completedAt && !order.tableClosedAt) {
    return unfinishedWalkInItems(order);
  }
  return false;
}
export function walkInKitchenStatus(order = {}) {
  return text(order.status) === "paid" && walkInKitchenPending(order)
    ? "pending" : text(order.status);
}
export function walkInOwnedTable(order = {}, tables = []) {
  if (text(order.orderType) !== "walkin" || text(order.serviceType) !== "dine_in") return false;
  const id = String(order.id || "");
  return Boolean(id && (Array.isArray(tables) ? tables : []).some(table =>
    String(table.walkInOrderId || "") === id &&
    String(table.status || "").toLowerCase() === "occupied" &&
    !String(table.orderToken || "").trim()));
}
export function walkInCashierPending(order = {}, tables = []) {
  if (text(order.orderType) !== "walkin" || terminal.has(text(order.status))) return false;
  if (walkInKitchenPending(order)) return true;
  if (text(order.paymentStatus) !== "paid") return text(order.status) !== "paid";
  // Payment-first order stays on the cashier only if a real table still
  // belongs to it. A completed settled bill remains in receipt history,
  // never in the active unpaid/open table workflow.
  return walkInOwnedTable(order, tables);
}
