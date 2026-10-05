import "./public-page-static-i18n.js?v=20261001-003";

await import("./public-tenant-resolver.js?v=20261003-010");

import { publicStorefrontService as dataService } from './public-storefront-service.js?v=20261005-131';
import { customerFunctions as functions } from "./public-firebase-context.js?v=20261002-001";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-functions.js";
import { money, toast } from "./ui.js?v=20260930-001";
import { t } from "./i18n.js?v=20261001-003";
import { generatePromptPayPayload } from "./promptpay.js";
import { qrDataUrl } from "./local-qr.js?v=20260722-036";
import "./cart-item-layout.js?v=20260702-002";
import {
  watchCustomerAuth,
  getCustomerFavorites,
  saveCustomerFavorites,
} from "./customer-profile-service.js?v=20261002-008";

const menuGrid = document.querySelector("#menuGrid");
const deliveryHeroStoreName = document.querySelector("#deliveryHeroStoreName");
const cartList = document.querySelector("#cartList");
const categoryTabs = document.querySelector("#categoryTabs");
const paymentMethod = document.querySelector("#paymentMethod");
const deliveryZone = document.querySelector("#deliveryZone");
const promptPaySection = document.querySelector("#promptPaySection");
const promptPayQr = document.querySelector("#promptPayQr");
const promptPayPlaceholder = document.querySelector("#promptPayPlaceholder");
const promptPayAmount = document.querySelector("#promptPayAmount");
const promptPayName = document.querySelector("#promptPayName");
const paymentSlipWrap = document.querySelector("#paymentSlipWrap");
const paymentSlip = document.querySelector("#paymentSlip");
const paymentSlipDropzone = document.querySelector("#paymentSlipDropzone");
const paymentSlipContent = document.querySelector("#paymentSlipContent");
const paymentSlipPreviewWrap = document.querySelector("#paymentSlipPreviewWrap");
const paymentSlipPreview = document.querySelector("#paymentSlipPreview");
const paymentSlipFileName = document.querySelector("#paymentSlipFileName");
const paymentSlipFileSize = document.querySelector("#paymentSlipFileSize");
const paymentSlipError = document.querySelector("#paymentSlipError");
const removePaymentSlip = document.querySelector("#removePaymentSlip");
const submitOrderButton = document.querySelector("#submitOrder");
const deliveryFreeGiftSection =
  document.querySelector("#deliveryFreeGiftSection");
const deliveryFreeGiftList =
  document.querySelector("#deliveryFreeGiftList");
const deliveryFreeGiftCounter =
  document.querySelector("#deliveryFreeGiftCounter");
const deliveryFreeGiftPeriod =
  document.querySelector("#deliveryFreeGiftPeriod");
const deliveryFreeGiftStatus =
  document.querySelector("#deliveryFreeGiftStatus");
const deliveryFreeShippingStatus =
  document.querySelector("#deliveryFreeShippingStatus");
const cart = new Map();
let menus = [];
let activeCategory = t("delivery.checkout.menu.all");
let storeSettings = {};
let currentSubtotal = 0;
let currentDeliveryFee = 0;
let currentTotal = 0;
let selectedSlipFile = null;
let selectedSlipObjectUrl = "";
let isSubmitting = false;
let currentDeliveryBaseFee = 0;
let freeShippingApplied = false;
let selectedFreeGiftMenuIds = new Set();
let favoriteMenuIds = new Set();
let currentFavoriteUser = null;

function renderDeliveryStoreHero(settings = {}) {
  if (!deliveryHeroStoreName) return;
  const translatedFallback = t("shared.store.fallback_name");
  const fallback = translatedFallback && translatedFallback !== "shared.store.fallback_name"
    ? translatedFallback
    : "ร้านอาหาร";
  deliveryHeroStoreName.textContent = dataService.getOrderDeliveryShopName(settings) || fallback;
}

renderDeliveryStoreHero();

// DELIVERY_GOOGLE_ROUTE_ENGINE_20260903_001
const deliveryDistanceStatus = document.querySelector("#deliveryDistanceStatus");
const computeDeliveryRoute = httpsCallable(functions, "computeDeliveryRoute");
let currentDeliveryDistanceKm = null;
let currentDeliveryRoute = null;
let deliveryRouteRequestSerial = 0;
let deliveryRoutePromise = Promise.resolve(null);
let currentLalamoveQuotation = null;
let currentLalamoveQuoteLocation = null;
let currentLalamoveQuotePaymentMethod = "";
let currentLalamoveQuoteError = "";
let deliveryDistancePending = false;

const DELIVERY_FEE_MODE_AUTOMATIC = "automatic";
const DELIVERY_FEE_MODE_MANUAL_FALLBACK = "manual-fallback";


async function askConfirm(message, options = {}) {
  if (typeof window.sweetConfirm === "function") return await window.sweetConfirm(message, options);
  return confirm(message);
}

function createOrderId() {
  return dataService.prepareOrderId("delivery");
}

function validCoordinate(value, min, max) {
  if (value === null || value === undefined || value === "") return false;

  const number = Number(value);

  return Number.isFinite(number)
    && number >= min
    && number <= max;
}

function storeLocation() {
  if (
    !validCoordinate(storeSettings.storeLatitude, -90, 90)
    || !validCoordinate(storeSettings.storeLongitude, -180, 180)
  ) {
    return null;
  }

  return {
    latitude: Number(storeSettings.storeLatitude),
    longitude: Number(storeSettings.storeLongitude),
  };
}

function customerDeliveryLocation() {
  const location = window.deliveryLocation?.get?.() || null;

  if (
    !location
    || !validCoordinate(location.latitude, -90, 90)
    || !validCoordinate(location.longitude, -180, 180)
  ) {
    return null;
  }

  return {
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
  };
}

function usesLalamove() {
  return String(storeSettings.deliveryProvider || "self").toLowerCase() === "lalamove";
}

function lalamoveZone() {
  if (!currentLalamoveQuotation?.quotationId) return null;
  const fee = Number(currentLalamoveQuotation.fee);
  if (!Number.isFinite(fee) || fee < 0) return null;
  return { id: "lalamove", label: "Lalamove", fee };
}

function lalamoveQuotationFreshFor(location) {
  if (!currentLalamoveQuotation?.quotationId || !currentLalamoveQuoteLocation || !location) return false;
  const currentPaymentMethod = String(paymentMethod?.value || "").toLowerCase();
  if (currentLalamoveQuotePaymentMethod !== currentPaymentMethod) return false;
  const expiresAt = Date.parse(String(currentLalamoveQuotation.expiresAt || ""));
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() + 15000) return false;
  const latitudeDelta = Math.abs(Number(location.latitude) - Number(currentLalamoveQuoteLocation.latitude));
  const longitudeDelta = Math.abs(Number(location.longitude) - Number(currentLalamoveQuoteLocation.longitude));
  return latitudeDelta <= 0.00001 && longitudeDelta <= 0.00001;
}

function radians(degrees) {
  return degrees * Math.PI / 180;
}

function haversineDistanceKm(from, to) {
  if (!from || !to) return null;
  const earthRadiusKm = 6371.0088;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const latitude1 = radians(from.latitude);
  const latitude2 = radians(to.latitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)));
}

