/* The ledger's payment field is historical: cancelled sale is excluded,
 * but its receipt and source remain visible under the cancelled filter.
 * A partly voided paid bill stays normal, with cancelled lines itemized. */
export const isCancelledSalesOrder = order => String(order?.status || "").toLowerCase()==="cancelled";
export const isReceiptHistoryOrder = order =>
  isCancelledSalesOrder(order) || order?.paymentStatus==="paid" || order?.status==="paid";
export const receiptCancellationSource = rows => {
  const sources = new Set(rows.map(x=>x?.cancellationSource).filter(x=>x==="cashier"||x==="kitchen"));
  return sources.size===1 ? [...sources][0] : sources.size>1 ? "mixed" : "unknown";
};
export const itemCancellationSource = item =>
  ["cashier","kitchen"].includes(item?.cancellationSource) ? item.cancellationSource : "unknown";
// Receipt history needs to show what the bill was worth before the whole
// bill was voided. This is DISPLAY-ONLY and must never feed sales KPIs.
// Partial menu cancellations already lower totalAmount; a last-line void
// can leave totalAmount=0, so fall back to the preserved original paid total.
export const historicalReceiptNet = order => {
  const net = Number(order?.totalAmount);
  if (Number.isFinite(net) && net > 0) return net;
  const originallyPaid = Number(order?.originalPaidTotal);
  if (Number.isFinite(originallyPaid) && originallyPaid > 0) return originallyPaid;
  return Number.isFinite(net) ? net : 0;
};
export const receiptHistoryDisplayNet = orders =>
  (Array.isArray(orders) ? orders : []).reduce((sum, order) => sum + historicalReceiptNet(order), 0);

export const reportedSalesNet = rows =>
  rows.reduce((sum,o) => sum + (isCancelledSalesOrder(o) ? 0 : Number(o?.totalAmount||0)), 0);
