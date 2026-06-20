import { dataService } from "./data-service.js";

const params = new URLSearchParams(location.search);
const tableCode = (params.get("table") || params.get("code") || "").trim().toUpperCase();
const token = params.get("token") || "";

if (tableCode && !token) {
  try {
    const table = await dataService.getTable(tableCode);
    if (table?.active !== false && table?.status === "occupied" && table?.orderToken) {
      params.set("table", tableCode);
      params.delete("code");
      params.set("token", table.orderToken);
      location.replace(`${location.pathname}?${params.toString()}`);
      await new Promise(() => {});
    }
  } catch (error) {
    console.error("Unable to resolve permanent table QR", error);
  }
}