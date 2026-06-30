import { waitForAuth, getUserProfile, mountUserMenu, STAFF_ROLES } from "./auth-service.js?v=20260630-076";

const dashboard = document.querySelector("#staffDashboard");
const publicLanding = document.querySelector("#publicLanding");
const user = await waitForAuth();

if (user) {
  const profile = await getUserProfile(user);

  if (profile?.active !== false && profile?.role === "super_admin") {
    location.replace("/platform");
  } else if (profile?.active !== false && STAFF_ROLES.includes(profile?.role)) {
    document.body.classList.add("staff-home");
    document.body.dataset.roles = profile.role;
    const brandLabel = document.querySelector(".brand-label");
    if (brandLabel) brandLabel.textContent = "Food Order/Delivery With QR";
    const mobileMenu = document.querySelector("[data-mobile-menu-trigger]");
    if (mobileMenu) mobileMenu.hidden = false;
    const ownerRoleAliases = new Set(["owner", "admin", "cashier", "kitchen"]);

    document.querySelectorAll("[data-dashboard-role]").forEach(card => {
      const roles = card.dataset.dashboardRole.split(",").map(role => role.trim());
      const ownerCanView = profile.role === "owner" && roles.some(role => ownerRoleAliases.has(role));
      card.hidden = !(ownerCanView || roles.includes(profile.role));
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
