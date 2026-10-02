import { doc, getDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { customerDb } from "./public-firebase-context.js?v=20261002-001";
import { setActiveTenant } from "./tenant-context.js?v=20261002-006";

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
  const revenueMode = tenant.revenueShareEnabled === true || tenant.billingMode === "revenue_share";
  if (revenueMode) return tenant.active !== false && tenant.revenueShareSuspended !== true;
  if (tenant.active === false || ["expired", "suspended"].includes(tenant.subscriptionStatus)) return false;
  const expiry = asDate(tenant.subscriptionExpiresAt);
  if (!expiry) return true;
  const graceDays = Number(tenant.gracePeriodDays ?? 3);
  return Date.now() <= expiry.getTime() + graceDays * 86400000;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function showUnavailableStorefront(
  reason = "ร้านไม่พร้อมให้บริการ",
  detail = "บัญชีร้านนี้หมดอายุ ถูกระงับ หรือปิดใช้งานชั่วคราว กรุณาติดต่อร้านค้า",
  storeName = ""
) {
  const safeReason = escapeHtml(reason);
  const safeDetail = escapeHtml(detail);
  const safeStoreName = escapeHtml(storeName);
  document.documentElement.lang = "th";
  document.documentElement.innerHTML = `
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
      <meta name="theme-color" content="#f4f8f5">
      <title>${safeReason}</title>
      <style>
        @font-face{
          font-family:"Kanit Local";
          src:url("/assets/fonts/Kanit-Regular.ttf") format("truetype");
          font-style:normal;
          font-weight:400;
          font-display:swap;
        }
        @font-face{
          font-family:"Kanit Local";
          src:url("/assets/fonts/Kanit-SemiBold.ttf") format("truetype");
          font-style:normal;
          font-weight:600;
          font-display:swap;
        }
        @font-face{
          font-family:"Kanit Local";
          src:url("/assets/fonts/Kanit-SemiBold.ttf") format("truetype");
          font-style:normal;
          font-weight:700;
          font-display:swap;
        }
        @font-face{
          font-family:"Kanit Local";
          src:url("/assets/fonts/Kanit-SemiBold.ttf") format("truetype");
          font-style:normal;
          font-weight:800;
          font-display:swap;
        }
        @font-face{
          font-family:"Kanit Local";
          src:url("/assets/fonts/Kanit-SemiBold.ttf") format("truetype");
          font-style:normal;
          font-weight:900;
          font-display:swap;
        }
        :root{
          color-scheme:light;
          --app-ui-font:"Kanit Local";
          --green:#159447;
          --green-dark:#0d6f34;
          --ink:#17231b;
          --muted:#66736b;
          --line:#dce7df;
          --surface:#ffffff;
          --page:#f4f8f5;
        }
        *{box-sizing:border-box}
        html,body{margin:0;min-height:100%;font-family:var(--app-ui-font);font-synthesis:none}
        body{
          min-height:100vh;
          min-height:100dvh;
          display:grid;
          place-items:center;
          padding:max(24px,env(safe-area-inset-top)) max(20px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(20px,env(safe-area-inset-left));
          background:
            radial-gradient(circle at 18% 12%,rgba(21,148,71,.08),transparent 34%),
            radial-gradient(circle at 86% 86%,rgba(13,111,52,.06),transparent 30%),
            var(--page);
          color:var(--ink);
        }
        button{font:inherit}
        .storefront-state{
          width:min(480px,100%);
          padding:34px 32px 30px;
          border:1px solid var(--line);
          border-radius:24px;
          background:var(--surface);
          text-align:center;
          box-shadow:0 22px 60px rgba(25,56,37,.09);
        }
        .storefront-state__mark{
          display:grid;
          width:64px;
          height:64px;
          margin:0 auto 18px;
          place-items:center;
          border-radius:20px;
          background:#eaf7ee;
          color:var(--green);
        }
        .storefront-state__mark svg{width:31px;height:31px;display:block}
        .storefront-state__eyebrow{
          margin:0 0 6px;
          color:var(--green-dark);
          font-size:13px;
          font-weight:600;
          letter-spacing:.02em;
        }
        .storefront-state__store-name{
          margin:0 0 12px;
          color:var(--ink);
          font-size:17px;
          font-weight:600;
          line-height:1.45;
        }
        h1{
          margin:0;
          color:var(--ink);
          font-size:clamp(24px,5vw,30px);
          font-weight:700;
          line-height:1.3;
          letter-spacing:-.02em;
        }
        .storefront-state__detail{
          max-width:390px;
          margin:12px auto 0;
          color:var(--muted);
          font-size:15px;
          font-weight:400;
          line-height:1.65;
        }
        .storefront-state__note{
          display:flex;
          align-items:flex-start;
          gap:9px;
          margin:22px 0 0;
          padding:12px 14px;
          border-radius:14px;
          background:#f2f7f3;
          color:#536159;
          text-align:left;
          font-size:13px;
          line-height:1.55;
        }
        .storefront-state__note svg{width:17px;height:17px;flex:0 0 auto;margin-top:2px;color:var(--green)}
        .storefront-state__actions{
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
          margin-top:22px;
        }
        .storefront-state__button{
          min-height:46px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:8px;
          border:1px solid #d8e3dc;
          border-radius:13px;
          padding:10px 16px;
          background:#f4f7f5;
          color:#26352b;
          font-weight:600;
          cursor:pointer;
          transition:transform .15s ease,background .15s ease,border-color .15s ease;
        }
        .storefront-state__button svg{width:17px;height:17px;display:block;flex:0 0 auto}
        .storefront-state__button:hover{background:#edf2ef;border-color:#cbd9d0}
        .storefront-state__button:active{transform:translateY(1px)}
        .storefront-state__button--primary{
          border-color:var(--green);
          background:var(--green);
          color:#fff;
        }
        .storefront-state__button--primary:hover{background:var(--green-dark);border-color:var(--green-dark)}
        .storefront-state__button:focus-visible{outline:3px solid rgba(21,148,71,.2);outline-offset:2px}
        @media(max-width:520px){
          body{padding:18px}
          .storefront-state{padding:28px 20px 22px;border-radius:20px}
          .storefront-state__mark{width:58px;height:58px;border-radius:18px}
          .storefront-state__actions{grid-template-columns:1fr}
        }
      </style>
    </head>
    <body>
      <main class="storefront-state" aria-labelledby="storefrontUnavailableTitle">
        <div class="storefront-state__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 10h18"></path>
            <path d="M5 10v9h14v-9"></path>
            <path d="M4 4h16l1 6H3l1-6Z"></path>
            <path d="M9 14h6"></path>
          </svg>
        </div>
        <p class="storefront-state__eyebrow">PENGUIN • หน้าร้านออนไลน์</p>
        ${safeStoreName ? `<p class="storefront-state__store-name">${safeStoreName}</p>` : ""}
        <h1 id="storefrontUnavailableTitle">${safeReason}</h1>
        <p class="storefront-state__detail">${safeDetail}</p>
        <div class="storefront-state__note">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9"></circle>
            <path d="M12 8v5"></path>
            <path d="M12 16.5h.01"></path>
          </svg>
          <span>หากร้านกลับมาเปิดให้บริการแล้ว สามารถโหลดหน้านี้ใหม่เพื่อเข้าใช้งานได้ทันที</span>
        </div>
        <div class="storefront-state__actions">
          <button class="storefront-state__button" id="storefrontUnavailableBack" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6"></path>
            </svg>
            <span>ย้อนกลับ</span>
          </button>
          <button class="storefront-state__button storefront-state__button--primary" id="storefrontUnavailableRetry" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 11a8.1 8.1 0 1 0 2 5.3"></path>
              <path d="M20 4v7h-7"></path>
            </svg>
            <span>โหลดใหม่อีกครั้ง</span>
          </button>
        </div>
      </main>
    </body>`;

  const backButton = document.getElementById("storefrontUnavailableBack");
  if (backButton) {
    backButton.hidden = history.length <= 1;
    backButton.addEventListener("click", () => history.back());
  }
  document.getElementById("storefrontUnavailableRetry")?.addEventListener("click", () => location.reload());
}

async function configuredStoreName(tenant) {
  const tenantId = String(tenant?.id || "").trim();
  if (!tenantId) return String(tenant?.name || "").trim();
  try {
    const storeSnapshot = await getDoc(doc(customerDb, "tenants", tenantId, "settings", "store"));
    const shopName = String(storeSnapshot.data()?.shopName || "").trim();
    if (shopName) return shopName;
  } catch (error) {
    console.warn("PUBLIC_STORE_NAME_SETTINGS_FALLBACK", error?.code || error?.message || error);
  }
  return String(tenant?.name || "").trim();
}

async function getTenantBySlug(slug) {
  const slugSnapshot = await getDoc(doc(customerDb, "tenantSlugs", slug));
  if (slugSnapshot.exists()) {
    const data = slugSnapshot.data();
    return {
      id: data.tenantId,
      slug: data.slug || slug,
      name: data.name || data.shopName || slug,
      raw: data
    };
  }

  const tenantSnapshot = await getDocs(query(collection(customerDb, "tenants"), where("slug", "==", slug)));
  if (tenantSnapshot.empty) return null;
  const item = tenantSnapshot.docs[0];
  const data = item.data();
  return {
    id: item.id,
    slug: data.slug || slug,
    name: data.name || data.shopName || slug,
    raw: data
  };
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
  const tenant = await getTenantBySlug(slug);
  if (!tenant?.id) {
    showUnavailableStorefront("ไม่พบร้านค้า", "ไม่พบชื่อร้านจากลิงก์นี้ กรุณาตรวจสอบลิงก์หรือสแกน QR ใหม่");
    throw new Error(`TENANT_NOT_FOUND:${slug}`);
  }

  if (!tenantCanUseStorefront(tenant.raw || tenant)) {
    const shopName = await configuredStoreName(tenant);
    showUnavailableStorefront(
      tenant.raw?.subscriptionStatus === "expired" ? "บัญชีร้านหมดอายุ" : "ร้านไม่พร้อมให้บริการ",
      "บัญชีร้านนี้หมดอายุ ถูกระงับ หรือปิดใช้งานชั่วคราว กรุณาติดต่อร้านค้า",
      shopName
    );
    throw new Error(`TENANT_INACTIVE:${slug}`);
  }

  setActiveTenant({
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name
  });
}
