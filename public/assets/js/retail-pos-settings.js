import { RetailCollections, getRecord, getTenantId } from './retail-db.js?v=20260629-032';
import { saveSettingsDocumentsLocalFirst } from './retail-pos-settings-sync.js?v=20260716-015';
import { sweetConfirm } from './sweet-dialog.js?v=20260731-094';

const SETTINGS_KEY = "retail_pos_store_settings_v1";
const tenantSettingsKey = () => `${SETTINGS_KEY}_${getTenantId()}`;

const defaults = {
  shopName: "POS ร้านค้าปลีก",
  shopAddress: "",
  shopPhone: "",
  taxId: "",
  vatRegistered: "no",
  vatRate: 7,
  defaultVatMode: "include",
  taxBranchType: "headOffice",
  taxBranchCode: "",
  taxInvoiceName: "",
  taxInvoiceAddress: "",
  receiptThanks: "ขอบคุณที่ใช้บริการ",
  receiptFooter: "เอกสารฉบับนี้ออกโดยระบบของร้านตามข้อมูลด้านบน",
  receiptPaperSize: "80",
  receiptPrintMode: "ask",
  promptPayEnabled: "no",
  promptPayId: "",
  promptPayAccountName: ""
};

const els = {
  form: document.querySelector("#storeSettingsForm"),
  shopName: document.querySelector("#shopName"),
  shopAddress: document.querySelector("#shopAddress"),
  shopPhone: document.querySelector("#shopPhone"),
  taxId: document.querySelector("#taxId"),
  vatRegistered: document.querySelector("#vatRegistered"),
  vatRate: document.querySelector("#vatRate"),
  defaultVatMode: document.querySelector("#defaultVatMode"),
  taxBranchType: document.querySelector("#taxBranchType"),
  taxBranchCode: document.querySelector("#taxBranchCode"),
  taxInvoiceName: document.querySelector("#taxInvoiceName"),
  taxInvoiceAddress: document.querySelector("#taxInvoiceAddress"),
  receiptThanks: document.querySelector("#receiptThanks"),
  receiptFooter: document.querySelector("#receiptFooter"),
  receiptPaperSize: document.querySelector("#receiptPaperSize"),
  receiptPrintMode: document.querySelector("#receiptPrintMode"),
  promptPayEnabled: document.querySelector("#promptPayEnabled"),
  promptPayId: document.querySelector("#promptPayId"),
  promptPayAccountName: document.querySelector("#promptPayAccountName"),
  previewShopName: document.querySelector("#previewShopName"),
  previewShopAddress: document.querySelector("#previewShopAddress"),
  previewShopPhone: document.querySelector("#previewShopPhone"),
  previewTaxId: document.querySelector("#previewTaxId"),
  previewTaxBranch: document.querySelector("#previewTaxBranch"),
  previewVatStatus: document.querySelector("#previewVatStatus"),
  previewVatMode: document.querySelector("#previewVatMode"),
  previewThanks: document.querySelector("#previewThanks"),
  previewFooter: document.querySelector("#previewFooter"),
  previewPaperSize: document.querySelector("#previewPaperSize"),
  previewPrintMode: document.querySelector("#previewPrintMode"),
  previewPromptPay: document.querySelector("#previewPromptPay"),
  resetBtn: document.querySelector("#resetSettingsBtn"),
  error: document.querySelector("#settingsError"),
  toast: document.querySelector("#toast")
};

let toastTimer;

function readLocalSettings() {
  try {
    const tenantId = getTenantId();
    const scoped = JSON.parse(localStorage.getItem(tenantSettingsKey())) || null;
    const legacy = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || null;
    const saved = scoped || (!legacy?.tenantId || legacy.tenantId === tenantId ? legacy : null);
    return { ...defaults, ...(saved || {}), tenantId, shopId: tenantId };
  }
  catch { return { ...defaults }; }
}

