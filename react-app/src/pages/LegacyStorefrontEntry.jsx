import { Navigate } from "react-router-dom";
import { PublicRouteMissingPage } from "@/pages/PublicRouteMissingPage";

const ACTIVE_TENANT_KEY = "food_order_active_tenant";

function storedTenantSlug() {
  try {
    const value = JSON.parse(localStorage.getItem(ACTIVE_TENANT_KEY) || "null");
    return String(value?.slug || value?.tenantSlug || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

export function LegacyStorefrontEntry({ target, allowStoredTenant = false }) {
  const slug = allowStoredTenant ? storedTenantSlug() : "";
  if (slug) {
    return <Navigate to={"/s/" + encodeURIComponent(slug) + "/" + target + location.search + location.hash} replace />;
  }
  return <PublicRouteMissingPage />;
}
