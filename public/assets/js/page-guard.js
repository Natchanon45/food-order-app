import { requireRole } from "./auth-service.js?v=20260701-015";
import { db, doc, getDoc } from "./firebase-config.js?v=20260630-073";

const roles = (document.body.dataset.roles || "")
  .split(",")
  .map(role => role.trim())
  .filter(Boolean);

const profile = await requireRole(roles);

function asDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value.seconds) return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function canUseTenant(tenant) {
  if (tenant.active === false || ["expired", "suspended"].includes(tenant.subscriptionStatus)) return false;
  const expiry = asDate(tenant.subscriptionExpiresAt);
  if (!expiry) return true;
  const graceDays = Number(tenant.gracePeriodDays ?? 3);
  return Date.now() <= expiry.getTime() + graceDays * 86400000;
}

if (profile?.role !== "super_admin" && profile?.tenantId) {
  const tenantSnapshot = await getDoc(doc(db, "tenants", profile.tenantId));
  const tenant = tenantSnapshot.exists() ? tenantSnapshot.data() : null;
  if (!tenant || !canUseTenant(tenant)) {
    document.documentElement.innerHTML = `
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
        <title>บัญชีร้านหมดอายุ</title>
        <style>
          body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:#f3f6f4;font-family:system-ui,-apple-system,sans-serif;color:#151515}
          main{width:min(460px,100%);padding:30px;border:1px solid #dde5df;border-radius:20px;background:#fff;text-align:center;box-shadow:0 16px 44px rgba(16,35,23,.08)}
          h1{margin:0 0 10px;font-size:25px}p{margin:0;color:#6b746f;line-height:1.7}a{display:inline-block;margin-top:18px;padding:10px 16px;border-radius:10px;background:#151515;color:#fff;text-decoration:none;font-weight:700}
        </style>
      </head>
      <body><main><h1>บัญชีร้านถูกระงับหรือหมดอายุ</h1><p>กรุณาติดต่อเจ้าของระบบเพื่อต่ออายุหรือเปิดใช้งานร้านอีกครั้ง</p></main></body>`;
  }
}
