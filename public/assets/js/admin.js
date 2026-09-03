import { dataService, usingDemoMode } from "./data-service.js?v=20260903-203";
import { ensureAdminSessionContext } from "./admin-session-bootstrap.js?v=20260903-203";
import { money, toast, DEFAULT_FOOD_IMAGE } from "./ui.js?v=20260831-001";
import { getMenuImagePosition, setMenuImagePosition } from "./admin-image-position.js";
import { t } from "./i18n.js?v=20260903-202";

await ensureAdminSessionContext();

if (usingDemoMode) document.querySelector("#demoBanner").innerHTML = `<div class="demo-banner">${t("admin.demo")}</div>`;

let menus = [];
let tables = [];
let selectedImageFile = null;

const menuImage = document.querySelector("#menuImage");
const menuImagePath = document.querySelector("#menuImagePath");
const fileInput = document.querySelector("#menuImageFile");
const dropzone = document.querySelector("#menuImageDropzone");
const dropzoneContent = document.querySelector("#menuImageDropzoneContent");
const previewWrap = document.querySelector("#menuImagePreviewWrap");
const preview = document.querySelector("#menuImagePreview");
const fileName = document.querySelector("#menuImageFileName");
const fileSize = document.querySelector("#menuImageFileSize");
const removeImageButton = document.querySelector("#removeMenuImage");
const imageError = document.querySelector("#menuImageError");

// ADMIN_MENU_IMAGE_REMOVE_OVERLAY_20260829_001
// Keep the existing delete handler, but place the same button inside
// the image dropzone so it can sit over the preview like the slip X.
if (dropzone && removeImageButton) {
  removeImageButton.setAttribute(
    "aria-label",
    t("admin.menu.remove_image")
  );
  removeImageButton.setAttribute(
    "title",
    t("admin.menu.remove_image")
  );

  if (removeImageButton.parentElement !== dropzone) {
    dropzone.appendChild(removeImageButton);
  }
}

// ADMIN_MENU_IMAGE_REMOVE_OVERLAY_20260829_002
// Remove every legacy child/icon from the delete button and render
// one text symbol only. The button remains accessible via aria-label.
if (removeImageButton) {
  const removeImageSymbol = document.createElement("span");

  removeImageSymbol.className =
    "menu-image-remove-symbol";

  removeImageSymbol.setAttribute(
    "aria-hidden",
    "true"
  );

  removeImageSymbol.textContent = "×";

  removeImageButton.replaceChildren(
    removeImageSymbol
  );
}

function resetValidationState(form, { validateValues = false } = {}) {
  form?.classList.remove("was-validated");
  form?.querySelectorAll("input, select, textarea").forEach(control => {
    delete control.dataset.validationTouched;
    delete control.dataset.validationState;
    control.classList.remove("is-valid", "is-invalid");
    const feedback = control.dataset.validationFeedbackId ? document.getElementById(control.dataset.validationFeedbackId) : null;
    if (feedback) { feedback.textContent = ""; feedback.classList.remove("show"); }
    if (validateValues && control.type !== "hidden" && control.type !== "file") control.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function askConfirm(message, options = {}) {
  if (typeof window.sweetConfirm === "function") return await window.sweetConfirm(message, options);
  return confirm(message);
}

function formatFileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function setImageError(message = "") {
  imageError.textContent = message;
  imageError.hidden = !message;
}

function showPreview(src, name = t("admin.menu.existing_image"), sizeText = "") {
  if (!src) {
    preview.src = DEFAULT_FOOD_IMAGE;
    previewWrap.hidden = true;
    dropzoneContent.hidden = false;
    dropzone.classList.remove("has-image");
    removeImageButton.hidden = true;
    fileName.textContent = "-";
    fileSize.textContent = "-";
    return;
  }
  preview.onerror = () => { preview.onerror = null; preview.src = DEFAULT_FOOD_IMAGE; };
  preview.src = src;
  previewWrap.hidden = false;
  dropzoneContent.hidden = true;
  dropzone.classList.add("has-image");
  removeImageButton.hidden = false;
  fileName.textContent = name;
  fileSize.textContent = sizeText;
}

function validateImageFile(file) {
  if (!file) throw new Error("NO_IMAGE_FILE");
  if (file.size > 8 * 1024 * 1024) throw new Error("IMAGE_TOO_LARGE");
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
  if (file.type && !allowed.includes(file.type)) throw new Error("INVALID_IMAGE_TYPE");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("IMAGE_PREVIEW_FAILED"));
    reader.readAsDataURL(file);
  });
}

