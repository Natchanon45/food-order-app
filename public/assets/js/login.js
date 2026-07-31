import { login, ROLE_HOME } from "./auth-service.js?v=20260731-079";
import { login as retailPosLogin } from "./retail-pos-auth.js?v=20260704-004";
import { toast } from "./ui.js?v=20260716-011";

localStorage.removeItem("retail_pos_session_v1");
localStorage.removeItem("retail_pos_current_user_v1");

const form = document.getElementById("loginForm");
const button = document.getElementById("loginButton");
const errorBox = document.getElementById("loginError");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const togglePasswordBtn = document.getElementById("togglePasswordBtn");
const defaultButtonHtml = button.innerHTML;
const next = new URLSearchParams(location.search).get("next") || "";
const isPosNext = next.replace(/\/index\.html$/, "/").startsWith("/pos");

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

async function prepareRetailPosSession(email, password) {
  const result = await retailPosLogin(email, password);
  return result?.ok === true;
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

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  try {
    const profile = await login(email, password);
    const posReady = await prepareRetailPosSession(email, password).catch(error => {
      console.warn("POS_SESSION_PREPARE_SKIPPED", error);
      return false;
    });

    if (isPosNext) {
      if (!posReady) throw new Error("บัญชีนี้ไม่มีสิทธิ์ใช้งาน Retail POS หรือยังไม่ได้สร้าง POS session");
      location.replace(next || "/pos/");
      return;
    }

    location.replace(next || ROLE_HOME[profile.role] || "/");
  } catch (error) {
    console.error(error);
    showLoginError(getLoginErrorMessage(error));
  } finally {
    setButtonLoading(false);
  }
});
