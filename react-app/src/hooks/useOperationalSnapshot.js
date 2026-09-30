import { useCallback, useEffect, useRef, useState } from "react";
import { loadOperationalSnapshot, watchOperationalOrders, watchOperationalTables, watchQuickOrderHeldBills } from "@/data/operationalData";

export function useOperationalSnapshot(tenantId, { realtime = true } = {}) {
  const [state, setState] = useState({ status: tenantId ? "loading" : "idle", data: null, error: null });
  const runId = useRef(0);

  const reload = useCallback(async () => {
    if (!tenantId) {
      setState({ status: "idle", data: null, error: null });
      return null;
    }
    const current = ++runId.current;
    setState(currentState => ({ ...currentState, status: "loading", error: null }));
    try {
      const data = await loadOperationalSnapshot(tenantId);
      if (runId.current === current) setState({ status: "ready", data, error: null });
      return data;
    } catch (error) {
      if (runId.current === current) setState({ status: "error", data: null, error });
      throw error;
    }
  }, [tenantId]);

  useEffect(() => {
    reload().catch(() => {});
    return () => { runId.current += 1; };
  }, [reload]);

  useEffect(() => {
    if (!tenantId || !realtime || state.status !== "ready") return undefined;
    const update = key => rows => setState(current => current.status === "ready"
      ? { ...current, data: { ...current.data, [key]: rows } }
      : current);
    const stops = [
      watchOperationalOrders(tenantId, update("orders")),
      watchOperationalTables(tenantId, update("tables")),
      watchQuickOrderHeldBills(tenantId, update("heldBills")),
    ];
    return () => stops.forEach(stop => stop?.());
  }, [tenantId, realtime, state.status]);

  return { ...state, reload };
}