async function selectImageFile(file) {
  try {
    validateImageFile(file);
    const previewUrl = await readFileAsDataUrl(file);
    selectedImageFile = file;
    setImageError("");
    setMenuImagePosition(50, 50);
    showPreview(previewUrl, file.name || t("admin.menu.image_name"), formatFileSize(file.size));
  } catch (error) {
    selectedImageFile = null;
    fileInput.value = "";
    let message = t("admin.menu.image_read_failed");
    if (error.message === "IMAGE_TOO_LARGE") message = t("admin.menu.image_too_large");
    if (error.message === "INVALID_IMAGE_TYPE") message = t("admin.menu.image_type_invalid");
    setImageError(message);
    toast(message, "error");
  }
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("IMAGE_DECODE_FAILED")); };
    image.src = objectUrl;
  });
}

async function resizeImage(file) {
  validateImageFile(file);
  const image = await loadImageElement(file);
  const maxSize = 1200;
  const ratio = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  canvas.getContext("2d", { alpha: false }).drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", .82));
  if (!blob) throw new Error("IMAGE_CONVERT_FAILED");
  return blob;
}

async function uploadMenuImage(file, menuId) {
  const blob = await resizeImage(file);
  if (usingDemoMode) return await new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve({ url: reader.result, path: "" });
    reader.readAsDataURL(blob);
  });
  return dataService.uploadMenuImage(menuId, blob);
}


// ADMIN_STORE_LOCATION_20260827_001
const adminStoreLocationElements = {
  map: document.querySelector("#adminStoreLocationMap"),
  latitude: document.querySelector("#storeLatitude"),
  longitude: document.querySelector("#storeLongitude"),
  status: document.querySelector("#adminStoreLocationStatus"),
  coordinates: document.querySelector("#adminStoreLocationCoordinates"),
  currentLocationButton: document.querySelector("#adminUseCurrentLocation"),
};

const ADMIN_STORE_DEFAULT_LOCATION = {
  latitude: 13.756331,
  longitude: 100.501762,
  zoom: 11,
};

let adminStoreMap = null;
let adminStoreMarker = null;

function normalizeAdminStoreLocation(latitude, longitude) {
  if (
    latitude === null
    || latitude === undefined
    || latitude === ""
    || longitude === null
    || longitude === undefined
    || longitude === ""
  ) {
    return null;
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (
    !Number.isFinite(lat)
    || !Number.isFinite(lng)
    || lat < -90
    || lat > 90
    || lng < -180
    || lng > 180
  ) {
    return null;
  }

  return {
    latitude: lat,
    longitude: lng,
  };
}

function getAdminStoreLocation() {
  return normalizeAdminStoreLocation(
    adminStoreLocationElements.latitude?.value,
    adminStoreLocationElements.longitude?.value,
  );
}

function renderAdminStoreLocation(location) {
  const ready = Boolean(location);

  if (adminStoreLocationElements.latitude) {
    adminStoreLocationElements.latitude.value = ready
      ? location.latitude.toFixed(7)
      : "";
  }

  if (adminStoreLocationElements.longitude) {
    adminStoreLocationElements.longitude.value = ready
      ? location.longitude.toFixed(7)
      : "";
  }

  if (adminStoreLocationElements.status) {
    adminStoreLocationElements.status.classList.toggle(
      "is-ready",
      ready,
    );
    adminStoreLocationElements.status.classList.remove("is-error");

    adminStoreLocationElements.status.textContent = ready
      ? "กำหนดตำแหน่งร้านแล้ว"
      : "ยังไม่ได้กำหนดตำแหน่งร้าน";
  }

  if (adminStoreLocationElements.coordinates) {
    adminStoreLocationElements.coordinates.textContent = ready
      ? `${location.latitude.toFixed(7)}, ${location.longitude.toFixed(7)}`
      : "";
  }
}

function moveAdminStoreMarker(location, pan = true) {
  if (!adminStoreMap || !location || !window.L) return;

  if (!adminStoreMarker) {
    adminStoreMarker = window.L.marker(
      [location.latitude, location.longitude],
      { draggable: true },
    ).addTo(adminStoreMap);

    adminStoreMarker.on("dragend", () => {
      const point = adminStoreMarker.getLatLng();

      setAdminStoreLocation(
        point.lat,
        point.lng,
        false,
      );
    });
  } else {
    adminStoreMarker.setLatLng([
      location.latitude,
      location.longitude,
    ]);
  }

  if (pan) {
    adminStoreMap.setView(
      [location.latitude, location.longitude],
      Math.max(adminStoreMap.getZoom(), 16),
    );
  }
}

function setAdminStoreLocation(latitude, longitude, pan = true) {
  const location = normalizeAdminStoreLocation(
    latitude,
    longitude,
  );

  if (!location) return false;

  renderAdminStoreLocation(location);
  moveAdminStoreMarker(location, pan);

  return true;
}

function initAdminStoreLocationMap() {
  if (!adminStoreLocationElements.map) return;

  if (!window.L) {
    if (adminStoreLocationElements.status) {
      adminStoreLocationElements.status.textContent =
        "โหลดแผนที่ไม่สำเร็จ";

      adminStoreLocationElements.status.classList.add(
        "is-error",
      );
    }

    return;
  }

  adminStoreMap = window.L.map(
    adminStoreLocationElements.map,
    {
      scrollWheelZoom: false,
    },
  ).setView(
    [
      ADMIN_STORE_DEFAULT_LOCATION.latitude,
      ADMIN_STORE_DEFAULT_LOCATION.longitude,
    ],
    ADMIN_STORE_DEFAULT_LOCATION.zoom,
  );

  window.L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    },
  ).addTo(adminStoreMap);

  adminStoreMap.on("click", event => {
    setAdminStoreLocation(
      event.latlng.lat,
      event.latlng.lng,
    );
  });

  setTimeout(
    () => adminStoreMap?.invalidateSize(),
    0,
  );
}

