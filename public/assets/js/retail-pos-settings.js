import { RetailCollections, getRecord, saveRecordStrict } from './retail-db.js?v=20260629-032';

const SETTINGS_KEY = "retail_pos_store_settings_v1";

const defaults = {
  shopName: "POS ร้านค้าปลีก",
  shopAddress: "",
  shopPhone: "",
  taxId: "",
  receiptThanks: "ขอบคุณที่ใช้บริการ",
  receiptFooter: "เอกสารฉบับนี้ออกโดยระบบของร้านตามข้อมูลด้านบน",
  receiptPaperSize: "80",
  receiptPrintMode: "ask"
};

const els = {
  form: document.querySelector("#storeSettingsForm"),
  shopName: document.querySelector("#shopName"),
  shopAddress: document.querySelector("#shopAddress"),
  shopPhone: document.querySelector("#shopPhone"),
  taxId: document.querySelector("#taxId"),
  receiptThanks: document.querySelector("#receiptThanks"),
  receiptFooter: document.querySelector("#receiptFooter"),
  receiptPaperSize: document.querySelector("#receiptPaperSize"),
  receiptPrintMode: document.querySelector("#receiptPrintMode"),
  previewShopName: document.querySelector("#previewShopName"),
  previewShopAddress: document.querySelector("#previewShopAddress"),
  previewShopPhone: document.querySelector("#previewShopPhone"),
  previewTaxId: document.querySelector("#previewTaxId"),
  previewThanks: document.querySelector("#previewThanks"),
  previewFooter: document.querySelector("#previewFooter"),
  previewPaperSize: document.querySelector("#previewPaperSize"),
  previewPrintMode: document.querySelector("#previewPrintMode"),
  resetBtn: document.querySelector("#resetSettingsBtn"),
  error: document.querySelector("#settingsError"),
  toast: document.querySelector("#toast")
};

let toastTimer;

function readLocalSettings() {
  try { return { ...defaults, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}) }; }
  catch { return { ...defaults }; }
}

async function readSettings() {
  const local = readLocalSettings();
  try {
    const [store, receipt] = await Promise.all([
      getRecord(RetailCollections.settings, "store"),
      getRecord(RetailCollections.settings, "receipt")
    ]);
    return { ...defaults, ...(store || {}), ...(receipt || {}), ...local };
  } catch (error) {
    console.warn("[retail-pos-settings] firebase settings fallback", error);
    return local;
  }
}

function normalizePaperSize(value) {
  const size = String(value || "80").toLowerCase();
  return ["58", "80", "a4"].includes(size) ? size : "80";
}

function normalizePrintMode(value) {
  return String(value || "ask") === "auto" ? "auto" : "ask";
}

function collectSettings() {
  return {
    shopName: els.shopName.value.trim(),
    shopAddress: els.shopAddress.value.trim(),
    shopPhone: els.shopPhone.value.trim(),
    taxId: els.taxId.value.trim(),
    receiptThanks: els.receiptThanks.value.trim() || defaults.receiptThanks,
    receiptFooter: els.receiptFooter.value.trim() || defaults.receiptFooter,
    receiptPaperSize: normalizePaperSize(els.receiptPaperSize?.value),
    receiptPrintMode: normalizePrintMode(els.receiptPrintMode?.value)
  };
}

function fillForm(settings) {
  els.shopName.value = settings.shopName || defaults.shopName;
  els.shopAddress.value = settings.shopAddress || "";
  els.shopPhone.value = settings.shopPhone || "";
  els.taxId.value = settings.taxId || "";
  els.receiptThanks.value = settings.receiptThanks || defaults.receiptThanks;
  els.receiptFooter.value = settings.receiptFooter || defaults.receiptFooter;
  if (els.receiptPaperSize) els.receiptPaperSize.value = normalizePaperSize(settings.receiptPaperSize);
  if (els.receiptPrintMode) els.receiptPrintMode.value = normalizePrintMode(settings.receiptPrintMode);
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
  if (els.previewPaperSize) els.previewPaperSize.textContent = `ขนาด: ${settings.receiptPaperSize === "a4" ? "A4" : `${settings.receiptPaperSize}mm`}`;
  if (els.previewPrintMode) els.previewPrintMode.textContent = settings.receiptPrintMode === "auto" ? "พิมพ์ทันทีหลังบันทึก" : "ถามก่อนพิมพ์";
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1800);
}

async function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  try {
    await Promise.all([
      saveRecordStrict(RetailCollections.settings, { id: "store", shopName: settings.shopName, shopAddress: settings.shopAddress, shopPhone: settings.shopPhone, taxId: settings.taxId }),
      saveRecordStrict(RetailCollections.settings, { id: "receipt", ...settings })
    ]);
  } catch (error) {
    console.warn("[retail-pos-settings] firebase save failed", error);
  }
}

els.form.addEventListener("input", updatePreview);

els.form.addEventListener("submit", async event => {
  event.preventDefault();
  const settings = collectSettings();
  if (!settings.shopName) {
    els.error.textContent = "กรุณากรอกชื่อร้าน";
    els.shopName.focus();
    return;
  }
  els.error.textContent = "";
  await saveSettings(settings);
  showToast("บันทึกการตั้งค่าแล้ว");
});

els.resetBtn.addEventListener("click", async () => {
  if (!confirm("คืนค่าข้อมูลร้านและข้อความใบเสร็จเป็นค่าเริ่มต้นหรือไม่?")) return;
  localStorage.removeItem(SETTINGS_KEY);
  fillForm(defaults);
  await saveSettings(defaults);
  showToast("คืนค่าเริ่มต้นแล้ว");
});

fillForm(await readSettings());
