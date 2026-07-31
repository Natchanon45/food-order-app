import { auth } from "./firebase-config.js?v=20260630-073";
import { createStaffUser, listStaffUsers, updateStaffUser } from "./admin-staff-service.js?v=20260704-002";
import { toast } from "./ui.js?v=20260731-080";

const userForm = document.getElementById("userForm");
const userRows = document.getElementById("userRows");
const userCount = document.getElementById("userCount");
const createUserButton = document.getElementById("createUserButton");
const userError = document.getElementById("userError");
const userDialog = document.getElementById("userDialog");
const openCreateUserModal = document.getElementById("openCreateUserModal");
const closeCreateUserModal = document.getElementById("closeCreateUserModal");
const cancelCreateUserModal = document.getElementById("cancelCreateUserModal");
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

function resetCreateForm() {
  userForm.reset();
  document.getElementById("active").checked = true;
  showError("");
}

function closeCreateDialog() {
  if (userDialog.open) userDialog.close();
}

openCreateUserModal.addEventListener("click", () => {
  resetCreateForm();
  userDialog.showModal();
  requestAnimationFrame(() => document.getElementById("displayName").focus());
});

closeCreateUserModal.addEventListener("click", closeCreateDialog);
cancelCreateUserModal.addEventListener("click", closeCreateDialog);
userDialog.addEventListener("close", resetCreateForm);

function iconLabel(iconClass, label) {
  return `<i class="bi ${iconClass}" aria-hidden="true"></i><span>${label}</span>`;
}

function setButtonContent(button, iconClass, label) {
  if (!button) return;
  button.innerHTML = iconLabel(iconClass, label);
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
      <td><button class="btn btn-primary btn-sm user-save-button" data-save-user="${user.uid}">${iconLabel("bi-floppy", "บันทึก")}</button></td>
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
  setButtonContent(createUserButton, "bi-hourglass-split", "กำลังสร้าง...");

  try {
    await createStaffUser({
      displayName: document.getElementById("displayName").value.trim(),
      email: document.getElementById("email").value.trim().toLowerCase(),
      password,
      role: document.getElementById("role").value,
      active: document.getElementById("active").checked
    });

    closeCreateDialog();
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
    setButtonContent(createUserButton, "bi-person-plus", "สร้างผู้ใช้งาน");
  }
});

userRows.addEventListener("click", async event => {
  const button = event.target.closest("[data-save-user]");
  if (!button) return;

  const uid = button.dataset.saveUser;
  const user = users.find(item => item.uid === uid);
  if (!user || uid === auth.currentUser?.uid) return;

  button.disabled = true;
  setButtonContent(button, "bi-hourglass-split", "กำลังบันทึก...");

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
    setButtonContent(button, "bi-floppy", "บันทึก");
  }
});

await loadUsers();
