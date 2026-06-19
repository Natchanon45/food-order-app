import { auth, signOut } from "./firebase-config.js";
import { waitForAuth, getUserProfile } from "./auth-service.js";

const user = await waitForAuth();
if (!user) {
  document.querySelector("#staffLoginLink")?.removeAttribute("hidden");
} else {
  const profile = await getUserProfile(user);
  const header = document.querySelector(".app-header");
  const loginLink = document.querySelector("#staffLoginLink");
  if (loginLink) loginLink.hidden = true;

  if (header && profile && !header.querySelector("[data-home-logout]")) {
    const account = document.createElement("div");
    account.className = "auth-user";
    account.innerHTML = `
      <span class="badge dark">${profile.displayName || profile.email} • ${profile.role}</span>
      ${profile.role === "super_admin" ? '<a class="btn btn-primary btn-sm" href="/admin/users">ผู้ใช้งาน</a>' : ""}
      <button type="button" class="btn btn-sm" data-home-logout>ออกจากระบบ</button>
    `;
    header.appendChild(account);

    account.querySelector("[data-home-logout]").addEventListener("click", async () => {
      await signOut(auth);
      location.replace("/login");
    });
  }
}
