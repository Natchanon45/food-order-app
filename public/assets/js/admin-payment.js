import { dataService } from "./data-service.js";
import { iconMarkup } from "./bootstrap-icons.js?v=20260701-001";

const textFieldIds = ["promptPayId", "promptPayName", "bankName", "bankAccountNumber", "bankAccountName"];
const deliveryFeeOptionsList = document.getElementById("deliveryFeeOptionsList");
const addDeliveryFeeOption = document.getElementById("addDeliveryFeeOption");
const currentSettings = await dataService.getStoreSettings();
const defaultDeliveryFeeOptions = [
  { id: "pickup", label: "รับที่ร้าน", fee: 0 },
  { id: "distance-0-2", label: "ระยะทาง 0-2 กิโลเมตร", fee: 10 },
  { id: "distance-2-5", label: "ระยะทาง 2-5 กิโลเมตร", fee: 30 },
  { id: "distance-5-plus", label: "ระยะทาง 5 กิโลเมตรขึ้นไป", fee: 50 }
];

function ensureStyles() {
  if (document.getElementById("adminDeliveryFeeOptionsStyle")) return;
  const style = document.createElement("style");
  style.id = "adminDeliveryFeeOptionsStyle";
  style.textContent = `
    .delivery-fee-head{align-items:flex-start!important;gap:16px!important}
    .delivery-fee-head>div{min-width:0;flex:1 1 auto}
    .delivery-fee-head #addDeliveryFeeOption{flex:0 0 auto;white-space:nowrap}
    #addDeliveryFeeOption{background:#159447;color:#fff;border-color:#159447;box-shadow:0 8px 18px rgba(21,148,71,.18);display:inline-flex;align-items:center;justify-content:center;gap:8px}
    #addDeliveryFeeOption .app-icon{width:16px;height:16px}
    #addDeliveryFeeOption:hover,#addDeliveryFeeOption:focus-visible{background:#0f7f3b;border-color:#0f7f3b}
    .delivery-fee-options{display:grid;gap:10px;margin-top:12px}
    .delivery-fee-row{display:grid;grid-template-columns:34px minmax(0,1fr) minmax(120px,180px) auto;gap:10px;align-items:end;padding:12px;border:1px solid #d8e8dd;border-radius:16px;background:linear-gradient(180deg,#fff,#fbfefc);box-shadow:0 8px 20px rgba(15,23,42,.04)}
    .delivery-fee-index{width:34px;height:46px;border-radius:12px;background:#e8f6ed;color:#0d6f34;display:grid;place-items:center;font-weight:600;align-self:end}
    .delivery-fee-row .field{margin:0}
    .delivery-fee-name-field{padding-top:22px}
    .delivery-fee-remove{width:42px!important;height:46px!important;min-width:42px!important;min-height:46px!important;padding:0!important;border-radius:12px!important;background:#dc2626!important;border-color:#dc2626!important;color:#fff!important;display:inline-grid!important;place-items:center!important;box-shadow:0 8px 18px rgba(220,38,38,.18)}
    .delivery-fee-remove .app-icon{width:18px;height:18px}
    .delivery-fee-remove:hover,.delivery-fee-remove:focus-visible{background:#b91c1c!important;border-color:#b91c1c!important;color:#fff!important}
    @media(max-width:720px){.delivery-fee-head{display:grid!important}.delivery-fee-head #addDeliveryFeeOption{width:100%;margin-top:10px}.delivery-fee-row{grid-template-columns:34px minmax(0,1fr);align-items:end}.delivery-fee-row .field:nth-of-type(2){grid-column:2}.delivery-fee-remove{grid-column:2;width:100%!important;border-radius:12px!important}}
  `;
  document.head.appendChild(style);
}

function icon(name) {
  return iconMarkup(name);
}

