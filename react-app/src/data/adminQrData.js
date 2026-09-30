import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/client";

export function subscribeActiveTables(tenantId, callback, onError) {
  const id = String(tenantId || "").trim();
  if (!id) throw new Error("TENANT_REQUIRED");
  return onSnapshot(
    collection(db, "tenants", id, "tables"),
    snapshot => {
      const rows = snapshot.docs
        .map(item => ({ id: item.id, ...item.data() }))
        .filter(item => item.active !== false)
        .sort((a, b) => String(a.code || a.name || "").localeCompare(String(b.code || b.name || ""), "th"));
      callback(rows);
    },
    error => {
      console.error("ADMIN_QR_TABLES_SUBSCRIBE_FAILED", error);
      onError?.(error);
    },
  );
}