adminStoreLocationElements.currentLocationButton
  ?.addEventListener("click", () => {
    if (!navigator.geolocation) {
      if (adminStoreLocationElements.status) {
        adminStoreLocationElements.status.textContent =
          "เบราว์เซอร์ไม่รองรับการอ่านตำแหน่ง";

        adminStoreLocationElements.status.classList.add(
          "is-error",
        );
      }

      return;
    }

    const button =
      adminStoreLocationElements.currentLocationButton;

    button.disabled = true;

    navigator.geolocation.getCurrentPosition(
      position => {
        setAdminStoreLocation(
          position.coords.latitude,
          position.coords.longitude,
        );

        button.disabled = false;
      },
      error => {
        console.error(
          "[admin-store-location] geolocation failed",
          error,
        );

        if (adminStoreLocationElements.status) {
          adminStoreLocationElements.status.textContent =
            "ไม่สามารถอ่านตำแหน่งปัจจุบันได้";

          adminStoreLocationElements.status.classList.remove(
            "is-ready",
          );

          adminStoreLocationElements.status.classList.add(
            "is-error",
          );
        }

        button.disabled = false;
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
      },
    );
  });



// DELIVERY_PROMOTION_ADMIN_20260827_001

function normalizeDeliveryPromotion(settings = {}) {
  const promotion =
    settings?.deliveryPromotion
    && typeof settings.deliveryPromotion === "object"
      ? settings.deliveryPromotion
      : {};

  const freeShipping =
    promotion.freeShipping
    && typeof promotion.freeShipping === "object"
      ? promotion.freeShipping
      : {};

  const freeGift =
    promotion.freeGift
    && typeof promotion.freeGift === "object"
      ? promotion.freeGift
      : {};

  return {
    freeShipping: {
      enabled: Boolean(freeShipping.enabled),
      minimumSubtotal: Math.max(
        0,
        Number(freeShipping.minimumSubtotal || 0) || 0
      ),
    },

    freeGift: {
      enabled: Boolean(freeGift.enabled),

      maxSelectableItems: Math.min(
        20,
        Math.max(
          1,
          Number.parseInt(
            freeGift.maxSelectableItems || 1,
            10
          ) || 1
        )
      ),

      validFrom: String(freeGift.validFrom || "").trim(),
      validUntil: String(freeGift.validUntil || "").trim(),

      menuIds: Array.isArray(freeGift.menuIds)
        ? [...new Set(
            freeGift.menuIds
              .map(value => String(value || "").trim())
              .filter(Boolean)
          )]
        : [],
    },
  };
}

function escapePromotionHtml(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]
  );
}

function updateDeliveryPromotionGiftSelectedCount() {
  const element =
    document.querySelector("#deliveryFreeGiftSelectedCount");

  if (!element) return;

  const count = document.querySelectorAll(
    "[data-delivery-free-gift-menu]:checked"
  ).length;

  element.textContent = t(
    "admin.delivery_promotion.selected_count",
    { count }
  );
}

