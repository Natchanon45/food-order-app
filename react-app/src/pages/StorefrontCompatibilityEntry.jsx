import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { PublicRouteMissingPage } from "@/pages/PublicRouteMissingPage";

const ACTIVE_TENANT_KEY = "food_order_active_tenant";

function storedTenantSlug() {
  try {
    const value = JSON.parse(localStorage.getItem(ACTIVE_TENANT_KEY) || "null");
    const slug = String(value?.slug || value?.tenantSlug || "").trim().toLowerCase();
    return /^[a-z0-9][a-z0-9-]{0,127}$/.test(slug) ? slug : "";
  } catch {
    return "";
  }
}

// Do not resolve arbitrary external paths or unvalidated localStorage slugs.
export function StorefrontCompatibilityEntry({ target = "takeaway", allowStoredTenant = false }) {
  const navigate = useNavigate();
  const slug = allowStoredTenant ? storedTenantSlug() : "";
  // PENGUIN canonical route differs from Source Laravel; preserve safe
  // tenant-based path, with allowlisted routes only.
  const destination = slug && ["takeaway","delivery","order"].includes(target)
    ? "/s/" + encodeURIComponent(slug) + "/" + target + location.search + location.hash
    : "";

  useEffect(() => {
    if (destination) navigate(destination, { replace: true });
  }, [destination, navigate]);

  if (destination) return <PageReadyOverlay />;
  return <PublicRouteMissingPage />;
}
