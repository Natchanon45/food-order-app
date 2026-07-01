await import("./public-tenant-resolver.js?v=20260629-025");

import { dataService } from "./data-service.js";

const params = new URLSearchParams(location.search);
const tableCode = (params.get("table") || params.get("code") || "").trim().toUpperCase();
const token = params.get("token") || "";

if (tableCode) {
  try {
    const table = await dataService.getTable(tableCode);
    let activeTable = null;
    if (table?.active !== false && table?.status === "occupied" && table?.orderToken) {
      activeTable = table;
    } else if (token) {
      const tables = await dataService.listTables();
      activeTable = tables.find(item => item?.active !== false && item?.status === "occupied" && item?.orderToken === token) || null;
    }
    const activeCode = activeTable?.code || activeTable?.id || "";
    const activeToken = activeTable?.orderToken || "";
    if (activeCode && activeToken && (activeCode !== tableCode || activeToken !== token)) {
      params.set("table", activeCode);
      params.delete("code");
      params.set("token", activeToken);
      location.replace(`${location.pathname}?${params.toString()}`);
      await new Promise(() => {});
    }
  } catch (error) {
    console.error("Unable to resolve permanent table QR", error);
  }
}