function syncDeliveryPromotionControlState() {
  const freeShippingEnabled =
    document.querySelector("#deliveryFreeShippingEnabled")
      ?.checked === true;

  const freeGiftEnabled =
    document.querySelector("#deliveryFreeGiftEnabled")
      ?.checked === true;

  const shippingInput =
    document.querySelector(
      "#deliveryFreeShippingMinimumSubtotal"
    );

  if (shippingInput) {
    shippingInput.disabled = !freeShippingEnabled;
  }

  for (const id of [
    "deliveryFreeGiftMaxSelectableItems",
    "deliveryFreeGiftValidFrom",
    "deliveryFreeGiftValidUntil",
  ]) {
    const element = document.querySelector(`#${id}`);

    if (element) {
      element.disabled = !freeGiftEnabled;
    }
  }

  for (const checkbox of document.querySelectorAll(
    "[data-delivery-free-gift-menu]"
  )) {
    checkbox.disabled = !freeGiftEnabled;
  }
}

function renderDeliveryPromotionGiftMenus(settings = {}) {
  const container =
    document.querySelector("#deliveryFreeGiftMenuList");

  if (!container) return;

  const promotion = normalizeDeliveryPromotion(settings);
  const selected = new Set(promotion.freeGift.menuIds);

  const availableMenus = menus
    .filter(menu => menu?.active !== false)
    .slice()
    .sort((left, right) =>
      String(left?.name || "").localeCompare(
        String(right?.name || ""),
        "th"
      )
    );

  if (!availableMenus.length) {
    container.innerHTML =
      '<div class="admin-promotion-empty">'
      + t(
        "admin.delivery_promotion.no_available_menus"
      )
      + '</div>';

    updateDeliveryPromotionGiftSelectedCount();
    syncDeliveryPromotionControlState();
    return;
  }

  container.innerHTML = availableMenus.map(menu => {
    const id = String(menu.id || "");
    const checked = selected.has(id);

    return `
      <label class="admin-promotion-gift-item">
        <input
          type="checkbox"
          data-delivery-free-gift-menu="${escapePromotionHtml(id)}"
          value="${escapePromotionHtml(id)}"
          ${checked ? "checked" : ""}
        >

        <span class="admin-promotion-gift-item-content">
          <strong>${escapePromotionHtml(menu.name || "-")}</strong>
          <small>
            ${escapePromotionHtml(menu.category || t(
              "admin.delivery_promotion.uncategorized"
            ))}
            • ${money(Number(menu.price || 0))} ${t("admin.common.baht")}
          </small>
        </span>
      </label>
    `;
  }).join("");

  updateDeliveryPromotionGiftSelectedCount();
  syncDeliveryPromotionControlState();
}

function fillDeliveryPromotionSettings(settings = {}) {
  const promotion = normalizeDeliveryPromotion(settings);

  const freeShippingEnabled =
    document.querySelector("#deliveryFreeShippingEnabled");

  const minimumSubtotal =
    document.querySelector(
      "#deliveryFreeShippingMinimumSubtotal"
    );

  const freeGiftEnabled =
    document.querySelector("#deliveryFreeGiftEnabled");

  const maxSelectable =
    document.querySelector(
      "#deliveryFreeGiftMaxSelectableItems"
    );

  const validFrom =
    document.querySelector("#deliveryFreeGiftValidFrom");

  const validUntil =
    document.querySelector("#deliveryFreeGiftValidUntil");

  if (freeShippingEnabled) {
    freeShippingEnabled.checked =
      promotion.freeShipping.enabled;
  }

  if (minimumSubtotal) {
    minimumSubtotal.value =
      promotion.freeShipping.minimumSubtotal || 500;
  }

  if (freeGiftEnabled) {
    freeGiftEnabled.checked =
      promotion.freeGift.enabled;
  }

  if (maxSelectable) {
    maxSelectable.value =
      promotion.freeGift.maxSelectableItems;
  }

  if (validFrom) {
    validFrom.value =
      promotion.freeGift.validFrom;
  }

  if (validUntil) {
    validUntil.value =
      promotion.freeGift.validUntil;
  }

  renderDeliveryPromotionGiftMenus(settings);
}

