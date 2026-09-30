import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import Sortable from "sortablejs";
import { useAuth } from "@/auth/AuthProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { ParityFooter } from "@/components/ParityFooter";
import { UserMenu } from "@/components/UserMenu";
import { AdminDeliveryQr } from "@/components/AdminDeliveryQr";
import { AdminCollapsibleCard } from "@/components/AdminCollapsibleCard";
import { sweetConfirm } from "@/components/sweetDialog";
import {
  deleteAdminMenu,
  deleteAdminTable,
  deleteTenantLalamoveWalletTopup,
  getAdminGoogleMapsBrowserKey,
  loadAdminSnapshot,
  loadOwnTenantLalamoveWallet,
  saveAdminCategoryOrder,
  saveAdminMenu,
  saveAdminMenuOrder,
  saveAdminStoreSettings,
  saveAdminTable,
  submitTenantLalamoveWalletTopup,
  testTenantLalamoveConnection,
  updateTenantLalamoveSettings,
  uploadAdminMenuImage,
} from "@/data/adminData";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { useTenant } from "@/tenant/TenantProvider";

const DEFAULT_FOOD_IMAGE = "/assets/images/default-food.svg";
const DEFAULT_LOCATION = { latitude: 13.756331, longitude: 100.501762, zoom: 11 };
const DEFAULT_DISTANCE_LIMITS = [2, 5, 10];
const LEGACY_DISTANCE_LIMITS = Object.freeze({
  "distance-0-2": 2,
  "distance-2-5": 5,
  "distance-5-plus": 10,
  nearby: 2,
  general: 5,
  far: 10,
});
const DEFAULT_FEES = [
  { id: "pickup", label: "", fee: 0, maxDistanceKm: null, locked: true },
  { id: "distance-0-2", label: "", fee: 10, maxDistanceKm: 2 },
  { id: "distance-2-5", label: "", fee: 30, maxDistanceKm: 5 },
  { id: "distance-5-plus", label: "", fee: 50, maxDistanceKm: 10 },
];

function showToast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `app-toast ${type === "error" ? "error" : "success"}`;
  el.setAttribute("role", type === "error" ? "alert" : "status");
  el.setAttribute("aria-live", "polite");
  el.innerHTML = `<span class="app-toast-icon" aria-hidden="true"><i class="bi bi-${type === "error" ? "x-circle" : "check-circle"} app-icon"></i></span><span class="app-toast-message"></span>`;
  el.querySelector(".app-toast-message").textContent = String(message || "");
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  window.setTimeout(() => {
    el.classList.remove("show");
    window.setTimeout(() => el.remove(), 250);
  }, 3200);
}

function money(value, locale = "th-TH") {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatFileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function visiblePaginationPages(currentPage, totalPages) {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function normalizeLocation(latitude, longitude) {
  if (latitude === "" || longitude === "" || latitude === null || longitude === null || latitude === undefined || longitude === undefined) return null;
  const lat = Number(latitude), lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: Number(lat.toFixed(7)), longitude: Number(lng.toFixed(7)) };
}

function loadScript(src, id) {
  const existing = document.getElementById(id);
  if (existing) return new Promise((resolve, reject) => {
    if (existing.dataset.ready === "1") resolve();
    else {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
    }
  });
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => { script.dataset.ready = "1"; resolve(); };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function ensureStyle(href, id) {
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

async function resizeMenuImage(file) {
  if (!file) throw new Error("NO_IMAGE_FILE");
  if (file.size > 8 * 1024 * 1024) throw new Error("IMAGE_TOO_LARGE");
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
  if (file.type && !allowed.includes(file.type)) throw new Error("INVALID_IMAGE_TYPE");
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("IMAGE_DECODE_FAILED"));
      element.src = objectUrl;
    });
    const maxSize = 1200;
    const ratio = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    canvas.getContext("2d", { alpha: false }).drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", .82));
    if (!blob) throw new Error("IMAGE_CONVERT_FAILED");
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function normalizedPromotion(settings = {}) {
  const value = settings.deliveryPromotion && typeof settings.deliveryPromotion === "object"
    ? settings.deliveryPromotion : {};
  const freeShipping = value.freeShipping && typeof value.freeShipping === "object" ? value.freeShipping : {};
  const freeGift = value.freeGift && typeof value.freeGift === "object" ? value.freeGift : {};
  return {
    freeShippingEnabled: freeShipping.enabled === true || value.freeShippingEnabled === true,
    freeShippingMinimumSubtotal: Math.max(
      0,
      Number(freeShipping.minimumSubtotal ?? value.freeShippingMinimumSubtotal ?? 500) || 0,
    ),
    freeGiftEnabled: freeGift.enabled === true || value.freeGiftEnabled === true,
    freeGiftMaxSelectableItems: Math.max(
      1,
      Math.min(20, Number.parseInt(freeGift.maxSelectableItems ?? value.freeGiftMaxSelectableItems ?? 1, 10) || 1),
    ),
    freeGiftValidFrom: String(freeGift.validFrom ?? value.freeGiftValidFrom ?? ""),
    freeGiftValidUntil: String(freeGift.validUntil ?? value.freeGiftValidUntil ?? ""),
    freeGiftMenuIds: Array.isArray(freeGift.menuIds)
      ? [...new Set(freeGift.menuIds.map(String).filter(Boolean))]
      : Array.isArray(value.freeGiftMenuIds)
        ? [...new Set(value.freeGiftMenuIds.map(String).filter(Boolean))]
        : [],
  };
}

function promotionForStore(value = {}) {
  return {
    freeShipping: {
      enabled: value.freeShippingEnabled === true,
      minimumSubtotal: Math.round(Math.max(0, Number(value.freeShippingMinimumSubtotal || 0)) * 100) / 100,
    },
    freeGift: {
      enabled: value.freeGiftEnabled === true,
      maxSelectableItems: Math.max(1, Math.min(20, Number.parseInt(value.freeGiftMaxSelectableItems || 1, 10) || 1)),
      validFrom: String(value.freeGiftValidFrom || "").trim(),
      validUntil: String(value.freeGiftValidUntil || "").trim(),
      menuIds: [...new Set((value.freeGiftMenuIds || []).map(item => String(item || "").trim()).filter(Boolean))],
    },
  };
}

export function AdminMap({ tenantSlug, location, onLocation, onError, t }) {
  const mapRef = useRef(null);
  const instanceRef = useRef(null);
  const markerRef = useRef(null);
  const [provider, setProvider] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    let fallbackStarted = false;
    const target = mapRef.current;
    if (!target || instanceRef.current) return () => { alive = false; };

    const initLeaflet = async () => {
      ensureStyle("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", "react-admin-leaflet-css");
      await loadScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js", "react-admin-leaflet-js");
      if (!alive || !window.L) return;
      target.replaceChildren();
      try { delete target._leaflet_id; } catch (_) {}
      markerRef.current = null;
      const center = location || DEFAULT_LOCATION;
      const map = window.L.map(target).setView([center.latitude, center.longitude], location ? 16 : DEFAULT_LOCATION.zoom);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: "&copy; OpenStreetMap",
      }).addTo(map);
      const ensureMarker = point => {
        if (!markerRef.current) {
          const marker = window.L.marker(point, { draggable: true }).addTo(map);
          marker.on("dragend", () => {
            const value = marker.getLatLng();
            onLocation(normalizeLocation(value.lat, value.lng));
          });
          markerRef.current = marker;
        }
        return markerRef.current;
      };
      if (location) ensureMarker([location.latitude, location.longitude]);
      map.on("click", event => {
        ensureMarker(event.latlng).setLatLng(event.latlng);
        onLocation(normalizeLocation(event.latlng.lat, event.latlng.lng));
      });
      instanceRef.current = { type: "leaflet", map };
      setProvider("leaflet");
    };

    const failMapCompletely = leafletError => {
      console.error("ADMIN_MAP_LOAD_FAILED", leafletError);
      if (!alive) return;
      const message = t("admin.store_location.map_failed");
      setProvider("failed");
      setError(message);
      onError?.(message);
    };

    const fallbackToLeaflet = async errorValue => {
      if (!alive || fallbackStarted || instanceRef.current?.type === "leaflet") return;
      fallbackStarted = true;
      console.warn("ADMIN_GOOGLE_MAP_FALLBACK", errorValue);
      instanceRef.current = null;
      markerRef.current = null;
      try {
        await initLeaflet();
        if (!alive) return;
        const message = t("admin.store_location.google_fallback");
        setError(message);
        onError?.(message);
      } catch (leafletError) {
        failMapCompletely(leafletError);
      }
    };

    const previousAuthFailure = window.gm_authFailure;
    const googleAuthFailure = () => {
      fallbackToLeaflet(new Error("GOOGLE_MAPS_AUTH_FAILURE"));
    };
    window.gm_authFailure = googleAuthFailure;

    const errorObserver = new MutationObserver(() => {
      if (target.querySelector(".gm-err-container, .gm-err-message")) {
        fallbackToLeaflet(new Error("GOOGLE_MAPS_RENDER_ERROR"));
      }
    });
    errorObserver.observe(target, { childList: true, subtree: true });

    const initGoogle = async () => {
      const apiKey = await getAdminGoogleMapsBrowserKey(tenantSlug);
      await loadScript(`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`, "react-admin-google-maps-js");
      if (!alive || fallbackStarted) return;
      if (!window.google?.maps) throw new Error("GOOGLE_MAPS_UNAVAILABLE");
      const center = location || DEFAULT_LOCATION;
      const map = new window.google.maps.Map(target, {
        center: { lat: center.latitude, lng: center.longitude },
        zoom: location ? 16 : DEFAULT_LOCATION.zoom,
        streetViewControl: false, mapTypeControl: false,
      });
      const ensureMarker = position => {
        if (!markerRef.current) {
          const marker = new window.google.maps.Marker({ map, position, draggable: true });
          marker.addListener("dragend", event => onLocation(normalizeLocation(event.latLng.lat(), event.latLng.lng())));
          markerRef.current = marker;
        }
        return markerRef.current;
      };
      if (location) ensureMarker({ lat: location.latitude, lng: location.longitude });
      map.addListener("click", event => {
        ensureMarker(event.latLng).setPosition(event.latLng);
        onLocation(normalizeLocation(event.latLng.lat(), event.latLng.lng()));
      });
      instanceRef.current = { type: "google", map };
      setProvider("google");
      setError("");
      onError?.("");
    };

    initGoogle().catch(fallbackToLeaflet);

    return () => {
      alive = false;
      errorObserver.disconnect();
      if (window.gm_authFailure === googleAuthFailure) {
        if (typeof previousAuthFailure === "function") window.gm_authFailure = previousAuthFailure;
        else delete window.gm_authFailure;
      }
    };
  }, [tenantSlug]);

  useEffect(() => {
    if (!location || !instanceRef.current) return;
    if (instanceRef.current.type === "google") {
      const point = { lat: location.latitude, lng: location.longitude };
      if (!markerRef.current) {
        const marker = new window.google.maps.Marker({ map: instanceRef.current.map, position: point, draggable: true });
        marker.addListener("dragend", event => onLocation(normalizeLocation(event.latLng.lat(), event.latLng.lng())));
        markerRef.current = marker;
      } else {
        markerRef.current.setPosition(point);
      }
      instanceRef.current.map.panTo(point);
      instanceRef.current.map.setZoom(Math.max(Number(instanceRef.current.map.getZoom?.() || 0), 16));
    } else if (window.L) {
      const point = [location.latitude, location.longitude];
      if (!markerRef.current) {
        const marker = window.L.marker(point, { draggable: true }).addTo(instanceRef.current.map);
        marker.on("dragend", () => {
          const value = marker.getLatLng();
          onLocation(normalizeLocation(value.lat, value.lng));
        });
        markerRef.current = marker;
      } else {
        markerRef.current.setLatLng(point);
      }
      instanceRef.current.map.setView(point, Math.max(Number(instanceRef.current.map.getZoom?.() || 0), 16));
    }
  }, [location?.latitude, location?.longitude]);

  return (
    <>
      <div ref={mapRef} id="adminStoreLocationMap" className="admin-store-location-map" aria-label={t("admin.store_location.map_aria")}></div>
      {provider === "failed" ? <span hidden>{error}</span> : null}
    </>
  );
}

