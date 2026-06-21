import { auth } from "./firebase-config.js";
import { createStaffUser, listStaffUsers, updateStaffUser } from "./auth-service.js";
import { toast } from "./ui.js";

const userForm = document.getElementById("userForm");
const userRows = document.getElementById("userRows");
const userCount = document.getElementById("userCount");
const createUserButton = document.getElementById("createUserButton");
const userError = document.getElementById("userError");
let users = [];

const roleOptions = [
  ["admin", "Admin"],
  ["cashier", "Cashier"],
  ["kitchen", "Kitchen"]
];

function showError(message = "") {
  userError.textContent = message;
  userError.hidden = !message;
}

function roleSelect(user) {
  return `<select class="input" data-role-uid="${user.uid}">
    ${roleOptions.map(([value, label]) => `<option value="${value}" ${user.role === value ? "selected" : ""}>${label}</option>`).join("")}
  </select>`;
}

function renderUsers() {
  userCount.textContent = `${users.length} คน`;
  userRows.innerHTML = users.length ? users.map(user => `
    <tr>
      <td><input class="input" data-name-uid="${user.uid}" value="${user.displayName || ""}" maxlength="100"></td>
      <td>${user.email || "-"}</td>
      <td>${roleSelect(user)}</td>
      <td style="text-align:center"><input type="checkbox" data-active-uid="${user.uid}" ${user.active !== false ? "checked" : ""}></td>
      <td><button class="btn btn-primary btn-sm" data-save-user="${user.uid}">บันทึก</button></td>
    </tr>
  `).join("") : '<tr><td colspan="5"><div class="empty">ยังไม่มีพนักงานในร้าน</div></td></tr>';
}

async function loadUsers() {
  try {
    users = await listStaffUsers();
    renderUsers();
  } catch (error) {
    console.error(error);
    showError("โหลดรายการพนักงานไม่สำเร็จ");
    toast("โหลดรายการพนักงานไม่สำเร็จ", "error");
  }
}

userForm.addEventListener("submit", async event => {
  event.preventDefault();
  showError("");

  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  if (password.length < 8) {
    showError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
    return;
  }
  if (password !== confirmPassword) {
    showError("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
    return;
  }

  createUserButton.disabled = true;
  createUserButton.textContent = "กำลังสร้าง...";

  try {
    await createStaffUser({
      displayName: document.getElementById("displayName").value.trim(),
      email: document.getElementById("email").value.trim().toLowerCase(),
      password,
      role: document.getElementById("role").value,
      active: document.getElementById("active").checked
    });

    userForm.reset();
    document.getElementById("active").checked = true;
    toast("สร้างพนักงานเรียบร้อยแล้ว");
    await loadUsers();
  } catch (error) {
    console.error(error);
    const code = String(error?.code || error?.message || "");
    let message = "สร้างพนักงานไม่สำเร็จ";
    if (code.includes("already-exists") || code.includes("email-already-exists")) message = "อีเมลนี้ถูกใช้งานแล้ว";
    if (code.includes("invalid-argument")) message = "กรุณาตรวจสอบข้อมูลพนักงาน";
    if (code.includes("permission-denied")) message = "บัญชีนี้ไม่มีสิทธิ์จัดการพนักงาน";
    showError(message);
    toast(message, "error");
  } finally {
    createUserButton.disabled = false;
    createUserButton.textContent = "สร้างผู้ใช้งาน";
  }
});

userRows.addEventListener("click", async event => {
  const button = event.target.closest("[data-save-user]");
  if (!button) return;

  const uid = button.dataset.saveUser;
  const user = users.find(item => item.uid === uid);
  if (!user || uid === auth.currentUser?.uid) return;

  button.disabled = true;
  button.textContent = "กำลังบันทึก...";

  try {
    const displayName = document.querySelector(`[data-name-uid="${uid}"]`).value.trim();
    const role = document.querySelector(`[data-role-uid="${uid}"]`).value;
    const active = document.querySelector(`[data-active-uid="${uid}"]`).checked;
    await updateStaffUser(uid, { displayName, role, active });
    toast("บันทึกข้อมูลพนักงานแล้ว");
    await loadUsers();
  } catch (error) {
    console.error(error);
    toast("บันทึกพนักงานไม่สำเร็จ", "error");
    button.disabled = false;
    button.textContent = "บันทึก";
  }
});

await loadUsers();
