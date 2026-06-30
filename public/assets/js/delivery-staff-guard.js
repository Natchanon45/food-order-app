import { auth, onAuthStateChanged } from "./firebase-config.js?v=20260630-073";
import { getStaffSession } from "./customer-profile-service.js";

const googleLoginButton = document.querySelector("#googleLoginButton");
const customerLogoutButton = document.querySelector("#customerLogoutButton");
const customerAccount = document.querySelector("#customerAccount");
const customerAccountName = document.querySelector("#customerAccountName");
const customerModeText = document.querySelector("#customerModeText");

onAuthStateChanged(auth, async user => {
  const staff = await getStaffSession(user).catch(() => null);
  if (!staff) return;

  googleLoginButton.hidden = true;
  googleLoginButton.disabled = true;
  customerLogoutButton.hidden = true;
  customerAccount.hidden = false;
  customerAccountName.textContent = `${staff.displayName || staff.email} • ${staff.role}`;
  customerModeText.textContent = "กำลังใช้งานด้วยบัญชีพนักงาน ระบบจะใช้ที่อยู่แบบ Guest เฉพาะอุปกรณ์นี้ และไม่อนุญาตให้ Login Google ซ้อน";
});
