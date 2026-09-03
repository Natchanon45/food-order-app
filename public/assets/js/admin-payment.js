import { dataService } from "./data-service.js?v=20260903-203";
import { ensureAdminSessionContext } from "./admin-session-bootstrap.js?v=20260903-203";
import { iconMarkup } from "./bootstrap-icons.js?v=20260701-001";
import { t } from "./i18n.js?v=20260903-202";

// ADMIN_DELIVERY_FEE_TABLE_20260829_004
const textFieldIds = ["promptPayId", "promptPayName", "bankName", "bankAccountNumber", "bankAccountName"];
const deliveryFeeOptionsList = document.getElementById("deliveryFeeOptionsList");
const addDeliveryFeeOption = document.getElementById("addDeliveryFeeOption");
const english = String(document.documentElement.lang || "").toLowerCase().startsWith("en");
const feeCopy = english
  ? {
      number: "No.",
      description: "Description",
      distance: "Distance (km)",
      fee: "Delivery Fee (THB)",
      action: "Action",
      pickup: "Store Pickup",
      upTo: distance => `Up to ${distance} km`,
      descriptionExample: value => `e.g. ${value}`,
      descriptionAria: "Delivery fee description",
      distanceAria: "Maximum delivery distance in kilometers",
      amountAria: "Delivery fee in THB",
      pickupLocked: "Store Pickup is a required system option and cannot be removed",
      tableAria: "Delivery fee tiers",
    }
  : {
      number: "ลำดับ",
      description: "รายละเอียด",
      distance: "ระยะทาง/กม.",
      fee: "ค่าส่ง/บาท",
      action: "การทำงาน",
      pickup: "รับเองที่ร้าน",
      upTo: distance => `ไม่เกิน ${distance} กิโลเมตร`,
      descriptionExample: value => `เช่น ${value}`,
      descriptionAria: "รายละเอียดช่วงค่าส่ง",
      distanceAria: "ระยะทางสูงสุดของช่วงค่าส่ง หน่วยกิโลเมตร",
      amountAria: "ค่าส่ง หน่วยบาท",
      pickupLocked: "รับเองที่ร้านเป็นตัวเลือกพื้นฐานของระบบและไม่สามารถลบได้",
      tableAria: "ตารางค่าจัดส่ง",
    };

await ensureAdminSessionContext();
const currentSettings = await dataService.getStoreSettings();

const DEFAULT_DISTANCE_LIMITS = [2, 5, 10];
const LEGACY_DISTANCE_LIMITS = Object.freeze({
  "distance-0-2": 2,
  "distance-2-5": 5,
  "distance-5-plus": 10,
  nearby: 2,
  general: 5,
  far: 10,
});

const defaultDeliveryFeeOptions = [
  { id: "pickup", label: "", maxDistanceKm: null, fee: 0 },
  { id: "distance-0-2", label: "", maxDistanceKm: 2, fee: 10 },
  { id: "distance-2-5", label: "", maxDistanceKm: 5, fee: 30 },
  { id: "distance-5-plus", label: "", maxDistanceKm: 10, fee: 50 },
];

function icon(name) {
  return iconMarkup(name);
}

