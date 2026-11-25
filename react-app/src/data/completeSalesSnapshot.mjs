// SOURCE 7bf9 merchant sales-report complete-history evidence on Firebase.
// Independent pure policy; no Firebase SDK or network and no financial writes.
export const MAX_COMPLETE_SALES_ORDERS = 20000;
export const VALID_TENANT_ID = /^[a-zA-Z0-9_-]{1,128}$/;
export function verifyCompleteTenantSalesSnapshot(snapshot, tenantId) {
  if (!VALID_TENANT_ID.test(String(tenantId || ""))) {
    throw new Error("SALES_REPORT_TENANT_INVALID");
  }
  if (!snapshot || snapshot.metadata?.fromCache !== false ||
      snapshot.metadata?.hasPendingWrites !== false ||
      !Array.isArray(snapshot.docs)) {
    throw new Error("SALES_REPORT_SERVER_CONFIRMATION_REQUIRED");
  }
  // A collection snapshot cannot silently represent >20k financial orders
  // as if all records had been read; an explicit accounting backend is needed.
  if (snapshot.docs.length > MAX_COMPLETE_SALES_ORDERS)
    throw new Error("SALES_REPORT_HISTORY_LIMIT_EXCEEDED");
  const seen = new Set();
  return snapshot.docs.map(item => {
    const id = String(item?.id || "");
    if (!VALID_TENANT_ID.test(id) || seen.has(id) ||
        typeof item?.data !== "function") {
      throw new Error("SALES_REPORT_DUPLICATE_OR_INVALID_ID");
    }
    seen.add(id);
    const data = item.data();
    if (!data || typeof data !== "object" || Array.isArray(data) ||
        (data.tenantId && String(data.tenantId) !== tenantId) ||
        !Array.isArray(data.items || [])) {
      throw new Error("SALES_REPORT_ORDER_INVALID");
    }
    const amount = data.totalAmount;
    // No NaN/Infinity, negative or string-derived financial totals.
    if (typeof amount !== "number" || !Number.isFinite(amount) ||
        amount < 0 || amount > 1000000000) {
      throw new Error("SALES_REPORT_TOTAL_AMOUNT_INVALID");
    }
    return {...data,id};
  });
}