async function readSettings() {
  const local = readLocalSettings();
  try {
    const [store, receipt, tax, payment] = await Promise.all([
      getRecord(RetailCollections.settings, "store"),
      getRecord(RetailCollections.settings, "receipt"),
      getRecord(RetailCollections.settings, "tax"),
      getRecord(RetailCollections.settings, "payment")
    ]);
    return { ...defaults, ...(store || {}), ...(receipt || {}), ...(tax || {}), ...(payment || {}), ...local };
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

function normalizeVatRegistered(value) {
  return String(value || "no") === "yes" ? "yes" : "no";
}

function normalizeVatMode(value) {
  return String(value || "include") === "exclude" ? "exclude" : "include";
}

function normalizeVatRate(value) {
  if (String(value ?? "").trim() === "") return defaults.vatRate;
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0) return defaults.vatRate;
  return Math.min(100, Math.round(rate * 100) / 100);
}

function normalizePromptPayEnabled(value) {
  return String(value || "no") === "yes" ? "yes" : "no";
}

function normalizePromptPayId(value) {
  return String(value || "").replace(/[^\d]/g, "").slice(0, 13);
}

function normalizeBranchType(value) {
  return String(value || "headOffice") === "branch" ? "branch" : "headOffice";
}

function collectSettings() {
  const vatRegistered = normalizeVatRegistered(els.vatRegistered?.value);
  const vatRate = normalizeVatRate(els.vatRate?.value);
  return {
    shopName: els.shopName.value.trim(),
    shopAddress: els.shopAddress.value.trim(),
    shopPhone: els.shopPhone.value.trim(),
    taxId: els.taxId.value.trim(),
    vatRegistered,
    vatRate: vatRegistered === "yes" && vatRate <= 0 ? defaults.vatRate : vatRate,
    defaultVatMode: normalizeVatMode(els.defaultVatMode?.value),
    taxBranchType: normalizeBranchType(els.taxBranchType?.value),
    taxBranchCode: els.taxBranchCode?.value.trim() || "",
    taxInvoiceName: els.taxInvoiceName?.value.trim() || "",
    taxInvoiceAddress: els.taxInvoiceAddress?.value.trim() || "",
    vatCalculationBase: "after_discount_and_points",
    shortTaxInvoiceEnabled: true,
    receiptThanks: els.receiptThanks.value.trim() || defaults.receiptThanks,
    receiptFooter: els.receiptFooter.value.trim() || defaults.receiptFooter,
    receiptPaperSize: normalizePaperSize(els.receiptPaperSize?.value),
    receiptPrintMode: normalizePrintMode(els.receiptPrintMode?.value),
    promptPayEnabled: normalizePromptPayEnabled(els.promptPayEnabled?.value),
    promptPayId: normalizePromptPayId(els.promptPayId?.value),
    promptPayAccountName: els.promptPayAccountName?.value.trim() || ""
  };
}

function fillForm(settings) {
  els.shopName.value = settings.shopName || defaults.shopName;
  els.shopAddress.value = settings.shopAddress || "";
  els.shopPhone.value = settings.shopPhone || "";
  els.taxId.value = settings.taxId || "";
  if (els.vatRegistered) els.vatRegistered.value = normalizeVatRegistered(settings.vatRegistered);
  if (els.vatRate) els.vatRate.value = normalizeVatRate(settings.vatRate);
  if (els.defaultVatMode) els.defaultVatMode.value = normalizeVatMode(settings.defaultVatMode);
  if (els.taxBranchType) els.taxBranchType.value = normalizeBranchType(settings.taxBranchType);
  if (els.taxBranchCode) els.taxBranchCode.value = settings.taxBranchCode || "";
  if (els.taxInvoiceName) els.taxInvoiceName.value = settings.taxInvoiceName || "";
  if (els.taxInvoiceAddress) els.taxInvoiceAddress.value = settings.taxInvoiceAddress || "";
  els.receiptThanks.value = settings.receiptThanks || defaults.receiptThanks;
  els.receiptFooter.value = settings.receiptFooter || defaults.receiptFooter;
  if (els.receiptPaperSize) els.receiptPaperSize.value = normalizePaperSize(settings.receiptPaperSize);
  if (els.receiptPrintMode) els.receiptPrintMode.value = normalizePrintMode(settings.receiptPrintMode);
  if (els.promptPayEnabled) els.promptPayEnabled.value = normalizePromptPayEnabled(settings.promptPayEnabled);
  if (els.promptPayId) els.promptPayId.value = normalizePromptPayId(settings.promptPayId);
  if (els.promptPayAccountName) els.promptPayAccountName.value = settings.promptPayAccountName || "";
  updatePreview();
}

function updatePreview() {
  const settings = collectSettings();
  const displayName = settings.taxInvoiceName || settings.shopName || defaults.shopName;
  const displayAddress = settings.taxInvoiceAddress || settings.shopAddress;
  els.previewShopName.textContent = displayName;
  els.previewShopAddress.textContent = displayAddress;
  els.previewShopPhone.textContent = settings.shopPhone ? `โทร ${settings.shopPhone}` : "";
  els.previewTaxId.textContent = settings.taxId ? `เลขประจำตัวผู้เสียภาษี ${settings.taxId}` : "";
  if (els.previewTaxBranch) els.previewTaxBranch.textContent = settings.taxBranchType === "branch" ? `สาขา ${settings.taxBranchCode || "ไม่ระบุ"}` : "สำนักงานใหญ่";
  if (els.previewVatStatus) els.previewVatStatus.textContent = settings.vatRegistered === "yes" ? `ใบกำกับภาษีอย่างย่อ • VAT ${settings.vatRate}%` : "ยังไม่เปิดใช้ VAT";
  if (els.previewVatMode) els.previewVatMode.textContent = settings.vatRegistered === "yes" ? `ค่าเริ่มต้น: ${settings.defaultVatMode === "exclude" ? "exclude VAT" : "include VAT"}` : "";
  els.previewThanks.textContent = settings.receiptThanks;
  els.previewFooter.textContent = settings.receiptFooter;
  if (els.previewPaperSize) els.previewPaperSize.textContent = `ขนาด: ${settings.receiptPaperSize === "a4" ? "A4" : `${settings.receiptPaperSize}mm`}`;
  if (els.previewPrintMode) els.previewPrintMode.textContent = settings.receiptPrintMode === "auto" ? "พิมพ์ทันทีหลังบันทึก" : "ถามก่อนพิมพ์";
  if (els.previewPromptPay) {
    const enabled = settings.promptPayEnabled === "yes";
    const receiver = settings.promptPayAccountName || displayName;
    els.previewPromptPay.textContent = enabled && settings.promptPayId
      ? `PromptPay พร้อมใช้ • ผู้รับเงิน ${receiver} • ${settings.promptPayId}`
      : "PromptPay / QR โอนเงินยังไม่เปิดใช้";
  }
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.remove("error", "is-error");
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1800);
}