function setDeliveryFeeMode(mode) {
  if (!deliveryZone) return;

  const normalized = mode === DELIVERY_FEE_MODE_MANUAL_FALLBACK
    ? DELIVERY_FEE_MODE_MANUAL_FALLBACK
    : DELIVERY_FEE_MODE_AUTOMATIC;
  const changed = deliveryZone.dataset.deliveryFeeMode !== normalized;

  deliveryZone.dataset.deliveryFeeMode = normalized;
  deliveryZone.disabled =
    document.body.classList.contains("delivery-payment-locked")
    || normalized !== DELIVERY_FEE_MODE_MANUAL_FALLBACK;

  if (changed) {
    document.dispatchEvent(new CustomEvent("delivery-fee-mode-changed", {
      detail: { mode: normalized },
    }));
  }
}

function manualDeliveryFeeFallbackAllowed() {
  if (usesLalamove()) return false;
  return currentDeliveryDistanceKm === null
    && deliveryZone?.dataset.deliveryFeeMode === DELIVERY_FEE_MODE_MANUAL_FALLBACK;
}

function storefrontSlug() {
  const match = location.pathname.match(/^\/s\/([^/]+)/i);
  return decodeURIComponent(match?.[1] || dataService.getActiveShop()?.slug || "").trim().toLowerCase();
}

function configuredMaxDeliveryDistanceKm() {
  const value = Number(storeSettings.deliveryMaxDistanceKm);

  return Number.isFinite(value) && value > 0
    ? value
    : null;
}

function deliveryZoneForDistance(distanceKm) {
  if (usesLalamove()) return lalamoveZone();
  if (distanceKm === null || distanceKm === undefined || distanceKm === "") {
    return null;
  }

  const distance = Number(distanceKm);
  if (!Number.isFinite(distance) || distance < 0) return null;

  const maxDistance = configuredMaxDeliveryDistanceKm();
  if (maxDistance !== null && distance > maxDistance) return null;

  return deliveryZones()
    .filter(zone => zone.id !== "pickup" && Number.isFinite(zone.maxDistanceKm))
    .sort((left, right) => left.maxDistanceKm - right.maxDistanceKm)
    .find(zone => distance <= zone.maxDistanceKm + 1e-9) || null;
}

function syncDeliveryZoneFromDistance() {
  if (!deliveryZone) {
    return null;
  }

  if (usesLalamove()) {
    setDeliveryFeeMode(DELIVERY_FEE_MODE_AUTOMATIC);
    const zone = lalamoveZone();
    deliveryZone.value = zone?.id || "";
    updateCart();
    return zone;
  }

  if (currentDeliveryDistanceKm === null) {
    setDeliveryFeeMode(DELIVERY_FEE_MODE_MANUAL_FALLBACK);

    const manualZones = deliveryZones().filter(zone => zone.id !== "pickup");
    if (!manualZones.some(zone => zone.id === deliveryZone.value)) {
      deliveryZone.value = manualZones[0]?.id || "";
    }

    updateCart();
    return null;
  }

  setDeliveryFeeMode(DELIVERY_FEE_MODE_AUTOMATIC);

  const zone = deliveryZoneForDistance(
    currentDeliveryDistanceKm
  );

  if (!zone) {
    updateCart();
    return null;
  }

  deliveryZone.value = zone.id;
  updateCart();
  return zone;
}

function lalamoveQuoteErrorMessage(errorText = currentLalamoveQuoteError) {
  const detail = String(errorText || "");
  if (detail.includes("ERR_OUT_OF_SERVICE_AREA")) {
    return t("delivery.checkout.distance.lalamove_out_of_service_area");
  }
  if (detail.includes("LALAMOVE_COD_UNAVAILABLE")) {
    return t("delivery.checkout.distance.lalamove_cod_unavailable");
  }
  return t("delivery.checkout.distance.lalamove_unavailable");
}

function renderDeliveryDistanceStatus() {
  if (!deliveryDistanceStatus) return;
  const from = storeLocation();
  const to = customerDeliveryLocation();
  if (!from) {
    deliveryDistanceStatus.hidden = false;
    deliveryDistanceStatus.classList.remove("is-ready");
    deliveryDistanceStatus.classList.add("is-error");
    deliveryDistanceStatus.textContent = t("delivery.checkout.distance.store_location_missing");
    return;
  }
  if (!to) {
    deliveryDistanceStatus.hidden = true;
    deliveryDistanceStatus.textContent = "";
    deliveryDistanceStatus.classList.remove("is-ready", "is-error");
    return;
  }

  if (usesLalamove()) {
    deliveryDistanceStatus.hidden = false;
    if (deliveryDistancePending) {
      deliveryDistanceStatus.classList.remove("is-ready", "is-error");
      deliveryDistanceStatus.textContent = t("delivery.checkout.distance.lalamove_loading");
      return;
    }
    if (!lalamoveZone() || currentDeliveryDistanceKm === null) {
      deliveryDistanceStatus.classList.remove("is-ready");
      deliveryDistanceStatus.classList.add("is-error");
      deliveryDistanceStatus.textContent = lalamoveQuoteErrorMessage();
      return;
    }
    const maxDistance = configuredMaxDeliveryDistanceKm();
    if (maxDistance !== null && currentDeliveryDistanceKm > maxDistance) {
      deliveryDistanceStatus.classList.remove("is-ready");
      deliveryDistanceStatus.classList.add("is-error");
      deliveryDistanceStatus.textContent = t("delivery.checkout.distance.out_of_range", {
        distance: currentDeliveryDistanceKm.toFixed(2),
        max: maxDistance.toFixed(2),
      });
      return;
    }
    deliveryDistanceStatus.classList.remove("is-error");
    deliveryDistanceStatus.classList.add("is-ready");
    deliveryDistanceStatus.textContent = t("delivery.checkout.distance.lalamove_ready", {
      distance: currentDeliveryDistanceKm.toFixed(2),
      fee: money(lalamoveZone().fee),
    });
    return;
  }

  if (!currentDeliveryRoute) return;
  const maxDistance = Number(currentDeliveryRoute.maxDistanceKm || configuredMaxDeliveryDistanceKm() || 0) || null;
  deliveryDistanceStatus.hidden = false;
  if (currentDeliveryRoute.inRange !== true) {
    deliveryDistanceStatus.classList.remove("is-ready");
    deliveryDistanceStatus.classList.add("is-error");
    deliveryDistanceStatus.textContent = maxDistance
      ? t("delivery.checkout.distance.out_of_range", { distance: currentDeliveryDistanceKm.toFixed(2), max: maxDistance.toFixed(2) })
      : t("delivery.checkout.distance.fee_rule_missing");
    return;
  }
  deliveryDistanceStatus.classList.remove("is-error");
  deliveryDistanceStatus.classList.add("is-ready");
  deliveryDistanceStatus.textContent = maxDistance
    ? t("delivery.checkout.distance.ready_with_limit", { distance: currentDeliveryDistanceKm.toFixed(2), max: maxDistance.toFixed(2) })
    : t("delivery.checkout.distance.ready", { distance: currentDeliveryDistanceKm.toFixed(2) });
}

