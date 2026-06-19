import { login, ROLE_HOME, waitForAuth, getUserProfile } from "./auth-service.js";
import "./ui.js";

const existingUser = await waitForAuth();
if (existingUser) {
  const profile = await getUserProfile(existingUser);
  if (profile?.active !== false && profile?.role) {
    location.replace(ROLE_HOME[profile.role] || "/");
  }
}

const form = document.getElementById("loginForm");
const button = document.getElementById("loginButton");
const errorBox = document.getElementById("loginError");

form.addEventListener("submit", async event => {
  event.preventDefault();
  errorBox.hidden = true;
  button.disabled = true;
  button.textContent = "กำลังเข้าสู่ระบบ...";

  try {
    const profile = await login(
      document.getElementById("email").value.trim(),
      document.getElementById("password").value
    );
    const next = new URLSearchParams(location.search).get("next");
    location.replace(next || ROLE_HOME[profile.role] || "/");
  } catch (error) {
    console.error(error);
    errorBox.textContent = "อีเมล รหัสผ่าน หรือสิทธิ์ผู้ใช้งานไม่ถูกต้อง";
    errorBox.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = "เข้าสู่ระบบ";
  }
});
