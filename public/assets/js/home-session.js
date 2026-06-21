import { waitForAuth, getUserProfile, mountUserMenu, STAFF_ROLES } from "./auth-service.js";

const dashboard = document.querySelector("#staffDashboard");
const user = await waitForAuth();

if (!user) {
  location.replace("/delivery");
} else {
  const profile = await getUserProfile(user);

  if (!profile || profile.active === false || !STAFF_ROLES.includes(profile.role)) {
    location.replace("/delivery");
  } else {
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

      const navCards = dashboard.querySelector(".nav-cards");
      if (navCards && !navCards.querySelector('[data-owner-table-qr]')) {
        const tableQrCard = document.createElement("a");
        tableQrCard.className = "card nav-card";
        tableQrCard.href = "/cashier/table-qr";
        tableQrCard.dataset.ownerTableQr = "true";
        tableQrCard.innerHTML = '<svg class="app-icon" aria-hidden="true"><use href="/assets/images/app-icons.svg#icon-table"></use></svg><span>ออกโต๊ะและ QR</span>';
        navCards.appendChild(tableQrCard);
      }
    }

    mountUserMenu(profile);
    dashboard.hidden = false;
  }
}
