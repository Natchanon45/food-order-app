const STORE_SETTINGS_KEY = "retail_pos_store_settings_v1";
const LEGACY_STORE_SETTINGS_KEY = "food_order_store_settings";

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function getStoreSettings() {
  const legacy = readJson(LEGACY_STORE_SETTINGS_KEY, {});
  const settings = readJson(STORE_SETTINGS_KEY, {});
  return {
    shopName: settings.shopName || legacy.shopName || "POS ร้านค้าปลีก",
    shopAddress: settings.shopAddress || legacy.shopAddress || "",
    shopPhone: settings.shopPhone || legacy.shopPhone || "",
    taxId: settings.taxId || legacy.taxId || legacy.shopTaxId || "",
    receiptThanks: settings.receiptThanks || "ขอบคุณที่ใช้บริการ",
    receiptFooter: settings.receiptFooter || "เอกสารฉบับนี้ออกโดยระบบของร้านตามข้อมูลด้านบน"
  };
}

function applyReceiptSettings() {
  const settings = getStoreSettings();
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
    applyReceiptSettings();
  }
});
