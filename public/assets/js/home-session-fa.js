import { waitForAuth, getUserProfile, mountUserMenu, STAFF_ROLES } from "./auth-service.js?v=20260802-104";
import { dataService } from "./data-service.js?v=20260704-001";
import { functions, httpsCallable } from "./firebase-config.js?v=20260630-073";
import translations from "./home-translations.js?v=20260903-218";
import { configureI18n, applyTranslations, t } from "./i18n.js?v=20260903-202";

configureI18n(translations);
applyTranslations();
document.title = t("home.meta.title");

const getTenantRevenueShareAccess = httpsCallable(functions, "getTenantRevenueShareAccess");

const dashboard = document.querySelector("#staffDashboard");
const publicLanding = document.querySelector("#publicLanding");
const user = await waitForAuth();

function enablePublicRegisterCta() {
  const registerLink = document.querySelector(".public-cta-row .btn-primary");
  if (registerLink) {
    registerLink.href = "/register/";
    registerLink.removeAttribute("aria-disabled");
  }
  const registerNote = document.querySelector(".public-register-note");
  if (registerNote) registerNote.textContent = t("home.public.pricing.register_note");
}

function routePublicLoginLinks() {
  document.querySelectorAll('a[href="/login"],a[href="/login/"]').forEach(link => {
    const text = link.textContent || "";
    if (text.includes("POS")) link.href = "/login/?next=%2Fpos%2F";
    else link.href = "/login/";
  });
}

function fixQuickLinkIconAlignment() {
  if (document.getElementById("quick-link-icon-align-fix")) return;
  const style = document.createElement("style");
  style.id = "quick-link-icon-align-fix";
  style.textContent = `
    #publicLanding .quick-link{align-items:center!important;}
    #publicLanding .quick-link-icon{width:42px!important;height:42px!important;min-width:42px!important;min-height:42px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;align-self:center!important;flex:0 0 42px!important;padding:0!important;line-height:1!important;}
    #publicLanding .quick-link-icon .app-icon,#publicLanding .quick-link-icon i.app-icon,#publicLanding .quick-link-icon .bi{width:20px!important;height:20px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;margin:0!important;padding:0!important;font-size:20px!important;line-height:1!important;vertical-align:middle!important;flex:0 0 20px!important;}
    #publicLanding .quick-link-icon .bi::before,#publicLanding .quick-link-icon i.app-icon::before{display:block!important;line-height:1!important;margin:0!important;}
  `;
  document.head.appendChild(style);
}

async function resolveDisplayShopName(profile) {
  try {
    const settings = await dataService.getStoreSettings();
    const name = String(settings?.shopName || "").trim();
    if (name) return name;
  } catch (error) {
    console.warn("STAFF_HOME_STORE_NAME_FALLBACK", error);
  }
  return profile.tenantName || t("home.staff.owner.store_fallback");
}

async function resolveRevenueShareAccess(profile) {
  if (!["owner", "admin"].includes(profile?.role)) return false;
  try {
    const result = await getTenantRevenueShareAccess({});
    return result.data?.enabled === true;
  } catch (error) {
    console.warn("REVENUE_SHARE_ACCESS_UNAVAILABLE", error);
    return false;
  }
}

function lower(value) { return String(value || "").trim().toLowerCase(); }
function profileSupportsModule(profile, moduleName) {
  if (!moduleName) return true;
  if (profile?.role === "super_admin") return true;

  const moduleList = [
    profile?.module,
    profile?.tenantType,
    profile?.businessType,
    profile?.businessUnit,
    profile?.business_unit,
    ...(Array.isArray(profile?.modules) ? profile.modules : []),
    ...(Array.isArray(profile?.businessUnits) ? profile.businessUnits : []),
    ...(Array.isArray(profile?.allowedModules) ? profile.allowedModules : [])
  ].filter(Boolean).map(lower);

  if (moduleName === "retail-pos") {
    if (profile?.role === "owner") return !moduleList.length || moduleList.includes("retail_pos") || moduleList.includes("retail") || moduleList.includes("all");
    return moduleList.includes("retail_pos") || moduleList.includes("retail") || moduleList.includes("all");
  }

  if (!moduleList.length) return true;
  return moduleList.includes(moduleName) || moduleList.includes("all");
}

enablePublicRegisterCta();
routePublicLoginLinks();
fixQuickLinkIconAlignment();

if (user) {
  const profile = await getUserProfile(user);

  if (profile?.active !== false && profile?.role === "super_admin") {
    location.replace("/platform");
  } else if (profile?.active !== false && STAFF_ROLES.includes(profile?.role)) {
    document.body.classList.add("staff-home");
    document.body.dataset.roles = profile.role;
    const brandLabel = document.querySelector(".brand-label");
    if (brandLabel) brandLabel.textContent = "Food Order/Delivery With QR";
    const ownerRoleAliases = new Set(["owner", "admin", "cashier", "kitchen", "manager"]);
    const revenueShareEnabled = await resolveRevenueShareAccess(profile);

    document.querySelectorAll("[data-dashboard-role]").forEach(card => {
      const roles = card.dataset.dashboardRole.split(",").map(role => role.trim());
      const ownerCanView = profile.role === "owner" && roles.some(role => ownerRoleAliases.has(role));
      const roleAllowed = ownerCanView || roles.includes(profile.role);
      const moduleAllowed = profileSupportsModule(profile, card.dataset.dashboardModule);
      const revenueShareAllowed = !card.hasAttribute("data-revenue-share-card") || revenueShareEnabled;
      card.hidden = !(roleAllowed && moduleAllowed && revenueShareAllowed);
    });

    const revenueShareSection = document.querySelector("[data-revenue-share-section]");
    if (revenueShareSection) revenueShareSection.hidden = !revenueShareEnabled;

    const heroTitle = dashboard.querySelector(".hero h1");
    const heroSubtitle = dashboard.querySelector(".hero p");

    if (profile.role === "owner") {
      if (heroTitle) heroTitle.textContent = t("home.staff.owner.title");
      if (heroSubtitle) heroSubtitle.textContent = await resolveDisplayShopName(profile);
    }

    mountUserMenu(profile);
    publicLanding.hidden = true;
    dashboard.hidden = false;
  }
}