function collectDeliveryPromotionSettings() {
  const minimumSubtotal = Math.max(
    0,
    Number(
      document.querySelector(
        "#deliveryFreeShippingMinimumSubtotal"
      )?.value || 0
    ) || 0
  );

  const maxSelectableItems = Math.min(
    20,
    Math.max(
      1,
      Number.parseInt(
        document.querySelector(
          "#deliveryFreeGiftMaxSelectableItems"
        )?.value || "1",
        10
      ) || 1
    )
  );

  const menuIds = [
    ...document.querySelectorAll(
      "[data-delivery-free-gift-menu]:checked"
    ),
  ]
    .map(element => String(element.value || "").trim())
    .filter(Boolean);

  return {
    freeShipping: {
      enabled:
        document.querySelector(
          "#deliveryFreeShippingEnabled"
        )?.checked === true,

      minimumSubtotal:
        Math.round(minimumSubtotal * 100) / 100,
    },

    freeGift: {
      enabled:
        document.querySelector(
          "#deliveryFreeGiftEnabled"
        )?.checked === true,

      maxSelectableItems,

      validFrom:
        document.querySelector(
          "#deliveryFreeGiftValidFrom"
        )?.value || "",

      validUntil:
        document.querySelector(
          "#deliveryFreeGiftValidUntil"
        )?.value || "",

      menuIds: [...new Set(menuIds)],
    },
  };
}


async function load() {
  const [menuData, tableData, settings] = await Promise.all([dataService.listMenus(), dataService.listTables(), dataService.getStoreSettings()]);
  menus = menuData;
  tables = tableData;
  document.querySelector("#shopName").value = settings.shopName || "";
  document.querySelector("#shopAddress").value = settings.shopAddress || "";
  document.querySelector("#shopPhone").value = settings.shopPhone || "";
  fillDeliveryPromotionSettings(settings);

  const savedStoreLocation = normalizeAdminStoreLocation(
    settings.storeLatitude,
    settings.storeLongitude,
  );

  renderAdminStoreLocation(savedStoreLocation);

  if (savedStoreLocation) {
    moveAdminStoreMarker(savedStoreLocation);
  }

  const deliveryProvider = document.querySelector("#deliveryProvider");
  if (deliveryProvider) {
    deliveryProvider.value =
      String(settings.deliveryProvider || "self") === "self"
        ? "self"
        : "self";
  }

  const maxDistanceInput =
    document.querySelector("#deliveryMaxDistanceKm");

  if (maxDistanceInput) {
    maxDistanceInput.value =
      Number(settings.deliveryMaxDistanceKm ?? 10) >= 0
        ? Number(settings.deliveryMaxDistanceKm ?? 10)
        : 10;
  }
  document.querySelector("#menuRows").innerHTML = menus.map(item => `
    <tr data-active="${item.active !== false}"><td><img src="${item.image || DEFAULT_FOOD_IMAGE}" alt="${item.name}" data-food-image style="width:58px;height:46px;object-fit:cover;object-position:${Number(item.imagePositionX ?? 50)}% ${Number(item.imagePositionY ?? 50)}%;border-radius:8px"></td><td><strong>${item.name}</strong></td><td>${item.category || "-"}</td><td>${money(item.price)}</td><td>${item.active !== false ? `<span class="badge">${t("admin.menu.active")}</span>` : `<span class="badge dark">${t("admin.menu.closed")}</span>`}</td><td><button class="btn btn-sm" data-edit-menu="${item.id}">${t("admin.common.edit")}</button> <button class="btn btn-danger btn-sm" data-delete-menu="${item.id}">${t("admin.common.delete")}</button></td></tr>
  `).join("");
  document.querySelector("#tableRows").innerHTML = tables.map(item => `
    <tr data-active="${item.active !== false}"><td><strong>${item.code}</strong></td><td>${item.name}</td><td><strong class="table-capacity">${Math.max(1, Number.parseInt(item.capacity ?? item.seats ?? item.seatCount ?? 4, 10) || 4)}</strong></td><td>${item.active !== false ? `<span class="badge">${t("admin.table.active")}</span>` : `<span class="badge dark">${t("admin.table.closed")}</span>`}</td><td><button class="btn btn-sm" data-edit-table="${item.id}">${t("admin.common.edit")}</button> <button class="btn btn-danger btn-sm" data-delete-table="${item.id}">${t("admin.common.delete")}</button></td></tr>
  `).join("");
}

async function loadWithRetry(attempts = 3) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await load();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 220 * (attempt + 1)));
      }
    }
  }
  throw lastError || new Error("ADMIN_LOAD_FAILED");
}

