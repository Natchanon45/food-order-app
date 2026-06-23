import { db, doc, getDoc } from "./firebase-config.js";
import { setActiveTenant } from "./tenant-context.js";

function storefrontSlug(pathname = location.pathname) {
  const match = pathname.match(/^\/s\/([^/]+)/i);
  return match ? decodeURIComponent(match[1]).trim().toLowerCase() : "";
}

function asDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value.seconds) return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function tenantCanUseStorefront(tenant) {
  if (tenant.active === false || ["expired", "suspended"].includes(tenant.subscriptionStatus)) return false;
  const expiry = asDate(tenant.subscriptionExpiresAt);
  if (!expiry) return true;
  const graceDays = Number(tenant.gracePeriodDays ?? 3);
  return Date.now() <= expiry.getTime() + graceDays * 86400000;
}

function showUnavailableStorefront(
  reason = "ร้านไม่พร้อมให้บริการ",
  detail = "บัญชีร้านนี้หมดอายุ ถูกระงับ หรือปิดใช้งานชั่วคราว กรุณาติดต่อร้านค้า"
) {
  document.documentElement.innerHTML = `
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
      <title>${reason}</title>
      <style>
        body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:#f3f6f4;color:#151515;font-family:system-ui,-apple-system,sans-serif}
        main{width:min(440px,100%);padding:28px;border:1px solid #dde5df;border-radius:20px;background:#fff;text-align:center;box-shadow:0 16px 44px rgba(16,35,23,.08)}
        h1{margin:0 0 10px;font-size:24px}p{margin:0;color:#6b746f;line-height:1.6}
      </style>
    </head>
    <body><main><h1>${reason}</h1><p>${detail}</p></main></body>`;
}

const slug = storefrontSlug();
const isPublicOrderingRoute =
  location.pathname.startsWith("/delivery") ||
  location.pathname.startsWith("/order") ||
  location.pathname.startsWith("/s/");

if (isPublicOrderingRoute && !slug) {
  showUnavailableStorefront(
    "ลิงก์ร้านค้าไม่สมบูรณ์",
    "กรุณาเปิดร้านผ่านลิงก์หรือ QR ที่มีชื่อร้าน เช่น /s/ชื่อร้าน/delivery"
  );
  throw new Error("TENANT_SLUG_REQUIRED");
}

if (slug) {
  const slugSnapshot = await getDoc(doc(db, "tenantSlugs", slug));
  if (!slugSnapshot.exists()) {
    showUnavailableStorefront("ไม่พบร้านค้า", "ไม่พบชื่อร้านจากลิงก์นี้ กรุณาตรวจสอบลิงก์หรือสแกน QR ใหม่");
    throw new Error(`TENANT_NOT_FOUND:${slug}`);
  }

  const tenant = slugSnapshot.data();
  if (!tenantCanUseStorefront(tenant)) {
    showUnavailableStorefront(tenant.subscriptionStatus === "expired" ? "บัญชีร้านหมดอายุ" : "ร้านไม่พร้อมให้บริการ");
    throw new Error(`TENANT_INACTIVE:${slug}`);
  }

  setActiveTenant({
    id: tenant.tenantId,
    slug: tenant.slug || slug,
    name: tenant.name || slug
  });
}
