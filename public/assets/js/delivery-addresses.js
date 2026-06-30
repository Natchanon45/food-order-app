import {
  watchCustomerAuth,
  loginCustomerWithGoogle,
  logoutCustomer,
  getCustomerProfile,
  saveCustomerProfile
} from "./customer-profile-service.js";
import { toast } from "./ui.js";

const phoneInput = document.querySelector("#recipientPhone");
const nameInput = document.querySelector("#recipientName");
const addressInput = document.querySelector("#deliveryAddress");
const addressBook = document.querySelector("#addressBook");
const addressList = document.querySelector("#addressList");
const addressCount = document.querySelector("#addressCount");
const lookupStatus = document.querySelector("#addressLookupStatus");
const addAddressButton = document.querySelector("#addAddressButton");
const addressForm = document.querySelector("#addressForm");
const addressLabel = document.querySelector("#addressLabel");
const addressRecipient = document.querySelector("#addressRecipient");
const addressText = document.querySelector("#addressText");
const addressDefault = document.querySelector("#addressDefault");
const saveAddressButton = document.querySelector("#saveAddressButton");
const cancelAddressButton = document.querySelector("#cancelAddressButton");
const submitOrderButton = document.querySelector("#submitOrder");
const googleLoginButton = document.querySelector("#googleLoginButton");
const customerLogoutButton = document.querySelector("#customerLogoutButton");
const customerAccount = document.querySelector("#customerAccount");
const customerAccountName = document.querySelector("#customerAccountName");
const customerModeText = document.querySelector("#customerModeText");

let currentUser = null;
let currentProfile = { displayName: "", phone: "", addresses: [] };
let selectedAddressId = "";
let editingAddressId = "";
let bypassSubmitCapture = false;