function collectStoreSettings() {
  const settings = {
    shopName: document.querySelector("#shopName").value.trim(),
    shopAddress: document.querySelector("#shopAddress").value.trim(),
    shopPhone: document.querySelector("#shopPhone").value.trim()
  };
  for (const fieldId of ["promptPayId", "promptPayName", "bankName", "bankAccountNumber", "bankAccountName"]) {
    settings[fieldId] = document.getElementById(fieldId)?.value.trim() || "";
  }
  const deliveryFeeOptions = [...document.querySelectorAll("[data-delivery-fee-row]")]
    .map((row, index) => ({
      id: row.dataset.optionId || `fee-${index + 1}`,
      label: row.querySelector("[data-delivery-fee-label]")?.value.trim() || "",
      fee: Math.max(0, Number(row.querySelector("[data-delivery-fee-amount]")?.value || 0))
    }))
    .filter(option => option.label);
  if (deliveryFeeOptions.length) {
    settings.deliveryFeeOptions = deliveryFeeOptions;
    settings.deliveryFeeNearby = deliveryFeeOptions[0]?.fee ?? 0;
    settings.deliveryFeeGeneral = deliveryFeeOptions[1]?.fee ?? 30;
    settings.deliveryFeeFar = deliveryFeeOptions[2]?.fee ?? 50;
  }
  // ADMIN_STORE_DELIVERY_PERSISTENCE_20260827_003
  const storeLatitudeValue = document.querySelector("#storeLatitude")?.value;
  const storeLongitudeValue = document.querySelector("#storeLongitude")?.value;

  const storeLatitude = Number(storeLatitudeValue);
  const storeLongitude = Number(storeLongitudeValue);

  if (
    storeLatitudeValue !== ""
    && storeLatitudeValue !== undefined
    && Number.isFinite(storeLatitude)
    && storeLatitude >= -90
    && storeLatitude <= 90
  ) {
    settings.storeLatitude = Number(storeLatitude.toFixed(7));
  } else {
    settings.storeLatitude = null;
  }

  if (
    storeLongitudeValue !== ""
    && storeLongitudeValue !== undefined
    && Number.isFinite(storeLongitude)
    && storeLongitude >= -180
    && storeLongitude <= 180
  ) {
    settings.storeLongitude = Number(storeLongitude.toFixed(7));
  } else {
    settings.storeLongitude = null;
  }

  settings.deliveryProvider =
    document.querySelector("#deliveryProvider")?.value || "self";

  const maxDistance = Number(
    document.querySelector("#deliveryMaxDistanceKm")?.value
  );

  settings.deliveryMaxDistanceKm =
    Number.isFinite(maxDistance) && maxDistance > 0
      ? Math.round(maxDistance * 100) / 100
      : 10;

  settings.deliveryPromotion =
    collectDeliveryPromotionSettings();

  return settings;
}

function storeSettingsMatch(expected, actual) {
  const expectedPromotion =
    normalizeDeliveryPromotion(expected);

  const actualPromotion =
    normalizeDeliveryPromotion(actual);

  if (
    JSON.stringify(actualPromotion)
    !== JSON.stringify(expectedPromotion)
  ) {
    return false;
  }

  const textFields = [
    "shopName",
    "shopAddress",
    "shopPhone",
    "promptPayId",
    "promptPayName",
    "bankName",
    "bankAccountNumber",
    "bankAccountName",
    "deliveryProvider"
  ];
  if (textFields.some(field => String(actual[field] ?? "") !== String(expected[field] ?? ""))) return false;

  const coordinateFields = [
    "storeLatitude",
    "storeLongitude",
    "deliveryMaxDistanceKm",
  ];

  if (
    coordinateFields.some(
      field =>
        Math.abs(
          Number(actual[field] ?? 0)
          - Number(expected[field] ?? 0),
        ) > 0.0000001,
    )
  ) {
    return false;
  }

  // ADMIN_STORE_DELIVERY_VERIFY_20260827_003
  const optionalNumberMatches = (expectedValue, actualValue, tolerance = 0.0000001) => {
    const expectedEmpty =
      expectedValue === null
      || expectedValue === undefined
      || expectedValue === "";

    const actualEmpty =
      actualValue === null
      || actualValue === undefined
      || actualValue === "";

    if (expectedEmpty || actualEmpty) {
      return expectedEmpty && actualEmpty;
    }

    const expectedNumber = Number(expectedValue);
    const actualNumber = Number(actualValue);

    return Number.isFinite(expectedNumber)
      && Number.isFinite(actualNumber)
      && Math.abs(expectedNumber - actualNumber) <= tolerance;
  };

  if (
    !optionalNumberMatches(
      expected.storeLatitude,
      actual.storeLatitude
    )
  ) return false;

  if (
    !optionalNumberMatches(
      expected.storeLongitude,
      actual.storeLongitude
    )
  ) return false;

  if (
    !optionalNumberMatches(
      expected.deliveryMaxDistanceKm,
      actual.deliveryMaxDistanceKm,
      0.0001
    )
  ) return false;

  if (
    String(actual.deliveryProvider || "self")
    !== String(expected.deliveryProvider || "self")
  ) return false;

  const expectedFees = (expected.deliveryFeeOptions || []).map(option => ({
    id: String(option.id || ""),
    label: String(option.label || ""),
    fee: Number(option.fee || 0)
  }));
  const actualFees = (actual.deliveryFeeOptions || []).map(option => ({
    id: String(option.id || ""),
    label: String(option.label || ""),
    fee: Number(option.fee || 0)
  }));
  return JSON.stringify(actualFees) === JSON.stringify(expectedFees);
}