function refreshDeliveryDistance() {
  const from = storeLocation();
  const to = customerDeliveryLocation();
  const requestSerial = ++deliveryRouteRequestSerial;
  currentDeliveryRoute = null;

  if (!from) {
    currentDeliveryDistanceKm = null;
    currentLalamoveQuotation = null;
    currentLalamoveQuoteLocation = null;
    currentLalamoveQuoteError = "";
    deliveryDistancePending = false;
    syncDeliveryZoneFromDistance();
    renderDeliveryDistanceStatus();
    deliveryRoutePromise = Promise.resolve(null);
    return deliveryRoutePromise;
  }
  if (!to) {
    currentDeliveryDistanceKm = null;
    currentLalamoveQuotation = null;
    currentLalamoveQuoteLocation = null;
    currentLalamoveQuoteError = "";
    deliveryDistancePending = false;
    setDeliveryFeeMode(DELIVERY_FEE_MODE_AUTOMATIC);
    if (deliveryZone) deliveryZone.value = "";
    updateCart();
    renderDeliveryDistanceStatus();
    deliveryRoutePromise = Promise.resolve(null);
    return deliveryRoutePromise;
  }

  if (usesLalamove()) {
    if (lalamoveQuotationFreshFor(to)) {
      const quotedDistance = Number(currentLalamoveQuotation?.distanceKm);
      currentDeliveryDistanceKm = Number.isFinite(quotedDistance) && quotedDistance >= 0
        ? quotedDistance
        : haversineDistanceKm(from, to);
      deliveryDistancePending = false;
      renderDeliveryZones();
      syncDeliveryZoneFromDistance();
      renderDeliveryDistanceStatus();
      deliveryRoutePromise = Promise.resolve(currentLalamoveQuotation);
      return deliveryRoutePromise;
    }

    currentLalamoveQuotation = null;
    currentLalamoveQuoteLocation = null;
    currentLalamoveQuoteError = "";
    currentDeliveryDistanceKm = null;
    deliveryDistancePending = true;
    renderDeliveryZones();
    syncDeliveryZoneFromDistance();
    renderDeliveryDistanceStatus();

    const address = document.querySelector("#deliveryAddress")?.value.trim() || "";
    const quotePaymentMethod = String(paymentMethod?.value || "").toLowerCase();
    deliveryRoutePromise = dataService.getLalamoveQuotation(to, address, quotePaymentMethod)
      .then(response => {
        if (requestSerial !== deliveryRouteRequestSerial) return null;
        const quotation = response?.item || null;
        const fee = Number(quotation?.fee);
        if (!quotation?.quotationId || !Number.isFinite(fee) || fee < 0) {
          throw new Error("LALAMOVE_QUOTATION_INVALID");
        }
        currentLalamoveQuotation = quotation;
        currentLalamoveQuoteLocation = {
          latitude: Number(to.latitude),
          longitude: Number(to.longitude),
        };
        currentLalamoveQuotePaymentMethod = quotePaymentMethod;
        currentLalamoveQuoteError = "";
        const quotedDistance = Number(quotation.distanceKm);
        currentDeliveryDistanceKm = Number.isFinite(quotedDistance) && quotedDistance >= 0
          ? quotedDistance
          : haversineDistanceKm(from, to);
        deliveryDistancePending = false;
        renderDeliveryZones();
        syncDeliveryZoneFromDistance();
        renderDeliveryDistanceStatus();
        return quotation;
      })
      .catch(error => {
        if (requestSerial !== deliveryRouteRequestSerial) return null;
        console.warn("[lalamove-quotation] quotation unavailable", error);
        currentLalamoveQuotation = null;
        currentLalamoveQuoteLocation = null;
        currentLalamoveQuoteError = String(
          error?.details?.providerError
          || error?.serverResponse?.providerError
          || error?.code
          || error?.message
          || ""
        );
        currentDeliveryDistanceKm = null;
        deliveryDistancePending = false;
        renderDeliveryZones();
        syncDeliveryZoneFromDistance();
        renderDeliveryDistanceStatus();
        return null;
      });
    return deliveryRoutePromise;
  }

  currentLalamoveQuotation = null;
  currentLalamoveQuoteLocation = null;
  currentLalamoveQuoteError = "";
  currentDeliveryDistanceKm = null;
  deliveryDistancePending = true;
  setDeliveryFeeMode(DELIVERY_FEE_MODE_AUTOMATIC);
  if (deliveryZone) deliveryZone.value = "";
  updateCart();
  if (deliveryDistanceStatus) {
    deliveryDistanceStatus.hidden = false;
    deliveryDistanceStatus.classList.remove("is-ready", "is-error");
    deliveryDistanceStatus.textContent = t("delivery.checkout.distance.calculating");
  }

  deliveryRoutePromise = computeDeliveryRoute({
    slug: storefrontSlug(),
    latitude: to.latitude,
    longitude: to.longitude,
  }).then(response => {
    if (requestSerial !== deliveryRouteRequestSerial) return null;
    const route = response.data || null;
    const distance = Number(route?.distanceKm);
    if (!route || !Number.isFinite(distance) || distance <= 0) throw new Error("GOOGLE_ROUTE_INVALID");
    currentDeliveryRoute = route;
    currentDeliveryDistanceKm = distance;
    deliveryDistancePending = false;
    if (route.zone?.id && deliveryZone?.querySelector(`option[value="${CSS.escape(String(route.zone.id))}"]`)) {
      deliveryZone.value = String(route.zone.id);
    }
    updateCart();
    renderDeliveryDistanceStatus();
    return route;
  }).catch(error => {
    if (requestSerial !== deliveryRouteRequestSerial) return null;
    console.error("[delivery-route] Google Routes failed", error);
    currentDeliveryRoute = null;
    currentDeliveryDistanceKm = null;
    deliveryDistancePending = false;
    if (deliveryZone) deliveryZone.value = "";
    updateCart();
    if (deliveryDistanceStatus) {
      deliveryDistanceStatus.hidden = false;
      deliveryDistanceStatus.classList.remove("is-ready");
      deliveryDistanceStatus.classList.add("is-error");
      deliveryDistanceStatus.textContent = t("delivery.checkout.distance.route_failed");
    }
    return null;
  });
  return deliveryRoutePromise;
}

function deliveryDistanceAllowed() {
  if (deliveryDistancePending) return false;
  if (usesLalamove()) {
    if (!lalamoveZone() || currentDeliveryDistanceKm === null) return false;
    const maxDistance = configuredMaxDeliveryDistanceKm();
    return maxDistance === null || currentDeliveryDistanceKm <= maxDistance;
  }
  if (currentDeliveryDistanceKm === null) {
    return manualDeliveryFeeFallbackAllowed() && Boolean(selectedZone());
  }
  return currentDeliveryRoute?.inRange === true && Boolean(currentDeliveryRoute?.zone?.id);
}

function menuImagePositionStyle(item = {}) {
  const clamp = value => Math.max(0, Math.min(100, Number.isFinite(Number(value)) ? Number(value) : 50));
  return `object-position:50% ${clamp(item.imagePositionY)}% !important`;
}

function favoriteCategoryLabel() {
  return t("delivery.checkout.menu.favorites");
}

function visibleFavoriteCount() {
  return menus.filter(item => item.active !== false && favoriteMenuIds.has(String(item.id))).length;
}

