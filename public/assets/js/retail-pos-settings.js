const SETTINGS_KEY = "retail_pos_store_settings_v1";

const defaults = {
  shopName: "POS ร้านค้าปลีก",
  shopAddress: "",
  shopPhone: "",
  taxId: "",
  receiptThanks: "ขอบคุณที่ใช้บริการ",
  receiptFooter: "เอกสารฉบับนี้ออกโดยระบบของร้านตามข้อมูลด้านบน"
};

const els = {
  form: document.querySelector("#storeSettingsForm"),
  shopName: document.querySelector("#shopName"),
  shopAddress: document.querySelector("#shopAddress"),
  shopPhone: document.querySelector("#shopPhone"),
  taxId: document.querySelector("#taxId"),
  receiptThanks: document.querySelector("#receiptThanks"),
  receiptFooter: document.querySelector("#receiptFooter"),
  previewShopName: document.querySelector("#previewShopName"),
  previewShopAddress: document.querySelector("#previewShopAddress"),
  previewShopPhone: document.querySelector("#previewShopPhone"),
  previewTaxId: document.querySelector("#previewTaxId"),
  previewThanks: document.querySelector("#previewThanks"),
  previewFooter: document.querySelector("#previewFooter"),
  resetBtn: document.querySelector("#resetSettingsBtn"),
  error: document.querySelector("#settingsError"),
  toast: document.querySelector("#toast")
};

let toastTimer;

function readSettings() {
  try {
    return { ...defaults, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}) };
  } catch {
    return { ...defaults };
  }
}

function collectSettings() {
  return {
    shopName: els.shopName.value.trim(),
    shopAddress: els.shopAddress.value.trim(),
    shopPhone: els.shopPhone.value.trim(),
    taxId: els.taxId.value.trim(),
    receiptThanks: els.receiptThanks.value.trim() || defaults.receiptThanks,
    receiptFooter: els.receiptFooter.value.trim() || defaults.receiptFooter
  };
}

function fillForm(settings) {
  els.shopName.value = settings.shopName || defaults.shopName;
  els.shopAddress.value = settings.shopAddress || "";
  els.shopPhone.value = settings.shopPhone || "";
  els.taxId.value = settings.taxId || "";
  els.receiptThanks.value = settings.receiptThanks || defaults.receiptThanks;
  els.receiptFooter.value = settings.receiptFooter || defaults.receiptFooter;
  updatePreview();
}

function updatePreview() {
  const settings = collectSettings();
  els.previewShopName.textContent = settings.shopName || defaults.shopName;
  els.previewShopAddress.textContent = settings.shopAddress;
  els.previewShopPhone.textContent = settings.shopPhone ? `โทร ${settings.shopPhone}` : "";
  els.previewTaxId.textContent = settings.taxId ? `เลขประจำตัวผู้เสียภาษี ${settings.taxId}` : "";
  els.previewThanks.textContent = settings.receiptThanks;
  els.previewFooter.textContent = settings.receiptFooter;
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1800);
}

els.form.addEventListener("input", updatePreview);

els.form.addEventListener("submit", event => {
  event.preventDefault();
  const settings = collectSettings();
  if (!settings.shopName) {
    els.error.textContent = "กรุณากรอกชื่อร้าน";
    els.shopName.focus();
    return;
  }
  els.error.textContent = "";
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  showToast("บันทึกการตั้งค่าแล้ว");
});

els.resetBtn.addEventListener("click", () => {
  if (!confirm("คืนค่าข้อมูลร้านและข้อความใบเสร็จเป็นค่าเริ่มต้นหรือไม่?")) return;
  localStorage.removeItem(SETTINGS_KEY);
  fillForm(defaults);
  showToast("คืนค่าเริ่มต้นแล้ว");
});

fillForm(readSettings());
