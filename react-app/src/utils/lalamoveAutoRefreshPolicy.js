// Follow Lalamove webhook with bounded provider checks while store staff are online.
// This is not a driver-GPS poller and does not touch financial settlement status.
export const LALAMOVE_AUTO_POLL_MS = 20000;
export const LALAMOVE_AUTO_RETRY_MS = 60000;
export const LALAMOVE_AUTO_MAX_PER_TICK = 2;
export const LALAMOVE_AUTO_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const TERMINAL = new Set(["COMPLETED", "CANCELED", "CANCELLED", "REJECTED", "EXPIRED"]);

function timestamp(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (Number.isFinite(value?.seconds)) return Number(value.seconds) * 1000;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function selectLalamoveAutoRefreshOrders(orders, checked, busy, now = Date.now()) {
  return (Array.isArray(orders) ? orders : [])
    .filter(order => {
      if (order?.orderType !== "delivery"
        || String(order?.deliveryProvider || "").toLowerCase() !== "lalamove"
        || !String(order?.lalamoveOrderId || "").trim()) return false;
      if (TERMINAL.has(String(order.lalamoveOrderStatus || "").toUpperCase())) return false;
      if (["cancelled", "completed"].includes(String(order.status || "").toLowerCase())) return false;
      const created = timestamp(order.lalamoveDispatchPlacedAt || order.createdAt);
      if (created && now - created > LALAMOVE_AUTO_MAX_AGE_MS) return false;
      const id = String(order.id || "");
      if (!id || busy.has(id)) return false;
      const lastCheck = checked.get(id) || 0;
      const lastServer = timestamp(order.lalamoveOrderLastSyncedAt);
      return now - Math.max(lastCheck, lastServer) >= LALAMOVE_AUTO_POLL_MS;
    })
    .sort((a, b) => (checked.get(String(a.id)) || 0) - (checked.get(String(b.id)) || 0))
    .slice(0, LALAMOVE_AUTO_MAX_PER_TICK);
}