document
  .querySelector("#deliveryFreeShippingEnabled")
  ?.addEventListener(
    "change",
    syncDeliveryPromotionControlState
  );

document
  .querySelector("#deliveryFreeGiftEnabled")
  ?.addEventListener(
    "change",
    syncDeliveryPromotionControlState
  );

document
  .querySelector("#deliveryFreeGiftMenuList")
  ?.addEventListener("change", event => {
    if (
      event.target.matches(
        "[data-delivery-free-gift-menu]"
      )
    ) {
      updateDeliveryPromotionGiftSelectedCount();
    }
  });

document.querySelector("#storeForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter || event.target.querySelector('button[type="submit"], button:not([type])');
  if (button) button.disabled = true;
  try {
    const settings = collectStoreSettings();
    const savedSettings = await dataService.saveStoreProfile(settings);
    if (!storeSettingsMatch(settings, savedSettings)) throw new Error("STORE_SETTINGS_VERIFICATION_FAILED");
    toast(t("admin.store.save_success"));
  } catch (error) {
    console.error("Unable to save store settings", error);
    toast(t("admin.store.save_failed"), "error");
  } finally {
    if (button) button.disabled = false;
  }
});

fileInput.addEventListener("change", event => { const file = event.target.files?.[0]; if (file) selectImageFile(file); });
for (const eventName of ["dragenter", "dragover"]) dropzone.addEventListener(eventName, event => { event.preventDefault(); dropzone.classList.add("is-dragover"); });
for (const eventName of ["dragleave", "drop"]) dropzone.addEventListener(eventName, event => { event.preventDefault(); dropzone.classList.remove("is-dragover"); });
dropzone.addEventListener("drop", event => { const file = event.dataTransfer?.files?.[0]; if (file) selectImageFile(file); });
removeImageButton.addEventListener("click", () => {
  selectedImageFile = null;
  menuImage.value = "";
  menuImagePath.value = "";
  fileInput.value = "";
  setImageError("");
  setMenuImagePosition(50, 50);
  showPreview("");
});

document.querySelector("#menuForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = document.querySelector("#saveMenuButton");
  button.disabled = true;
  button.textContent = selectedImageFile ? t("admin.menu.saving_upload") : t("admin.menu.saving");
  setImageError("");
  try {
    const id = document.querySelector("#menuId").value || crypto.randomUUID();
    let image = menuImage.value;
    let imagePath = menuImagePath.value;
    if (selectedImageFile) {
      const uploaded = await uploadMenuImage(selectedImageFile, id);
      image = uploaded.url;
      imagePath = uploaded.path;
    }
    await dataService.saveMenu({ id, name: document.querySelector("#menuName").value.trim(), category: document.querySelector("#menuCategory").value.trim(), price: Number(document.querySelector("#menuPrice").value), image, imagePath, ...getMenuImagePosition(), active: document.querySelector("#menuActive").checked });
    event.target.reset();
    document.querySelector("#menuId").value = "";
    menuImage.value = "";
    menuImagePath.value = "";
    document.querySelector("#menuActive").checked = true;
    selectedImageFile = null;
    setMenuImagePosition(50, 50);
    showPreview("");
    toast(t("admin.menu.saved"));
    await loadWithRetry();
  } catch (error) {
    console.error(error);
    let message = t("admin.menu.save_failed");
    if (error.message === "IMAGE_TOO_LARGE") message = t("admin.menu.image_too_large");
    if (error.message === "INVALID_IMAGE_TYPE") message = t("admin.menu.image_type_unsupported");
    if (["IMAGE_DECODE_FAILED", "IMAGE_CONVERT_FAILED"].includes(error.message)) message = t("admin.menu.image_decode_failed");
    if (error.status === 413) message = t("admin.menu.image_server_too_large");
    if (error.status === 422 || error.code === "IMAGE_UPLOAD_FAILED") message = t("admin.menu.image_upload_failed");
    setImageError(message);
    toast(message, "error");
  } finally {
    button.disabled = false;
    button.textContent = t("admin.menu.save");
  }
});

