import { waitForAuth, getUserProfile, mountUserMenu, STAFF_ROLES } from "./auth-service.js?v=20260704-002";

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
  if (registerNote) registerNote.textContent = "สมัคร Premium Trial ฟรี 1 เดือน หลังยืนยันอีเมลแล้วเริ่มเปิดร้านได้ทันที";
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

    document.querySelectorAll("[data-dashboard-role]").forEach(card => {
      const roles = card.dataset.dashboardRole.split(",").map(role => role.trim());
      const ownerCanView = profile.role === "owner" && roles.some(role => ownerRoleAliases.has(role));
      const roleAllowed = ownerCanView || roles.includes(profile.role);
      const moduleAllowed = profileSupportsModule(profile, card.dataset.dashboardModule);
      card.hidden = !(roleAllowed && moduleAllowed);
    });

    const heroTitle = dashboard.querySelector(".hero h1");
    const heroSubtitle = dashboard.querySelector(".hero p");

    if (profile.role === "owner") {
      if (heroTitle) heroTitle.textContent = "ระบบจัดการร้าน";
      if (heroSubtitle) heroSubtitle.textContent = profile.tenantName || "ร้านของคุณ";
    }

    mountUserMenu(profile);
    publicLanding.hidden = true;
    dashboard.hidden = false;
  }
}