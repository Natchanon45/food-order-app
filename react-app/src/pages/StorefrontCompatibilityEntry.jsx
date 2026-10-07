import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
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

export function StorefrontCompatibilityEntry({ target, allowStoredTenant = false }) {
  const navigate = useNavigate();
  const slug = allowStoredTenant ? storedTenantSlug() : "";
  const destination = slug
    ? "/s/" + encodeURIComponent(slug) + "/" + target + location.search + location.hash
    : "";

  useEffect(() => {
    if (destination) navigate(destination, { replace: true });
  }, [destination, navigate]);

  if (destination) return <PageReadyOverlay />;
  return <PublicRouteMissingPage />;
}