document.querySelector("#tableCapacity")?.addEventListener("input", event => {
  event.currentTarget.setCustomValidity("");
});

document.querySelector("#tableForm").addEventListener("submit", async event => {
  event.preventDefault();
  const code = document.querySelector("#tableCode").value.trim().toUpperCase();
  const capacityInput = document.querySelector("#tableCapacity");
  const capacity = Number.parseInt(capacityInput.value, 10);
  capacityInput.setCustomValidity("");
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) {
    capacityInput.setCustomValidity(t("admin.table.capacity_invalid"));
    capacityInput.reportValidity();
    return;
  }
  await dataService.saveTable({ id: document.querySelector("#tableId").value || code, code, name: document.querySelector("#tableName").value.trim(), capacity, active: document.querySelector("#tableActive").checked });
  event.target.reset();
  document.querySelector("#tableCapacity").value = "4";
  document.querySelector("#tableActive").checked = true;
  toast(t("admin.table.saved"));
  await loadWithRetry();
});

document.body.addEventListener("click", event => {
  const addButton = event.target.closest("[data-open-admin-modal]");
  if (!addButton) return;
  if (addButton.dataset.openAdminModal === "menu") {
    const form = document.querySelector("#menuForm");
    form.reset();
    resetValidationState(form);
    document.querySelector("#menuId").value = "";
    menuImage.value = "";
    menuImagePath.value = "";
    selectedImageFile = null;
    fileInput.value = "";
    setImageError("");
    setMenuImagePosition(50, 50);
    showPreview("");
  }
  if (addButton.dataset.openAdminModal === "table") {
    const form = document.querySelector("#tableForm");
    form.reset();
    resetValidationState(form);
    document.querySelector("#tableId").value = "";
    document.querySelector("#tableCapacity").value = "4";
    document.querySelector("#tableActive").checked = true;
  }
});

document.body.addEventListener("click", async event => {
  const editMenu = event.target.closest("[data-edit-menu]")?.dataset.editMenu;
  const deleteMenu = event.target.closest("[data-delete-menu]")?.dataset.deleteMenu;
  const editTable = event.target.closest("[data-edit-table]")?.dataset.editTable;
  const deleteTable = event.target.closest("[data-delete-table]")?.dataset.deleteTable;
  if (editMenu) {
    const item = menus.find(row => row.id === editMenu);
    document.querySelector("#menuId").value = item.id;
    document.querySelector("#menuName").value = item.name;
    document.querySelector("#menuCategory").value = item.category || "";
    document.querySelector("#menuPrice").value = item.price;
    menuImage.value = item.image && item.image !== DEFAULT_FOOD_IMAGE ? item.image : "";
    menuImagePath.value = item.imagePath || "";
    document.querySelector("#menuActive").checked = item.active !== false;
    selectedImageFile = null;
    fileInput.value = "";
    setImageError("");
    setMenuImagePosition(item.imagePositionX ?? 50, item.imagePositionY ?? 50);
    showPreview(item.image || DEFAULT_FOOD_IMAGE, t("admin.menu.existing_image"), "");
    resetValidationState(document.querySelector("#menuForm"), { validateValues: true });
  }
  if (deleteMenu) {
    const ok = await askConfirm(t("admin.menu.delete_confirm"), { title: t("admin.menu.delete_title"), confirmText: t("admin.common.confirm"), cancelText: t("admin.common.cancel"), type: "warning" });
    if (ok) { await dataService.deleteMenu(deleteMenu); toast(t("admin.menu.deleted")); await loadWithRetry(); }
  }
  if (editTable) {
    const item = tables.find(row => row.id === editTable);
    document.querySelector("#tableId").value = item.id;
    document.querySelector("#tableCode").value = item.code;
    document.querySelector("#tableName").value = item.name;
    document.querySelector("#tableCapacity").value = Math.max(1, Number.parseInt(item.capacity ?? item.seats ?? item.seatCount ?? 4, 10) || 4);
    document.querySelector("#tableActive").checked = item.active !== false;
    resetValidationState(document.querySelector("#tableForm"), { validateValues: true });
  }
  if (deleteTable) {
    const ok = await askConfirm(t("admin.table.delete_confirm"), { title: t("admin.table.delete_title"), confirmText: t("admin.common.confirm"), cancelText: t("admin.common.cancel"), type: "warning" });
    if (ok) { await dataService.deleteTable(deleteTable); toast(t("admin.table.deleted")); await loadWithRetry(); }
  }
});

setMenuImagePosition(50, 50);
showPreview("");
initAdminStoreLocationMap();
await loadWithRetry();
