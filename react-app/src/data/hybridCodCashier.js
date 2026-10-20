import { hybridDeliveryCashierRoute } from "./hybridCodCashierRoute.mjs";

// Phase 3K SOURCE ONLY. The Callable is intentionally NOT exported from
// functions/index.js, therefore no frontend httpsCallable reference exists.
// When the reviewed backend endpoint is registered at staged cutover, the
// caller must supply its authenticated invocation function explicitly.
// Fail closed rather than calling an unregistered endpoint or writing
// paymentStatus/paidAt directly through the browser.
export async function settleHybridCodCashier(tenant, order, callable = null) {
  const route = hybridDeliveryCashierRoute(tenant, order);
  if (route !== "server") throw new Error("HYBRID_COD_CASHIER_NOT_RELEASED");
  if (!tenant?.id || !order?.id) throw new Error("HYBRID_COD_MISSING_CONTEXT");
  if (typeof callable !== "function") throw new Error("HYBRID_COD_CALLABLE_NOT_REGISTERED");
  const response = await callable({ tenantId: tenant.id, orderId: order.id });
  if (response?.data?.ok !== true) throw new Error("HYBRID_COD_SETTLEMENT_UNCONFIRMED");
  return response.data;
}
