// Source 7bf9 role navigation policy, adapted to Firebase Auth at Login.
 // This is navigation permission only: page guards / Firestore / Callables
 // remain the authoritative Tenant and staff security boundary.
 // M0 authorization parity: role allowlist copied from the canonical Laravel
// config/migrated-page-access.php and checked against that file by Node CI.
// This is navigation gating only: Laravel middleware remains authoritative.
export const CANONICAL_WEB_ROLES = Object.freeze({
  "/admin": Object.freeze(["owner","admin"]),
  "/admin/qr": Object.freeze(["owner","admin"]),
  "/admin/sales-report": Object.freeze(["owner","admin"]),
  "/admin/tenants": Object.freeze(["super_admin"]),
  "/admin/users": Object.freeze(["owner"]),
  "/admin/store-settings": Object.freeze(["owner","admin"]),
  "/admin/revenue-share": Object.freeze(["owner","admin"]),
  "/cashier": Object.freeze(["owner","admin","manager","cashier"]),
  "/cashier/quick-order": Object.freeze(["owner","admin","manager","cashier"]),
  "/cashier/receipt": Object.freeze(["owner","admin","manager","cashier"]),
  "/cashier/table-qr": Object.freeze(["owner","admin","manager","cashier"]),
  "/cashier/customer-display": Object.freeze(["owner","admin","manager","cashier"]),
  "/kitchen": Object.freeze(["owner","admin","manager","kitchen"]),
  "/platform": Object.freeze(["super_admin"]),
  "/platform/contact": Object.freeze(["super_admin"]),
  "/platform/owners": Object.freeze(["super_admin"]),
  "/platform/pricing": Object.freeze(["super_admin"]),
  "/platform/hybrid-invoices": Object.freeze(["super_admin"]),
  "/reports/revenue-share": Object.freeze(["owner","admin"]),
  "/reports/hybrid-billing": Object.freeze(["owner","admin"]),
  "/super-admin/saas-setup": Object.freeze(["super_admin"]),
  "/pos": Object.freeze(["owner","admin","manager","cashier","stock","staff"]),
  "/pos/backup": Object.freeze(["owner"]),
  "/pos/catalog": Object.freeze(["owner","admin","manager","cashier","stock","staff"]),
  "/pos/categories": Object.freeze(["owner","admin","manager","stock"]),
  "/pos/customer-display": Object.freeze(["owner","admin","manager","cashier"]),
  "/pos/customers": Object.freeze(["owner","admin","manager","cashier"]),
  "/pos/forbidden": Object.freeze(["*"]),
  "/pos/payables": Object.freeze(["owner","admin","manager"]),
  "/pos/products": Object.freeze(["owner","admin","manager","stock"]),
  "/pos/purchases": Object.freeze(["owner","admin","manager","stock"]),
  "/pos/receipt": Object.freeze(["owner","admin","manager","cashier"]),
  "/pos/returns": Object.freeze(["owner","admin","manager","cashier"]),
  "/pos/sales": Object.freeze(["owner","admin","manager","cashier"]),
  "/pos/settings": Object.freeze(["owner","admin","manager"]),
  "/pos/shifts": Object.freeze(["owner","admin","manager","cashier"]),
  "/pos/stock-counts": Object.freeze(["owner","admin","manager","stock"]),
  "/pos/stock-movements": Object.freeze(["owner","admin","manager","stock"]),
  "/pos/suppliers": Object.freeze(["owner","admin","manager","stock"]),
  "/pos/tax-invoice": Object.freeze(["owner","admin","manager","cashier"]),
  "/pos/tax-invoices": Object.freeze(["owner","admin","manager","cashier"]),
  "/pos/users": Object.freeze(["owner"]),
});

// Two staff queue pages are defined in routes/web.php rather than in the
// migrated-page-access.php map; preserve their canonical Laravel middleware.
const CUSTOM_WEB_ROLES = Object.freeze({
  "/cashier/waiting-queue": Object.freeze(["owner","admin","manager","cashier"]),
  "/waiting-queue": Object.freeze(["owner","admin","manager","cashier"]),
});

const protectedRoute = /^(?:\/admin(?:\/|$)|\/platform(?:\/|$)|\/super-admin(?:\/|$)|\/cashier(?:\/|$)|\/kitchen(?:\/|$)|\/waiting-queue(?:\/|$)|\/pos(?:\/|$)|\/reports(?:\/|$))/;

export function mayNavigateToCanonicalPage(role, path, businessUnits) {
  const canonical = String(path || "").replace(/^\/react-port(?=\/)/, "")
    .replace(/^\/react(?=\/)/, "").replace(/\/+$/, "") || "/";
  const normalized = canonical === "/admin/store-settings" ? "/admin"
    : canonical === "/admin/revenue-share" ? "/reports/revenue-share" : canonical;
  const access = CANONICAL_WEB_ROLES[normalized] || CUSTOM_WEB_ROLES[normalized];
  if (!access) return !protectedRoute.test(normalized);
  const customPOS=(normalized==="/pos"||normalized.startsWith("/pos/")) && /^role-[A-Za-z0-9-]{1,27}$/.test(String(role||"")) && normalized!=="/pos/backup" && normalized!=="/pos/users";
  if (!access.includes("*") && !access.includes(String(role || "")) && !customPOS) return false;
  if (normalized.startsWith("/pos") && normalized !== "/pos/forbidden")
    return businessUnits.has("retail_pos");
  if (/^\/(?:admin|cashier|kitchen)(?:\/|$)/.test(normalized) && normalized !== "/admin/tenants")
    return businessUnits.has("order_delivery");
  if (normalized === "/reports/revenue-share" || normalized === "/cashier/waiting-queue" || normalized === "/waiting-queue")
    return businessUnits.has("order_delivery");
  return true;
}
