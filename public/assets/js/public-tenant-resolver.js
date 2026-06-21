import { db, doc, getDoc } from "./firebase-config.js";
import { setActiveTenant } from "./tenant-context.js";

function storefrontSlug(pathname = location.pathname) {
  const match = pathname.match(/^\/s\/([^/]+)/i);
  return match ? decodeURIComponent(match[1]).trim().toLowerCase() : "";
}

function showUnavailableStorefront() {
  document.documentElement.innerHTML = `
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
      <title>ร้านไม่พร้อมให้บริการ</title>
      <style>
        body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:#f3f6f4;color:#151515;font-family:system-ui,-apple-system,sans-serif}
        main{width:min(440px,100%);padding:28px;border:1px solid #dde5df;border-radius:20px;background:#fff;text-align:center;box-shadow:0 16px 44px rgba(16,35,23,.08)}
        h1{margin:0 0 10px;font-size:24px}p{margin:0;color:#6b746f;line-height:1.6}
      </style>
    </head>
    <body><main><h1>ร้านไม่พร้อมให้บริการ</h1><p>บัญชีร้านนี้ถูกระงับหรือปิดใช้งานชั่วคราว กรุณาติดต่อร้านค้า</p></main></body>`;
}

const slug = storefrontSlug();

if (slug) {
  const slugSnapshot = await getDoc(doc(db, "tenantSlugs", slug));
  if (!slugSnapshot.exists() || slugSnapshot.data().active === false) {
    showUnavailableStorefront();
    throw new Error(`TENANT_INACTIVE:${slug}`);
  }

  const tenant = slugSnapshot.data();
  setActiveTenant({
    id: tenant.tenantId,
    slug: tenant.slug || slug,
    name: tenant.name || slug
  });
}
