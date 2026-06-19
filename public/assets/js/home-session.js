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
    document.querySelectorAll("[data-dashboard-role]").forEach(card => {
      const roles = card.dataset.dashboardRole.split(",").map(role => role.trim());
      card.hidden = !roles.includes(profile.role);
    });

    mountUserMenu(profile);
    dashboard.hidden = false;
  }
}
