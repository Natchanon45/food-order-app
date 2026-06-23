#!/usr/bin/env python3
from pathlib import Path

ROOT = Path.cwd()

def replace(path, old, new):
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'ไม่พบข้อความเดิมใน {path}')
    p.write_text(text.replace(old, new), encoding='utf-8')
    print(f'updated: {path}')

path = 'public/assets/js/tenant-context.js'
p = ROOT / path
text = p.read_text(encoding='utf-8')
text = text.replace('''function normalizeTenant(value = {}) {
  return {
    id: String(value.id || value.tenantId || DEFAULT_TENANT.id).trim(),
    slug: String(value.slug || value.tenantSlug || DEFAULT_TENANT.slug).trim().toLowerCase(),
    name: String(value.name || value.tenantName || DEFAULT_TENANT.name).trim()
  };
}''','''function normalizeTenant(value = {}) {
  const tenant = {
    id: String(value.id || value.tenantId || "").trim(),
    slug: String(value.slug || value.tenantSlug || "").trim().toLowerCase(),
    name: String(value.name || value.tenantName || value.slug || value.tenantSlug || "").trim()
  };

  if (!tenant.id) throw new Error("TENANT_ID_REQUIRED");
  if (!tenant.slug) throw new Error("TENANT_SLUG_REQUIRED");
  return tenant;
}''')
text = text.replace('''    if (saved) return normalizeTenant(JSON.parse(saved));

    const legacy = localStorage.getItem(LEGACY_ACTIVE_SHOP_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (parsed?.slug === DEFAULT_TENANT.slug || parsed?.id === "default-shop") {
        localStorage.removeItem(LEGACY_ACTIVE_SHOP_KEY);
        localStorage.setItem(ACTIVE_TENANT_KEY, JSON.stringify(DEFAULT_TENANT));
        return DEFAULT_TENANT;
      }
    }
    return null;''','''    return saved ? normalizeTenant(JSON.parse(saved)) : null;''')
text = text.replace('''  } catch (error) {
    console.warn("Unable to read active tenant", error);
    return null;
  }''','''  } catch (error) {
    console.warn("Unable to read active tenant", error);
    clearActiveTenant();
    return null;
  }''')
text = text.replace('''  // Staff routes such as /admin, /cashier and /kitchen do not contain a
  // tenant slug. They must therefore use the tenant selected from the
  // authenticated user's profile instead of falling back to the default shop.
  if (!pathSlug) return stored || DEFAULT_TENANT;

  if (pathSlug === DEFAULT_TENANT.slug) {
    return stored?.slug === DEFAULT_TENANT.slug ? stored : DEFAULT_TENANT;
  }

  if (stored?.slug === pathSlug) return stored;
  throw new Error(`TENANT_NOT_RESOLVED:${pathSlug}`);''','''  if (pathSlug) {
    if (stored?.slug === pathSlug) return stored;
    throw new Error(`TENANT_NOT_RESOLVED:${pathSlug}`);
  }

  if (stored?.id && stored?.slug) return stored;
  throw new Error("TENANT_CONTEXT_REQUIRED");''')
p.write_text(text, encoding='utf-8')
print(f'updated: {path}')

path = 'public/assets/js/auth-service.js'
replace(path,'import { DEFAULT_TENANT, resolveTenantContext, setActiveTenant } from "./tenant-context.js";','import { clearActiveTenant, setActiveTenant } from "./tenant-context.js";')
replace(path,'''function activateProfileTenant(profile = {}) {
  if (profile.role === "super_admin") return null;
  const fallback = resolveTenantContext();
  return setActiveTenant({
    id: profile.tenantId || fallback.id || DEFAULT_TENANT.id,
    slug: profile.tenantSlug || fallback.slug || DEFAULT_TENANT.slug,
    name: profile.tenantName || fallback.name || DEFAULT_TENANT.name
  });
}''','''async function activateProfileTenant(profile = {}) {
  if (profile.role === "super_admin") return true;
  if (!profile.tenantId) {
    clearActiveTenant();
    return false;
  }

  const tenantSnapshot = await getDoc(doc(db, "tenants", profile.tenantId));
  if (!tenantSnapshot.exists()) {
    clearActiveTenant();
    return false;
  }

  const tenant = tenantSnapshot.data();
  const slug = String(profile.tenantSlug || tenant.slug || "").trim().toLowerCase();
  if (!slug) {
    clearActiveTenant();
    return false;
  }

  setActiveTenant({
    id: profile.tenantId,
    slug,
    name: profile.tenantName || tenant.name || slug
  });
  return true;
}''')
replace(path,'''  const profile = { uid: user.uid, email: user.email, ...snapshot.data() };
  activateProfileTenant(profile);
  return profile;''','''  const profile = { uid: user.uid, email: user.email, ...snapshot.data() };
  profile.tenantReady = await activateProfileTenant(profile);
  return profile;''')
replace(path,'''  if (!profile || profile.active === false || !permitted) {
    location.replace(ROLE_HOME[profile?.role] || "/delivery");
    return new Promise(() => {});
  }''','''  if (!profile || profile.active === false || !permitted || profile.tenantReady === false) {
    location.replace(profile?.tenantReady === false ? "/login/?error=tenant" : (ROLE_HOME[profile?.role] || "/login"));
    return new Promise(() => {});
  }''')
replace(path,'''  if (!profile || profile.active === false) {
    await signOut(auth);
    throw new Error("ACCOUNT_NOT_ALLOWED");
  }''','''  if (!profile || profile.active === false || profile.tenantReady === false) {
    await signOut(auth);
    clearActiveTenant();
    throw new Error(profile?.tenantReady === false ? "TENANT_NOT_ASSIGNED" : "ACCOUNT_NOT_ALLOWED");
  }''')

path = 'public/assets/js/public-tenant-resolver.js'
replace(path,'''const slug = storefrontSlug();

if (slug) {''','''const slug = storefrontSlug();
const isPublicOrderingRoute =
  location.pathname.startsWith("/delivery") ||
  location.pathname.startsWith("/order") ||
  location.pathname.startsWith("/s/");

if (isPublicOrderingRoute && !slug) {
  showUnavailableStorefront("ลิงก์ร้านค้าไม่สมบูรณ์");
  throw new Error("TENANT_SLUG_REQUIRED");
}

if (slug) {''')

print('\nPhase 1 applied successfully.')