async function saveSettings(settings) {
  const tenantId = getTenantId();
  const localSettings = {
    ...settings,
    tenantId,
    shopId: tenantId,
    syncStatus: "pending_sync",
    syncQueuedAt: Date.now()
  };
  localStorage.setItem(tenantSettingsKey(), JSON.stringify(localSettings));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(localSettings));
  const storeSettings = {
    id: "store",
    shopName: settings.shopName,
    shopAddress: settings.shopAddress,
    shopPhone: settings.shopPhone,
    taxId: settings.taxId
  };
  const receiptSettings = {
    id: "receipt",
    receiptThanks: settings.receiptThanks,
    receiptFooter: settings.receiptFooter,
    receiptPaperSize: settings.receiptPaperSize,
    receiptPrintMode: settings.receiptPrintMode
  };
  const taxSettings = {
    id: "tax",
    vatRegistered: settings.vatRegistered,
    vatRate: settings.vatRate,
    defaultVatMode: settings.defaultVatMode,
    taxBranchType: settings.taxBranchType,
    taxBranchCode: settings.taxBranchCode,
    taxInvoiceName: settings.taxInvoiceName,
    taxInvoiceAddress: settings.taxInvoiceAddress,
    vatCalculationBase: settings.vatCalculationBase,
    shortTaxInvoiceEnabled: settings.shortTaxInvoiceEnabled
  };
  const paymentSettings = {
    id: "payment",
    promptPayEnabled: settings.promptPayEnabled,
    promptPayId: settings.promptPayId,
    promptPayAccountName: settings.promptPayAccountName
  };
  const result = await saveSettingsDocumentsLocalFirst([
    storeSettings,
    receiptSettings,
    taxSettings,
    paymentSettings
  ]);
  const saved = {
    ...localSettings,
    syncStatus: result.pending ? "pending_sync" : "synced",
    firebaseSyncedAt: result.pending ? 0 : Date.now()
  };
  localStorage.setItem(tenantSettingsKey(), JSON.stringify(saved));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(saved));
  return result;
}

els.form.addEventListener("input", updatePreview);
els.form.addEventListener("change", updatePreview);

els.form.addEventListener("submit", async event => {
  event.preventDefault();
  const settings = collectSettings();
  if (!settings.shopName) {
    els.error.textContent = "กรุณากรอกชื่อร้าน";
    els.shopName.focus();
    return;
  }
  if (settings.vatRegistered === "yes" && !settings.taxId) {
    els.error.textContent = "กรุณากรอกเลขประจำตัวผู้เสียภาษีเมื่อเปิดใช้ VAT";
    els.taxId.focus();
    return;
  }
  if (settings.promptPayEnabled === "yes" && !settings.promptPayId) {
    els.error.textContent = "กรุณากรอกเบอร์ PromptPay หรือเลขนิติบุคคลก่อนเปิดใช้ QR โอนเงิน";
    els.promptPayId?.focus();
    return;
  }
  if (settings.promptPayEnabled === "yes" && ![10, 13].includes(settings.promptPayId.length)) {
    els.error.textContent = "PromptPay ต้องเป็นเบอร์โทร 10 หลัก หรือเลขนิติบุคคล/เลขภาษี 13 หลัก";
    els.promptPayId?.focus();
    return;
  }
  els.error.textContent = "";
  await saveSettings(settings);
  showToast("บันทึกข้อมูลการตั้งค่าร้านค้าสำเร็จ");
});

els.resetBtn.addEventListener("click", async () => {
  const confirmed = await sweetConfirm("คืนค่าข้อมูลร้าน ภาษี และข้อความใบเสร็จเป็นค่าเริ่มต้นหรือไม่?", {
    title: "ยืนยันคืนค่าเริ่มต้น",
    type: "warning",
    cancelText: "ยกเลิก",
    confirmText: "คืนค่าเริ่มต้น",
    confirmIcon: "arrow-clockwise"
  });
  if (!confirmed) return;
  localStorage.removeItem(SETTINGS_KEY);
  fillForm(defaults);
  await saveSettings(defaults);
  showToast("คืนค่าเริ่มต้นแล้ว");
});

fillForm(await readSettings());
