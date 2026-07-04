import { login, ROLE_HOME, waitForAuth, getUserProfile } from "./auth-service.js";
import { toast } from "./ui.js?v=20260701-001";

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
const passwordInput = document.getElementById("password");
const togglePasswordBtn = document.getElementById("togglePasswordBtn");
const defaultButtonHtml = button.innerHTML;

function syncFloatingIcon(input) {
  const wrap = input.closest(".login-input-wrap");
  if (!wrap) return;
  wrap.classList.toggle("is-filled", Boolean(input.value));
}

document.querySelectorAll(".login-input-wrap input").forEach(input => {
  syncFloatingIcon(input);
  input.addEventListener("input", () => syncFloatingIcon(input));
  input.addEventListener("change", () => syncFloatingIcon(input));
});

function setButtonLoading(isLoading) {
  button.disabled = isLoading;
  button.innerHTML = isLoading ? '<span class="login-loading">กำลังเข้าสู่ระบบ...</span>' : defaultButtonHtml;
}

function showLoginError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  toast(message, "error");
}

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

togglePasswordBtn?.addEventListener("click", () => {
  const show = passwordInput.type === "password";
  passwordInput.type = show ? "text" : "password";
  togglePasswordBtn.textContent = show ? "ซ่อน" : "แสดง";
  syncFloatingIcon(passwordInput);
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  errorBox.hidden = true;
  setButtonLoading(true);

  try {
    const profile = await login(
      document.getElementById("email").value.trim(),
      passwordInput.value
    );
    const next = new URLSearchParams(location.search).get("next");
    location.replace(next || ROLE_HOME[profile.role] || "/");
  } catch (error) {
    console.error(error);
    showLoginError(getLoginErrorMessage(error));
  } finally {
    setButtonLoading(false);
  }
});
