import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/client";

// These estimates are computed exclusively from trusted paid Delivery documents by the backend.
export async function getHybridBillingPreview(month) {
  const response = await httpsCallable(functions, "getTenantHybridBillingPreview")({ month });
  if (response?.data?.ok !== true) throw new Error("HYBRID_PREVIEW_UNAVAILABLE");
  return response.data;
}