function AdminEntityModal({ open, entity, editing, saving, onClose, children, t }) {
  useEffect(() => {
    document.body.classList.toggle("admin-modal-open", open);
    return () => document.body.classList.remove("admin-modal-open");
  }, [open]);
  if (!open) return null;
  const isTable = entity === "table";
  const title = isTable
    ? t(editing ? "admin.workspace.edit_table" : "admin.workspace.add_table")
    : t(editing ? "admin.workspace.edit_menu" : "admin.workspace.add_menu");
  const subtitle = t(isTable ? "admin.workspace.table_subtitle" : "admin.workspace.menu_subtitle");
  return (
    <div className="admin-edit-modal-backdrop is-open" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section className="admin-edit-modal" data-admin-modal-entity={entity} role="dialog" aria-modal="true" aria-labelledby="adminEditModalTitle" aria-describedby="adminEditModalSubtitle">
        <header className="admin-edit-modal-head">
          <span className="admin-edit-modal-icon" aria-hidden="true"><i className={"bi bi-" + (isTable ? "grid-3x3-gap" : "egg-fried")}></i></span>
          <div className="admin-edit-modal-copy">
            <h2 id="adminEditModalTitle">{title}</h2>
            <p className="admin-edit-modal-subtitle" id="adminEditModalSubtitle">{subtitle}</p>
          </div>
          <button className="admin-edit-modal-close" type="button" aria-label={t("admin.common.close")} disabled={saving} onClick={onClose}><i className="bi bi-x-lg" aria-hidden="true"></i></button>
        </header>
        <div className="admin-edit-modal-body">{children}</div>
        <footer className="admin-edit-modal-footer">
          <button className="btn admin-edit-modal-cancel" type="button" disabled={saving} onClick={onClose}><i className="bi bi-x-circle" aria-hidden="true"></i><span>{t("admin.common.cancel")}</span></button>
          <button
            className="btn btn-primary admin-edit-modal-submit"
            type="submit"
            form={isTable ? "tableForm" : "menuForm"}
            disabled={saving}
          >
            {saving ? <span className="admin-edit-modal-spinner" aria-hidden="true"></span> : <i className={"bi bi-" + (editing ? "floppy" : "plus-lg")} aria-hidden="true"></i>}
            <span>{saving ? t("admin.common.saving") : t(editing ? "admin.common.save" : "admin.common.create")}</span>
          </button>
        </footer>
      </section>
    </div>
  );
}

