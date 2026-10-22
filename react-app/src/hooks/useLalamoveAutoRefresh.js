import { useEffect, useRef } from "react";
import { refreshLalamoveDispatch } from "@/data/operationalData";
import {
  LALAMOVE_AUTO_POLL_MS,
  LALAMOVE_AUTO_RETRY_MS,
  selectLalamoveAutoRefreshOrders,
} from "@/utils/lalamoveAutoRefreshPolicy";

// Firestore onSnapshot remains authoritative for Cashier, Kitchen and customer.
// The direct provider query is only a bounded fallback for missed webhooks.
export function useLalamoveAutoRefresh(tenantId, orders, enabled) {
  const latestOrders = useRef([]);
  latestOrders.current = orders;

  useEffect(() => {
    if (!tenantId || !enabled) return undefined;
    let alive = true;
    const checked = new Map();
    const inFlight = new Set();

    const tick = () => {
      if (!alive || document.visibilityState === "hidden" || navigator.onLine === false) return;
      const candidates = selectLalamoveAutoRefreshOrders(
        latestOrders.current, checked, inFlight,
      );
      for (const order of candidates) {
        const id = String(order.id);
        checked.set(id, Date.now());
        inFlight.add(id);
        refreshLalamoveDispatch(tenantId, id)
          .catch(error => {
            if (!alive) return;
            // Retry slower on temporary provider/auth/rate-limit failures.
            checked.set(id, Date.now() + LALAMOVE_AUTO_RETRY_MS - LALAMOVE_AUTO_POLL_MS);
            console.warn("LALAMOVE_AUTO_STATUS_REFRESH_FAILED", id, error?.code || error?.message || error);
          })
          .finally(() => inFlight.delete(id));
      }
    };

    const interval = window.setInterval(tick, LALAMOVE_AUTO_POLL_MS);
    const foreground = () => tick();
    document.addEventListener("visibilitychange", foreground);
    window.addEventListener("online", foreground);
    // Orders often arrive after the initial Firestore snapshot; the first
    // interval makes the first fallback attempt within 20 seconds.
    tick();

    return () => {
      alive = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", foreground);
      window.removeEventListener("online", foreground);
      checked.clear();
    };
  }, [tenantId, enabled]);
}