function categories() {
  const all = t("delivery.checkout.menu.all");
  const favorites = visibleFavoriteCount() ? [favoriteCategoryLabel()] : [];
  return [all, ...favorites, ...new Set(menus.filter(item => item.active !== false).map(item => item.category || t("delivery.checkout.menu.other")))];
}

function renderTabs() {
  categoryTabs.innerHTML = categories().map(category => `<button type="button" class="category-tab${category === activeCategory ? " active" : ""}" data-category="${category}">${category}</button>`).join("");
}

function renderMenus() {
  const keyword = document.querySelector("#searchInput").value.trim().toLowerCase();
  const allCategory = t("delivery.checkout.menu.all");
  const favoriteCategory = favoriteCategoryLabel();
  const otherCategory = t("delivery.checkout.menu.other");
  const filtered = menus.filter(item => {
    if (item.active === false) return false;
    if (keyword && !String(item.name || "").toLowerCase().includes(keyword)) return false;
    if (activeCategory === allCategory) return true;
    if (activeCategory === favoriteCategory) return favoriteMenuIds.has(String(item.id));
    return (item.category || otherCategory) === activeCategory;
  });
  menuGrid.innerHTML = filtered.length
    ? filtered.map(item => {
      const favorite = favoriteMenuIds.has(String(item.id));
      const favoriteLabel = favorite ? t("delivery.checkout.menu.favorite_remove") : t("delivery.checkout.menu.favorite_add");
      return `<article class="card menu-card"><div class="menu-image"><img src="${item.image}" alt="${item.name}" data-image-position-x="50" data-image-position-y="${Number(item.imagePositionY ?? 50)}" style="${menuImagePositionStyle(item)}"><button type="button" class="menu-favorite-button${favorite ? " is-favorite" : ""}" data-favorite="${item.id}" aria-pressed="${favorite}" aria-label="${favoriteLabel}" title="${favoriteLabel}"><i class="bi bi-heart${favorite ? "-fill" : ""}" aria-hidden="true"></i></button></div><div class="menu-name">${item.name}</div><div class="menu-category">${item.category || otherCategory}</div><div class="menu-footer"><span class="price">${money(item.price)} ${t("delivery.checkout.units.baht")}</span><button type="button" class="btn btn-primary btn-sm menu-add-button" data-add="${item.id}" aria-label="${t("delivery.checkout.menu.add")}" title="${t("delivery.checkout.menu.add")}"><i class="bi bi-plus-lg" aria-hidden="true"></i></button></div></article>`;
    }).join("")
    : `<div class="card empty">${t("delivery.checkout.menu.not_found")}</div>`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}


// DELIVERY_PROMOTION_CHECKOUT_20260827_001

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
          0,
          Number.parseInt(
            freeGift.maxSelectableItems || 0,
            10
          ) || 0
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