function DeliveryFeeEditor({ fees, setFees, readonly = false, t }) {
  const update = (index, patch) => setFees(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const remove = index => {
    if (readonly) return;
    setFees(current => current.filter((_, itemIndex) => itemIndex !== index));
  };
  const add = () => {
    if (readonly) return;
    setFees(current => {
      if (current.length >= 12) return current;
      const distances = current
        .filter(item => item.id !== "pickup")
        .map(item => Number(item.maxDistanceKm))
        .filter(value => Number.isFinite(value) && value > 0);
      const maximum = distances.length ? Math.max(...distances) : 0;
      const nextDistance = maximum > 0 ? Math.round((maximum + 5) * 100) / 100 : 2;
      return [...current, {
        id: "fee-" + crypto.randomUUID(),
        label: "",
        fee: 0,
        maxDistanceKm: nextDistance,
      }];
    });
  };
  return (
    <div
      className={"card" + (readonly ? " is-lalamove-readonly" : "")}
      id="deliveryFeeSettingsCard"
      aria-disabled={readonly ? "true" : "false"}
      style={{ boxShadow: "none", background: "#f8fbf9" }}
    >
      <div className="section-title delivery-fee-head" style={{ marginTop: 0 }}>
        <div><h2>{t("admin.delivery_fee.title")}</h2><div className="menu-category">{t("admin.delivery_fee.description")}</div></div>
        <button className="btn btn-primary btn-sm" id="addDeliveryFeeOption" type="button" disabled={readonly} onClick={add}><i className="bi bi-plus-lg app-icon" aria-hidden="true"></i><span>{t("admin.delivery_fee.add")}</span></button>
      </div>
      <div id="deliveryFeeOptionsList" className="delivery-fee-options" role="table" aria-label={t("admin.delivery_fee.table_aria")}>
        <div className="delivery-fee-table-header" role="row">
          <div role="columnheader">{t("admin.delivery_fee.table_headers.number")}</div>
          <div role="columnheader">{t("admin.delivery_fee.table_headers.description")}</div>
          <div role="columnheader">{t("admin.delivery_fee.table_headers.distance")}</div>
          <div role="columnheader">{t("admin.delivery_fee.table_headers.fee")}</div>
          <div role="columnheader" className="delivery-fee-action-header" aria-label={t("admin.delivery_fee.table_headers.action")}></div>
        </div>
        <div className="delivery-fee-table-body" data-delivery-fee-body role="rowgroup">
          {fees.map((item, index) => {
            const pickup = item.id === "pickup" || item.locked === true;
            const distance = pickup ? null : Number(item.maxDistanceKm || 0);
            const descriptionPlaceholder = pickup
              ? t("admin.delivery_fee.description_example", { value: t("admin.delivery_fee.default_pickup") })
              : t("admin.delivery_fee.description_example", {
                  value: t("admin.delivery_fee.up_to", { distance: Number.isFinite(distance) && distance > 0 ? distance : 2 }),
                });
            return (
              <div className={"delivery-fee-row" + (pickup ? " is-pickup" : "")} data-delivery-fee-row data-option-id={item.id} data-delivery-fee-pickup={pickup ? "true" : "false"} role="row" key={item.id}>
                <div className="delivery-fee-index" data-delivery-fee-index role="cell">{index + 1}</div>
                <input
                  className="input delivery-fee-description delivery-fee-description-input"
                  data-delivery-fee-label
                  type="text"
                  maxLength="120"
                  disabled={readonly}
                  aria-label={t("admin.delivery_fee.description_aria")}
                  value={item.label}
                  onChange={e => update(index, { label: e.target.value })}
                  placeholder={descriptionPlaceholder}
                />
                <div className="delivery-fee-cell delivery-fee-distance-cell" role="cell" data-mobile-label={t("admin.delivery_fee.table_headers.distance")}>
                  {pickup ? <span className="delivery-fee-static-value" data-delivery-fee-distance-static>—</span> : <input
                    className="input"
                    data-delivery-fee-distance
                    type="number"
                    min="0.1"
                    step="0.1"
                    required
                    inputMode="decimal"
                    disabled={readonly}
                    aria-label={t("admin.delivery_fee.distance_aria")}
                    value={item.maxDistanceKm ?? ""}
                    onChange={e => update(index, { maxDistanceKm: Math.max(0.1, Number(e.target.value || 0.1)) })}
                  />}
                </div>
                <div className="delivery-fee-cell delivery-fee-amount-cell" role="cell" data-mobile-label={t("admin.delivery_fee.table_headers.fee")}>
                  {pickup ? <><span className="delivery-fee-static-value" data-delivery-fee-amount-static>0</span><input type="hidden" data-delivery-fee-amount value="0" /></> : <input
                    className="input"
                    data-delivery-fee-amount
                    type="number"
                    min="0"
                    step="1"
                    required
                    inputMode="decimal"
                    disabled={readonly}
                    aria-label={t("admin.delivery_fee.amount_aria")}
                    value={item.fee}
                    onChange={e => update(index, { fee: Math.max(0, Number(e.target.value || 0)) })}
                  />}
                </div>
                <div className="delivery-fee-action" role="cell">
                  {pickup ? <span className="delivery-fee-lock" title={t("admin.delivery_fee.pickup_locked")} aria-label={t("admin.delivery_fee.pickup_locked")} role="img"><i className="bi bi-lock-fill app-icon" aria-hidden="true"></i></span> : <button className="btn delivery-fee-remove" type="button" data-remove-delivery-fee disabled={readonly} aria-label={t("admin.delivery_fee.remove")} title={t("admin.delivery_fee.remove")} onClick={() => remove(index)}><i className="bi bi-x-lg app-icon" aria-hidden="true"></i></button>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PromotionEditor({ value, onChange, menus, t, formatMoney }) {
  const patch = update => onChange({ ...value, ...update });
  const activeMenus = menus
    .filter(item => item.active !== false)
    .slice()
    .sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || ""), "th"));
  return (
    <section className="admin-delivery-promotion" id="deliveryPromotionSettings">
      <div className="admin-delivery-promotion-head">
        <div><h3><i className="bi bi-gift" aria-hidden="true"></i>{t("admin.delivery_promotion.title")}</h3><p>{t("admin.delivery_promotion.description")}</p></div>
        <span className="admin-delivery-promotion-badge">{t("admin.delivery_promotion.badge")}</span>
      </div>
      <div className="admin-delivery-promotion-block">
        <label className="admin-promotion-toggle">
          <input type="checkbox" id="deliveryFreeShippingEnabled" checked={value.freeShippingEnabled} onChange={e => patch({ freeShippingEnabled: e.target.checked })} />
          <span className="admin-promotion-toggle-ui"></span>
          <span><strong>{t("admin.delivery_promotion.free_shipping_title")}</strong><small>{t("admin.delivery_promotion.free_shipping_help")}</small></span>
        </label>
        <div className="admin-promotion-fields">
          <div className="field"><label htmlFor="deliveryFreeShippingMinimumSubtotal">{t("admin.delivery_promotion.minimum_subtotal")}</label><div className="admin-promotion-money-input"><input className="input" id="deliveryFreeShippingMinimumSubtotal" type="number" min="0" step="0.01" disabled={!value.freeShippingEnabled} value={value.freeShippingMinimumSubtotal} onChange={e => patch({ freeShippingMinimumSubtotal: Math.max(0, Number(e.target.value || 0)) })} /><span>{t("admin.common.baht")}</span></div></div>
        </div>
      </div>
      <div className="admin-delivery-promotion-block">
        <label className="admin-promotion-toggle">
          <input type="checkbox" id="deliveryFreeGiftEnabled" checked={value.freeGiftEnabled} onChange={e => patch({ freeGiftEnabled: e.target.checked })} />
          <span className="admin-promotion-toggle-ui"></span>
          <span><strong>{t("admin.delivery_promotion.free_gift_title")}</strong><small>{t("admin.delivery_promotion.free_gift_help")}</small></span>
        </label>
        <div className="admin-promotion-fields admin-promotion-fields-three">
          <div className="field"><label htmlFor="deliveryFreeGiftMaxSelectableItems">{t("admin.delivery_promotion.max_gifts")}</label><div className="admin-promotion-number-input"><input className="input" id="deliveryFreeGiftMaxSelectableItems" type="number" min="1" max="20" step="1" disabled={!value.freeGiftEnabled} value={value.freeGiftMaxSelectableItems} onChange={e => patch({ freeGiftMaxSelectableItems: Math.max(1, Math.min(20, Number.parseInt(e.target.value || 1, 10) || 1)) })} /><span>{t("admin.delivery_promotion.item_unit")}</span></div></div>
          <div className="field"><label htmlFor="deliveryFreeGiftValidFrom">{t("admin.delivery_promotion.valid_from")}</label><input className="input" id="deliveryFreeGiftValidFrom" type="date" disabled={!value.freeGiftEnabled} value={value.freeGiftValidFrom} onChange={e => patch({ freeGiftValidFrom: e.target.value })} /><small className="admin-promotion-help">{t("admin.delivery_promotion.valid_from_help")}</small></div>
          <div className="field"><label htmlFor="deliveryFreeGiftValidUntil">{t("admin.delivery_promotion.valid_until")}</label><input className="input" id="deliveryFreeGiftValidUntil" type="date" disabled={!value.freeGiftEnabled} value={value.freeGiftValidUntil} onChange={e => patch({ freeGiftValidUntil: e.target.value })} /><small className="admin-promotion-help">{t("admin.delivery_promotion.valid_until_help")}</small></div>
        </div>
        <div className="admin-promotion-gifts">
          <div className="admin-promotion-gifts-head"><div><strong>{t("admin.delivery_promotion.gift_items_title")}</strong><small>{t("admin.delivery_promotion.gift_items_help")}</small></div><span className="badge" id="deliveryFreeGiftSelectedCount">{t("admin.delivery_promotion.selected_count", { count: value.freeGiftMenuIds.length })}</span></div>
          <div className="admin-promotion-gift-list" id="deliveryFreeGiftMenuList">
            {activeMenus.length ? activeMenus.map(menu => (
              <label className="admin-promotion-gift-item" key={menu.id}>
                <input type="checkbox" disabled={!value.freeGiftEnabled} checked={value.freeGiftMenuIds.includes(menu.id)} onChange={e => {
                  const next = e.target.checked ? [...new Set([...value.freeGiftMenuIds, menu.id])] : value.freeGiftMenuIds.filter(id => id !== menu.id);
                  patch({ freeGiftMenuIds: next });
                }} />
                <span><strong>{menu.name}</strong><small>{menu.category || t("admin.delivery_promotion.uncategorized")} • {formatMoney(menu.price)} {t("admin.common.baht")}</small></span>
              </label>
            )) : <div className="admin-promotion-empty">{t("admin.delivery_promotion.no_available_menus")}</div>}
          </div>
        </div>
      </div>
      <div className="admin-delivery-promotion-note"><i className="bi bi-shield-check" aria-hidden="true"></i><span>{t("admin.delivery_promotion.backend_note")}</span></div>
    </section>
  );
}

function feeRowsFromSettings(settings, t) {
  const positiveNumber = value => {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return null;
    return Math.round(number * 100) / 100;
  };
  const distanceForOption = (option, index) => {
    const explicit = positiveNumber(option?.maxDistanceKm ?? option?.distanceKm ?? option?.maxDistance);
    if (explicit !== null) return explicit;
    const legacy = LEGACY_DISTANCE_LIMITS[String(option?.id || option?.key || "")];
    if (legacy) return legacy;
    const fallback = DEFAULT_DISTANCE_LIMITS[index];
    if (fallback) return fallback;
    return DEFAULT_DISTANCE_LIMITS.at(-1) + ((index - DEFAULT_DISTANCE_LIMITS.length + 1) * 5);
  };
  const hasLegacy = ["deliveryFeeNearby", "deliveryFeeGeneral", "deliveryFeeFar"]
    .some(key => settings?.[key] !== undefined && settings?.[key] !== null && settings?.[key] !== "");
  const source = Array.isArray(settings?.deliveryFeeOptions) && settings.deliveryFeeOptions.length
    ? settings.deliveryFeeOptions
    : hasLegacy
      ? [
          { id: "pickup", label: "", maxDistanceKm: null, fee: 0 },
          { id: "distance-0-2", label: "", maxDistanceKm: 2, fee: Number(settings.deliveryFeeNearby ?? 10) },
          { id: "distance-2-5", label: "", maxDistanceKm: 5, fee: Number(settings.deliveryFeeGeneral ?? 30) },
          { id: "distance-5-plus", label: "", maxDistanceKm: 10, fee: Number(settings.deliveryFeeFar ?? 50) },
        ]
      : DEFAULT_FEES;
  const sourceStartsWithPickup = String(source[0]?.id || "") === "pickup";
  const normalized = source.map((item, index) => {
    const id = String(item?.id || item?.key || "fee-" + (index + 1)).trim() || "fee-" + (index + 1);
    const pickup = id === "pickup";
    const distanceIndex = Math.max(0, index - (sourceStartsWithPickup ? 1 : 0));
    return {
      id,
      label: String(item?.label ?? item?.name ?? "").trim(),
      fee: pickup ? 0 : Math.max(0, Number(item?.fee ?? item?.amount ?? 0) || 0),
      maxDistanceKm: pickup ? null : distanceForOption(item, distanceIndex),
      locked: pickup,
    };
  });
  const pickup = normalized.find(item => item.id === "pickup")
    || { ...DEFAULT_FEES[0], label: t("admin.delivery_fee.default_pickup") };
  const tiers = normalized
    .filter(item => item.id !== "pickup" && positiveNumber(item.maxDistanceKm) !== null)
    .sort((left, right) => Number(left.maxDistanceKm) - Number(right.maxDistanceKm))
    .slice(0, 11);
  return [pickup, ...tiers];
}

export function AdminPage() {
  const authState = useAuth();
  const tenantState = useTenant();
  const { profile } = authState;
  const { tenant } = tenantState;
  const { t, intlLocale } = useI18n();
  const stylesReady = useParityPage({
    title: t("admin.meta.title"),
    bodyClass: "order-delivery-workspace admin-vr-page admin-vr-dashboard",
    styles: [
      "app.css", "menu-pagination.css", "admin-sort.css", "icons.css", "admin-workspace.css",
      "admin-icon-polish.css", "sweet-dialog.css", "order-delivery-workspace-theme.css", "admin-retail-pos-parity.css",
      "admin-react-master-visual.css",
      "admin-modal-retail-pos-parity.css", "admin-delivery-fee-row-alignment.css",
      "admin-store-location.css", "admin-delivery-providers.css", "admin-delivery-promotions.css",
      "admin-upload.css", "admin-mobile-table.css",
    ],
    attributes: { "data-roles": "admin", "data-admin-workspace-refresh": "1" },
  });

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [settings, setSettings] = useState({});
  const [menus, setMenus] = useState([]);
  const [tables, setTables] = useState([]);
  const [lalamove, setLalamove] = useState({});
  const [wallet, setWallet] = useState({});
  const [lalamoveForm, setLalamoveForm] = useState({ accountMode: "disabled", environment: "sandbox", apiKey: "", apiSecret: "" });
  const [lalamoveSaving, setLalamoveSaving] = useState(false);
  const [lalamoveTesting, setLalamoveTesting] = useState(false);
  const [walletTopupAmount, setWalletTopupAmount] = useState("");
  const [walletTopupFile, setWalletTopupFile] = useState(null);
  const [walletTopupBusy, setWalletTopupBusy] = useState(false);
  const [walletSlipDragOver, setWalletSlipDragOver] = useState(false);
  const [walletDeleteBusy, setWalletDeleteBusy] = useState("");
  const [storeForm, setStoreForm] = useState({
    shopName: "", shopAddress: "", shopPhone: "", promptPayId: "", promptPayName: "",
    bankName: "", bankAccountNumber: "", bankAccountName: "",
    deliveryProvider: "self", deliveryMaxDistanceKm: 10,
  });
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [mapError, setMapError] = useState("");
  const [locationBusy, setLocationBusy] = useState(false);
  const [fees, setFees] = useState([]);
  const [promotion, setPromotion] = useState(normalizedPromotion({}));
  const [storeSaving, setStoreSaving] = useState(false);
  const [menuSearch, setMenuSearch] = useState("");
  const [menuStatus, setMenuStatus] = useState("all");
  const [tableSearch, setTableSearch] = useState("");
  const [tableStatus, setTableStatus] = useState("all");
  const [menuPage, setMenuPage] = useState(1);
  const [tablePage, setTablePage] = useState(1);
  const [pageSize, setPageSize] = useState(() => window.matchMedia?.("(max-width: 480px)")?.matches ? 5 : 10);
  const [modal, setModal] = useState({ open: false, entity: "menu", editing: null });
  const [entitySaving, setEntitySaving] = useState(false);
  const [menuForm, setMenuForm] = useState({ id: "", name: "", category: "", price: "", image: "", imagePath: "", imagePositionY: 50, active: true });
  const [tableForm, setTableForm] = useState({ id: "", code: "", name: "", capacity: 4, active: true });
  const [menuImageFile, setMenuImageFile] = useState(null);
  const [menuImagePreview, setMenuImagePreview] = useState("");
  const [menuImageError, setMenuImageError] = useState("");
  const menuImagePositionDragRef = useRef({ dragging: false, startY: 0, startPositionY: 50 });
  const [categoryOrder, setCategoryOrder] = useState([]);
  const [selectedSortCategory, setSelectedSortCategory] = useState("");
  const categorySortListRef = useRef(null);
  const itemSortListRef = useRef(null);

  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 480px)");
    if (!media) return undefined;
    const syncPageSize = () => setPageSize(media.matches ? 5 : 10);
    syncPageSize();
    media.addEventListener?.("change", syncPageSize);
    return () => media.removeEventListener?.("change", syncPageSize);
  }, []);

  const load = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    setLoadError("");
    try {
      let data = null;
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          data = await loadAdminSnapshot(tenant.id);
          break;
        } catch (error) {
          lastError = error;
          if (attempt < 2) await new Promise(resolve => window.setTimeout(resolve, 220 * (attempt + 1)));
        }
      }
      if (!data) throw lastError || new Error("ADMIN_LOAD_FAILED");
      const s = data.settings || {};
      setSettings(s);
      setMenus(data.menus || []);
      setTables(data.tables || []);
      const lalamoveStatus = data.lalamove || {};
      setLalamove(lalamoveStatus);
      setWallet(data.wallet || {});
      setLalamoveForm({
        accountMode: lalamoveStatus.accountMode === "partner" ? "tenant" : (["disabled", "tenant", "fod_central"].includes(lalamoveStatus.accountMode) ? lalamoveStatus.accountMode : "disabled"),
        environment: lalamoveStatus.environment === "production" ? "production" : "sandbox",
        apiKey: "",
        apiSecret: "",
      });
      setStoreForm({
        shopName: String(s.shopName || tenant.name || ""),
        shopAddress: String(s.shopAddress || ""),
        shopPhone: String(s.shopPhone || ""),
        promptPayId: String(s.promptPayId || ""),
        promptPayName: String(s.promptPayName || s.promptPayAccountName || ""),
        bankName: String(s.bankName || ""),
        bankAccountNumber: String(s.bankAccountNumber || ""),
        bankAccountName: String(s.bankAccountName || ""),
        deliveryProvider: String(s.deliveryProvider || "self").toLowerCase() === "lalamove" && lalamoveStatus.available === true ? "lalamove" : "self",
        deliveryMaxDistanceKm: Number(s.deliveryMaxDistanceKm ?? 10) >= 0 ? Number(s.deliveryMaxDistanceKm ?? 10) : 10,
      });
      setLocation(normalizeLocation(s.storeLatitude, s.storeLongitude));
      setFees(feeRowsFromSettings(s, t));
      setPromotion(normalizedPromotion(s));
      const categories = [...new Set((data.menus || []).map(item => String(item.category || t("admin.menu.other_category"))))];
      const configuredOrder = Array.isArray(s.categoryOrder) ? s.categoryOrder.map(String) : [];
      const nextOrder = [...configuredOrder.filter(name => categories.includes(name)), ...categories.filter(name => !configuredOrder.includes(name))];
      setCategoryOrder(nextOrder);
      setSelectedSortCategory(current => current && categories.includes(current) ? current : (nextOrder[0] || categories[0] || ""));
    } catch (error) {
      console.error("ADMIN_LOAD_FAILED", error);
      setLoadError(error?.message || "ADMIN_LOAD_FAILED");
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, tenant?.name, t]);

  useEffect(() => {
    if (profile && ["owner", "admin"].includes(profile.role) && tenant?.id) load();
  }, [profile?.role, tenant?.id, load]);

  const patchStore = patch => setStoreForm(current => ({ ...current, ...patch }));
  const patchLalamove = patch => setLalamoveForm(current => ({ ...current, ...patch }));

  useEffect(() => {
    if (!tenant?.id || wallet?.loadError !== true) return undefined;
    let cancelled = false;
    let timer = 0;
    let attempts = 0;

    const recover = delay => {
      window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        if (cancelled) return;
        attempts += 1;
        try {
          const next = await loadOwnTenantLalamoveWallet();
          if (!cancelled) setWallet(next || {});
        } catch (error) {
          console.warn("ADMIN_LALAMOVE_WALLET_RECOVERY_FAILED", error);
          if (!cancelled && attempts < 3) recover(1500 * attempts);
        }
      }, delay);
    };

    const recoverNow = async () => {
      if (cancelled) return;
      try {
        const next = await loadOwnTenantLalamoveWallet();
        if (!cancelled) setWallet(next || {});
      } catch (error) {
        console.warn("ADMIN_LALAMOVE_WALLET_RECOVERY_FAILED", error);
      }
    };

    const onFocus = () => { void recoverNow(); };
    const onVisibility = () => { if (!document.hidden) void recoverNow(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    recover(1200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [tenant?.id, wallet?.loadError]);

  const refreshWallet = async () => {
    try {
      const next = await loadOwnTenantLalamoveWallet();
      setWallet(next || {});
      return next || {};
    } catch (error) {
      console.error("ADMIN_LALAMOVE_WALLET_REFRESH_FAILED", error);
      setWallet(current => ({ ...current, loadError: true }));
      return { ...wallet, loadError: true };
    }
  };

  const saveLalamoveAccount = async () => {
    if (lalamoveSaving) return;
    setLalamoveSaving(true);
    try {
      const saved = await updateTenantLalamoveSettings({
        accountMode: lalamoveForm.accountMode,
        environment: lalamoveForm.environment,
        apiKey: lalamoveForm.apiKey.trim(),
        apiSecret: lalamoveForm.apiSecret.trim(),
      });
      setLalamove(saved || {});
      setLalamoveForm(current => ({
        ...current,
        accountMode: saved?.accountMode === "partner" ? "tenant" : (saved?.accountMode || current.accountMode),
        environment: saved?.environment === "production" ? "production" : "sandbox",
        apiKey: "",
        apiSecret: "",
      }));
      if (saved?.available !== true && storeForm.deliveryProvider === "lalamove") patchStore({ deliveryProvider: "self" });
      await refreshWallet();
      showToast(t("admin.delivery_settings.lalamove_account_saved"));
    } catch (error) {
      console.error("ADMIN_LALAMOVE_SAVE_FAILED", error);
      showToast(t("admin.delivery_settings.lalamove_account_save_failed"), "error");
    } finally {
      setLalamoveSaving(false);
    }
  };

  const lalamoveTestFailure = error => {
    const text = String(error?.message || "");
    const providerStatus = Number(error?.details?.providerStatus || 0);
    const providerError = String(error?.details?.providerError || "").trim();
    const requestId = String(error?.details?.requestId || "");
    let message = t("admin.delivery_settings.lalamove_test_failed");
    if (text.includes("LALAMOVE_CREDENTIAL_PREFIX_MISMATCH")) message = t("admin.delivery_settings.lalamove_test_prefix_mismatch");
    else if (providerStatus === 401) message = t("admin.delivery_settings.lalamove_test_unauthorized");
    else if (providerStatus === 403) message = t("admin.delivery_settings.lalamove_test_forbidden");
    else if (providerStatus === 0) message = t("admin.delivery_settings.lalamove_test_network_error");
    const safeDetail = providerError && providerError !== "LALAMOVE_CONNECTION_FAILED" ? " · " + providerError : "";
    return message + safeDetail + (requestId ? " · Request ID: " + requestId : "");
  };

  const testLalamoveAccount = async () => {
    if (lalamoveTesting) return;
    setLalamoveTesting(true);
    try {
      const response = await testTenantLalamoveConnection();
      const next = response?.item || {};
      setLalamove(next);
      setLalamoveForm(current => ({
        ...current,
        accountMode: next.accountMode === "partner" ? "tenant" : (next.accountMode || current.accountMode),
        environment: next.environment === "production" ? "production" : "sandbox",
        apiKey: "",
        apiSecret: "",
      }));
      await refreshWallet();
      showToast(t("admin.delivery_settings.lalamove_test_success"));
    } catch (error) {
      console.error("ADMIN_LALAMOVE_TEST_FAILED", error);
      showToast(lalamoveTestFailure(error), "error");
    } finally {
      setLalamoveTesting(false);
    }
  };

  const chooseWalletSlip = file => {
    const input = document.getElementById("lalamoveFodWalletTopupSlip");
    if (!file) {
      setWalletTopupFile(null);
      if (input) input.value = "";
      return;
    }
    const mime = String(file.type || "").toLowerCase();
    const extension = String(file.name || "").split(".").pop()?.toLowerCase() || "";
    const allowedMime = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    const allowedExtension = ["jpg", "jpeg", "png", "webp", "pdf"];
    const validType = allowedMime.includes(mime) || allowedExtension.includes(extension);
    if (!validType || !(Number(file.size || 0) > 0) || file.size > 10 * 1024 * 1024) {
      showToast(t("admin.delivery_settings.fod_wallet_topup_file_invalid"), "error");
      setWalletTopupFile(null);
      if (input) input.value = "";
      return;
    }
    setWalletTopupFile(file);
  };

  const submitWalletTopup = async () => {
    const amount = Number(walletTopupAmount || 0);
    if (!tenant?.id || walletTopupBusy || !Number.isFinite(amount) || amount < 1 || !walletTopupFile) {
      showToast(t("admin.delivery_settings.fod_wallet_topup_invalid"), "error");
      return;
    }
    setWalletTopupBusy(true);
    try {
      const result = await submitTenantLalamoveWalletTopup(tenant.id, amount, walletTopupFile);
      setWallet(result?.wallet || await loadOwnTenantLalamoveWallet());
      setWalletTopupAmount("");
      setWalletTopupFile(null);
      const slipInput = document.getElementById("lalamoveFodWalletTopupSlip");
      if (slipInput) slipInput.value = "";
      showToast(t(result?.autoApproved
        ? "admin.delivery_settings.fod_wallet_topup_auto_approved"
        : "admin.delivery_settings.fod_wallet_topup_submitted"));
    } catch (error) {
      console.error("ADMIN_LALAMOVE_TOPUP_FAILED", error);
      const text = String(error?.message || "");
      const key = text.includes("FOD_WALLET_TOPUP_DUPLICATE_SLIP")
        ? "admin.delivery_settings.fod_wallet_topup_duplicate"
        : text.includes("FOD_WALLET_TOPUP_DESTINATION_REQUIRED")
          ? "admin.delivery_settings.fod_wallet_topup_destination_missing"
          : text.includes("FOD_WALLET_TOPUP_NOT_ALLOWED")
            ? "admin.delivery_settings.fod_wallet_topup_not_allowed"
            : "admin.delivery_settings.fod_wallet_topup_failed";
      showToast(t(key), "error");
    } finally {
      setWalletTopupBusy(false);
    }
  };

  const removeWalletTopup = async item => {
    if (!item?.id || walletDeleteBusy) return;
    const confirmed = await sweetConfirm(t("admin.delivery_settings.fod_wallet_topup_delete_confirm"), {
      title: t("admin.delivery_settings.fod_wallet_topup_delete"),
      confirmText: t("admin.delivery_settings.fod_wallet_topup_delete"),
      cancelText: t("shared.actions.cancel"),
      type: "warning",
    });
    if (!confirmed) return;
    setWalletDeleteBusy(item.id);
    try {
      const result = await deleteTenantLalamoveWalletTopup(item.id);
      setWallet(result?.wallet || await loadOwnTenantLalamoveWallet());
      showToast(t("admin.delivery_settings.fod_wallet_topup_deleted"));
    } catch (error) {
      console.error("ADMIN_LALAMOVE_TOPUP_DELETE_FAILED", error);
      showToast(t("admin.delivery_settings.fod_wallet_topup_delete_failed"), "error");
    } finally {
      setWalletDeleteBusy("");
    }
  };

  const useCurrentLocation = () => {
    setLocationError("");
    setMapError("");
    if (!navigator.geolocation) {
      setLocationError(t("admin.store_location.geolocation_unsupported"));
      return;
    }
    setLocationBusy(true);
    navigator.geolocation.getCurrentPosition(
      position => {
        setLocation(normalizeLocation(position.coords.latitude, position.coords.longitude));
        setLocationError("");
        setMapError("");
        setLocationBusy(false);
      },
      error => {
        console.error("ADMIN_STORE_GEOLOCATION_FAILED", error);
        setLocationError(t("admin.store_location.geolocation_failed"));
        setLocationBusy(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  };

  const saveStore = async event => {
    event.preventDefault();
    if (!tenant?.id || storeSaving) return;
    const cleanFees = fees
      .map((item, index) => {
        const id = String(item.id || "fee-" + (index + 1));
        const pickup = id === "pickup" || item.locked === true;
        const maxDistanceKm = pickup ? null : (Number(item.maxDistanceKm) > 0 ? Number(item.maxDistanceKm) : null);
        const typedLabel = String(item.label || "").trim();
        const fallbackLabel = pickup
          ? t("admin.delivery_fee.default_pickup")
          : (maxDistanceKm === null ? "" : t("admin.delivery_fee.up_to", { distance: maxDistanceKm }));
        return {
          id,
          label: typedLabel || fallbackLabel,
          fee: pickup ? 0 : Math.max(0, Number(item.fee || 0)),
          ...(maxDistanceKm !== null ? { maxDistanceKm } : {}),
        };
      })
      .filter(item => item.id === "pickup" || Number(item.maxDistanceKm) > 0);
    setStoreSaving(true);
    try {
      const pickupFee = cleanFees.find(item => item.id === "pickup") || {
        id: "pickup",
        label: t("admin.delivery_fee.default_pickup"),
        fee: 0,
      };
      const distanceTiers = cleanFees
        .filter(item => item.id !== "pickup" && Number(item.maxDistanceKm) > 0)
        .sort((left, right) => Number(left.maxDistanceKm) - Number(right.maxDistanceKm));
      const normalizedFees = [
        { ...pickupFee, maxDistanceKm: null, fee: 0 },
        ...distanceTiers,
      ];
      const payload = {
        ...storeForm,
        shopName: storeForm.shopName.trim(),
        shopAddress: storeForm.shopAddress.trim(),
        shopPhone: storeForm.shopPhone.trim(),
        promptPayId: storeForm.promptPayId.trim(),
        promptPayName: storeForm.promptPayName.trim(),
        promptPayAccountName: storeForm.promptPayName.trim(),
        bankName: storeForm.bankName.trim(),
        bankAccountNumber: storeForm.bankAccountNumber.trim(),
        bankAccountName: storeForm.bankAccountName.trim(),
        deliveryMaxDistanceKm: Number(storeForm.deliveryMaxDistanceKm) > 0 ? Math.round(Number(storeForm.deliveryMaxDistanceKm) * 100) / 100 : 10,
        deliveryFeeOptions: normalizedFees,
        deliveryFeeNearby: distanceTiers[0]?.fee ?? 0,
        deliveryFeeGeneral: distanceTiers[1]?.fee ?? distanceTiers[0]?.fee ?? 0,
        deliveryFeeFar: distanceTiers[2]?.fee ?? distanceTiers.at(-1)?.fee ?? 0,
        storeLatitude: location?.latitude ?? null,
        storeLongitude: location?.longitude ?? null,
        deliveryPromotion: promotionForStore(promotion),
      };
      const saved = await saveAdminStoreSettings(tenant.id, payload);
      const expectedPromotion = JSON.stringify(payload.deliveryPromotion);
      const actualPromotion = JSON.stringify(promotionForStore(normalizedPromotion(saved)));
      const textFields = [
        "shopName", "shopAddress", "shopPhone", "promptPayId", "promptPayName",
        "bankName", "bankAccountNumber", "bankAccountName", "deliveryProvider",
      ];
      const textMismatch = textFields.some(field => String(saved?.[field] ?? "") !== String(payload[field] ?? ""));
      const numberMismatch = ["storeLatitude", "storeLongitude", "deliveryMaxDistanceKm"].some(field => {
        const expected = payload[field];
        const actual = saved?.[field];
        if (expected === null || expected === undefined || expected === "") {
          return !(actual === null || actual === undefined || actual === "");
        }
        return !Number.isFinite(Number(actual)) || Math.abs(Number(actual) - Number(expected)) > 0.0001;
      });
      const normalizeFeeRows = rows => (Array.isArray(rows) ? rows : []).map(item => ({
        id: String(item?.id || ""),
        label: String(item?.label || ""),
        fee: Number(item?.fee || 0),
        ...(Number(item?.maxDistanceKm) > 0 ? { maxDistanceKm: Number(item.maxDistanceKm) } : {}),
      }));
      const feeMismatch = JSON.stringify(normalizeFeeRows(saved?.deliveryFeeOptions))
        !== JSON.stringify(normalizeFeeRows(payload.deliveryFeeOptions));
      if (textMismatch || numberMismatch || feeMismatch || expectedPromotion !== actualPromotion) {
        throw new Error("STORE_SETTINGS_VERIFICATION_FAILED");
      }
      setSettings(saved);
      showToast(t("admin.store.save_success"));
    } catch (error) {
      console.error("ADMIN_STORE_SAVE_FAILED", error);
      showToast(t("admin.store.save_failed"), "error");
    } finally {
      setStoreSaving(false);
    }
  };

  const closeModal = () => {
    if (entitySaving) return;
    if (menuImagePreview?.startsWith("blob:")) URL.revokeObjectURL(menuImagePreview);
    setMenuImageFile(null);
    setMenuImagePreview("");
    setMenuImageError("");
    setModal({ open: false, entity: "menu", editing: null });
  };

  const openMenu = menu => {
    const item = menu || {};
    setMenuForm({
      id: item.id || "", name: item.name || "", category: item.category || "", price: item.price ?? "",
      image: item.image || "", imagePath: item.imagePath || "", imagePositionY: Number(item.imagePositionY ?? 50), active: item.active !== false,
    });
    setMenuImageFile(null);
    setMenuImagePreview(item.image || "");
    setMenuImageError("");
    setModal({ open: true, entity: "menu", editing: menu || null });
  };

  const openTable = table => {
    const item = table || {};
    setTableForm({
      id: item.id || "", code: item.code || "", name: item.name || "",
      capacity: Math.max(1, Number.parseInt(item.capacity ?? item.seats ?? item.seatCount ?? 4, 10) || 4),
      active: item.active !== false,
    });
    setModal({ open: true, entity: "table", editing: table || null });
  };

  const chooseMenuImage = file => {
    setMenuImageError("");
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      const message = t("admin.menu.image_too_large");
      setMenuImageError(message);
      showToast(message, "error");
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    if (file.type && !allowed.includes(file.type)) {
      const message = t("admin.menu.image_type_invalid");
      setMenuImageError(message);
      showToast(message, "error");
      return;
    }
    if (menuImagePreview?.startsWith("blob:")) URL.revokeObjectURL(menuImagePreview);
    setMenuImageFile(file);
    setMenuImagePreview(URL.createObjectURL(file));
    setMenuForm(current => ({ ...current, imagePositionY: 50 }));
  };

  const clampMenuImagePosition = value => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

  const startMenuImagePositionDrag = event => {
    event.preventDefault();
    menuImagePositionDragRef.current = {
      dragging: true,
      startY: event.clientY,
      startPositionY: clampMenuImagePosition(menuForm.imagePositionY),
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveMenuImagePosition = event => {
    const drag = menuImagePositionDragRef.current;
    if (!drag.dragging) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const nextPosition = drag.startPositionY - ((event.clientY - drag.startY) / Math.max(rect.height, 1)) * 100;
    setMenuForm(current => ({ ...current, imagePositionY: clampMenuImagePosition(nextPosition) }));
  };

  const endMenuImagePositionDrag = event => {
    if (!menuImagePositionDragRef.current.dragging) return;
    event.preventDefault();
    menuImagePositionDragRef.current.dragging = false;
    try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch (_) {}
  };

  const submitMenu = async () => {
    if (!tenant?.id || entitySaving) return;
    const name = String(menuForm.name || "").trim();
    const category = String(menuForm.category || "").trim();
    const price = Number(menuForm.price);
    if (!name || !category || !Number.isFinite(price) || price < 0) return;
    setEntitySaving(true);
    try {
      const id = menuForm.id || crypto.randomUUID();
      let image = menuForm.image || "";
      let imagePath = menuForm.imagePath || "";
      if (menuImageFile) {
        const blob = await resizeMenuImage(menuImageFile);
        const uploaded = await uploadAdminMenuImage(id, blob);
        image = uploaded.url;
        imagePath = uploaded.path;
      }
      await saveAdminMenu(tenant.id, {
        ...menuForm,
        id,
        name,
        category,
        price,
        image,
        imagePath,
        active: menuForm.active !== false,
      });
      showToast(t("admin.menu.saved"));
      closeModal();
      await load();
    } catch (error) {
      console.error("ADMIN_MENU_SAVE_FAILED", error);
      let message = t("admin.menu.save_failed");
      if (error?.message === "DUPLICATE_MENU_NAME") message = t("admin.menu.name_duplicate");
      if (error?.message === "IMAGE_TOO_LARGE") message = t("admin.menu.image_too_large");
      if (error?.message === "INVALID_IMAGE_TYPE") message = t("admin.menu.image_type_invalid");
      if (error?.message === "IMAGE_DECODE_FAILED") message = t("admin.menu.image_decode_failed");
      setMenuImageError(message);
      showToast(message, "error");
    } finally {
      setEntitySaving(false);
    }
  };

  const submitTable = async () => {
    if (!tenant?.id || entitySaving) return;
    const code = String(tableForm.code || "").trim().toUpperCase();
    const name = String(tableForm.name || "").trim();
    const capacity = Number.parseInt(tableForm.capacity, 10);
    if (!code || !name) return;
    if (!Number.isFinite(capacity) || capacity < 1 || capacity > 100) {
      showToast(t("admin.table.capacity_invalid"), "error");
      return;
    }
    setEntitySaving(true);
    try {
      await saveAdminTable(tenant.id, {
        ...tableForm,
        code,
        name,
        capacity,
        active: tableForm.active !== false,
      });
      showToast(t("admin.table.saved"));
      closeModal();
      await load();
    } catch (error) {
      console.error("ADMIN_TABLE_SAVE_FAILED", error);
      showToast(t("shared.state.save_failed"), "error");
    } finally {
      setEntitySaving(false);
    }
  };

  const removeMenu = async menu => {
    const confirmed = await sweetConfirm(t("admin.menu.delete_confirm"), {
      title: t("admin.menu.delete_title"),
      confirmText: t("admin.common.confirm"),
      cancelText: t("admin.common.cancel"),
      type: "warning",
    });
    if (!confirmed) return;
    try {
      await deleteAdminMenu(tenant.id, menu.id);
      showToast(t("admin.menu.deleted"));
      await load();
    } catch (error) {
      console.error("ADMIN_MENU_DELETE_FAILED", error);
      showToast(t("shared.state.action_failed"), "error");
    }
  };

  const removeTable = async table => {
    const confirmed = await sweetConfirm(t("admin.table.delete_confirm"), {
      title: t("admin.table.delete_title"),
      confirmText: t("admin.common.confirm"),
      cancelText: t("admin.common.cancel"),
      type: "warning",
    });
    if (!confirmed) return;
    try {
      await deleteAdminTable(tenant.id, table.id);
      showToast(t("admin.table.deleted"));
      await load();
    } catch (error) {
      console.error("ADMIN_TABLE_DELETE_FAILED", error);
      showToast(t("shared.state.action_failed"), "error");
    }
  };

  const filteredMenus = useMemo(() => {
    const query = menuSearch.trim().toLocaleLowerCase();
    return menus.filter(item => {
      if (menuStatus === "active" && item.active === false) return false;
      if (menuStatus === "inactive" && item.active !== false) return false;
      if (query && ![item.name, item.category].join(" ").toLocaleLowerCase().includes(query)) return false;
      return true;
    });
  }, [menus, menuSearch, menuStatus]);

  const filteredTables = useMemo(() => {
    const query = tableSearch.trim().toLocaleLowerCase();
    return tables.filter(item => {
      if (tableStatus === "active" && item.active === false) return false;
      if (tableStatus === "inactive" && item.active !== false) return false;
      if (query && ![item.code, item.name].join(" ").toLocaleLowerCase().includes(query)) return false;
      return true;
    });
  }, [tables, tableSearch, tableStatus]);

  useEffect(() => setMenuPage(1), [menuSearch, menuStatus, menus]);
  useEffect(() => setTablePage(1), [tableSearch, tableStatus, tables]);

  const menuPages = Math.max(1, Math.ceil(filteredMenus.length / pageSize));
  const tablePages = Math.max(1, Math.ceil(filteredTables.length / pageSize));
  const currentMenuPage = Math.min(menuPage, menuPages);
  const currentTablePage = Math.min(tablePage, tablePages);
  const visibleMenus = filteredMenus.slice((currentMenuPage - 1) * pageSize, currentMenuPage * pageSize);
  const visibleTables = filteredTables.slice((currentTablePage - 1) * pageSize, currentTablePage * pageSize);
  const menuPaginationPages = visiblePaginationPages(currentMenuPage, menuPages);
  const tablePaginationPages = visiblePaginationPages(currentTablePage, tablePages);

  useEffect(() => {
    if (menuPage > menuPages) setMenuPage(menuPages);
  }, [menuPage, menuPages]);

  useEffect(() => {
    if (tablePage > tablePages) setTablePage(tablePages);
  }, [tablePage, tablePages]);

  const goToListPage = (kind, page) => {
    const total = kind === "menu" ? menuPages : tablePages;
    const next = Math.max(1, Math.min(total, Number(page) || 1));
    if (kind === "menu") setMenuPage(next);
    else setTablePage(next);
    window.requestAnimationFrame(() => {
      document.getElementById(kind === "menu" ? "menuListPagination" : "tableListPagination")
        ?.closest("section")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const itemOrder = useMemo(
    () => menus.filter(item => String(item.category || t("admin.menu.other_category")) === selectedSortCategory)
      .sort((a, b) => Number(a.sortOrder ?? 9999) - Number(b.sortOrder ?? 9999)),
    [menus, selectedSortCategory, t],
  );

  useEffect(() => {
    if (loading) return undefined;
    const touchDevice = window.matchMedia?.("(pointer: coarse)")?.matches || "ontouchstart" in window;
    const options = onEnd => ({
      animation: 120,
      handle: ".sort-handle",
      ghostClass: "sort-ghost",
      chosenClass: "sort-chosen",
      dragClass: "sort-drag",
      fallbackClass: "sort-fallback",
      delay: 80,
      delayOnTouchOnly: true,
      touchStartThreshold: 4,
      forceFallback: Boolean(touchDevice),
      fallbackOnBody: Boolean(touchDevice),
      fallbackTolerance: 5,
      scroll: true,
      scrollSensitivity: 60,
      scrollSpeed: 14,
      bubbleScroll: true,
      onEnd,
    });

    const categoryList = categorySortListRef.current;
    const itemList = itemSortListRef.current;
    const categorySortable = categoryList && categoryOrder.length
      ? new Sortable(categoryList, options(() => {
        const nextOrder = [...categoryList.querySelectorAll("[data-sort-category]")]
          .map(node => node.dataset.sortCategory)
          .filter(Boolean);
        if (nextOrder.length) setCategoryOrder(nextOrder);
      }))
      : null;
    const itemSortable = itemList && itemOrder.length
      ? new Sortable(itemList, options(() => {
        const ids = [...itemList.querySelectorAll("[data-sort-menu-id]")]
          .map(node => node.dataset.sortMenuId)
          .filter(Boolean);
        const ranks = new Map(ids.map((id, index) => [id, index + 1]));
        setMenus(current => current.map(item => ranks.has(item.id) ? { ...item, sortOrder: ranks.get(item.id) } : item));
      }))
      : null;

    return () => {
      categorySortable?.destroy();
      itemSortable?.destroy();
    };
  }, [loading, selectedSortCategory, categoryOrder.length, itemOrder.length]);

  const saveCategories = async () => {
    try {
      await saveAdminCategoryOrder(tenant.id, categoryOrder);
      showToast(t("admin.menu.category_order_saved"));
      await load();
    } catch (error) {
      console.error("ADMIN_CATEGORY_ORDER_SAVE_FAILED", error);
      showToast(t("admin.menu.category_order_failed"), "error");
    }
  };

  const saveItems = async () => {
    try {
      await saveAdminMenuOrder(tenant.id, selectedSortCategory, itemOrder.map(item => item.id));
      showToast(t("admin.menu.item_order_saved", { category: selectedSortCategory }));
      await load();
    } catch (error) {
      console.error("ADMIN_ITEM_ORDER_SAVE_FAILED", error);
      showToast(t("admin.menu.item_order_failed"), "error");
    }
  };

  if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady) {
    return <PageReadyOverlay context="LUKKAJA" title={t("shared.state.loading")} message={t("shared.state.please_wait")} progress={82} />;
  }
  if (!profile) return <Navigate to="/login?next=%2Freact%2Fadmin" replace />;
  if (!["owner", "admin"].includes(profile.role)) return <Navigate to="/" replace />;
  if (tenantState.status === "error" || !tenant) return <Navigate to="/" replace />;

  const rawMode = String(lalamove.accountMode || "disabled");
  const lalamoveMode = rawMode === "partner" ? "tenant" : (["disabled", "tenant", "fod_central"].includes(rawMode) ? rawMode : "disabled");
  const lalamoveAvailable = lalamove.available === true
    || (lalamoveMode === "tenant" && lalamove.tenantReady === true)
    || (lalamoveMode === "fod_central" && lalamove.fodCentralApproved === true && lalamove.platformReady === true);
  const previewLalamoveMode = ["disabled", "tenant", "fod_central"].includes(lalamoveForm.accountMode)
    ? lalamoveForm.accountMode : "disabled";
  const previewLalamoveAvailable = previewLalamoveMode === lalamoveMode ? lalamoveAvailable : false;
  const lalamoveSelected = storeForm.deliveryProvider === "lalamove" && lalamoveAvailable;
  const walletBalance = Number(wallet.balance || 0);
  const walletLoadError = wallet.loadError === true;
  const walletTopup = wallet.topup && typeof wallet.topup === "object"
    ? wallet.topup
    : { storageReady: !walletLoadError, allowed: false, destination: {}, items: Array.isArray(wallet.topups) ? wallet.topups : [] };
  const walletDestination = walletTopup.destination || {};
  const walletTopupReady = Boolean(!walletLoadError && walletTopup.storageReady && walletTopup.allowed && walletDestination.configured);
  const walletTransactions = Array.isArray(wallet.transactions) ? wallet.transactions : [];
  const walletTopupItems = Array.isArray(walletTopup.items) ? walletTopup.items : [];
  const walletStorageReady = !walletLoadError && wallet.storageReady !== false;
  const walletModeKey = walletLoadError
    ? "admin.delivery_settings.fod_wallet_load_failed"
    : !walletStorageReady
      ? "admin.delivery_settings.fod_wallet_storage_missing"
      : previewLalamoveMode === "fod_central"
        ? "admin.delivery_settings.fod_wallet_active"
        : "admin.delivery_settings.fod_wallet_inactive";
  const walletTopupHelpKey = !walletTopup.storageReady
    ? "admin.delivery_settings.fod_wallet_topup_storage_missing"
    : !walletTopup.allowed
      ? "admin.delivery_settings.fod_wallet_topup_not_allowed"
      : !walletDestination.configured
        ? "admin.delivery_settings.fod_wallet_topup_destination_missing"
        : "admin.delivery_settings.fod_wallet_topup_help";
  const walletDate = value => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat(intlLocale, { dateStyle: "short", timeStyle: "short" }).format(date)
      : "-";
  };
  const walletTypeLabel = type => {
    const key = "admin.delivery_settings.fod_wallet_types." + String(type || "adjustment");
    const label = t(key);
    return label === key ? String(type || "-") : label;
  };
  const walletStatusLabel = status => {
    const key = "admin.delivery_settings.fod_wallet_topup_statuses." + String(status || "pending");
    const label = t(key);
    return label === key ? String(status || "-") : label;
  };
  const tenantLalamoveMode = lalamoveForm.accountMode === "tenant";
  const lalamoveStatusKey = previewLalamoveAvailable
    ? "admin.delivery_settings.lalamove_status_ready"
    : previewLalamoveMode === "fod_central" && !lalamove.fodCentralApproved
      ? "admin.delivery_settings.lalamove_status_waiting_approval"
      : previewLalamoveMode === "disabled"
        ? "admin.delivery_settings.lalamove_status_disabled"
        : "admin.delivery_settings.lalamove_status_not_ready";

  return (
    <>
      <header className="app-header">
        <div className="brand"><span className="brand-mark">FOD</span>{t("admin.header.title")}</div>
        <div className="app-header-actions" data-header-actions>
          <LocaleSwitcher style={{ marginLeft: 0, marginRight: 0 }} />
          <UserMenu profile={profile} />
        </div>
      </header>

      <div id="demoBanner"></div>

      <main className="container">
        <section className="hero">
          <h1>{t("admin.hero.title")}</h1>
          <p>{t("admin.hero.description")}</p>
        </section>

        {loadError ? <div className="upload-error" role="alert">{loadError}</div> : null}

        <section className="card admin-vr-card" style={{ marginBottom: 16 }} data-admin-card-role="sales-report" data-admin-vr-accent="cyan" data-admin-icon="bar-chart-line">
          <div className="section-title admin-card-visual-title" style={{ margin: 0, alignItems: "center" }}>
            <span className="admin-heading-icon" aria-hidden="true"><i className="bi bi-bar-chart-line"></i></span>
            <div className="admin-card-heading"><h2>{t("admin.sales_report.title")}</h2><div className="menu-category">{t("admin.sales_report.description")}</div></div>
            <Link className="btn btn-primary" to="/admin/sales-report"><i className="bi bi-eye app-icon" aria-hidden="true"></i><span>{t("admin.sales_report.button")}</span></Link>
          </div>
        </section>

        <AdminDeliveryQr tenant={tenant} shopName={settings.shopName || tenant?.name || ""} t={t} />

        <AdminCollapsibleCard
          style={{ marginBottom: 16 }}
          cardKey="store"
          icon="building-gear"
          accent="violet"
          heading={<h2>{t("admin.store.section_title")}</h2>}
          t={t}
        >
          <form id="storeForm" className="grid" onSubmit={saveStore}>
            <div className="field"><label htmlFor="shopName">{t("admin.store.shop_name")}</label><input className="input" id="shopName" required value={storeForm.shopName} onChange={e => patchStore({ shopName: e.target.value })} /></div>
            <div className="field"><label htmlFor="shopAddress">{t("admin.store.shop_address")}</label><textarea className="input" id="shopAddress" required value={storeForm.shopAddress} onChange={e => patchStore({ shopAddress: e.target.value })}></textarea></div>
            <div className="field"><label htmlFor="shopPhone">{t("admin.store.shop_phone")}</label><input className="input" id="shopPhone" type="tel" value={storeForm.shopPhone} onChange={e => patchStore({ shopPhone: e.target.value })} /></div>

            <section className="admin-store-location">
              <div className="admin-store-location-head">
                <div><h3>{t("admin.store_location.title")}</h3><div className="menu-category">{t("admin.store_location.description")}</div></div>
                <button className="btn btn-sm" id="adminUseCurrentLocation" type="button" disabled={locationBusy} onClick={useCurrentLocation}><i className="bi bi-crosshair app-icon" aria-hidden="true"></i><span>{t("admin.store_location.use_current")}</span></button>
              </div>
              <AdminMap tenantSlug={tenant.slug} location={location} onLocation={value => { setLocation(value); setLocationError(""); setMapError(""); }} onError={setMapError} t={t} />
              <div className="admin-store-location-footer">
                <span id="adminStoreLocationStatus" className={(locationError || mapError) ? "is-error" : location ? "is-ready" : ""}>{locationError || mapError || (location ? t("admin.store_location.status_ready") : t("admin.store_location.status_unset"))}</span>
                <span id="adminStoreLocationCoordinates">{location ? location.latitude.toFixed(7) + ", " + location.longitude.toFixed(7) : ""}</span>
              </div>
              <input type="hidden" id="storeLatitude" value={location?.latitude ?? ""} readOnly />
              <input type="hidden" id="storeLongitude" value={location?.longitude ?? ""} readOnly />
            </section>

            <div className="grid grid-2">
              <div className="field"><label htmlFor="promptPayId">{t("admin.store.promptpay_id")}</label><input className="input" id="promptPayId" inputMode="numeric" value={storeForm.promptPayId} onChange={e => patchStore({ promptPayId: e.target.value })} /></div>
              <div className="field"><label htmlFor="promptPayName">{t("admin.store.promptpay_name")}</label><input className="input" id="promptPayName" value={storeForm.promptPayName} onChange={e => patchStore({ promptPayName: e.target.value })} /></div>
            </div>
            <div className="grid grid-2">
              <div className="field"><label htmlFor="bankName">{t("admin.store.bank_name")}</label><input className="input" id="bankName" value={storeForm.bankName} onChange={e => patchStore({ bankName: e.target.value })} /></div>
              <div className="field"><label htmlFor="bankAccountNumber">{t("admin.store.bank_account_number")}</label><input className="input" id="bankAccountNumber" inputMode="numeric" value={storeForm.bankAccountNumber} onChange={e => patchStore({ bankAccountNumber: e.target.value })} /></div>
            </div>
            <div className="field"><label htmlFor="bankAccountName">{t("admin.store.bank_account_name")}</label><input className="input" id="bankAccountName" value={storeForm.bankAccountName} onChange={e => patchStore({ bankAccountName: e.target.value })} /></div>

            <div className="card admin-lalamove-account-card" id="lalamoveAccountCard" style={{ boxShadow: "none", background: "#f8fbf9" }}>
              <div className="section-title" style={{ marginTop: 0 }}>
                <div><h2>{t("admin.delivery_settings.lalamove_account_title")}</h2><div className="menu-category">{t("admin.delivery_settings.lalamove_account_description")}</div></div>
                <span className={"badge" + (previewLalamoveAvailable ? "" : " dark")} id="lalamoveAccountStatus">{t(lalamoveStatusKey)}</span>
              </div>

              <div className="grid grid-2">
                <div className="field">
                  <label htmlFor="lalamoveAccountMode">{t("admin.delivery_settings.lalamove_account_mode")}</label>
                  <select className="input" id="lalamoveAccountMode" value={lalamoveForm.accountMode} onChange={e => patchLalamove({ accountMode: e.target.value })}>
                    <option value="disabled">{t("admin.delivery_settings.lalamove_mode_disabled")}</option>
                    <option value="tenant">{t("admin.delivery_settings.lalamove_mode_tenant")}</option>
                    <option value="fod_central">{t("admin.delivery_settings.lalamove_mode_fod")}</option>
                  </select>
                </div>
                <div className={"field" + (!tenantLalamoveMode ? " is-lalamove-readonly" : "")} id="lalamoveTenantEnvironmentField" aria-disabled={tenantLalamoveMode ? "false" : "true"}>
                  <label htmlFor="lalamoveTenantEnvironment">{t("admin.delivery_settings.lalamove_environment")}</label>
                  <select className="input" id="lalamoveTenantEnvironment" value={lalamoveForm.environment} disabled={!tenantLalamoveMode} onChange={e => patchLalamove({ environment: e.target.value })}>
                    <option value="sandbox">Sandbox</option>
                    <option value="production">Production</option>
                  </select>
                </div>
              </div>

              <div className={"grid grid-2" + (!tenantLalamoveMode ? " is-lalamove-readonly" : "")} id="lalamoveTenantCredentials" aria-disabled={tenantLalamoveMode ? "false" : "true"}>
                <div className="field">
                  <label htmlFor="lalamoveTenantApiKey">{t("admin.delivery_settings.lalamove_api_key")}</label>
                  <input className="input" id="lalamoveTenantApiKey" type="password" autoComplete="off" disabled={!tenantLalamoveMode} value={lalamoveForm.apiKey} placeholder={lalamove.tenantApiKeyMasked || "pk_..."} onChange={e => patchLalamove({ apiKey: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="lalamoveTenantApiSecret">{t("admin.delivery_settings.lalamove_api_secret")}</label>
                  <input className="input" id="lalamoveTenantApiSecret" type="password" autoComplete="off" disabled={!tenantLalamoveMode} value={lalamoveForm.apiSecret} placeholder={lalamove.tenantApiSecretMasked || "sk_..."} onChange={e => patchLalamove({ apiSecret: e.target.value })} />
                </div>
              </div>

              <div className="menu-category" id="lalamoveAccountHelp">{t("admin.delivery_settings.lalamove_mode_help")}</div>
              <div className="admin-lalamove-account-actions">
                <button className="btn btn-sm" type="button" id="testTenantLalamoveConnection" hidden={!tenantLalamoveMode} disabled={!tenantLalamoveMode || lalamoveTesting} onClick={testLalamoveAccount}><i className="bi bi-plug"></i>{" "}<span>{t("admin.delivery_settings.lalamove_test_connection")}</span></button>
                <button className="btn btn-primary btn-sm" type="button" id="saveLalamoveAccountSettings" disabled={lalamoveSaving} onClick={saveLalamoveAccount}><i className="bi bi-floppy"></i>{" "}<span>{t("admin.delivery_settings.lalamove_save_account")}</span></button>
              </div>

              <section className="admin-lalamove-wallet" id="lalamoveFodWallet" aria-labelledby="lalamoveFodWalletTitle">
                <div className="admin-lalamove-wallet-head">
                  <div>
                    <span className="admin-lalamove-wallet-icon"><i className="bi bi-wallet2" aria-hidden="true"></i></span>
                    <div><strong id="lalamoveFodWalletTitle">{t("admin.delivery_settings.fod_wallet_title")}</strong><small id="lalamoveFodWalletMode">{t(walletModeKey)}</small></div>
                  </div>
                  <div className="admin-lalamove-wallet-balance"><span>{t("admin.delivery_settings.fod_wallet_balance")}</span><strong id="lalamoveFodWalletBalance">{money(walletBalance, intlLocale)}</strong><small>{t("admin.delivery_settings.fod_wallet_credit_unit")}</small></div>
                </div>

                <div className="admin-lalamove-wallet-topup" id="lalamoveFodWalletTopupPanel" hidden={!walletTopupReady}>
                  <div className="admin-lalamove-wallet-topup-destination">
                    <div><span>{t("admin.delivery_settings.fod_wallet_topup_destination")}</span><strong id="lalamoveFodWalletDestinationType">{walletDestination.accountTypeLabel || walletDestination.accountType || "-"}</strong></div>
                    <div><span>{t("admin.delivery_settings.fod_wallet_topup_account_name")}</span><strong id="lalamoveFodWalletDestinationName">{walletDestination.accountName || "-"}</strong></div>
                    <div><span>{t("admin.delivery_settings.fod_wallet_topup_account_number")}</span><strong id="lalamoveFodWalletDestinationNumber">{walletDestination.accountNumber || "-"}</strong></div>
                  </div>

                  <div id="lalamoveFodWalletTopupForm" className="admin-lalamove-wallet-topup-form" role="group">
                    <label className="admin-lalamove-wallet-topup-amount">
                      <span className="admin-lalamove-wallet-field-label">{t("admin.delivery_settings.fod_wallet_topup_amount")}</span>
                      <span className="admin-lalamove-wallet-amount-control">
                        <span className="admin-lalamove-wallet-amount-icon"><i className="bi bi-cash-stack" aria-hidden="true"></i></span>
                        <input className="admin-lalamove-wallet-amount-input" id="lalamoveFodWalletTopupAmount" type="number" min="1" max="1000000" step="0.01" inputMode="decimal" placeholder="0.00" value={walletTopupAmount} disabled={walletTopupBusy} onChange={e => setWalletTopupAmount(e.target.value)} />
                        <span className="admin-lalamove-wallet-amount-unit">{t("admin.delivery_settings.fod_wallet_credit_unit")}</span>
                      </span>
                    </label>

                    <div className="admin-lalamove-wallet-slip-field">
                      <span className="admin-lalamove-wallet-field-label">{t("admin.delivery_settings.fod_wallet_topup_slip")}</span>
                      <div
                        className={"admin-lalamove-wallet-slip-picker" + (walletTopupFile ? " has-file" : "") + (walletSlipDragOver ? " is-dragover" : "")}
                        id="lalamoveFodWalletSlipPicker"
                        role="button"
                        tabIndex="0"
                        aria-describedby="lalamoveFodWalletSlipHint"
                        onClick={e => {
                          if (walletTopupBusy || e.target.closest("#lalamoveFodWalletSlipClear")) return;
                          document.getElementById("lalamoveFodWalletTopupSlip")?.click();
                        }}
                        onKeyDown={e => {
                          if ((e.key !== "Enter" && e.key !== " ") || walletTopupBusy || e.target.closest("#lalamoveFodWalletSlipClear")) return;
                          e.preventDefault();
                          document.getElementById("lalamoveFodWalletTopupSlip")?.click();
                        }}
                        onDragEnter={e => { e.preventDefault(); if (!walletTopupBusy) setWalletSlipDragOver(true); }}
                        onDragOver={e => { e.preventDefault(); if (!walletTopupBusy) setWalletSlipDragOver(true); }}
                        onDragLeave={e => { e.preventDefault(); setWalletSlipDragOver(false); }}
                        onDrop={e => {
                          e.preventDefault();
                          setWalletSlipDragOver(false);
                          if (walletTopupBusy) return;
                          chooseWalletSlip(e.dataTransfer?.files?.[0] || null);
                        }}
                      >
                        <input id="lalamoveFodWalletTopupSlip" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={walletTopupBusy} onChange={e => chooseWalletSlip(e.target.files?.[0] || null)} />
                        <div className="admin-lalamove-wallet-slip-empty" id="lalamoveFodWalletSlipEmpty" hidden={Boolean(walletTopupFile)}>
                          <span className="admin-lalamove-wallet-slip-icon"><i className="bi bi-receipt" aria-hidden="true"></i></span>
                          <div><strong>{t("admin.delivery_settings.fod_wallet_topup_choose_slip")}</strong></div>
                          <i className="bi bi-upload admin-lalamove-wallet-slip-upload-icon" aria-hidden="true"></i>
                        </div>
                        <div className="admin-lalamove-wallet-slip-selected" id="lalamoveFodWalletSlipSelected" hidden={!walletTopupFile}>
                          <span className="admin-lalamove-wallet-slip-icon is-selected"><i className="bi bi-file-earmark-check" aria-hidden="true"></i></span>
                          <div><strong id="lalamoveFodWalletSlipName">{walletTopupFile?.name || "-"}</strong><small id="lalamoveFodWalletSlipSize">{walletTopupFile ? formatFileSize(walletTopupFile.size) : "-"}</small></div>
                          <button className="admin-lalamove-wallet-slip-clear" id="lalamoveFodWalletSlipClear" type="button" disabled={walletTopupBusy} aria-label={t("admin.delivery_settings.fod_wallet_topup_clear_file")} onClick={e => { e.preventDefault(); e.stopPropagation(); chooseWalletSlip(null); }}><i className="bi bi-x-lg" aria-hidden="true"></i><span>{t("admin.delivery_settings.fod_wallet_topup_clear_file")}</span></button>
                        </div>
                      </div>
                      <small className="admin-lalamove-wallet-slip-hint" id="lalamoveFodWalletSlipHint">{t("admin.delivery_settings.fod_wallet_topup_file_hint")}</small>
                    </div>

                    <div className="admin-action-row admin-lalamove-wallet-topup-actions">
                      <button className="btn btn-primary btn-sm admin-lalamove-wallet-topup-submit" id="lalamoveFodWalletTopupSubmit" type="button" disabled={walletTopupBusy} onClick={submitWalletTopup}><i className="bi bi-cloud-arrow-up" aria-hidden="true"></i><span>{t("admin.delivery_settings.fod_wallet_topup_submit")}</span></button>
                    </div>
                  </div>
                  <small className="admin-lalamove-wallet-topup-help" id="lalamoveFodWalletTopupHelp">{t(walletTopupHelpKey)}</small>
                  <div className="admin-lalamove-wallet-credit-policy" role="note">
                    <p><i className="bi bi-arrow-left-right" aria-hidden="true"></i><span>{t("admin.delivery_settings.fod_wallet_credit_rate")}</span></p>
                    <p><i className="bi bi-shield-exclamation" aria-hidden="true"></i><span>{t("admin.delivery_settings.fod_wallet_credit_terms")}</span></p>
                  </div>
                </div>

                <div className="admin-lalamove-wallet-topup-history">
                  <div className="admin-lalamove-wallet-ledger-title"><strong>{t("admin.delivery_settings.fod_wallet_topup_history")}</strong><span>{t("admin.delivery_settings.fod_wallet_phase3_note")}</span></div>
                  <div id="lalamoveFodWalletTopupRequests" className="admin-lalamove-wallet-transactions">
                    {walletTopupItems.length ? walletTopupItems.map(item => (
                      <div className={"admin-lalamove-wallet-row topup " + String(item.status || "pending")} key={item.id}>
                        <div><strong>{money(item.amount || 0, intlLocale)} {t("admin.delivery_settings.fod_wallet_credit_unit")} · {walletStatusLabel(item.status)}</strong><small>{walletDate(item.submittedAt)}{item.verificationStatus ? " · " + item.verificationStatus : ""}</small></div>
                        {String(item.status || "") === "pending" ? <button className="btn btn-danger btn-sm" type="button" data-delete-fod-wallet-topup={item.id} disabled={walletDeleteBusy === item.id} onClick={() => removeWalletTopup(item)}><i className="bi bi-trash3" aria-hidden="true"></i><span>{t("admin.delivery_settings.fod_wallet_topup_delete")}</span></button> : null}
                      </div>
                    )) : <div className="admin-lalamove-wallet-empty">{t("admin.delivery_settings.fod_wallet_topup_empty")}</div>}
                  </div>
                </div>

                <div className="admin-lalamove-wallet-ledger">
                  <div className="admin-lalamove-wallet-ledger-title"><strong>{t("admin.delivery_settings.fod_wallet_recent")}</strong><span>{t("admin.delivery_settings.fod_wallet_ledger_note")}</span></div>
                  <div id="lalamoveFodWalletTransactions" className="admin-lalamove-wallet-transactions">
                    {!walletStorageReady ? <div className="menu-category">{t(walletLoadError ? "admin.delivery_settings.fod_wallet_load_failed" : "admin.delivery_settings.fod_wallet_storage_missing")}</div>
                      : walletTransactions.length ? walletTransactions.map(row => {
                        const credit = row.direction === "credit";
                        const reference = row.orderId || row.reference || row.lalamoveOrderId || "";
                        return <div className={"admin-lalamove-wallet-row " + (credit ? "credit" : "debit")} key={row.id}>
                          <div><strong>{walletTypeLabel(row.type)}</strong><small>{walletDate(row.createdAt)}{reference ? " · " + reference : ""}</small></div>
                          <span>{credit ? "+" : "−"}{money(row.amount || 0, intlLocale)} {t("admin.delivery_settings.fod_wallet_credit_unit")}</span>
                        </div>;
                      }) : <div className="admin-lalamove-wallet-empty">{t("admin.delivery_settings.fod_wallet_empty")}</div>}
                  </div>
                </div>
              </section>
            </div>

            <div className="card admin-delivery-settings-card" style={{ boxShadow: "none", background: "#f8fbf9" }}>
              <div className="section-title" style={{ marginTop: 0 }}><div><h2>{t("admin.delivery_settings.title")}</h2><div className="menu-category">{t("admin.delivery_settings.description")}</div></div></div>
              <div className="grid grid-2">
                <div className="field">
                  <label>{t("admin.delivery_settings.provider_label")}</label>
                  <select id="deliveryProvider" hidden value={storeForm.deliveryProvider} onChange={e => patchStore({ deliveryProvider: e.target.value })}><option value="self">self</option><option value="lalamove">lalamove</option></select>
                  <div className="admin-delivery-provider-options" id="deliveryProviderOptions">
                    <div className={"admin-delivery-provider-card" + (storeForm.deliveryProvider === "self" ? " is-active" : "")} data-delivery-provider-card="self" role="button" tabIndex="0" onClick={() => patchStore({ deliveryProvider: "self" })} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); patchStore({ deliveryProvider: "self" }); } }}>
                      <div className="admin-delivery-provider-icon"><i className="bi bi-shop" aria-hidden="true"></i></div>
                      <div className="admin-delivery-provider-content"><div className="admin-delivery-provider-title-row"><strong>{t("admin.delivery_settings.self_title")}</strong><span className={"admin-delivery-provider-badge" + (storeForm.deliveryProvider === "self" ? " is-active" : " is-available")} data-delivery-provider-badge="self">{t(storeForm.deliveryProvider === "self" ? "admin.delivery_settings.self_selected_status" : "admin.delivery_settings.self_available_status")}</span></div><div className="admin-delivery-provider-description">{t("admin.delivery_settings.self_description")}</div></div>
                      <div className="admin-delivery-provider-check" data-delivery-provider-indicator="self"><i className={"bi bi-" + (storeForm.deliveryProvider === "self" ? "check-circle-fill" : "circle")} aria-hidden="true"></i></div>
                    </div>
                    <div className={"admin-delivery-provider-card" + (lalamoveAvailable ? (lalamoveSelected ? " is-active" : "") : " is-disabled")} data-delivery-provider-card="lalamove" aria-disabled={lalamoveAvailable ? "false" : "true"} role="button" tabIndex={lalamoveAvailable ? 0 : -1} onClick={() => { if (lalamoveAvailable) patchStore({ deliveryProvider: "lalamove" }); }} onKeyDown={e => { if (!lalamoveAvailable || (e.key !== "Enter" && e.key !== " ")) return; e.preventDefault(); patchStore({ deliveryProvider: "lalamove" }); }}>
                      <div className="admin-delivery-provider-icon"><i className="bi bi-truck" aria-hidden="true"></i></div>
                      <div className="admin-delivery-provider-content"><div className="admin-delivery-provider-title-row"><strong>Lalamove</strong><span className={"admin-delivery-provider-badge" + (lalamoveAvailable ? (lalamoveSelected ? " is-active" : " is-available") : " is-disabled")} data-delivery-provider-badge="lalamove">{t(lalamoveAvailable ? lalamoveSelected ? "admin.delivery_settings.lalamove_selected_status" : "admin.delivery_settings.lalamove_available_status" : "admin.delivery_settings.lalamove_status")}</span></div><div className="admin-delivery-provider-description" data-delivery-provider-description="lalamove">{t(lalamoveAvailable ? "admin.delivery_settings.lalamove_description" : "admin.delivery_settings.lalamove_unavailable_description")}</div></div>
                      <div className={lalamoveAvailable ? "admin-delivery-provider-check" : "admin-delivery-provider-lock"} data-delivery-provider-indicator="lalamove"><i className={"bi bi-" + (!lalamoveAvailable ? "lock-fill" : lalamoveSelected ? "check-circle-fill" : "circle")} aria-hidden="true"></i></div>
                    </div>
                  </div>
                </div>
                <div className="field"><label htmlFor="deliveryMaxDistanceKm">{t("admin.delivery_settings.max_distance_label")}</label><input className="input" id="deliveryMaxDistanceKm" type="number" min="0" step="0.1" value={storeForm.deliveryMaxDistanceKm} onChange={e => patchStore({ deliveryMaxDistanceKm: e.target.value })} /></div>
              </div>
              <div className="menu-category admin-delivery-distance-note">{t("admin.delivery_settings.distance_help")}</div>
            </div>

            <PromotionEditor value={promotion} onChange={setPromotion} menus={menus} t={t} formatMoney={value => money(value, intlLocale)} />
            <DeliveryFeeEditor fees={fees} setFees={setFees} readonly={lalamoveSelected} t={t} />

            <button className="btn btn-primary admin-store-save-full-row" id="storeSettingsSaveButton" type="submit" disabled={storeSaving} data-admin-button-icon="floppy"><i className="bi bi-floppy app-icon admin-button-icon" aria-hidden="true"></i><span className="admin-button-label">{t("admin.store.save")}</span></button>
          </form>
        </AdminCollapsibleCard>

        <AdminCollapsibleCard
          style={{ marginTop: 16 }}
          cardKey="menu-list"
          icon="fork-knife"
          accent="green"
          heading={<h2>{t("admin.menu.list_title")}</h2>}
          t={t}
        >
          <div className="admin-list-actions">
            <button className="btn btn-primary btn-sm" type="button" data-open-admin-modal="menu" onClick={() => openMenu(null)}><i className="bi bi-plus-lg app-icon" aria-hidden="true"></i><span>{t("admin.menu.add")}</span></button>
          </div>
          <div className="grid grid-2" style={{ marginBottom: 12 }}>
            <input className="input" id="menuListSearch" value={menuSearch} onChange={e => setMenuSearch(e.target.value)} placeholder={t("admin.menu.search")} />
            <select className="input" id="menuListStatus" value={menuStatus} onChange={e => setMenuStatus(e.target.value)}>
              <option value="all">{t("admin.menu.status_all")}</option>
              <option value="active">{t("admin.menu.status_active")}</option>
              <option value="inactive">{t("admin.menu.status_inactive")}</option>
            </select>
          </div>
          <div className="admin-table-scroll admin-menu-table-scroll" data-horizontal-scroll="true">
            <table className="table-list">
              <thead><tr><th>{t("admin.menu.header_image")}</th><th>{t("admin.menu.header_menu")}</th><th>{t("admin.menu.header_category")}</th><th>{t("admin.menu.header_price")}</th><th>{t("admin.menu.header_status")}</th><th></th></tr></thead>
              <tbody id="menuRows">
                {visibleMenus.length ? visibleMenus.map(item => (
                  <tr key={item.id} data-active={item.active !== false}>
                    <td><img src={item.image || DEFAULT_FOOD_IMAGE} alt={item.name || ""} data-food-image style={{ width: 58, height: 46, objectFit: "cover", objectPosition: "50% " + Number(item.imagePositionY ?? 50) + "%", borderRadius: 8 }} onError={e => { e.currentTarget.src = DEFAULT_FOOD_IMAGE; }} /></td>
                    <td><strong>{item.name}</strong></td>
                    <td>{item.category || "-"}</td>
                    <td>{money(item.price, intlLocale)}</td>
                    <td>{item.active !== false ? <span className="badge">{t("admin.menu.active")}</span> : <span className="badge dark">{t("admin.menu.closed")}</span>}</td>
                    <td><button className="btn btn-sm" type="button" data-edit-menu={item.id} data-admin-button-icon="pencil-square" aria-label={t("admin.common.edit")} title={t("admin.common.edit")} onClick={() => openMenu(item)}><i className="bi bi-pencil-square app-icon admin-button-icon" aria-hidden="true"></i><span className="admin-button-label">{t("admin.common.edit")}</span></button>{" "}<button className="btn btn-danger btn-sm" type="button" data-delete-menu={item.id} data-admin-button-icon="trash3" aria-label={t("admin.common.delete")} title={t("admin.common.delete")} onClick={() => removeMenu(item)}><i className="bi bi-trash3 app-icon admin-button-icon" aria-hidden="true"></i><span className="admin-button-label">{t("admin.common.delete")}</span></button></td>
                  </tr>
                )) : <tr><td colSpan="6"><div className="empty">{t("admin.pagination.no_results")}</div></td></tr>}
              </tbody>
            </table>
          </div>
          {menuPages > 1 ? <nav id="menuListPagination" className="menu-pagination" aria-label={t("admin.menu.pagination_aria")}>
            <button type="button" className="menu-page-button menu-page-direction" disabled={currentMenuPage === 1} aria-label={t("admin.pagination.previous")} onClick={() => goToListPage("menu", currentMenuPage - 1)}><i className="bi bi-chevron-left" aria-hidden="true"></i></button>
            {menuPaginationPages.map(page => <button type="button" className={"menu-page-button" + (page === currentMenuPage ? " active" : "")} aria-label={t("admin.pagination.page", { page })} aria-current={page === currentMenuPage ? "page" : undefined} onClick={() => goToListPage("menu", page)} key={page}>{page}</button>)}
            <button type="button" className="menu-page-button menu-page-direction" disabled={currentMenuPage === menuPages} aria-label={t("admin.pagination.next")} onClick={() => goToListPage("menu", currentMenuPage + 1)}><i className="bi bi-chevron-right" aria-hidden="true"></i></button>
            <div className="menu-page-summary">{t("admin.pagination.summary", { current: currentMenuPage, total: menuPages, count: filteredMenus.length })}</div>
          </nav> : null}
        </AdminCollapsibleCard>

        <AdminCollapsibleCard
          style={{ marginTop: 16 }}
          cardKey="menu-sort"
          icon="list-ol"
          accent="green"
          heading={<div><h2>{t("admin.menu.sort_title")}</h2><div className="menu-category">{t("admin.menu.sort_help")}</div></div>}
          t={t}
        >
          <div className="sort-manager">
            <div className="sort-panel">
              <div className="sort-panel-head"><strong>{t("admin.menu.category_order")}</strong><button type="button" className="btn btn-primary btn-sm" id="saveCategoryOrder" data-admin-button-icon="floppy" onClick={saveCategories}><i className="bi bi-floppy app-icon admin-button-icon" aria-hidden="true"></i><span className="admin-button-label">{t("admin.menu.save_category_order")}</span></button></div>
              <div id="categorySortList" className="sort-list" ref={categorySortListRef}>
                {categoryOrder.length ? categoryOrder.map(name => (
                  <div
                    className={"sort-item" + (selectedSortCategory === name ? " active-category" : "")}
                    key={name}
                    data-sort-category={name}
                  >
                    <span className="sort-handle" aria-hidden="true">⋮⋮</span>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setSelectedSortCategory(name)}
                      style={{ padding: 0, background: "transparent", textAlign: "left", fontWeight: 600 }}
                    >{name}</button>
                  </div>
                )) : <div className="empty">{t("admin.menu.no_categories")}</div>}
              </div>
            </div>
            <div className="sort-panel">
              <div className="sort-panel-head"><div><strong>{t("admin.menu.item_order")}</strong><div className="menu-category" id="selectedSortCategory">{selectedSortCategory || "-"}</div></div><button type="button" className="btn btn-primary btn-sm" id="saveItemOrder" data-admin-button-icon="floppy" disabled={!selectedSortCategory} onClick={saveItems}><i className="bi bi-floppy app-icon admin-button-icon" aria-hidden="true"></i><span className="admin-button-label">{t("admin.menu.save_item_order")}</span></button></div>
              <div id="itemSortList" className="sort-list" ref={itemSortListRef}>
                {itemOrder.length ? itemOrder.map(item => (
                  <div
                    className="sort-item"
                    key={item.id}
                    data-sort-menu-id={item.id}
                  ><span className="sort-handle" aria-hidden="true">⋮⋮</span><span>{item.name}</span></div>
                )) : <div className="empty">{t("admin.menu.no_items_in_category")}</div>}
              </div>
            </div>
          </div>
        </AdminCollapsibleCard>

        <AdminCollapsibleCard
          style={{ marginTop: 16 }}
          cardKey="table-list"
          icon="grid-3x3-gap"
          accent="blue"
          heading={<h2>{t("admin.table.list_title")}</h2>}
          t={t}
        >
          <div className="admin-list-actions">
            <Link to="/admin/qr" className="btn btn-dark btn-sm"><i className="bi bi-qr-code app-icon" aria-hidden="true"></i><span>{t("admin.table.issue_qr")}</span></Link>
            <button className="btn btn-primary btn-sm" type="button" data-open-admin-modal="table" onClick={() => openTable(null)}><i className="bi bi-plus-lg app-icon" aria-hidden="true"></i><span>{t("admin.table.add")}</span></button>
          </div>
          <div className="grid grid-2" style={{ marginBottom: 12 }}>
            <input className="input" id="tableListSearch" value={tableSearch} onChange={e => setTableSearch(e.target.value)} placeholder={t("admin.table.search")} />
            <select className="input" id="tableListStatus" value={tableStatus} onChange={e => setTableStatus(e.target.value)}>
              <option value="all">{t("admin.table.status_all")}</option>
              <option value="active">{t("admin.table.status_active")}</option>
              <option value="inactive">{t("admin.table.status_inactive")}</option>
            </select>
          </div>
          <div className="admin-table-scroll admin-table-list-scroll" data-horizontal-scroll="true">
            <table className="table-list">
              <thead><tr><th>{t("admin.table.header_code")}</th><th>{t("admin.table.header_name")}</th><th>{t("admin.table.header_capacity")}</th><th>{t("admin.table.header_status")}</th><th></th></tr></thead>
              <tbody id="tableRows">
                {visibleTables.length ? visibleTables.map(item => (
                  <tr key={item.id} data-active={item.active !== false}>
                    <td><strong>{item.code}</strong></td><td>{item.name}</td><td><strong className="table-capacity">{Math.max(1, Number.parseInt(item.capacity ?? item.seats ?? item.seatCount ?? 4, 10) || 4)}</strong></td>
                    <td>{item.active !== false ? <span className="badge">{t("admin.table.active")}</span> : <span className="badge dark">{t("admin.table.closed")}</span>}</td>
                    <td><button className="btn btn-sm" type="button" data-edit-table={item.id} data-admin-button-icon="pencil-square" aria-label={t("admin.common.edit")} title={t("admin.common.edit")} onClick={() => openTable(item)}><i className="bi bi-pencil-square app-icon admin-button-icon" aria-hidden="true"></i><span className="admin-button-label">{t("admin.common.edit")}</span></button>{" "}<button className="btn btn-danger btn-sm" type="button" data-delete-table={item.id} data-admin-button-icon="trash3" aria-label={t("admin.common.delete")} title={t("admin.common.delete")} onClick={() => removeTable(item)}><i className="bi bi-trash3 app-icon admin-button-icon" aria-hidden="true"></i><span className="admin-button-label">{t("admin.common.delete")}</span></button></td>
                  </tr>
                )) : <tr><td colSpan="5"><div className="empty">{t("admin.pagination.no_results")}</div></td></tr>}
              </tbody>
            </table>
          </div>
          {tablePages > 1 ? <nav id="tableListPagination" className="menu-pagination" aria-label={t("admin.table.pagination_aria")}>
            <button type="button" className="menu-page-button menu-page-direction" disabled={currentTablePage === 1} aria-label={t("admin.pagination.previous")} onClick={() => goToListPage("table", currentTablePage - 1)}><i className="bi bi-chevron-left" aria-hidden="true"></i></button>
            {tablePaginationPages.map(page => <button type="button" className={"menu-page-button" + (page === currentTablePage ? " active" : "")} aria-label={t("admin.pagination.page", { page })} aria-current={page === currentTablePage ? "page" : undefined} onClick={() => goToListPage("table", page)} key={page}>{page}</button>)}
            <button type="button" className="menu-page-button menu-page-direction" disabled={currentTablePage === tablePages} aria-label={t("admin.pagination.next")} onClick={() => goToListPage("table", currentTablePage + 1)}><i className="bi bi-chevron-right" aria-hidden="true"></i></button>
            <div className="menu-page-summary">{t("admin.pagination.summary", { current: currentTablePage, total: tablePages, count: filteredTables.length })}</div>
          </nav> : null}
        </AdminCollapsibleCard>
      </main>

      <AdminEntityModal open={modal.open} entity={modal.entity} editing={Boolean(modal.editing)} saving={entitySaving} onClose={closeModal} t={t}>
        {modal.entity === "menu" ? (
          <section className="card admin-entity-form-card" data-admin-entity-form="menu" style={{ display: "block" }}>
            <form id="menuForm" className="grid" noValidate onSubmit={event => { event.preventDefault(); submitMenu(); }}>
              <input type="hidden" id="menuId" value={menuForm.id} readOnly /><input type="hidden" id="menuImage" value={menuForm.image} readOnly /><input type="hidden" id="menuImagePath" value={menuForm.imagePath} readOnly />
              <div className="field"><label htmlFor="menuName">{t("admin.menu.name")}</label><input className="input" id="menuName" required value={menuForm.name} onChange={e => setMenuForm(current => ({ ...current, name: e.target.value }))} /></div>
              <div className="grid grid-2">
                <div className="field"><label htmlFor="menuCategory">{t("admin.menu.category")}</label><input className="input" id="menuCategory" required value={menuForm.category} onChange={e => setMenuForm(current => ({ ...current, category: e.target.value }))} /></div>
                <div className="field"><label htmlFor="menuPrice">{t("admin.menu.price")}</label><input className="input" id="menuPrice" type="number" min="0" step="0.01" required value={menuForm.price} onChange={e => setMenuForm(current => ({ ...current, price: e.target.value }))} /></div>
              </div>
              <div className="field">
                <label>{t("admin.menu.image")}</label>
                <div className={"upload-dropzone" + (menuImagePreview ? " has-image" : "")} id="menuImageDropzone" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); chooseMenuImage(e.dataTransfer.files?.[0]); }}>
                  <input id="menuImageFile" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={e => chooseMenuImage(e.target.files?.[0])} />
                  {!menuImagePreview ? <div className="upload-dropzone-content" id="menuImageDropzoneContent"><div className="upload-dropzone-icon">+</div><div className="upload-dropzone-title">{t("admin.menu.image_pick")}</div><div className="upload-dropzone-help">{t("admin.menu.image_help")}</div></div> : null}
                  {menuImagePreview ? <div className="upload-preview" id="menuImagePreviewWrap"><img id="menuImagePreview" src={menuImagePreview} alt={t("admin.menu.image_alt")} draggable={false} style={{ objectPosition: "50% " + menuForm.imagePositionY + "%", cursor: "ns-resize", touchAction: "none", userSelect: "none", WebkitUserDrag: "none" }} onDragStart={event => event.preventDefault()} onPointerDown={startMenuImagePositionDrag} onPointerMove={moveMenuImagePosition} onPointerUp={endMenuImagePositionDrag} onPointerCancel={endMenuImagePositionDrag} onLostPointerCapture={() => { menuImagePositionDragRef.current.dragging = false; }} /><div className="upload-file-meta"><span id="menuImageFileName">{menuImageFile?.name || t("admin.menu.existing_image")}</span><span id="menuImageFileSize">{menuImageFile ? formatFileSize(menuImageFile.size) : ""}</span></div></div> : null}
                  {menuImagePreview ? <div className="image-position-controls"><div className="menu-category">ลากรูปขึ้น-ลงเพื่อเลือกพื้นที่แสดง • แนวตั้ง <strong id="imagePositionValue">{clampMenuImagePosition(menuForm.imagePositionY)}%</strong></div><button type="button" className="btn btn-sm" id="resetImagePosition" data-admin-button-icon="arrows-move" onClick={event => { event.preventDefault(); event.stopPropagation(); setMenuForm(current => ({ ...current, imagePositionY: 50 })); }}><i className="bi bi-arrows-move app-icon admin-button-icon" aria-hidden="true"></i><span className="admin-button-label">จัดกึ่งกลางรูป</span></button></div> : null}
                  {menuImagePreview ? <button type="button" className="btn btn-danger btn-sm" id="removeMenuImage" aria-label={t("admin.menu.remove_image")} title={t("admin.menu.remove_image")} onClick={event => { event.preventDefault(); event.stopPropagation(); if (menuImagePreview.startsWith("blob:")) URL.revokeObjectURL(menuImagePreview); setMenuImageFile(null); setMenuImagePreview(""); setMenuForm(current => ({ ...current, image: "", imagePath: "", imagePositionY: 50 })); }}><span className="menu-image-remove-symbol" aria-hidden="true">×</span></button> : null}
                </div>
                {menuImageError ? <div className="upload-error" id="menuImageError">{menuImageError}</div> : <div className="upload-error" id="menuImageError" hidden></div>}
              </div>
              <label><input type="checkbox" id="menuActive" checked={menuForm.active} onChange={e => setMenuForm(current => ({ ...current, active: e.target.checked }))} /> {t("admin.menu.active")}</label>
              <button className="btn btn-primary admin-edit-modal-source-submit" id="saveMenuButton" type="submit" hidden data-admin-button-icon="floppy"><i className="bi bi-floppy app-icon admin-button-icon" aria-hidden="true"></i><span className="admin-button-label">{t("admin.menu.save")}</span></button>
            </form>
          </section>
        ) : (
          <section className="card admin-entity-form-card admin-table-card" data-admin-entity-form="table" style={{ display: "block" }}>
            <form id="tableForm" className="grid" noValidate onSubmit={event => { event.preventDefault(); submitTable(); }}>
              <input type="hidden" id="tableId" value={tableForm.id} readOnly />
              <div className="field"><label htmlFor="tableCode">{t("admin.table.code")}</label><input className="input" id="tableCode" placeholder="A01" required value={tableForm.code} disabled={Boolean(modal.editing)} onChange={e => setTableForm(current => ({ ...current, code: e.target.value.toUpperCase() }))} /></div>
              <div className="field"><label htmlFor="tableName">{t("admin.table.name")}</label><input className="input" id="tableName" placeholder={t("admin.table.name_placeholder")} required value={tableForm.name} onChange={e => setTableForm(current => ({ ...current, name: e.target.value }))} /></div>
              <div className="field"><label htmlFor="tableCapacity">{t("admin.table.capacity")}</label><input className="input" id="tableCapacity" type="number" min="1" max="100" step="1" inputMode="numeric" required value={tableForm.capacity} onChange={e => setTableForm(current => ({ ...current, capacity: e.target.value }))} /><small>{t("admin.table.capacity_help")}</small></div>
              <label><input type="checkbox" id="tableActive" checked={tableForm.active} onChange={e => setTableForm(current => ({ ...current, active: e.target.checked }))} /> {t("admin.table.active")}</label>
              <button className="btn btn-primary admin-edit-modal-source-submit" type="submit" hidden data-admin-button-icon="floppy"><i className="bi bi-floppy app-icon admin-button-icon" aria-hidden="true"></i><span className="admin-button-label">{t("admin.table.save")}</span></button>
            </form>
          </section>
        )}
      </AdminEntityModal>

      <ParityFooter />
    </>
  );
}