async function askConfirm(message, options = {}) {
  if (typeof window.sweetConfirm === "function") return await window.sweetConfirm(message, options);
  return confirm(message);
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function newAddressId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function renderAccount() {
  const signedIn = Boolean(currentUser);
  googleLoginButton.hidden = signedIn;
  customerLogoutButton.hidden = !signedIn;
  customerAccount.hidden = !signedIn;
  customerAccountName.textContent = signedIn ? (currentUser.displayName || currentUser.email || "บัญชี Google") : "";
  customerModeText.textContent = signedIn
    ? "ที่อยู่จะบันทึกกับบัญชี Google และใช้ได้บนอุปกรณ์อื่น"
    : "โหมด Guest: ที่อยู่จะจำเฉพาะอุปกรณ์และเบราว์เซอร์นี้";
}

function renderAddressBook() {
  const addresses = currentProfile.addresses || [];
  addressBook.hidden = false;
  addressCount.textContent = `${addresses.length}/5 ที่อยู่`;
  addAddressButton.disabled = addresses.length >= 5;

  addressList.innerHTML = addresses.length ? addresses.map(address => `
    <label class="address-card${address.id === selectedAddressId ? " selected" : ""}">
      <input type="radio" name="savedDeliveryAddress" value="${address.id}" ${address.id === selectedAddressId ? "checked" : ""}>
      <div>
        <div class="address-card-title">
          ${address.label || "ที่อยู่"}
          ${address.isDefault ? '<span class="address-default">ที่อยู่หลัก</span>' : ""}
        </div>
        <div class="address-card-text"><strong>${address.recipientName || currentProfile.displayName || ""}</strong>\n${address.address}</div>
      </div>
      <div class="address-card-actions">
        <button type="button" class="btn btn-sm" data-edit-address="${address.id}">แก้ไข</button>
        ${address.isDefault ? "" : `<button type="button" class="btn btn-sm" data-default-address="${address.id}">ตั้งเป็นหลัก</button>`}
        <button type="button" class="btn btn-danger btn-sm" data-delete-address="${address.id}">ลบ</button>
      </div>
    </label>
  `).join("") : '<div class="empty" style="padding:20px 10px">ยังไม่มีที่อยู่ที่บันทึกไว้</div>';
}

function selectAddress(id) {
  const address = currentProfile.addresses.find(item => item.id === id);
  if (!address) return;
  selectedAddressId = id;
  addressInput.value = address.address || "";
  if (address.recipientName) nameInput.value = address.recipientName;
  renderAddressBook();
}

function openAddressForm(address = null) {
  editingAddressId = address?.id || "";
  addressLabel.value = address?.label || "บ้าน";
  addressRecipient.value = address?.recipientName || nameInput.value.trim();
  addressText.value = address?.address || addressInput.value.trim();
  addressDefault.checked = address ? Boolean(address.isDefault) : currentProfile.addresses.length === 0;
  addressForm.hidden = false;
  addressText.focus();
}

function closeAddressForm() {
  editingAddressId = "";
  addressForm.hidden = true;
  addressLabel.value = "";
  addressRecipient.value = "";
  addressText.value = "";
  addressDefault.checked = false;
}

async function persistProfile() {
  currentProfile = {
    ...currentProfile,
    displayName: nameInput.value.trim() || currentProfile.displayName || "",
    phone: normalizePhone(phoneInput.value)
  };
  await saveCustomerProfile(currentProfile, currentUser);
}

async function loadProfile() {
  lookupStatus.textContent = "กำลังโหลดที่อยู่...";
  try {
    currentProfile = await getCustomerProfile(currentUser);
    if (currentProfile.displayName) nameInput.value = currentProfile.displayName;
    if (currentProfile.phone) phoneInput.value = currentProfile.phone;

    const addresses = currentProfile.addresses || [];
    const preferred = addresses.find(item => item.isDefault) || addresses[0] || null;
    selectedAddressId = preferred?.id || "";
    if (preferred) {
      addressInput.value = preferred.address || "";
      if (preferred.recipientName) nameInput.value = preferred.recipientName;
      lookupStatus.textContent = `พบ ${addresses.length} ที่อยู่ เลือกที่อยู่สำหรับจัดส่งได้เลย`;
    } else {
      addressInput.value = "";
      lookupStatus.textContent = currentUser
        ? "ยังไม่มีที่อยู่ในบัญชีนี้ กรุณาเพิ่มที่อยู่ใหม่"
        : "ยังไม่มีที่อยู่ในอุปกรณ์นี้ กรุณาเพิ่มที่อยู่ใหม่";
    }
    renderAddressBook();
  } catch (error) {
    console.error(error);
    currentProfile = { displayName: "", phone: "", addresses: [] };
    selectedAddressId = "";
    lookupStatus.textContent = "โหลดที่อยู่ไม่สำเร็จ กรุณากรอกที่อยู่ใหม่";
    renderAddressBook();
  }
}

googleLoginButton.addEventListener("click", async () => {
  googleLoginButton.disabled = true;
  googleLoginButton.textContent = "กำลังเข้าสู่ระบบ...";
  try {
    await loginCustomerWithGoogle();
  } catch (error) {
    console.error(error);
    const messages = {
      "auth/unauthorized-domain": "โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase Authentication",
      "auth/operation-not-allowed": "ยังไม่ได้เปิดใช้งานการเข้าสู่ระบบด้วย Google",
      "auth/popup-blocked": "เบราว์เซอร์บล็อกหน้าต่าง Google กรุณาอนุญาตป๊อปอัปแล้วลองใหม่",
      "auth/network-request-failed": "เชื่อมต่อ Google ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่",
      "auth/cancelled-popup-request": "มีหน้าต่างเข้าสู่ระบบ Google เปิดอยู่แล้ว"
    };
    if (error.code !== "auth/popup-closed-by-user") {
      toast(messages[error.code] || "เข้าสู่ระบบ Google ไม่สำเร็จ กรุณาติดต่อผู้ดูแลระบบ", "error");
    }
  } finally {
    googleLoginButton.disabled = false;
    googleLoginButton.textContent = "เข้าสู่ระบบด้วย Google";
  }
});

customerLogoutButton.addEventListener("click", async () => {
  await logoutCustomer();
  toast("ออกจากระบบลูกค้าแล้ว");
});

addAddressButton.addEventListener("click", () => {
  if (currentProfile.addresses.length >= 5) {
    toast("บันทึกได้สูงสุด 5 ที่อยู่", "error");
    return;
  }
  openAddressForm();
});

cancelAddressButton.addEventListener("click", closeAddressForm);

saveAddressButton.addEventListener("click", async () => {
  const label = addressLabel.value.trim();
  const recipientName = addressRecipient.value.trim();
  const address = addressText.value.trim();

  if (!label || !recipientName || !address) {
    toast("กรุณากรอกชื่อที่อยู่ ชื่อผู้รับ และรายละเอียดที่อยู่", "error");
    return;
  }

  let addresses = [...(currentProfile.addresses || [])];
  if (!editingAddressId && addresses.length >= 5) {
    toast("บันทึกได้สูงสุด 5 ที่อยู่", "error");
    return;
  }

  const wasEditing = Boolean(editingAddressId);
  const id = editingAddressId || newAddressId();
  const isDefault = addressDefault.checked || addresses.length === 0;
  if (isDefault) addresses = addresses.map(item => ({ ...item, isDefault: false }));

  const nextAddress = { id, label, recipientName, address, isDefault };
  const index = addresses.findIndex(item => item.id === id);
  if (index >= 0) addresses[index] = nextAddress;
  else addresses.push(nextAddress);

  currentProfile = { ...currentProfile, displayName: recipientName, addresses: addresses.slice(0, 5) };
  selectedAddressId = id;
  nameInput.value = recipientName;
  addressInput.value = address;

  try {
    await persistProfile();
    closeAddressForm();
    renderAddressBook();
    toast(wasEditing ? "แก้ไขที่อยู่แล้ว" : "บันทึกที่อยู่แล้ว");
  } catch (error) {
    console.error(error);
    toast("บันทึกที่อยู่ไม่สำเร็จ", "error");
  }
});

addressList.addEventListener("change", event => {
  const radio = event.target.closest('input[name="savedDeliveryAddress"]');
  if (radio) selectAddress(radio.value);
});

addressList.addEventListener("click", async event => {
  const editButton = event.target.closest("[data-edit-address]");
  if (editButton) {
    event.preventDefault();
    openAddressForm(currentProfile.addresses.find(item => item.id === editButton.dataset.editAddress));
    return;
  }

  const defaultButton = event.target.closest("[data-default-address]");
  if (defaultButton) {
    event.preventDefault();
    const id = defaultButton.dataset.defaultAddress;
    currentProfile.addresses = currentProfile.addresses.map(item => ({ ...item, isDefault: item.id === id }));
    selectedAddressId = id;
    await persistProfile();
    selectAddress(id);
    toast("ตั้งเป็นที่อยู่หลักแล้ว");
    return;
  }

  const deleteButton = event.target.closest("[data-delete-address]");
  if (deleteButton) {
    event.preventDefault();
    const ok = await askConfirm("ยืนยันลบที่อยู่นี้?", {
      title: "ลบที่อยู่จัดส่ง",
      confirmText: "ตกลง",
      cancelText: "ยกเลิก",
      type: "warning"
    });
    if (!ok) return;
    const id = deleteButton.dataset.deleteAddress;
    currentProfile.addresses = currentProfile.addresses.filter(item => item.id !== id);
    if (currentProfile.addresses.length && !currentProfile.addresses.some(item => item.isDefault)) currentProfile.addresses[0].isDefault = true;
    selectedAddressId = currentProfile.addresses.find(item => item.isDefault)?.id || currentProfile.addresses[0]?.id || "";
    await persistProfile();
    if (selectedAddressId) selectAddress(selectedAddressId);
    else {
      addressInput.value = "";
      renderAddressBook();
    }
    toast("ลบที่อยู่แล้ว");
  }
});

async function saveCurrentDeliveryAddress() {
  const recipientName = nameInput.value.trim();
  const address = addressInput.value.trim();
  if (!recipientName || !address) return;

  let addresses = [...(currentProfile.addresses || [])];
  let matched = addresses.find(item => item.address.trim() === address);
  if (matched) {
    addresses = addresses.map(item => item.id === matched.id ? { ...item, recipientName } : item);
  } else if (addresses.length < 5) {
    const id = newAddressId();
    addresses.push({ id, label: "ที่อยู่ล่าสุด", recipientName, address, isDefault: addresses.length === 0 });
    selectedAddressId = id;
  }
  currentProfile = { ...currentProfile, displayName: recipientName, addresses: addresses.slice(0, 5) };
  await persistProfile();
}

submitOrderButton.addEventListener("click", async event => {
  if (bypassSubmitCapture) {
    bypassSubmitCapture = false;
    return;
  }

  if (!nameInput.value.trim() || !addressInput.value.trim()) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  submitOrderButton.disabled = true;
  const originalText = submitOrderButton.textContent;
  submitOrderButton.textContent = "กำลังบันทึกที่อยู่...";

  try {
    await saveCurrentDeliveryAddress();
    bypassSubmitCapture = true;
    submitOrderButton.disabled = false;
    submitOrderButton.textContent = originalText;
    submitOrderButton.click();
  } catch (error) {
    console.error(error);
    submitOrderButton.disabled = false;
    submitOrderButton.textContent = originalText;
    toast("บันทึกที่อยู่ไม่สำเร็จ กรุณาลองใหม่", "error");
  }
}, true);

watchCustomerAuth(async user => {
  currentUser = user;
  renderAccount();
  await loadProfile();
});