function localDateString() {
  const now = new Date();

  const year = String(now.getFullYear()).padStart(4, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatPromotionDate(value = "") {
  const match = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) return "";

  return `${match[3]}/${match[2]}/${match[1]}`;
}

function freeGiftPromotionActive() {
  const config =
    normalizeDeliveryPromotion(storeSettings).freeGift;

  if (
    !config.enabled
    || config.maxSelectableItems < 1
    || !config.menuIds.length
  ) {
    return false;
  }

  const today = localDateString();

  if (
    config.validFrom
    && today < config.validFrom
  ) {
    return false;
  }

  if (
    config.validUntil
    && today > config.validUntil
  ) {
    return false;
  }

  return true;
}

function availableFreeGiftMenus() {
  const config =
    normalizeDeliveryPromotion(storeSettings).freeGift;

  const allowed = new Set(config.menuIds);

  return menus.filter(
    menu =>
      menu?.active !== false
      && allowed.has(String(menu.id || ""))
  );
}

function freeGiftSelectionRequired() {
  return freeGiftPromotionActive()
    && availableFreeGiftMenus().length > 0;
}

function missingRequiredFreeGiftSelection() {
  return freeGiftSelectionRequired()
    && selectedFreeGiftMenuIds.size < 1;
}

function renderDeliveryFreeGiftPromotion() {
  if (
    !deliveryFreeGiftSection
    || !deliveryFreeGiftList
  ) {
    return;
  }

  if (!freeGiftPromotionActive()) {
    selectedFreeGiftMenuIds.clear();
    deliveryFreeGiftSection.hidden = true;
    return;
  }

  const config =
    normalizeDeliveryPromotion(storeSettings).freeGift;

  const giftMenus = availableFreeGiftMenus();

  deliveryFreeGiftSection.hidden = false;

  if (deliveryFreeGiftCounter) {
    deliveryFreeGiftCounter.textContent =
      `${selectedFreeGiftMenuIds.size} / ${config.maxSelectableItems}`;
  }

  if (deliveryFreeGiftPeriod) {
    const from = formatPromotionDate(config.validFrom);
    const until = formatPromotionDate(config.validUntil);

    if (from && until) {
      deliveryFreeGiftPeriod.textContent =
        t(
          "delivery.checkout.promotion.gift_period_range",
          { from, until }
        );
    } else if (until) {
      deliveryFreeGiftPeriod.textContent =
        t(
          "delivery.checkout.promotion.gift_period",
          { date: until }
        );
    } else {
      deliveryFreeGiftPeriod.textContent = "";
    }
  }

  if (!giftMenus.length) {
    selectedFreeGiftMenuIds.clear();

    deliveryFreeGiftList.innerHTML =
      `<div class="delivery-free-gift-empty">${
        t("delivery.checkout.promotion.gift_empty")
      }</div>`;

    if (deliveryFreeGiftStatus) {
      deliveryFreeGiftStatus.textContent = "";
    }

    return;
  }

  /*
   * Remove selections that are no longer available.
   */
  const availableIds =
    new Set(giftMenus.map(menu => String(menu.id)));

  selectedFreeGiftMenuIds =
    new Set(
      [...selectedFreeGiftMenuIds]
        .filter(id => availableIds.has(id))
        .slice(0, config.maxSelectableItems)
    );

  const selectionLimitReached =
    selectedFreeGiftMenuIds.size
    >= config.maxSelectableItems;

  deliveryFreeGiftList.innerHTML =
    giftMenus.map(menu => {
      const id = String(menu.id || "");

      const selected =
        selectedFreeGiftMenuIds.has(id);

      const limitReached =
        selectionLimitReached && !selected;

      return `
        <label
          class="delivery-free-gift-item${
            selected ? " is-selected" : ""
          }${
            limitReached
              ? " is-limit-reached"
              : ""
          }"
        >
          <input
            type="checkbox"
            data-delivery-free-gift-input="${escapeHtml(id)}"
            value="${escapeHtml(id)}"
            ${selected ? "checked" : ""}
            ${limitReached ? "disabled" : ""}
          >

          <span class="delivery-free-gift-item-content">
            <strong>${escapeHtml(menu.name || "-")}</strong>
            <small>${escapeHtml(
              menu.category
              || t("delivery.checkout.menu.other")
            )}</small>
          </span>
        </label>
      `;
    }).join("");

  if (deliveryFreeGiftCounter) {
    deliveryFreeGiftCounter.textContent =
      `${selectedFreeGiftMenuIds.size} / ${config.maxSelectableItems}`;
  }

  if (deliveryFreeGiftStatus) {
    const giftRequired = selectedFreeGiftMenuIds.size < 1;
    deliveryFreeGiftStatus.classList.toggle("is-required", giftRequired);
    deliveryFreeGiftStatus.textContent =
      giftRequired
        ? t("delivery.checkout.promotion.gift_required")
        : t(
            "delivery.checkout.promotion.gift_selection",
            {
              selected: selectedFreeGiftMenuIds.size,
              max: config.maxSelectableItems,
            }
          );
  }
}

function deliveryFreeShippingState(subtotal) {
  const config =
    normalizeDeliveryPromotion(storeSettings).freeShipping;

  const minimum = Number(config.minimumSubtotal || 0);
  const amount = Math.max(0, Number(subtotal || 0));

  return {
    enabled:
      config.enabled
      && minimum > 0,

    minimum,

    applied:
      config.enabled
      && minimum > 0
      && amount >= minimum,

    remaining:
      Math.max(0, minimum - amount),
  };
}

function renderDeliveryFreeShippingStatus() {
  if (!deliveryFreeShippingStatus) return;

  const state =
    deliveryFreeShippingState(currentSubtotal);

  if (!state.enabled || currentSubtotal <= 0) {
    deliveryFreeShippingStatus.hidden = true;
    deliveryFreeShippingStatus.textContent = "";
    deliveryFreeShippingStatus.classList.remove(
      "is-progress"
    );
    return;
  }

  deliveryFreeShippingStatus.hidden = false;

  if (state.applied) {
    deliveryFreeShippingStatus.classList.remove(
      "is-progress"
    );

    deliveryFreeShippingStatus.textContent =
      t(
        "delivery.checkout.promotion.free_shipping_applied",
        { minimum: money(state.minimum) }
      );

    return;
  }

  deliveryFreeShippingStatus.classList.add(
    "is-progress"
  );

  deliveryFreeShippingStatus.textContent =
    t(
      "delivery.checkout.promotion.free_shipping_progress",
      { remaining: money(state.remaining) }
    );
}


function deliveryZones() {
  const customOptions = Array.isArray(storeSettings.deliveryFeeOptions)
    ? storeSettings.deliveryFeeOptions
    : [];
  const legacyLimits = {
    "distance-0-2": 2,
    nearby: 2,
    "distance-2-5": 5,
    general: 5,
    "distance-5-plus": configuredMaxDeliveryDistanceKm() || 10,
    far: configuredMaxDeliveryDistanceKm() || 10,
  };
  let tierIndex = 0;
  const normalized = customOptions.map((option, index) => {
    const id = String(option.id || option.key || `fee-${index + 1}`);
    const pickup = id === "pickup";
    let maxDistanceKm = null;
    if (!pickup) {
      const explicit = Number(
        option.maxDistanceKm ?? option.distanceKm ?? option.maxDistance
      );
      if (Number.isFinite(explicit) && explicit > 0) {
        maxDistanceKm = explicit;
      } else if (legacyLimits[id]) {
        maxDistanceKm = legacyLimits[id];
      } else {
        const fallbackLimits = [2, 5, 10];
        maxDistanceKm = fallbackLimits[tierIndex]
          ?? (fallbackLimits.at(-1) + ((tierIndex - fallbackLimits.length + 1) * 5));
      }
      tierIndex += 1;
    }
    return {
      id,
      label: String(option.label || option.name || "").trim(),
      fee: pickup ? 0 : Math.max(0, Number(option.fee ?? option.amount ?? 0) || 0),
      maxDistanceKm,
    };
  }).filter(option => option.label);
  if (normalized.length) return normalized;
  return [
    { id: "pickup", label: t("delivery.checkout.zones.pickup"), fee: 0, maxDistanceKm: null },
    { id: "distance-0-2", label: t("delivery.checkout.zones.distance_0_2"), fee: 10, maxDistanceKm: 2 },
    { id: "distance-2-5", label: t("delivery.checkout.zones.distance_2_5"), fee: 30, maxDistanceKm: 5 },
    { id: "distance-5-plus", label: t("delivery.checkout.zones.distance_5_plus"), fee: 50, maxDistanceKm: configuredMaxDeliveryDistanceKm() || 10 },
  ];
}

function renderDeliveryZones() {
  const zones = deliveryZones().filter(zone => zone.id !== "pickup");
  const previousValue = deliveryZone.value;

  if (usesLalamove()) {
    const zone = lalamoveZone();
    deliveryZone.innerHTML = zone
      ? `<option value="lalamove">Lalamove • ${money(zone.fee)} ${t("delivery.checkout.units.baht")}</option>`
      : `<option value="">Lalamove</option>`;
    deliveryZone.value = zone ? "lalamove" : "";
    setDeliveryFeeMode(DELIVERY_FEE_MODE_AUTOMATIC);
    return;
  }

  deliveryZone.innerHTML = zones.map(zone =>
    `<option value="${escapeHtml(zone.id)}">${escapeHtml(zone.label)} • ${money(zone.fee)} ${t("delivery.checkout.units.baht")}</option>`
  ).join("");

  if (currentDeliveryRoute) {
    deliveryZone.value = currentDeliveryRoute.inRange === true
      ? String(currentDeliveryRoute.zone?.id || "")
      : "";
    setDeliveryFeeMode(DELIVERY_FEE_MODE_AUTOMATIC);
    return;
  }

  deliveryZone.value = zones.some(zone => zone.id === previousValue)
    ? previousValue
    : (zones[0]?.id || "");
  setDeliveryFeeMode(DELIVERY_FEE_MODE_MANUAL_FALLBACK);
}

function selectedZone() {
  if (usesLalamove()) return lalamoveZone();
  if (currentDeliveryRoute?.inRange === true && currentDeliveryRoute?.zone?.id) {
    return currentDeliveryRoute.zone;
  }

  if (currentDeliveryRoute || currentDeliveryDistanceKm !== null || !manualDeliveryFeeFallbackAllowed()) {
    return null;
  }

  return deliveryZones().find(
    zone =>
      zone.id !== "pickup"
      && zone.id === deliveryZone.value
  ) || deliveryZones().find(
    zone => zone.id !== "pickup"
  ) || null;
}

function showPromptPayPlaceholder(message) {
  promptPayQr.hidden = true;
  promptPayQr.removeAttribute("src");
  promptPayPlaceholder.hidden = false;
  promptPayPlaceholder.textContent = message;
}

function renderPromptPay() {
  const isPromptPay = paymentMethod.value === "promptpay";
  promptPaySection.hidden = !isPromptPay;
  paymentSlipWrap.hidden = !isPromptPay;
  paymentSlip.required = false;
  if (!isPromptPay) {
    clearSlipSelection();
    return;
  }

  promptPayAmount.textContent = `${money(currentTotal)} ${t("delivery.checkout.units.baht")}`;
  promptPayName.textContent = storeSettings.promptPayName || storeSettings.bankAccountName || "";
  if (!storeSettings.promptPayId) {
    showPromptPayPlaceholder(t("delivery.checkout.payment.promptpay_not_configured"));
    return;
  }
  if (currentSubtotal <= 0) {
    showPromptPayPlaceholder(t("delivery.checkout.payment.add_items_for_qr"));
    return;
  }

  try {
    const payload = generatePromptPayPayload(storeSettings.promptPayId, currentTotal);
    promptPayQr.src = qrDataUrl(payload, { size: 320, margin: 4 });
    promptPayQr.onerror = null;
    promptPayPlaceholder.hidden = true;
    promptPayQr.hidden = false;
  } catch (error) {
    console.error(error);
    showPromptPayPlaceholder(error?.message === "QR_DATA_TOO_LONG"
      ? t("delivery.checkout.payment.qr_too_long")
      : t("delivery.checkout.payment.promptpay_invalid"));
  }
}

function updateCart() {
  const items = [...cart.values()];
  cartList.innerHTML = items.length
    ? items.map(item => `<div class="cart-row"><div><strong>${item.name}</strong><div class="menu-category">${money(item.price)} ${t("delivery.checkout.units.baht")}</div><input class="input" data-note="${item.id}" value="${item.note || ""}" placeholder="${t("delivery.checkout.menu.item_note_placeholder")}" style="margin-top:7px"></div><div class="qty"><button data-dec="${item.id}">−</button><strong>${item.qty}</strong><button data-inc="${item.id}">+</button></div></div>`).join("")
    : `<div class="empty">${t("delivery.checkout.menu.cart_empty")}</div>`;
  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
  currentSubtotal = items.reduce((sum, item) => sum + item.qty * Number(item.price), 0);

  const automaticDeliveryZone =
    currentDeliveryDistanceKm !== null
      ? deliveryZoneForDistance(
          currentDeliveryDistanceKm
        )
      : null;
  const effectiveDeliveryZone =
    automaticDeliveryZone
    || (manualDeliveryFeeFallbackAllowed() ? selectedZone() : null);

  currentDeliveryBaseFee =
    currentSubtotal > 0 && effectiveDeliveryZone
      ? Number(effectiveDeliveryZone.fee || 0)
      : 0;

  const freeShipping =
    deliveryFreeShippingState(currentSubtotal);

  freeShippingApplied =
    freeShipping.applied;

  currentDeliveryFee =
    freeShippingApplied
      ? 0
      : currentDeliveryBaseFee;

  currentTotal = currentSubtotal + currentDeliveryFee;
  document.querySelector("#cartCount").textContent = t("delivery.checkout.menu.cart_count", { count: totalQty });
  document.querySelector("#deliverySubtotal").textContent = money(currentSubtotal);
  document.querySelector("#deliveryFeeDisplay").textContent = money(currentDeliveryFee);
  renderDeliveryFreeShippingStatus();
  document.querySelector("#cartTotal").textContent = money(currentTotal);
  submitOrderButton.disabled = isSubmitting || !items.length || !deliveryDistanceAllowed() || missingRequiredFreeGiftSelection();
  renderPromptPay();
}

function formatFileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function setSlipError(message = "") {
  paymentSlipError.textContent = message;
  paymentSlipError.hidden = !message;
}

function clearSlipSelection() {
  selectedSlipFile = null;
  paymentSlip.value = "";
  paymentSlipDropzone.classList.remove("has-file", "is-dragover");
  paymentSlipContent.hidden = false;
  paymentSlipPreviewWrap.hidden = true;
  removePaymentSlip.hidden = true;
  paymentSlipPreview.removeAttribute("src");
  paymentSlipFileName.textContent = "-";
  paymentSlipFileSize.textContent = "-";
  setSlipError("");
  if (selectedSlipObjectUrl) URL.revokeObjectURL(selectedSlipObjectUrl);
  selectedSlipObjectUrl = "";
}

function selectSlipFile(file) {
  if (!file) return;
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
  const extension = String(file.name || "").split(".").pop()?.toLowerCase() || "";
  const allowedExtension = ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(extension);
  if (file.size > 8 * 1024 * 1024) {
    clearSlipSelection();
    setSlipError(t("delivery.checkout.payment.slip_too_large"));
    toast(t("delivery.checkout.payment.slip_too_large"), "error");
    return;
  }
  if ((file.type && !allowedTypes.includes(file.type)) || (!file.type && !allowedExtension)) {
    clearSlipSelection();
    setSlipError(t("delivery.checkout.payment.slip_type_detail"));
    toast(t("delivery.checkout.payment.slip_type_toast"), "error");
    return;
  }
  if (selectedSlipObjectUrl) URL.revokeObjectURL(selectedSlipObjectUrl);
  selectedSlipFile = file;
  selectedSlipObjectUrl = URL.createObjectURL(file);
  paymentSlipPreview.src = selectedSlipObjectUrl;
  paymentSlipFileName.textContent = file.name || t("delivery.checkout.payment.slip_fallback_name");
  paymentSlipFileSize.textContent = formatFileSize(file.size);
  paymentSlipContent.hidden = true;
  paymentSlipPreviewWrap.hidden = false;
  removePaymentSlip.hidden = false;
  paymentSlipDropzone.classList.add("has-file");
  setSlipError("");
  toast(t("delivery.checkout.payment.slip_attached"));
}

async function uploadSlip(file, orderId) {
  if (!file) return { path: "" };
  if (file.size > 8 * 1024 * 1024) throw new Error("SLIP_TOO_LARGE");
  return dataService.uploadSlip(file, orderId);
}

function submitErrorMessage(error) {
  const code = String(error?.code || error?.message || "");
  if (code.includes("SLIP_TOO_LARGE")) return t("delivery.checkout.payment.slip_too_large");
  if (
    code.includes("DELIVERY_FREE_GIFT_LIMIT_EXCEEDED")
  ) {
    return t("delivery.checkout.promotion.gift_limit", {
      max:
        normalizeDeliveryPromotion(storeSettings)
          .freeGift.maxSelectableItems,
    });
  }

  if (
    code.includes("DELIVERY_FREE_GIFT_REQUIRED")
  ) {
    return t(
      "delivery.checkout.promotion.gift_required"
    );
  }

  if (
    code.includes("DELIVERY_FREE_GIFT_INVALID")
  ) {
    return t(
      "delivery.checkout.promotion.gift_invalid"
    );
  }

  if (
    code.includes("DELIVERY_FREE_GIFT_NOT_AVAILABLE")
  ) {
    return t(
      "delivery.checkout.promotion.gift_unavailable"
    );
  }

  if (code.includes("TENANT_NOT_READY")) return t("delivery.checkout.errors.tenant_not_ready");
  if (code.includes("storage/unauthorized")) return t("delivery.checkout.errors.storage_unauthorized");
  if (code.includes("storage/retry-limit-exceeded")) return t("delivery.checkout.errors.storage_retry");
  if (code.includes("storage/canceled")) return t("delivery.checkout.errors.storage_cancelled");
  if (code.includes("STORAGE_NOT_READY")) return t("delivery.checkout.errors.storage_not_ready");
  return t("delivery.checkout.errors.submit_failed", { code: code || "UNKNOWN_ERROR" });
}

document.addEventListener("delivery-location-changed", () => {
  refreshDeliveryDistance();

  /*
   * refreshDeliveryDistance() synchronizes the automatic zone
   * and totals. Run one final cart refresh so the submit guard
   * also reflects the new distance.
   */
  updateCart();
});

paymentSlip.addEventListener("click", event => event.stopPropagation());
paymentSlip.addEventListener("change", event => selectSlipFile(event.target.files?.[0] || null));
paymentSlipDropzone.addEventListener("click", () => paymentSlip.click());
for (const eventName of ["dragenter", "dragover"]) {
  paymentSlipDropzone.addEventListener(eventName, event => {
    event.preventDefault();
    paymentSlipDropzone.classList.add("is-dragover");
  });
}
for (const eventName of ["dragleave", "drop"]) {
  paymentSlipDropzone.addEventListener(eventName, event => {
    event.preventDefault();
    paymentSlipDropzone.classList.remove("is-dragover");
  });
}
paymentSlipDropzone.addEventListener("drop", event => selectSlipFile(event.dataTransfer?.files?.[0] || null));
removePaymentSlip.addEventListener("click", event => {
  event.stopPropagation();
  clearSlipSelection();
});
categoryTabs.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  renderTabs();
  renderMenus();
});
document.querySelector("#searchInput").addEventListener("input", renderMenus);
paymentMethod.addEventListener("change", () => {
  renderPromptPay();
  if (usesLalamove()) refreshDeliveryDistance();
});
deliveryZone.addEventListener("change", updateCart);
deliveryFreeGiftList?.addEventListener(
  "change",
  event => {
    const checkbox =
      event.target.closest(
        "[data-delivery-free-gift-input]"
      );

    if (!checkbox) return;

    const config =
      normalizeDeliveryPromotion(
        storeSettings
      ).freeGift;

    const id = String(
      checkbox.dataset.deliveryFreeGiftInput || ""
    ).trim();

    if (!id) return;

    if (checkbox.checked) {
      if (
        selectedFreeGiftMenuIds.size
        >= config.maxSelectableItems
      ) {
        checkbox.checked = false;

        toast(
          t(
            "delivery.checkout.promotion.gift_limit",
            {
              max: config.maxSelectableItems,
            }
          ),
          "error"
        );

        return;
      }

      selectedFreeGiftMenuIds.add(id);
    } else {
      selectedFreeGiftMenuIds.delete(id);
    }

    renderDeliveryFreeGiftPromotion();
    updateCart();
  }
);
menuGrid.addEventListener("click", async event => {
  const favoriteButton = event.target.closest("[data-favorite]");
  if (favoriteButton) {
    const id = String(favoriteButton.dataset.favorite || "");
    if (!id) return;
    const wasFavorite = favoriteMenuIds.has(id);
    if (wasFavorite) favoriteMenuIds.delete(id);
    else favoriteMenuIds.add(id);

    if (activeCategory === favoriteCategoryLabel() && !visibleFavoriteCount()) {
      activeCategory = t("delivery.checkout.menu.all");
    }
    renderTabs();
    renderMenus();
    try {
      await saveCustomerFavorites([...favoriteMenuIds], currentFavoriteUser);
    } catch (error) {
      console.error("[delivery-favorites] save failed", error);
      if (wasFavorite) favoriteMenuIds.add(id);
      else favoriteMenuIds.delete(id);
      renderTabs();
      renderMenus();
      toast(t("delivery.checkout.menu.favorite_save_failed"), "error");
    }
    return;
  }

  const addButton = event.target.closest("[data-add]");
  const id = addButton?.dataset.add;
  if (!id) return;
  const menu = menus.find(item => item.id === id);
  const current = cart.get(id);
  cart.set(id, current ? { ...current, qty: current.qty + 1 } : { ...menu, qty: 1, note: "" });
  updateCart();
});
cartList.addEventListener("click", async event => {
  const increment = event.target.dataset.inc;
  const decrement = event.target.dataset.dec;
  const id = increment || decrement;
  if (!id) return;
  const item = cart.get(id);
  if (!item) return;
  if (increment) {
    item.qty += 1;
    cart.set(id, item);
    updateCart();
    return;
  }
  if (item.qty <= 1) {
    const confirmed = await askConfirm(t("delivery.checkout.confirm.remove_item", { item: item.name }), {
      title: t("delivery.checkout.confirm.remove_item_title"),
      confirmText: t("delivery.checkout.common.confirm"),
      cancelText: t("delivery.checkout.common.cancel"),
      type: "warning"
    });
    if (!confirmed) return;
    cart.delete(id);
  } else {
    item.qty -= 1;
    cart.set(id, item);
  }
  updateCart();
});
cartList.addEventListener("input", event => {
  const id = event.target.dataset.note;
  if (!id) return;
  const item = cart.get(id);
  item.note = event.target.value;
  cart.set(id, item);
});