function optionId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return `fee-${globalThis.crypto.randomUUID()}`;
  return `fee-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function legacyDeliveryFeeOptions(settings) {
  const hasLegacy = ["deliveryFeeNearby", "deliveryFeeGeneral", "deliveryFeeFar"].some(key => settings[key] !== undefined && settings[key] !== null && settings[key] !== "");
  if (!hasLegacy) return defaultDeliveryFeeOptions;
  return [
    { id: "nearby", label: "ในเขตใกล้ร้าน", fee: Number(settings.deliveryFeeNearby ?? 0) },
    { id: "general", label: "พื้นที่ทั่วไป", fee: Number(settings.deliveryFeeGeneral ?? 30) },
    { id: "far", label: "พื้นที่ห่างไกล", fee: Number(settings.deliveryFeeFar ?? 50) }
  ];
}

function normalizeDeliveryFeeOptions(settings) {
  const source = Array.isArray(settings.deliveryFeeOptions) && settings.deliveryFeeOptions.length
    ? settings.deliveryFeeOptions
    : legacyDeliveryFeeOptions(settings);
  return source.map((option, index) => ({
    id: String(option.id || option.key || `fee-${index + 1}`).trim() || `fee-${index + 1}`,
    label: String(option.label || option.name || "").trim(),
    fee: Math.max(0, Number(option.fee ?? option.amount ?? 0) || 0)
  })).filter(option => option.label);
}

function rowTemplate(option = {}) {
  const id = option.id || optionId();
  const safeId = escapeHtml(id);
  const label = escapeHtml(option.label || "");
  const fee = Math.max(0, Number(option.fee || 0));
  return `
    <div class="delivery-fee-row" data-delivery-fee-row data-option-id="${safeId}">
      <div class="delivery-fee-index" aria-hidden="true"></div>
      <div class="field delivery-fee-name-field">
        <input class="input" data-delivery-fee-label maxlength="80" value="${label}" placeholder="เช่น รับเองที่ร้าน หรือ ระยะทาง 1-2 กิโลเมตร" aria-label="ชื่อที่แสดงใน Dropdown">
      </div>
      <div class="field">
        <label>ค่าส่ง (บาท)</label>
        <input class="input" data-delivery-fee-amount type="number" min="0" step="1" value="${fee}">
      </div>
      <button class="btn delivery-fee-remove" type="button" data-remove-delivery-fee aria-label="ลบตัวเลือกค่าส่ง" title="ลบตัวเลือกค่าส่ง">${icon("x-lg")}</button>
    </div>`;
}

function refreshDeliveryFeeIndexes() {
  document.querySelectorAll("[data-delivery-fee-row]").forEach((row, index) => {
    const badge = row.querySelector(".delivery-fee-index");
    if (badge) badge.textContent = String(index + 1);
  });
}

function renderDeliveryFeeOptions() {
  if (!deliveryFeeOptionsList) return;
  ensureStyles();
  const options = normalizeDeliveryFeeOptions(currentSettings);
  deliveryFeeOptionsList.innerHTML = options.map(rowTemplate).join("");
  refreshDeliveryFeeIndexes();
}

function readDeliveryFeeOptions() {
  const rows = [...document.querySelectorAll("[data-delivery-fee-row]")];
  const options = rows.map((row, index) => ({
    id: row.dataset.optionId || `fee-${index + 1}`,
    label: row.querySelector("[data-delivery-fee-label]")?.value.trim() || "",
    fee: Math.max(0, Number(row.querySelector("[data-delivery-fee-amount]")?.value || 0))
  })).filter(option => option.label);
  return options.length ? options : defaultDeliveryFeeOptions;
}

for (const fieldId of textFieldIds) {
  const field = document.getElementById(fieldId);
  if (field) field.value = currentSettings[fieldId] || "";
}

renderDeliveryFeeOptions();

addDeliveryFeeOption?.addEventListener("click", () => {
  deliveryFeeOptionsList?.insertAdjacentHTML("beforeend", rowTemplate({ id: optionId(), label: "", fee: 0 }));
  refreshDeliveryFeeIndexes();
  deliveryFeeOptionsList?.querySelector("[data-delivery-fee-row]:last-child [data-delivery-fee-label]")?.focus();
});

deliveryFeeOptionsList?.addEventListener("click", event => {
  const button = event.target.closest("[data-remove-delivery-fee]");
  if (!button) return;
  const rows = deliveryFeeOptionsList.querySelectorAll("[data-delivery-fee-row]");
  if (rows.length <= 1) return;
  button.closest("[data-delivery-fee-row]")?.remove();
  refreshDeliveryFeeIndexes();
});

document.getElementById("storeForm")?.addEventListener("submit", async () => {
  const settings = {};

  for (const fieldId of textFieldIds) {
    settings[fieldId] = document.getElementById(fieldId)?.value.trim() || "";
  }

  const deliveryFeeOptions = readDeliveryFeeOptions();
  settings.deliveryFeeOptions = deliveryFeeOptions;
  settings.deliveryFeeNearby = deliveryFeeOptions[0]?.fee ?? 0;
  settings.deliveryFeeGeneral = deliveryFeeOptions[1]?.fee ?? 30;
  settings.deliveryFeeFar = deliveryFeeOptions[2]?.fee ?? 50;

  await dataService.saveStoreSettings(settings);
});
