import { dataService } from "./data-service.js";

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
    .delivery-fee-options{display:grid;gap:10px}
    .delivery-fee-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(120px,180px) auto;gap:10px;align-items:end;padding:10px;border:1px solid var(--line);border-radius:14px;background:#fff}
    .delivery-fee-row .field{margin:0}
    .delivery-fee-remove{width:42px!important;height:42px!important;min-width:42px!important;min-height:42px!important;padding:0!important;border-radius:50%!important}
    @media(max-width:720px){.delivery-fee-row{grid-template-columns:1fr}.delivery-fee-remove{width:100%!important;border-radius:12px!important}}
  `;
  document.head.appendChild(style);
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
      <div class="field">
        <label>ชื่อที่แสดงใน Dropdown</label>
        <input class="input" data-delivery-fee-label maxlength="80" value="${label}" placeholder="เช่น ระยะทาง 0-2 กิโลเมตร">
      </div>
      <div class="field">
        <label>ค่าส่ง (บาท)</label>
        <input class="input" data-delivery-fee-amount type="number" min="0" step="1" value="${fee}">
      </div>
      <button class="btn delivery-fee-remove" type="button" data-remove-delivery-fee aria-label="ลบตัวเลือกค่าส่ง">ลบ</button>
    </div>`;
}

function renderDeliveryFeeOptions() {
  if (!deliveryFeeOptionsList) return;
  ensureStyles();
  const options = normalizeDeliveryFeeOptions(currentSettings);
  deliveryFeeOptionsList.innerHTML = options.map(rowTemplate).join("");
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
  deliveryFeeOptionsList?.querySelector("[data-delivery-fee-row]:last-child [data-delivery-fee-label]")?.focus();
});

deliveryFeeOptionsList?.addEventListener("click", event => {
  const button = event.target.closest("[data-remove-delivery-fee]");
  if (!button) return;
  const rows = deliveryFeeOptionsList.querySelectorAll("[data-delivery-fee-row]");
  if (rows.length <= 1) return;
  button.closest("[data-delivery-fee-row]")?.remove();
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
