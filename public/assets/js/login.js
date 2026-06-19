import { login, ROLE_HOME, waitForAuth, getUserProfile } from "./auth-service.js";
import { toast } from "./ui.js";

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

function getLoginErrorMessage(error) {
  const code = String(error?.code || error?.message || "");

  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  }
  if (code.includes("invalid-email")) return "รูปแบบอีเมลไม่ถูกต้อง";
  if (code.includes("too-many-requests")) return "มีการลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่";
  if (code.includes("network-request-failed")) return "ไม่สามารถเชื่อมต่อเครือข่ายได้ กรุณาตรวจสอบอินเทอร์เน็ต";
  if (code.includes("ACCOUNT_NOT_ALLOWED")) return "บัญชีนี้ไม่มีสิทธิ์ใช้งานหรือถูกปิดใช้งาน";

  return "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน";
}

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
    toast(getLoginErrorMessage(error), "error");
  } finally {
    button.disabled = false;
    button.textContent = "เข้าสู่ระบบ";
  }
});
