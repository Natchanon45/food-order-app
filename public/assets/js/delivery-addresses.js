import { dataService } from "./data-service.js";
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

let currentProfile = { displayName: "", addresses: [] };
let selectedAddressId = "";
let editingAddressId = "";
let lookupTimer = null;

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function newAddressId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
  const phone = normalizePhone(phoneInput.value);
  if (phone.length < 9) return;
  await dataService.saveDeliveryCustomer(phone, currentProfile);
}

async function lookupAddresses() {
  const phone = normalizePhone(phoneInput.value);
  if (phone.length < 9) {
    lookupStatus.textContent = "กรอกเบอร์โทรเพื่อค้นหาที่อยู่เดิม";
    currentProfile = { displayName: "", addresses: [] };
    selectedAddressId = "";
    addressBook.hidden = true;
    return;
  }

  lookupStatus.textContent = "กำลังค้นหาที่อยู่...";
  try {
    const profile = await dataService.getDeliveryCustomer(phone);
    currentProfile = profile || { displayName: "", addresses: [] };
    if (profile?.displayName && !nameInput.value.trim()) nameInput.value = profile.displayName;

    const addresses = currentProfile.addresses || [];
    const preferred = addresses.find(item => item.isDefault) || addresses[0] || null;
    selectedAddressId = preferred?.id || "";
    if (preferred) {
      addressInput.value = preferred.address || "";
      if (preferred.recipientName) nameInput.value = preferred.recipientName;
      lookupStatus.textContent = `พบ ${addresses.length} ที่อยู่ เลือกที่อยู่สำหรับจัดส่งได้เลย`;
    } else {
      lookupStatus.textContent = "ยังไม่มีที่อยู่สำหรับเบอร์นี้ กรุณาเพิ่มที่อยู่ใหม่";
    }
    renderAddressBook();
  } catch (error) {
    console.error(error);
    lookupStatus.textContent = "ค้นหาที่อยู่ไม่สำเร็จ กรุณากรอกที่อยู่ใหม่";
    currentProfile = { displayName: "", addresses: [] };
    selectedAddressId = "";
    renderAddressBook();
  }
}

phoneInput.addEventListener("input", () => {
  clearTimeout(lookupTimer);
  lookupTimer = setTimeout(lookupAddresses, 500);
});

addAddressButton.addEventListener("click", () => {
  if (currentProfile.addresses.length >= 5) {
    toast("บันทึกได้สูงสุด 5 ที่อยู่ต่อเบอร์โทร", "error");
    return;
  }
  openAddressForm();
});

cancelAddressButton.addEventListener("click", closeAddressForm);

saveAddressButton.addEventListener("click", async () => {
  const phone = normalizePhone(phoneInput.value);
  const label = addressLabel.value.trim();
  const recipientName = addressRecipient.value.trim();
  const address = addressText.value.trim();

  if (phone.length < 9) {
    toast("กรุณากรอกเบอร์โทรศัพท์ก่อนบันทึกที่อยู่", "error");
    return;
  }
  if (!label || !recipientName || !address) {
    toast("กรุณากรอกชื่อที่อยู่ ชื่อผู้รับ และรายละเอียดที่อยู่", "error");
    return;
  }

  let addresses = [...(currentProfile.addresses || [])];
  if (!editingAddressId && addresses.length >= 5) {
    toast("บันทึกได้สูงสุด 5 ที่อยู่ต่อเบอร์โทร", "error");
    return;
  }

  const id = editingAddressId || newAddressId();
  const isDefault = addressDefault.checked || addresses.length === 0;
  if (isDefault) addresses = addresses.map(item => ({ ...item, isDefault: false }));

  const nextAddress = { id, label, recipientName, address, isDefault };
  const existingIndex = addresses.findIndex(item => item.id === id);
  if (existingIndex >= 0) addresses[existingIndex] = nextAddress;
  else addresses.push(nextAddress);

  currentProfile = { ...currentProfile, displayName: recipientName, addresses: addresses.slice(0, 5) };
  selectedAddressId = id;
  nameInput.value = recipientName;
  addressInput.value = address;

  try {
    await persistProfile();
    closeAddressForm();
    renderAddressBook();
    toast(editingAddressId ? "แก้ไขที่อยู่แล้ว" : "บันทึกที่อยู่แล้ว");
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
    const address = currentProfile.addresses.find(item => item.id === editButton.dataset.editAddress);
    openAddressForm(address);
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
    if (!confirm("ยืนยันลบที่อยู่นี้?")) return;
    const id = deleteButton.dataset.deleteAddress;
    currentProfile.addresses = currentProfile.addresses.filter(item => item.id !== id);
    if (currentProfile.addresses.length && !currentProfile.addresses.some(item => item.isDefault)) {
      currentProfile.addresses[0].isDefault = true;
    }
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

export async function saveCurrentDeliveryAddress() {
  const phone = normalizePhone(phoneInput.value);
  const recipientName = nameInput.value.trim();
  const address = addressInput.value.trim();
  if (phone.length < 9 || !recipientName || !address) return;

  let addresses = [...(currentProfile.addresses || [])];
  let matched = addresses.find(item => item.address.trim() === address);

  if (matched) {
    matched = { ...matched, recipientName };
    addresses = addresses.map(item => item.id === matched.id ? matched : item);
    selectedAddressId = matched.id;
  } else if (addresses.length < 5) {
    const id = newAddressId();
    const isDefault = addresses.length === 0;
    matched = { id, label: "ที่อยู่ล่าสุด", recipientName, address, isDefault };
    addresses.push(matched);
    selectedAddressId = id;
  }

  currentProfile = { ...currentProfile, displayName: recipientName, addresses: addresses.slice(0, 5) };
  await dataService.saveDeliveryCustomer(phone, currentProfile);
}

lookupStatus.textContent = "กรอกเบอร์โทรเพื่อค้นหาที่อยู่เดิม";
