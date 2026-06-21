import { db, doc, getDoc } from "./firebase-config.js";
import { DEFAULT_TENANT, getStoredTenant, setActiveTenant } from "./tenant-context.js";

function storefrontSlug(pathname = location.pathname) {
  const match = pathname.match(/^\/s\/([^/]+)/i);
  return match ? decodeURIComponent(match[1]).trim().toLowerCase() : "";
}

const slug = storefrontSlug();

if (slug) {
  const stored = getStoredTenant();

  if (stored?.slug !== slug) {
    if (slug === DEFAULT_TENANT.slug) {
      setActiveTenant(DEFAULT_TENANT);
    } else {
      const slugSnapshot = await getDoc(doc(db, "tenantSlugs", slug));

      if (!slugSnapshot.exists() || slugSnapshot.data().active === false) {
        throw new Error(`TENANT_NOT_FOUND:${slug}`);
      }

      const tenant = slugSnapshot.data();
      setActiveTenant({
        id: tenant.tenantId,
        slug: tenant.slug || slug,
        name: tenant.name || slug
      });
    }
  }
}
