import "./retail-sales-returns-permissions.js?v=20260625-2";
import { RetailCollections, getRecord } from "./retail-db.js?v=20260629-032";

const STORE_SETTINGS_KEY = "retail_pos_store_settings_v1";
const LEGACY_STORE_SETTINGS_KEY = "food_order_store_settings";
let settingsCache = null;

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeSettings(store = {}, receipt = {}, legacy = {}) {
  return {
    shopName: receipt.shopName || store.shopName || store.name || legacy.shopName || "POS ร้านค้าปลีก",
    shopAddress: receipt.shopAddress || store.shopAddress || store.address || legacy.shopAddress || "",
    shopPhone: receipt.shopPhone || store.shopPhone || store.phone || legacy.shopPhone || "",
    taxId: receipt.taxId || receipt.shopTaxId || store.taxId || store.shopTaxId || legacy.taxId || legacy.shopTaxId || "",
    receiptThanks: receipt.receiptThanks || store.receiptThanks || legacy.receiptThanks || "ขอบคุณที่ใช้บริการ",
    receiptFooter: receipt.receiptFooter || store.receiptFooter || legacy.receiptFooter || "เอกสารฉบับนี้ออกโดยระบบของร้านตามข้อมูลด้านบน"
  };
}

function fallbackStoreSettings() {
  const legacy = readJson(LEGACY_STORE_SETTINGS_KEY, {});
  const cached = readJson(STORE_SETTINGS_KEY, {});
  return normalizeSettings(cached, cached, legacy);
}

async function getStoreSettings() {
  if (settingsCache) return settingsCache;
  const fallback = fallbackStoreSettings();
  try {
    const [store, receipt] = await Promise.all([
      getRecord(RetailCollections.settings, "store"),
      getRecord(RetailCollections.settings, "receipt")
    ]);
    settingsCache = normalizeSettings(store || {}, receipt || {}, fallback);
    writeJson(STORE_SETTINGS_KEY, settingsCache);
    return settingsCache;
  } catch (error) {
    console.warn("[retail-sales-receipt-settings] firebase settings fallback", error);
    settingsCache = fallback;
    return fallback;
  }
}

async function applyReceiptSettings() {
  const settings = await getStoreSettings();
  const values = {
    receiptShopName: settings.shopName,
    receiptShopAddress: settings.shopAddress,
    receiptShopPhone: settings.shopPhone ? `โทร ${settings.shopPhone}` : "",
    receiptTaxId: settings.taxId ? `เลขประจำตัวผู้เสียภาษี ${settings.taxId}` : "",
    receiptThanks: settings.receiptThanks,
    receiptFooter: settings.receiptFooter
  };

  Object.entries(values).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });
}

applyReceiptSettings();

document.querySelector("#salesTableBody")?.addEventListener("click", event => {
  if (event.target.closest("[data-sale-id]")) applyReceiptSettings();
}, true);

document.querySelector("#printReceiptBtn")?.addEventListener("click", applyReceiptSettings, true);
window.addEventListener("beforeprint", applyReceiptSettings);
window.addEventListener("storage", event => {
  if (!event.key || event.key === STORE_SETTINGS_KEY || event.key === LEGACY_STORE_SETTINGS_KEY) {
    settingsCache = null;
    applyReceiptSettings();
  }
});