function optionId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `fee-${globalThis.crypto.randomUUID()}`;
  }
  return `fee-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function normalizePositiveNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.round(number * 100) / 100;
}

function formatDistance(value) {
  const number = normalizePositiveNumber(value);
  if (number === null) return "";
  return Number.isInteger(number)
    ? String(number)
    : String(number).replace(/0+$/, "").replace(/\.$/, "");
}

function distanceForOption(option, index) {
  const explicit = normalizePositiveNumber(
    option?.maxDistanceKm ?? option?.distanceKm ?? option?.maxDistance,
  );
  if (explicit !== null) return explicit;

  const legacy = LEGACY_DISTANCE_LIMITS[String(option?.id || option?.key || "")];
  if (legacy) return legacy;

  const fallback = DEFAULT_DISTANCE_LIMITS[index];
  if (fallback) return fallback;

  return DEFAULT_DISTANCE_LIMITS.at(-1)
    + ((index - DEFAULT_DISTANCE_LIMITS.length + 1) * 5);
}

function defaultDescriptionForOption(option) {
  if (option.id === "pickup") return feeCopy.pickup;
  const distance = formatDistance(option.maxDistanceKm);
  return distance ? feeCopy.upTo(distance) : feeCopy.upTo("2");
}

function descriptionPlaceholder(option) {
  return feeCopy.descriptionExample(defaultDescriptionForOption(option));
}

function legacyDeliveryFeeOptions(settings) {
  const hasLegacy = ["deliveryFeeNearby", "deliveryFeeGeneral", "deliveryFeeFar"]
    .some(key => settings[key] !== undefined && settings[key] !== null && settings[key] !== "");

  if (!hasLegacy) return defaultDeliveryFeeOptions;

  return [
    { id: "pickup", label: "", maxDistanceKm: null, fee: 0 },
    { id: "distance-0-2", label: "", maxDistanceKm: 2, fee: Number(settings.deliveryFeeNearby ?? 10) },
    { id: "distance-2-5", label: "", maxDistanceKm: 5, fee: Number(settings.deliveryFeeGeneral ?? 30) },
    { id: "distance-5-plus", label: "", maxDistanceKm: 10, fee: Number(settings.deliveryFeeFar ?? 50) },
  ];
}

function normalizeDeliveryFeeOptions(settings) {
  const source = Array.isArray(settings.deliveryFeeOptions) && settings.deliveryFeeOptions.length
    ? settings.deliveryFeeOptions
    : legacyDeliveryFeeOptions(settings);
  const sourceStartsWithPickup = String(source[0]?.id || "") === "pickup";

  const normalized = source.map((option, index) => {
    const id = String(option?.id || option?.key || `fee-${index + 1}`).trim()
      || `fee-${index + 1}`;
    const pickup = id === "pickup";
    const distanceIndex = Math.max(0, index - (sourceStartsWithPickup ? 1 : 0));

    return {
      id,
      label: String(option?.label ?? option?.name ?? "").trim(),
      maxDistanceKm: pickup ? null : distanceForOption(option, distanceIndex),
      fee: pickup ? 0 : Math.max(0, Number(option?.fee ?? option?.amount ?? 0) || 0),
    };
  });

  const pickup = normalized.find(option => option.id === "pickup")
    || { ...defaultDeliveryFeeOptions[0] };
  const tiers = normalized
    .filter(option => option.id !== "pickup" && normalizePositiveNumber(option.maxDistanceKm) !== null)
    .sort((left, right) => left.maxDistanceKm - right.maxDistanceKm)
    .slice(0, 11);

  return [pickup, ...tiers];
}

function rowTemplate(option = {}) {
  const id = String(option.id || optionId());
  const pickup = id === "pickup";
  const safeId = escapeHtml(id);
  const label = escapeHtml(String(option.label || "").trim());
  const placeholder = escapeHtml(descriptionPlaceholder({ ...option, id }));
  const distance = formatDistance(option.maxDistanceKm);
  const fee = pickup ? 0 : Math.max(0, Number(option.fee || 0));

  return `
    <div
      class="delivery-fee-row${pickup ? " is-pickup" : ""}"
      data-delivery-fee-row
      data-option-id="${safeId}"
      data-delivery-fee-pickup="${pickup ? "true" : "false"}"
      role="row"
    >
      <div class="delivery-fee-index" data-delivery-fee-index role="cell"></div>
      <input
        class="input delivery-fee-description delivery-fee-description-input"
        data-delivery-fee-label
        type="text"
        maxlength="120"
        value="${label}"
        placeholder="${placeholder}"
        aria-label="${escapeHtml(feeCopy.descriptionAria)}"
      >
      <div class="delivery-fee-cell delivery-fee-distance-cell" role="cell" data-mobile-label="${escapeHtml(feeCopy.distance)}">
        ${pickup
          ? `<span class="delivery-fee-static-value" data-delivery-fee-distance-static>&mdash;</span>`
          : `<input
              class="input"
              data-delivery-fee-distance
              type="number"
              min="0.1"
              step="0.1"
              required
              inputmode="decimal"
              value="${escapeHtml(distance)}"
              aria-label="${escapeHtml(feeCopy.distanceAria)}"
            >`}
      </div>
      <div class="delivery-fee-cell delivery-fee-amount-cell" role="cell" data-mobile-label="${escapeHtml(feeCopy.fee)}">
        ${pickup
          ? `<span class="delivery-fee-static-value" data-delivery-fee-amount-static>0</span><input type="hidden" data-delivery-fee-amount value="0">`
          : `<input
              class="input"
              data-delivery-fee-amount
              type="number"
              min="0"
              step="1"
              required
              inputmode="decimal"
              value="${fee}"
              aria-label="${escapeHtml(feeCopy.amountAria)}"
            >`}
      </div>
      <div class="delivery-fee-action" role="cell">
        ${pickup
          ? `<span
              class="delivery-fee-lock"
              title="${escapeHtml(feeCopy.pickupLocked)}"
              aria-label="${escapeHtml(feeCopy.pickupLocked)}"
              role="img"
            >${icon("lock-fill")}</span>`
          : `<button
              class="btn delivery-fee-remove"
              type="button"
              data-remove-delivery-fee
              aria-label="${escapeHtml(t("admin.delivery_fee.remove"))}"
              title="${escapeHtml(t("admin.delivery_fee.remove"))}"
            >${icon("x-lg")}</button>`}
      </div>
    </div>`;
}

function tableHeaderTemplate() {
  return `
    <div class="delivery-fee-table-header" role="row">
      <div role="columnheader">${escapeHtml(feeCopy.number)}</div>
      <div role="columnheader">${escapeHtml(feeCopy.description)}</div>
      <div role="columnheader">${escapeHtml(feeCopy.distance)}</div>
      <div role="columnheader">${escapeHtml(feeCopy.fee)}</div>
      <div role="columnheader" class="delivery-fee-action-header" aria-label="${escapeHtml(feeCopy.action)}"></div>
    </div>`;
}

function refreshDeliveryFeeIndexes() {
  deliveryFeeOptionsList?.querySelectorAll("[data-delivery-fee-row]").forEach((row, index) => {
    const badge = row.querySelector("[data-delivery-fee-index]");
    if (badge) badge.textContent = String(index + 1);
  });
}

function syncRowDescriptionPlaceholder(row) {
  if (!row || row.dataset.deliveryFeePickup === "true") return;
  const distanceInput = row.querySelector("[data-delivery-fee-distance]");
  const labelInput = row.querySelector("[data-delivery-fee-label]");
  const maxDistanceKm = normalizePositiveNumber(distanceInput?.value);
  if (!labelInput || maxDistanceKm === null) return;
  labelInput.placeholder = feeCopy.descriptionExample(
    feeCopy.upTo(formatDistance(maxDistanceKm)),
  );
}

function readDeliveryFeeOptionsFromTable() {
  const rows = [...(deliveryFeeOptionsList?.querySelectorAll("[data-delivery-fee-row]") || [])];
  const options = rows.map((row, index) => {
    const pickup = row.dataset.deliveryFeePickup === "true" || row.dataset.optionId === "pickup";
    const maxDistanceKm = pickup
      ? null
      : normalizePositiveNumber(row.querySelector("[data-delivery-fee-distance]")?.value);
    const typedLabel = String(
      row.querySelector("[data-delivery-fee-label]")?.value || "",
    ).trim();
    const fallbackLabel = pickup
      ? feeCopy.pickup
      : (maxDistanceKm === null ? "" : feeCopy.upTo(formatDistance(maxDistanceKm)));
    const label = typedLabel || fallbackLabel;
    const fee = pickup
      ? 0
      : Math.max(0, Number(row.querySelector("[data-delivery-fee-amount]")?.value || 0) || 0);

    return {
      id: String(row.dataset.optionId || `fee-${index + 1}`),
      label,
      maxDistanceKm,
      fee,
    };
  });

  const pickup = options.find(option => option.id === "pickup") || {
    id: "pickup",
    label: feeCopy.pickup,
    maxDistanceKm: null,
    fee: 0,
  };
  const tiers = options
    .filter(option => option.id !== "pickup" && option.maxDistanceKm !== null)
    .sort((left, right) => left.maxDistanceKm - right.maxDistanceKm);

  return [pickup, ...tiers];
}

function installDeliveryFeeSaveEnrichment() {
  if (dataService.__deliveryFeeTableSaveEnriched) return;
  const originalSaveStoreProfile = dataService.saveStoreProfile?.bind(dataService);
  if (typeof originalSaveStoreProfile !== "function") return;

  dataService.saveStoreProfile = async settings => {
    const options = readDeliveryFeeOptionsFromTable();
    const tiers = options.filter(option => option.id !== "pickup");
    const enriched = {
      ...settings,
      deliveryFeeOptions: options,
      deliveryFeeNearby: tiers[0]?.fee ?? 0,
      deliveryFeeGeneral: tiers[1]?.fee ?? tiers[0]?.fee ?? 0,
      deliveryFeeFar: tiers[2]?.fee ?? tiers.at(-1)?.fee ?? 0,
    };
    return originalSaveStoreProfile(enriched);
  };

  Object.defineProperty(dataService, "__deliveryFeeTableSaveEnriched", {
    value: true,
    configurable: true,
  });
}

function renderDeliveryFeeOptions() {
  if (!deliveryFeeOptionsList) return;
  const options = normalizeDeliveryFeeOptions(currentSettings);
  deliveryFeeOptionsList.setAttribute("role", "table");
  deliveryFeeOptionsList.setAttribute("aria-label", feeCopy.tableAria);
  deliveryFeeOptionsList.innerHTML = `
    ${tableHeaderTemplate()}
    <div class="delivery-fee-table-body" data-delivery-fee-body role="rowgroup">
      ${options.map(rowTemplate).join("")}
    </div>`;
  refreshDeliveryFeeIndexes();
}

function nextDeliveryDistance() {
  const values = [...(deliveryFeeOptionsList?.querySelectorAll("[data-delivery-fee-distance]") || [])]
    .map(input => normalizePositiveNumber(input.value))
    .filter(value => value !== null);
  const maximum = values.length ? Math.max(...values) : 0;
  return maximum > 0 ? Math.round((maximum + 5) * 100) / 100 : 2;
}

for (const fieldId of textFieldIds) {
  const field = document.getElementById(fieldId);
  if (field) field.value = currentSettings[fieldId] || "";
}

renderDeliveryFeeOptions();
installDeliveryFeeSaveEnrichment();

addDeliveryFeeOption?.addEventListener("click", () => {
  const body = deliveryFeeOptionsList?.querySelector("[data-delivery-fee-body]");
  if (!body || body.querySelectorAll("[data-delivery-fee-row]").length >= 12) return;

  const option = {
    id: optionId(),
    label: "",
    maxDistanceKm: nextDeliveryDistance(),
    fee: 0,
  };
  body.insertAdjacentHTML("beforeend", rowTemplate(option));
  refreshDeliveryFeeIndexes();

  const newRow = body.querySelector("[data-delivery-fee-row]:last-child");
  newRow?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  newRow?.querySelector("[data-delivery-fee-label]")?.focus({ preventScroll: true });
});

deliveryFeeOptionsList?.addEventListener("input", event => {
  if (!event.target.matches("[data-delivery-fee-distance]")) return;
  syncRowDescriptionPlaceholder(event.target.closest("[data-delivery-fee-row]"));
});

deliveryFeeOptionsList?.addEventListener("click", event => {
  const button = event.target.closest("[data-remove-delivery-fee]");
  if (!button) return;
  button.closest("[data-delivery-fee-row]")?.remove();
  refreshDeliveryFeeIndexes();
});