submitOrderButton.addEventListener("click", async () => {
  if (isSubmitting) return;
  const recipientName = document.querySelector("#recipientName").value.trim();
  const recipientPhone = document.querySelector("#recipientPhone").value.trim();
  const deliveryAddress = document.querySelector("#deliveryAddress").value.trim();

  if (!recipientName || !recipientPhone || !deliveryAddress) {
    toast(t("delivery.checkout.validation.delivery_details_required"), "error");
    return;
  }

  await refreshDeliveryDistance();

  const deliveryLocation = customerDeliveryLocation();
  const storeCoordinates = storeLocation();
  const lalamoveDeliveryAvailable = Boolean(
    usesLalamove()
    && storeCoordinates
    && deliveryLocation
    && currentDeliveryDistanceKm !== null
    && lalamoveZone()
  );
  const automaticDistanceAvailable = usesLalamove()
    ? lalamoveDeliveryAvailable
    : Boolean(
        storeCoordinates
        && deliveryLocation
        && currentDeliveryDistanceKm !== null
        && currentDeliveryRoute
      );

  if (usesLalamove() && !lalamoveDeliveryAvailable) {
    toast(lalamoveQuoteErrorMessage(), "error");
    deliveryDistanceStatus?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (!usesLalamove() && storeCoordinates && deliveryLocation && !currentDeliveryRoute) {
    toast(t("delivery.checkout.distance.route_failed"), "error");
    deliveryDistanceStatus?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (automaticDistanceAvailable && !deliveryDistanceAllowed()) {
    const maxDistance = configuredMaxDeliveryDistanceKm();

    toast(
      maxDistance !== null
        ? t(
            "delivery.checkout.distance.out_of_range",
            {
              distance: Number(currentDeliveryDistanceKm || 0).toFixed(2),
              max: maxDistance.toFixed(2),
            },
          )
        : t("delivery.checkout.distance.unavailable"),
      "error",
    );

    deliveryDistanceStatus?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    return;
  }

  if (missingRequiredFreeGiftSelection()) {
    deliveryFreeGiftSection?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    toast(
      t("delivery.checkout.promotion.gift_required"),
      "error",
    );
    return;
  }

  const method = paymentMethod.value;
  if (method === "promptpay" && !storeSettings.promptPayId) {
    toast(t("delivery.checkout.payment.promptpay_not_configured"), "error");
    return;
  }
  if (method === "promptpay" && !selectedSlipFile) {
    setSlipError(t("delivery.checkout.payment.slip_required_error"));
    paymentSlipDropzone.scrollIntoView({ behavior: "smooth", block: "center" });
    toast(t("delivery.checkout.payment.slip_required_toast"), "error");
    return;
  }

  const paidItems = [...cart.values()].map(({ id, name, price, qty, note }) => ({
    menuId: id,
    name,
    price: Number(price),
    qty,
    note: note || "",
    cancelled: false,
  }));
  if (!paidItems.length) return;

  const giftItems = [...selectedFreeGiftMenuIds]
    .map(menuId => menus.find(menu => String(menu.id) === String(menuId)))
    .filter(Boolean)
    .map(menu => ({
      menuId: menu.id,
      name: menu.name,
      price: 0,
      qty: 1,
      note: "",
      cancelled: false,
      isGift: true,
    }));
  const items = [...paidItems, ...giftItems];

  const zone = usesLalamove()
    ? lalamoveZone()
    : automaticDistanceAvailable
      ? currentDeliveryRoute?.zone || null
      : selectedZone();

  if (!zone) {
    toast(t("delivery.checkout.distance.fee_rule_missing"), "error");
    return;
  }

  deliveryZone.value = zone.id;

  const orderId = createOrderId();
  const slipFile = selectedSlipFile;
  isSubmitting = true;
  submitOrderButton.disabled = true;
  submitOrderButton.textContent = method === "promptpay"
    ? t("delivery.checkout.submit.saving_slip")
    : t("delivery.checkout.submit.sending");

  try {
    let slip = { path: "" };
    if (method === "promptpay") {
      slip = await uploadSlip(slipFile, orderId);
      submitOrderButton.textContent = t("delivery.checkout.submit.creating_order");
    }

    const finalBaseFee = Math.max(0, Number(zone.fee || 0) || 0);
    const finalFreeShipping = deliveryFreeShippingState(currentSubtotal).applied;
    const finalDeliveryFee = finalFreeShipping ? 0 : finalBaseFee;
    const finalTotal = currentSubtotal + finalDeliveryFee;

    const orderPayload = {
      id: orderId,
      tableCode: "DELIVERY",
      recipientName,
      recipientPhone,
      deliveryAddress,
      deliveryProvider: usesLalamove() ? "lalamove" : "self",
      deliveryZone: zone.id,
      deliveryZoneLabel: zone.label,
      deliveryBaseFee: finalBaseFee,
      deliveryFee: finalDeliveryFee,
      deliveryFeeDiscount: Math.max(0, finalBaseFee - finalDeliveryFee),
      freeShippingApplied: Boolean(finalFreeShipping),
      deliveryFeeMode: usesLalamove()
        ? "lalamove_quotation"
        : automaticDistanceAvailable
          ? "google_routes"
          : "manual_fallback",
      freeGiftMenuIds: [...selectedFreeGiftMenuIds],
      subtotalAmount: currentSubtotal,
      totalAmount: finalTotal,
      paymentMethod: method,
      paymentStatus: method === "promptpay" ? "pending_verification" : "unpaid",
      paymentSlipUrl: "",
      paymentSlipPath: slip.path,
      status: "pending",
      note: document.querySelector("#orderNote").value.trim(),
      items,
    };

    if (deliveryLocation) {
      orderPayload.deliveryLatitude = deliveryLocation.latitude;
      orderPayload.deliveryLongitude = deliveryLocation.longitude;
    }

    if (usesLalamove()) {
      const quote = currentLalamoveQuotation || {};
      const quotedFee = Math.max(0, Number(quote.fee || finalBaseFee) || 0);
      orderPayload.deliveryDistanceKm = Number(currentDeliveryDistanceKm.toFixed(3));
      orderPayload.deliveryDistanceMeters = Math.max(
        0,
        Number(quote.distanceMeters || Math.round(currentDeliveryDistanceKm * 1000)) || 0
      );
      orderPayload.deliveryRouteProvider = "lalamove";
      orderPayload.lalamoveQuotationId = String(quote.quotationId || "");
      orderPayload.lalamoveQuotationExpiresAt = String(quote.expiresAt || "");
      orderPayload.lalamoveCurrency = String(quote.currency || "THB");
      orderPayload.lalamoveAccountMode = String(quote.accountMode || "");
      orderPayload.lalamoveAccountEnvironment = String(quote.accountEnvironment || "");
      orderPayload.lalamoveDispatchQuote = {
        quotationId: String(quote.quotationId || ""),
        expiresAt: String(quote.expiresAt || ""),
        fee: quotedFee,
        currency: String(quote.currency || "THB"),
        distanceKm: Number.isFinite(Number(quote.distanceKm)) ? Number(quote.distanceKm) : Number(currentDeliveryDistanceKm.toFixed(3)),
        distanceMeters: Math.max(0, Number(quote.distanceMeters || 0) || 0),
        priceBreakdown: quote.priceBreakdown || {},
        specialRequests: Array.isArray(quote.specialRequests) ? quote.specialRequests : [],
        stops: Array.isArray(quote.stops) ? quote.stops : [],
      };
      orderPayload.lalamoveDispatchFee = quotedFee;
      orderPayload.lalamoveDispatchPriceDifference = 0;
      orderPayload.lalamoveDispatchRequiresApproval = false;
      orderPayload.lalamoveDispatchQuotedAt = new Date().toISOString();
    } else if (automaticDistanceAvailable) {
      orderPayload.deliveryDistanceKm = Number(currentDeliveryDistanceKm.toFixed(3));
      orderPayload.deliveryDistanceMeters = Number(currentDeliveryRoute?.distanceMeters || 0);
      orderPayload.deliveryDurationSeconds = Number(currentDeliveryRoute?.durationSeconds || 0);
      orderPayload.deliveryRouteProvider = "google_routes";
    }

    await dataService.createDeliveryOrder(orderPayload);
    const tenant = dataService.getActiveShop();
    const tenantSlug = encodeURIComponent(tenant.slug);
    cart.clear();
    clearSlipSelection();
    toast(t("delivery.checkout.submit.success"));
    location.href = `/s/${tenantSlug}/delivery/success/?order=${encodeURIComponent(orderId)}`;
  } catch (error) {
    console.error("DELIVERY_ORDER_FAILED", error);
    toast(submitErrorMessage(error), "error");
  } finally {
    isSubmitting = false;
    submitOrderButton.textContent = t("delivery.checkout.summary.submit_order");
    updateCart();
  }
});

watchCustomerAuth(async user => {
  currentFavoriteUser = user;
  try {
    favoriteMenuIds = new Set(await getCustomerFavorites(user));
  } catch (error) {
    console.warn("[delivery-favorites] load failed", error);
    favoriteMenuIds = new Set();
  }
  if (activeCategory === favoriteCategoryLabel() && !visibleFavoriteCount()) {
    activeCategory = t("delivery.checkout.menu.all");
  }
  renderTabs();
  renderMenus();
});

try {
  [menus, storeSettings] = await Promise.all([dataService.listMenus(), dataService.getStoreSettings()]);
  renderDeliveryStoreHero(storeSettings);
  renderTabs();
  renderMenus();
  renderDeliveryZones();
  renderDeliveryFreeGiftPromotion();
  refreshDeliveryDistance();
  updateCart();
} catch (error) {
  console.error(error);
  menuGrid.innerHTML = `<div class="card empty">${t("delivery.checkout.menu.load_failed")}</div>`;
}