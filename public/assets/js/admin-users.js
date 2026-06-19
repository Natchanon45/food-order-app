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
  ["kitchen", "Kitchen"],
  ["super_admin", "Super Admin"]
];

function showError(message = "") {
  userError.textContent = message;
  userError.hidden = !message;
}

function roleSelect(user) {
  return `<select class="input" data-role-uid="${user.uid}" ${user.uid === auth.currentUser?.uid ? "disabled" : ""}>
    ${roleOptions.map(([value, label]) => `<option value="${value}" ${user.role === value ? "selected" : ""}>${label}</option>`).join("")}
  </select>`;
}

function renderUsers() {
  userCount.textContent = `${users.length} คน`;
  userRows.innerHTML = users.map(user => {
    const isCurrentUser = user.uid === auth.currentUser?.uid;
    return `
      <tr>
        <td>
          <input class="input" data-name-uid="${user.uid}" value="${user.displayName || ""}" maxlength="100">
          ${isCurrentUser ? '<div class="menu-category">บัญชีที่กำลังใช้งาน</div>' : ""}
        </td>
        <td>${user.email || "-"}</td>
        <td>${roleSelect(user)}</td>
        <td style="text-align:center">
          <input type="checkbox" data-active-uid="${user.uid}" ${user.active !== false ? "checked" : ""} ${isCurrentUser ? "disabled" : ""}>
        </td>
        <td><button class="btn btn-primary btn-sm" data-save-user="${user.uid}">บันทึก</button></td>
      </tr>
    `;
  }).join("");
}

async function loadUsers() {
  users = await listStaffUsers();
  renderUsers();
}

userForm.addEventListener("submit", async event => {
  event.preventDefault();
  showError("");
  createUserButton.disabled = true;
  createUserButton.textContent = "กำลังสร้าง...";

  try {
    await createStaffUser({
      displayName: document.getElementById("displayName").value.trim(),
      email: document.getElementById("email").value.trim().toLowerCase(),
      password: document.getElementById("password").value,
      role: document.getElementById("role").value,
      active: document.getElementById("active").checked
    });

    userForm.reset();
    document.getElementById("active").checked = true;
    toast("สร้างผู้ใช้งานเรียบร้อยแล้ว");
    await loadUsers();
  } catch (error) {
    console.error(error);
    let message = "สร้างผู้ใช้งานไม่สำเร็จ";
    if (error.code === "auth/email-already-in-use") message = "อีเมลนี้ถูกใช้งานแล้ว";
    if (error.code === "auth/invalid-email") message = "รูปแบบอีเมลไม่ถูกต้อง";
    if (error.code === "auth/weak-password") message = "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";
    if (error.code === "auth/operation-not-allowed") message = "กรุณาเปิด Email/Password ใน Firebase Authentication ก่อน";
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
  if (!user) return;

  button.disabled = true;
  button.textContent = "กำลังบันทึก...";

  try {
    const displayName = document.querySelector(`[data-name-uid="${uid}"]`).value.trim();
    const roleField = document.querySelector(`[data-role-uid="${uid}"]`);
    const activeField = document.querySelector(`[data-active-uid="${uid}"]`);

    await updateStaffUser(uid, {
      displayName,
      role: roleField ? roleField.value : user.role,
      active: activeField ? activeField.checked : user.active !== false
    });

    toast("บันทึกข้อมูลผู้ใช้งานแล้ว");
    await loadUsers();
  } catch (error) {
    console.error(error);
    toast("บันทึกผู้ใช้งานไม่สำเร็จ", "error");
    button.disabled = false;
    button.textContent = "บันทึก";
  }
});

await loadUsers();
