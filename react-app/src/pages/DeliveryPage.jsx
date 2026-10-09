import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { useParams } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { sweetConfirm } from "@/components/sweetDialog";
import { DeliveryLocationPicker } from "@/components/DeliveryLocationPicker";
import {
  PublicCartList, PublicMenuCatalog, PublicStorefrontFooter, PublicStorefrontHeader, showStorefrontToast,
} from "@/components/PublicStorefront";
import {
  checkDeliveryStoreIsOpen, createPublicDeliveryOrder, deliveryFreeGiftActive, loadPublicStorefront, normalizeDeliveryFreeGift,
  preparePublicOrderId, resolvePublicTenant, uploadPublicPaymentSlip, watchPublicStoreSettings,
} from "@/data/publicStorefrontData";
import {
  getDeliveryCustomerFavorites, getDeliveryCustomerProfile, loginDeliveryCustomerWithGoogle,
  logoutDeliveryCustomer, saveDeliveryCustomerFavorites, saveDeliveryCustomerProfile,
  watchDeliveryCustomerAuth,
} from "@/data/customerDeliveryData";
import { functions } from "@/firebase/client";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { generatePromptPayPayload } from "@/utils/promptPay";
import { qrDataUrl } from "@/utils/localQr";
import { svgQrPngBlob } from "@/utils/downloadQrPng";
import { validDeliveryLocation as normalizeLocation, matchGpsSavedAddress, validatedGpsFix } from "@/utils/deliveryLocationPolicy";
import { getDeliveryOpeningStatus } from "@/utils/deliveryOpeningHours";

const computeDeliveryRoute = httpsCallable(functions, "computeDeliveryRoute");
const quotePublicLalamoveDelivery = httpsCallable(functions, "quotePublicLalamoveDelivery");
const verifyDeliveryPaymentSlip = httpsCallable(functions, "verifyDeliveryPaymentSlip", { timeout: 70000 });
function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}
function newAddressId() {
  return typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : "address-" + Date.now() + "-" + Math.random().toString(36).slice(2, 12);
}
function normalizeZones(settings = {}) {
  const custom = Array.isArray(settings.deliveryFeeOptions) ? settings.deliveryFeeOptions : [];
  const configuredMax = Number(settings.deliveryMaxDistanceKm);
  const legacy = {
    "distance-0-2": 2, nearby: 2, "distance-2-5": 5, general: 5,
    "distance-5-plus": Number.isFinite(configuredMax) && configuredMax > 0 ? configuredMax : 10,
    far: Number.isFinite(configuredMax) && configuredMax > 0 ? configuredMax : 10,
  };
  let tier = 0;
  const rows = custom.map((option, index) => {
    const id = String(option?.id || option?.key || "fee-" + (index + 1));
    const pickup = id === "pickup";
    const explicit = Number(option?.maxDistanceKm ?? option?.distanceKm ?? option?.maxDistance);
    const fallback = [2, 5, 10];
    const maxDistanceKm = pickup ? null : (
      Number.isFinite(explicit) && explicit > 0
        ? explicit
        : legacy[id] || fallback[tier] || 10 + Math.max(0, tier - 2) * 5
    );
    if (!pickup) tier += 1;
    return {
      id,
      label: String(option?.label || option?.name || "").trim() || (pickup ? "รับที่ร้าน" : id),
      fee: pickup ? 0 : Math.max(0, Number(option?.fee ?? option?.amount ?? 0) || 0),
      maxDistanceKm,
    };
  });
  if (rows.length) return rows;
  return [
    { id: "distance-0-2", label: "0-2 km", fee: 10, maxDistanceKm: 2 },
    { id: "distance-2-5", label: "2-5 km", fee: 30, maxDistanceKm: 5 },
    { id: "distance-5-plus", label: "5+ km", fee: 50, maxDistanceKm: Number.isFinite(configuredMax) && configuredMax > 0 ? configuredMax : 10 },
  ];
}
function freeShippingConfig(settings = {}) {
  const row = settings?.deliveryPromotion?.freeShipping || {};
  return {
    enabled: row.enabled === true,
    minimumSubtotal: Math.max(0, Number(row.minimumSubtotal || 0) || 0),
  };
}
function deliveryErrorMessage(error, t, settings) {
  const detail = String(error?.details?.providerError || error?.serverResponse?.providerError || error?.message || error?.code || "");
  if (detail.includes("DELIVERY_STORE_CLOSED") || detail.includes("DELIVERY_STORE_STATUS_UNAVAILABLE")) {
    return t("delivery.opening_hours.order_unavailable");
  }
  if (detail.includes("ERR_OUT_OF_SERVICE_AREA")) return t("delivery.checkout.distance.lalamove_out_of_service_area");
  if (detail.includes("LALAMOVE_COD_UNAVAILABLE")) return t("delivery.checkout.distance.lalamove_cod_unavailable");
  if (detail.includes("DELIVERY_FREE_GIFT_LIMIT_EXCEEDED")) {
    return t("delivery.checkout.promotion.gift_limit", { max: normalizeDeliveryFreeGift(settings).maxSelectableItems });
  }
  if (detail.includes("DELIVERY_FREE_GIFT_REQUIRED")) return t("delivery.checkout.promotion.gift_required");
  if (detail.includes("DELIVERY_FREE_GIFT_INVALID")) return t("delivery.checkout.promotion.gift_invalid");
  if (detail.includes("DELIVERY_FREE_GIFT_NOT_AVAILABLE")) return t("delivery.checkout.promotion.gift_unavailable");
  if (detail.includes("SLIP_TOO_LARGE")) return t("delivery.checkout.payment.slip_too_large");
  if (detail.includes("storage/unauthorized")) return t("delivery.checkout.errors.storage_unauthorized");
  if (detail.includes("storage/retry-limit-exceeded")) return t("delivery.checkout.errors.storage_retry");
  if (detail.includes("storage/canceled")) return t("delivery.checkout.errors.storage_cancelled");
  return t("delivery.checkout.errors.submit_failed", { code: detail || "UNKNOWN_ERROR" });
}
function prettyDate(value = "") {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? match[3] + "/" + match[2] + "/" + match[1] : "";
}

export function DeliveryPage() {
  const { slug = "" } = useParams();
  const { t, locale, formatNumber } = useI18n();
  const stylesReady = useParityPage({
    title: t("delivery.checkout.meta_title"),
    bodyClass: "order-delivery-workspace delivery-page customer-order-page",
    styles: [
      "app.css", "menu-qr.css", "payment-slip.css", "menu-pagination.css", "delivery-addresses.css",
      "delivery-location-map.css", "delivery-promotions.css", "icons.css", "pos-refresh.css",
      "public-menu-image-frame.css", "mobile-menu-scroll.css", "delivery-payment-lock.css", "sweet-dialog.css",
      "order-delivery-workspace-theme.css", "delivery-google-normal-button.css",
      "delivery-google-font-mobile-spacing.css", "delivery-favorites.css", "shared-responsive.css",
    ],
  });

  const [tenant, setTenant] = useState(null);
  const [settings, setSettings] = useState({});
  const [settingsLiveReady, setSettingsLiveReady] = useState(false);
  const [settingsLiveError, setSettingsLiveError] = useState(false);
  const [openingClock, setOpeningClock] = useState(() => Date.now());
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeCategory, setActiveCategory] = useState("__all__");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [cart, setCart] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());

  const [customerUser, setCustomerUser] = useState(null);
  const [profile, setProfile] = useState({ displayName: "", phone: "", addresses: [] });
  const [profileLoading, setProfileLoading] = useState(true);
  const [customerBusy, setCustomerBusy] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [addressEditor, setAddressEditor] = useState(null);
  const [addressEditorError, setAddressEditorError] = useState("");
  const savedAddresses = Array.isArray(profile.addresses) ? profile.addresses : [];

  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState(null);
  const locationSourceRef = useRef("");
  const [initialGps, setInitialGps] = useState({ status: "pending", point: null, accuracy: null });
  const initialGpsRequestedForTenantRef = useRef("");
  const [routeState, setRouteState] = useState({ pending: false, route: null, quote: null, error: "" });
  const [manualZoneId, setManualZoneId] = useState("");
  const [freeGiftIds, setFreeGiftIds] = useState(new Set());
  const [orderNote, setOrderNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("promptpay");
  const [slipFile, setSlipFile] = useState(null);
  const [slipPreview, setSlipPreview] = useState("");
  const [paymentLocked, setPaymentLocked] = useState(false);
  const [lockedTotal, setLockedTotal] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [promptPayPng, setPromptPayPng] = useState({ source: "", url: "" });

  // Full-screen editor avoids crowding the narrow delivery sidebar.
  useEffect(() => {
    if (!addressEditor) return undefined;
    setAddressEditorError("");
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKeyDown = event => {
      if (event.key === "Escape" && customerBusy !== "address") setAddressEditor(null);
    };
    document.getElementById("addressLabel")?.focus();
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.documentElement.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [Boolean(addressEditor), customerBusy]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const nextTenant = await resolvePublicTenant(slug);
        const catalog = await loadPublicStorefront(nextTenant);
        if (!alive) return;
        setTenant(nextTenant);
        setSettings(catalog.settings || {});
        setMenus(catalog.menus || []);
        const zones = normalizeZones(catalog.settings || {}).filter(zone => zone.id !== "pickup");
        setManualZoneId(zones[0]?.id || "");
      } catch (error) {
        console.error("DELIVERY_REACT_LOAD_FAILED", error);
        if (alive) setLoadError(t("delivery.checkout.errors.tenant_not_ready"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [slug]);

  // Live settings update the storefront immediately after an emergency
  // close/reopen. Time-based transitions also tick without a page reload.
  useEffect(() => {
    if (!tenant) return undefined;
    let alive = true;
    setSettingsLiveReady(false);
    setSettingsLiveError(false);
    const unsubscribe = watchPublicStoreSettings(tenant, updated => {
      if (!alive) return;
      setSettings(updated);
      setSettingsLiveReady(true);
      setSettingsLiveError(false);
    }, error => {
      console.error("DELIVERY_STORE_HOURS_LISTENER_FAILED", error);
      if (alive) { setSettingsLiveError(true); setSettingsLiveReady(true); }
    });
    return () => { alive = false; unsubscribe?.(); };
  }, [tenant?.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setOpeningClock(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!tenant) return undefined;
    let alive = true;
    const stop = watchDeliveryCustomerAuth(async user => {
      if (!alive) return;
      setCustomerUser(user);
      setProfileLoading(true);
      try {
        const [nextProfile, favorites] = await Promise.all([
          getDeliveryCustomerProfile(tenant, user),
          getDeliveryCustomerFavorites(tenant, user),
        ]);
        if (!alive) return;
        const resolvedProfile = nextProfile || { displayName: "", phone: "", addresses: [] };
        const addresses = Array.isArray(resolvedProfile.addresses) ? resolvedProfile.addresses : [];
        setProfile(resolvedProfile);
        setFavoriteIds(new Set(favorites || []));
        // Wait for GPS after the address book loads; only a saved pin within
        // 100 metres may be auto-selected, regardless of legacy isDefault.
        if (resolvedProfile.displayName) setRecipientName(current => current || resolvedProfile.displayName);
        if (resolvedProfile.phone) setRecipientPhone(current => current || resolvedProfile.phone);
      } catch (error) {
        console.error("DELIVERY_CUSTOMER_PROFILE_LOAD_FAILED", error);
      } finally {
        if (alive) setProfileLoading(false);
      }
    });
    return () => { alive = false; stop?.(); };
  }, [tenant?.id]);

  // Resolve the customer address book first, then obtain device GPS. Compare
  // against that same loaded set of saved pins before selecting the nearest.
  // This is independent from Google Maps script/map readiness on PC/mobile.
  useEffect(() => {
    if (!tenant?.id || profileLoading || initialGpsRequestedForTenantRef.current === tenant.id) return undefined;
    initialGpsRequestedForTenantRef.current = tenant.id;
    let active = true;
    if (!window.isSecureContext || !navigator.geolocation?.getCurrentPosition) {
      setInitialGps({ status: "unavailable", point: null, accuracy: null });
      return undefined;
    }
    navigator.geolocation.getCurrentPosition(position => {
      if (!active) return;
      const { point, accuracy } = validatedGpsFix(position.coords);
      setInitialGps({ status: point ? "ready" : "unavailable", point, accuracy });
    }, error => {
      if (!active) return;
      console.warn("DELIVERY_INITIAL_GPS_UNAVAILABLE", error?.code || error);
      setInitialGps({ status: "unavailable", point: null, accuracy: null });
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
    return () => { active = false; };
  }, [tenant?.id, profileLoading]);

  useEffect(() => {
    if (profileLoading || initialGps.status === "pending" || locationSourceRef.current) return;
    const addresses = Array.isArray(profile.addresses) ? profile.addresses : [];
    // Even a single default Saved Address must never be selected when the
    // customer's GPS is farther than 100m away, missing or inaccurate.
    // Only a verified nearby saved pin may be selected automatically.
    const nearest = initialGps.point
      ? matchGpsSavedAddress(addresses, initialGps.point, "current-location")
      : null;
    if (nearest) selectAddress(nearest.address);
    // Otherwise leave checkout unselected and require explicit choice or save.
  }, [profileLoading, profile.addresses, initialGps]);

  useEffect(() => () => { if (slipPreview) URL.revokeObjectURL(slipPreview); }, [slipPreview]);

  useEffect(() => {
    if (favoriteIds.size === 0 && activeCategory === "__favorites__") {
      setActiveCategory("__all__");
      setPage(1);
    }
  }, [favoriteIds.size, activeCategory]);

  const businessStatus = useMemo(
    () => settingsLiveReady && !settingsLiveError
      ? getDeliveryOpeningStatus(settings, new Date(openingClock))
      : { open: false, reason: "unavailable", message: "" },
    [settings, settingsLiveReady, settingsLiveError, openingClock],
  );
  const storeAcceptingOrders = businessStatus.open === true;
  const closedReason = String(businessStatus.message || "").trim();

  const money = value => formatNumber(Number(value || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + Number(item.qty || 0), 0), [cart]);
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0), 0), [cart]);
  const zones = useMemo(() => normalizeZones(settings).filter(zone => zone.id !== "pickup"), [settings]);
  const usesLalamove = String(settings.deliveryProvider || "self").toLowerCase() === "lalamove";
  const maxDistance = Number(settings.deliveryMaxDistanceKm) > 0 ? Number(settings.deliveryMaxDistanceKm) : null;

  const routeZone = routeState.route?.zone || null;
  const lalamoveZone = routeState.quote ? {
    id: "lalamove", label: "Lalamove", fee: Math.max(0, Number(routeState.quote.fee || 0) || 0),
    maxDistanceKm: maxDistance,
  } : null;
  const manualMode = !usesLalamove
    && (!Number.isFinite(Number(settings.storeLatitude)) || !Number.isFinite(Number(settings.storeLongitude)));
  const manualZone = zones.find(zone => zone.id === manualZoneId) || zones[0] || null;
  const selectedZone = usesLalamove ? lalamoveZone : routeZone || (manualMode ? manualZone : null);

  const freeShipping = freeShippingConfig(settings);
  const freeShippingApplied = freeShipping.enabled && freeShipping.minimumSubtotal > 0 && subtotal >= freeShipping.minimumSubtotal;
  const baseDeliveryFee = Math.max(0, Number(selectedZone?.fee || 0) || 0);
  const deliveryFee = freeShippingApplied ? 0 : baseDeliveryFee;
  const total = subtotal + deliveryFee;

  const giftConfig = normalizeDeliveryFreeGift(settings);
  const giftPromotionActive = deliveryFreeGiftActive(giftConfig);
  const giftMenus = useMemo(() => {
    if (!giftPromotionActive) return [];
    const allowed = new Set(giftConfig.menuIds || []);
    return menus.filter(menu => menu.active !== false && allowed.has(String(menu.id)));
  }, [giftPromotionActive, giftConfig.menuIds?.join("|"), menus]);
  useEffect(() => {
    const available = new Set(giftMenus.map(menu => String(menu.id)));
    setFreeGiftIds(current => new Set([...current].filter(id => available.has(id)).slice(0, giftConfig.maxSelectableItems || 0)));
  }, [giftMenus.map(menu => menu.id).join("|"), giftConfig.maxSelectableItems]);

  useEffect(() => {
    if (!tenant || !deliveryLocation) {
      setRouteState({ pending: false, route: null, quote: null, error: "" });
      return undefined;
    }
    if (manualMode) {
      setRouteState({ pending: false, route: null, quote: null, error: "" });
      return undefined;
    }
    let alive = true;
    const timer = window.setTimeout(async () => {
      setRouteState(current => ({ ...current, pending: true, error: "" }));
      try {
        if (usesLalamove) {
          const response = await quotePublicLalamoveDelivery({
            slug: tenant.slug || slug,
            latitude: deliveryLocation.latitude,
            longitude: deliveryLocation.longitude,
            paymentMethod,
            address: deliveryAddress.trim(),
          });
          if (!alive) return;
          const quote = response.data?.item || null;
          if (!quote?.quotationId || !Number.isFinite(Number(quote.fee))) throw new Error("LALAMOVE_QUOTATION_INVALID");
          setRouteState({ pending: false, route: null, quote, error: "" });
        } else {
          const response = await computeDeliveryRoute({
            slug: tenant.slug || slug,
            latitude: deliveryLocation.latitude,
            longitude: deliveryLocation.longitude,
          });
          if (!alive) return;
          const route = response.data || null;
          if (!route || !Number.isFinite(Number(route.distanceKm))) throw new Error("GOOGLE_ROUTE_INVALID");
          setRouteState({ pending: false, route, quote: null, error: "" });
        }
      } catch (error) {
        console.warn("DELIVERY_REACT_ROUTE_FAILED", error);
        if (alive) setRouteState({ pending: false, route: null, quote: null, error: String(error?.details?.providerError || error?.code || error?.message || "") });
      }
    }, 350);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [tenant?.id, deliveryLocation?.latitude, deliveryLocation?.longitude, paymentMethod, deliveryAddress, usesLalamove, manualMode]);

  const routeDistance = Number(routeState.quote?.distanceKm ?? routeState.route?.distanceKm);
  const routeReady = manualMode
    ? Boolean(selectedZone)
    : usesLalamove
      ? Boolean(routeState.quote && Number.isFinite(routeDistance) && (!maxDistance || routeDistance <= maxDistance))
      : Boolean(routeState.route?.inRange === true && selectedZone);

  const promptPayQr = useMemo(() => {
    if (paymentMethod !== "promptpay" || total <= 0) return { src: "", error: "" };
    const id = String(settings.promptPayId || "").replace(/\D/g, "");
    if (!id) return { src: "", error: t("delivery.checkout.payment.promptpay_not_configured") };
    try {
      return { src: qrDataUrl(generatePromptPayPayload(id, total), { size: 320, margin: 4 }), error: "" };
    } catch {
      return { src: "", error: t("delivery.checkout.payment.promptpay_invalid") };
    }
  }, [paymentMethod, total, settings.promptPayId, t]);

  // Prepare real PNG bytes while the payment card is displayed. Native anchor
  // downloads retain the browser user gesture on mobile (unlike async click()).
  useEffect(() => {
    if (!promptPayQr.src) return undefined;
    let active = true;
    let url = "";
    svgQrPngBlob(promptPayQr.src).then(blob => {
      if (!active) return;
      url = URL.createObjectURL(blob);
      setPromptPayPng({ source: promptPayQr.src, url });
    }).catch(error => console.error("DELIVERY_QR_PNG_PREPARE_FAILED", error));
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [promptPayQr.src]);
  const paymentQrDownloadUrl = promptPayPng.source === promptPayQr.src ? promptPayPng.url : "";

  const add = item => {
    if (paymentLocked || !storeAcceptingOrders) return;
    setCart(current => {
      const found = current.find(row => row.id === item.id);
      return found
        ? current.map(row => row.id === item.id ? { ...row, qty: row.qty + 1 } : row)
        : [...current, { ...item, qty: 1, note: "" }];
    });
  };
  const increase = id => { if (!paymentLocked && storeAcceptingOrders) setCart(current => current.map(row => row.id === id ? { ...row, qty: row.qty + 1 } : row)); };
  const decrease = async item => {
    if (paymentLocked) return;
    if (item.qty > 1) {
      setCart(current => current.map(row => row.id === item.id ? { ...row, qty: row.qty - 1 } : row));
      return;
    }
    const ok = await sweetConfirm(t("delivery.checkout.confirm.remove_item", { item: item.name }), {
      title: t("delivery.checkout.confirm.remove_item_title"),
      confirmText: t("delivery.checkout.common.confirm"),
      cancelText: t("delivery.checkout.common.cancel"),
      type: "warning",
    });
    if (ok) setCart(current => current.filter(row => row.id !== item.id));
  };
  const noteItem = (id, value) => { if (!paymentLocked) setCart(current => current.map(row => row.id === id ? { ...row, note: value } : row)); };

  const toggleFavorite = async item => {
    const id = String(item.id);
    const next = new Set(favoriteIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    try {
      await saveDeliveryCustomerFavorites(tenant, [...next], customerUser);
      setFavoriteIds(next);
    } catch (error) {
      console.error("DELIVERY_FAVORITE_SAVE_FAILED", error);
      showStorefrontToast(t("delivery.checkout.menu.favorite_save_failed"), "error");
    }
  };

  const selectAddress = address => {
    const point = normalizeLocation(address);
    if (!point || !String(address?.id || "").trim()) {
      showStorefrontToast(t("delivery.checkout.address.saved_pin_required"), "error");
      return;
    }
    locationSourceRef.current = "saved-address";
    setSelectedAddressId(address.id);
    setRecipientName(address.recipientName || profile.displayName || "");
    setRecipientPhone(address.recipientPhone || profile.phone || "");
    setDeliveryAddress(address.address || "");
    setDeliveryLocation(point);
  };

  // A removed or changed saved address may not remain a checkout destination.
  useEffect(() => {
    if (profileLoading || !selectedAddressId) return;
    const saved = (profile.addresses || []).find(address => address.id === selectedAddressId);
    const point = normalizeLocation(saved);
    if (!saved || !point) {
      locationSourceRef.current = "";
      setSelectedAddressId("");
      setDeliveryAddress("");
      setDeliveryLocation(null);
    }
  }, [profileLoading, profile.addresses, selectedAddressId]);

  const persistProfile = async next => {
    const saved = await saveDeliveryCustomerProfile(tenant, next, customerUser);
    setProfile(saved);
    return saved;
  };
  const saveAddress = async () => {
    if (!addressEditor || customerBusy) return;
    const label = String(addressEditor.label || "").trim();
    const name = String(addressEditor.recipientName || "").trim();
    const address = String(addressEditor.address || "").trim();
    if (!label || !name || !address) {
      setAddressEditorError(t("delivery.checkout.address.required_fields")); return;
    }
    const addressPin = normalizeLocation(addressEditor);
    if (!addressPin) {
      setAddressEditorError(t("delivery.checkout.address.saved_pin_required")); return;
    }
    let addresses = [...(profile.addresses || [])];
    if (!addressEditor.id && addresses.length >= 5) {
      setAddressEditorError(t("delivery.checkout.address.max_five")); return;
    }
    const id = addressEditor.id || newAddressId();
    const index = addresses.findIndex(item => item.id === id);
    // Keep legacy isDefault metadata unchanged for existing addresses only.
    // New saved addresses do not need a primary flag; GPS or explicit choice
    // determines the destination, never the legacy default property.
    const row = {
      id, label, recipientName: name, recipientPhone: normalizePhone(recipientPhone),
      address, latitude: addressPin.latitude, longitude: addressPin.longitude,
      ...(index >= 0 && Object.prototype.hasOwnProperty.call(addresses[index], "isDefault")
        ? { isDefault: addresses[index].isDefault } : {}),
    };
    if (index >= 0) addresses[index] = row; else addresses.push(row);
    setAddressEditorError("");
    setCustomerBusy("address");
    try {
      await persistProfile({ ...profile, displayName: name, phone: normalizePhone(recipientPhone), addresses });
      setAddressEditor(null);
      selectAddress(row);
      showStorefrontToast(t(index >= 0 ? "delivery.checkout.address.updated" : "delivery.checkout.address.saved"));
    } catch (error) {
      console.error("DELIVERY_ADDRESS_SAVE_FAILED", error);
      setAddressEditorError(t("delivery.checkout.address.save_failed"));
    } finally { setCustomerBusy(""); }
  };
  const deleteAddress = async address => {
    const ok = await sweetConfirm(t("delivery.checkout.address.delete_prompt"), {
      title: t("delivery.checkout.address.delete_title"),
      confirmText: t("delivery.checkout.common.confirm"), cancelText: t("delivery.checkout.common.cancel"), type: "warning",
    });
    if (!ok) return;
    // Do not rewrite the remaining legacy primary flags when deleting.
    // Neither GPS matching nor manual checkout selection depends on them.
    const addresses = (profile.addresses || []).filter(row => row.id !== address.id);
    try {
      await persistProfile({ ...profile, addresses });
      if (selectedAddressId === address.id) {
        locationSourceRef.current = "";
        setSelectedAddressId("");
        setDeliveryAddress("");
        setDeliveryLocation(null);
      }
      showStorefrontToast(t("delivery.checkout.address.deleted"));
    } catch (error) {
      console.error("DELIVERY_ADDRESS_DELETE_FAILED", error);
      showStorefrontToast(t("delivery.checkout.address.save_failed"), "error");
    }
  };
  const loginGoogle = async () => {
    if (!tenant || customerBusy) return;
    setCustomerBusy("login");
    try { await loginDeliveryCustomerWithGoogle(tenant); }
    catch (error) {
      console.error("DELIVERY_GOOGLE_LOGIN_FAILED", error);
      const code = String(error?.code || error?.message || "");
      const map = {
        "auth/popup-blocked": "popup_failed_to_open",
        "auth/popup-closed-by-user": "popup_closed",
        "auth/cancelled-popup-request": "popup_closed",
      };
      const key = map[code];
      showStorefrontToast(key ? t("delivery.checkout.customer.google_errors." + key) : t("delivery.checkout.customer.google_login_failed"), "error");
    } finally { setCustomerBusy(""); }
  };
  const logoutGoogle = async () => {
    setCustomerBusy("logout");
    try {
      await logoutDeliveryCustomer();
      showStorefrontToast(t("delivery.checkout.customer.logout_done"));
    } finally { setCustomerBusy(""); }
  };

  const chooseSlip = file => {
    if (!file) return;
    const ext = String(file.name || "").split(".").pop()?.toLowerCase() || "";
    const allowed = ["jpg","jpeg","png","webp","heic","heif"];
    if (file.size > 8 * 1024 * 1024) {
      showStorefrontToast(t("delivery.checkout.payment.slip_too_large"), "error"); return;
    }
    if ((file.type && !file.type.startsWith("image/")) || (!file.type && !allowed.includes(ext))) {
      showStorefrontToast(t("delivery.checkout.payment.slip_type_toast"), "error"); return;
    }
    if (slipPreview) URL.revokeObjectURL(slipPreview);
    setSlipFile(file); setSlipPreview(URL.createObjectURL(file));
  };
  const clearSlip = () => {
    if (slipPreview) URL.revokeObjectURL(slipPreview);
    setSlipFile(null); setSlipPreview("");
  };

  const validateBase = () => {
    if (!storeAcceptingOrders) {
      showStorefrontToast(t("delivery.opening_hours.order_unavailable"), "error");
      return false;
    }
    if (!cart.length) { showStorefrontToast(t("delivery.checkout.validation.add_items_first"), "error"); return false; }
    if (!recipientName.trim() || !recipientPhone.trim() || !deliveryAddress.trim()) {
      showStorefrontToast(t("delivery.checkout.validation.delivery_details_required"), "error"); return false;
    }
    const saved = (profile.addresses || []).find(address => address.id === selectedAddressId);
    const point = normalizeLocation(saved);
    if (addressEditor || !saved || !point || !deliveryLocation
      || deliveryLocation.latitude !== point.latitude || deliveryLocation.longitude !== point.longitude
      || deliveryAddress.trim() !== String(saved.address || "").trim()) {
      showStorefrontToast(t("delivery.checkout.address.saved_selection_required"), "error");
      return false;
    }
    if (routeState.pending) { showStorefrontToast(t("delivery.checkout.distance.calculating"), "error"); return false; }
    if (!routeReady) {
      const message = usesLalamove
        ? deliveryErrorMessage({ message: routeState.error || "LALAMOVE" }, t, settings)
        : routeState.route && routeState.route.inRange !== true && maxDistance
          ? t("delivery.checkout.distance.out_of_range", { distance: Number(routeDistance || 0).toFixed(2), max: maxDistance.toFixed(2) })
          : t("delivery.checkout.distance.fee_rule_missing");
      showStorefrontToast(message, "error"); return false;
    }
    if (giftMenus.length && freeGiftIds.size < 1) {
      showStorefrontToast(t("delivery.checkout.promotion.gift_required"), "error"); return false;
    }
    if (freeGiftIds.size > giftConfig.maxSelectableItems) {
      showStorefrontToast(t("delivery.checkout.promotion.gift_limit", { max: giftConfig.maxSelectableItems }), "error"); return false;
    }
    if (paymentMethod === "promptpay" && !String(settings.promptPayId || "").trim()) {
      showStorefrontToast(t("delivery.checkout.payment.promptpay_not_configured"), "error"); return false;
    }
    return true;
  };

  const submit = async () => {
    if (!tenant || submitting) return;
    if (!validateBase()) return;
    // Server-side read before payment lock, and again before upload/verify.
    try { await checkDeliveryStoreIsOpen(tenant); }
    catch (error) {
      showStorefrontToast(t("delivery.opening_hours.order_unavailable"), "error");
      return;
    }
    if (paymentMethod === "promptpay" && !paymentLocked) {
      setLockedTotal({ subtotal, deliveryFee, total });
      setPaymentLocked(true);
      showStorefrontToast(t("delivery.checkout.payment_lock.locked_done", { total: money(total) }));
      return;
    }
    if (paymentMethod === "promptpay" && !slipFile) {
      showStorefrontToast(t("delivery.checkout.payment.slip_required_toast"), "error"); return;
    }
    const orderId = preparePublicOrderId(tenant, "delivery");
    let submittingToBackend = false;
    setSubmitting(true);
    try {
      await checkDeliveryStoreIsOpen(tenant);
      const slip = paymentMethod === "promptpay" ? await uploadPublicPaymentSlip(tenant, slipFile, orderId) : { path: "" };
      let slipCheckStatus = "";
      if (paymentMethod === "promptpay") {
        const response = await verifyDeliveryPaymentSlip({
          tenantId: tenant.id, orderId, slipPath: slip.path, amount: total,
          deliveryFee, items: cart.map(item => ({ id: item.id, qty: item.qty })),
          deliveryProvider: usesLalamove ? "lalamove" : "self",
          latitude: deliveryLocation.latitude, longitude: deliveryLocation.longitude,
          quotationId: usesLalamove ? String(routeState.quote?.quotationId || "") : "",
          zoneId: selectedZone.id,
        });
        const result = response?.data || {};
        slipCheckStatus = String(result.status || "");
        const slipErrors = {
          duplicate: "slip_duplicate",
          mismatch: "slip_mismatch",
          receiver_mismatch: "slip_receiver_mismatch",
          invalid: "slip_invalid",
        };
        if (slipErrors[slipCheckStatus]) {
          showStorefrontToast(t("delivery.checkout.payment." + slipErrors[slipCheckStatus]), "error");
          return;
        }
        if (!["matched", "manual_review"].includes(slipCheckStatus)) {
          throw new Error("DELIVERY_SLIP_CHECK_INCOMPLETE");
        }
        if (slipCheckStatus === "manual_review") {
          showStorefrontToast(t("delivery.checkout.payment.slip_manual"));
        }
      }
      const paidItems = cart.map(({ id, name, price, qty, note: itemNote }) => ({
        menuId: id, name, price: Number(price || 0), qty: Number(qty || 0), note: itemNote || "", cancelled: false,
      }));
      const giftItems = [...freeGiftIds].map(id => menus.find(menu => String(menu.id) === id)).filter(Boolean).map(menu => ({
        menuId: menu.id, name: menu.name, price: 0, qty: 1, note: "", cancelled: false, isGift: true,
      }));
      const payload = {
        id: orderId, tableCode: "DELIVERY",
        recipientName: recipientName.trim(), recipientPhone: normalizePhone(recipientPhone),
        deliveryAddress: deliveryAddress.trim(),
        deliveryProvider: usesLalamove ? "lalamove" : "self",
        deliveryZone: selectedZone.id, deliveryZoneLabel: selectedZone.label,
        deliveryBaseFee: baseDeliveryFee, deliveryFee,
        deliveryFeeDiscount: Math.max(0, baseDeliveryFee - deliveryFee),
        freeShippingApplied, deliveryFeeMode: usesLalamove ? "lalamove_quotation" : manualMode ? "manual_fallback" : "google_routes",
        freeGiftMenuIds: [...freeGiftIds],
        subtotalAmount: subtotal, totalAmount: total,
        paymentMethod, paymentStatus: paymentMethod === "promptpay" ? "pending_verification" : "unpaid",
        paymentSlipUrl: "", paymentSlipPath: slip.path || "",
        ...(paymentMethod === "promptpay" ? { slipCheckStatus, paymentReviewRequired: slipCheckStatus === "manual_review" } : {}),
        status: "pending", note: orderNote.trim(), items: [...paidItems, ...giftItems],
        deliveryLatitude: deliveryLocation.latitude, deliveryLongitude: deliveryLocation.longitude,
      };
      if (usesLalamove) {
        const quote = routeState.quote || {};
        const quotedFee = Math.max(0, Number(quote.fee || baseDeliveryFee) || 0);
        payload.deliveryDistanceKm = Number(Number(routeDistance || 0).toFixed(3));
        payload.deliveryDistanceMeters = Math.max(0, Number(quote.distanceMeters || Math.round(Number(routeDistance || 0) * 1000)) || 0);
        payload.deliveryRouteProvider = "lalamove";
        payload.lalamoveQuotationId = String(quote.quotationId || "");
        payload.lalamoveQuotationExpiresAt = String(quote.expiresAt || "");
        payload.lalamoveCurrency = String(quote.currency || "THB");
        payload.lalamoveAccountMode = String(quote.accountMode || "");
        payload.lalamoveAccountEnvironment = String(quote.accountEnvironment || "");
        payload.lalamoveDispatchQuote = {
          quotationId: String(quote.quotationId || ""), expiresAt: String(quote.expiresAt || ""),
          fee: quotedFee, currency: String(quote.currency || "THB"),
          distanceKm: Number.isFinite(Number(quote.distanceKm)) ? Number(quote.distanceKm) : Number(Number(routeDistance || 0).toFixed(3)),
          distanceMeters: Math.max(0, Number(quote.distanceMeters || 0) || 0),
          priceBreakdown: quote.priceBreakdown || {},
          specialRequests: Array.isArray(quote.specialRequests) ? quote.specialRequests : [],
          stops: Array.isArray(quote.stops) ? quote.stops : [],
        };
        const special = Array.isArray(quote.specialRequests) ? quote.specialRequests : [];
        const cod = paymentMethod === "cod" && special.includes("CASH_ON_DELIVERY");
        if (paymentMethod === "cod" && !cod) throw new Error("LALAMOVE_COD_UNAVAILABLE");
        payload.lalamoveCodEnabled = cod;
        payload.lalamoveCodAmount = cod ? total : 0;
        payload.lalamoveDispatchFee = quotedFee;
        payload.lalamoveDispatchPriceDifference = 0;
        payload.lalamoveDispatchRequiresApproval = false;
        payload.lalamoveDispatchQuotedAt = new Date().toISOString();
      } else if (routeState.route) {
        payload.deliveryDistanceKm = Number(Number(routeState.route.distanceKm || 0).toFixed(3));
        payload.deliveryDistanceMeters = Number(routeState.route.distanceMeters || 0);
        payload.deliveryDurationSeconds = Number(routeState.route.durationSeconds || 0);
        payload.deliveryRouteProvider = "google_routes";
      }

      submittingToBackend = true;
      await createPublicDeliveryOrder(tenant, payload, { menus, settings });

      // Do not rewrite saved-address coordinates as a side effect of checkout.
      // Customer address-book pins change only through explicit Save Address.

      // Replace the submitted checkout history entry so Back cannot restore a
      // locked PromptPay amount or replay a completed order from the browser cache.
      try { sessionStorage.removeItem("delivery_checkout_draft:" + (tenant.slug || slug)); } catch {}
      setCart([]);
      setFreeGiftIds(new Set());
      setPaymentLocked(false);
      setLockedTotal(null);
      clearSlip();
      location.replace("/s/" + encodeURIComponent(tenant.slug || slug) + "/delivery/success?order=" + encodeURIComponent(orderId));
    } catch (error) {
      console.error("DELIVERY_REACT_SUBMIT_FAILED", error);
      const isSlipFunctionError = !submittingToBackend && String(error?.code || "").includes("functions/");
      showStorefrontToast(isSlipFunctionError
        ? t("delivery.checkout.payment.slip_service_error")
        : deliveryErrorMessage(error, t, settings), "error");
    } finally { setSubmitting(false); }
  };

  const distanceStatus = (() => {
    if (!deliveryLocation) return "";
    if (routeState.pending) return usesLalamove ? t("delivery.checkout.distance.lalamove_loading") : t("delivery.checkout.distance.calculating");
    if (routeState.error) return usesLalamove ? deliveryErrorMessage({ message: routeState.error }, t, settings) : t("delivery.checkout.distance.route_failed");
    if (usesLalamove && routeState.quote) {
      if (maxDistance && routeDistance > maxDistance) return t("delivery.checkout.distance.out_of_range", { distance: routeDistance.toFixed(2), max: maxDistance.toFixed(2) });
      return t("delivery.checkout.distance.lalamove_ready", { distance: routeDistance.toFixed(2), fee: money(baseDeliveryFee) });
    }
    if (routeState.route) {
      return routeState.route.inRange
        ? (maxDistance ? t("delivery.checkout.distance.ready_with_limit", { distance: routeDistance.toFixed(2), max: maxDistance.toFixed(2) }) : t("delivery.checkout.distance.ready", { distance: routeDistance.toFixed(2) }))
        : (maxDistance ? t("delivery.checkout.distance.out_of_range", { distance: routeDistance.toFixed(2), max: maxDistance.toFixed(2) }) : t("delivery.checkout.distance.fee_rule_missing"));
    }
    if (manualMode) return t("delivery.checkout.distance.store_location_missing");
    return "";
  })();

  const toggleGift = id => {
    setFreeGiftIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < giftConfig.maxSelectableItems) next.add(id);
      else showStorefrontToast(t("delivery.checkout.promotion.gift_limit", { max: giftConfig.maxSelectableItems }), "error");
      return next;
    });
  };

  if (!stylesReady || loading || (tenant && profileLoading && !loadError)
    || (tenant && !settingsLiveReady && !loadError)) return <PageReadyOverlay />;
  const shopName = String(settings.orderDeliveryShopName || settings.shopName || tenant?.name || t("shared.store.fallback_name") || "PENGUIN").trim();
  const locked = paymentMethod === "promptpay" && paymentLocked;

  return <>
    <PublicStorefrontHeader title={t("delivery.checkout.header.title")} badge={t("delivery.checkout.header.badge")} />
    <div id="demoBanner"></div>
    <main className="container">
      <section className="hero">
        <h1 className="hero-title"><i className="bi bi-scooter app-icon" aria-hidden="true"></i><span id="deliveryHeroStoreName">{shopName}</span></h1>
        <p>{t("delivery.checkout.hero.description")}</p>
      </section>

      {!storeAcceptingOrders ? <section className="delivery-closed-banner" id="deliveryStoreClosed"
        role="alert" aria-live="polite">
        <span className="delivery-closed-icon"><i className="bi bi-door-closed app-icon" aria-hidden="true"></i></span>
        <div className="delivery-closed-body">
          <div className="delivery-closed-heading">
            <strong>{t("delivery.opening_hours.closed_title")}</strong>
            <span className="delivery-closed-status">
              <i className="bi bi-circle-fill app-icon" aria-hidden="true"></i>
              {t("delivery.opening_hours.closed_badge")}
            </span>
          </div>
          <p className="delivery-closed-detail">{t(businessStatus.reason === "closed_day" ? "delivery.opening_hours.closed_day" :
            businessStatus.reason === "outside_hours" ? "delivery.opening_hours.outside_hours" :
            businessStatus.reason === "unavailable" ? "delivery.opening_hours.status_unavailable" :
            "delivery.opening_hours.manual_closed")}</p>
          {closedReason ? <p className="delivery-closed-reason">
            <i className="bi bi-info-circle app-icon" aria-hidden="true"></i>
            {closedReason}
          </p> : null}
          <p className="delivery-closed-footnote">
            <i className="bi bi-clock-history app-icon" aria-hidden="true"></i>
            {t("delivery.opening_hours.closed_help")}
          </p>
        </div>
      </section> : null}
      {loadError ? <section className="card empty">{loadError}</section> : (
        <div className="delivery-pos">
          {loading ? <div className="delivery-menu-column"><div className="card empty">{t("common.loading")}</div></div> : (
            <PublicMenuCatalog menus={menus} prefix="delivery.checkout.menu" activeCategory={activeCategory}
              setActiveCategory={setActiveCategory} search={search} setSearch={setSearch} page={page} setPage={setPage}
              onAdd={add} disabled={submitting || locked || !storeAcceptingOrders}
              extraCategory={favoriteIds.size > 0 ? "__favorites__" : null} extraLabel={t("delivery.checkout.menu.favorites")}
              extraFilter={item => favoriteIds.has(String(item.id))}
              favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite}
              favoriteAddLabel={t("delivery.checkout.menu.favorite_add")}
              favoriteRemoveLabel={t("delivery.checkout.menu.favorite_remove")}
              searchId="searchInput" paginationId="menuPagination" />
          )}

          <div className="delivery-side-column">
            <section className="card">
              <div className="section-title"><h2><i className="bi bi-cart3 app-icon"></i><span>{t("delivery.checkout.menu.cart_title")}</span></h2><span id="cartCount" className="badge">{t("delivery.checkout.menu.cart_count", { count: cartCount })}</span></div>
              <PublicCartList items={cart} prefix="delivery.checkout.cart" onIncrease={increase} onDecrease={decrease} onNote={noteItem} emptyTextKey="delivery.checkout.menu.cart_empty" listId="cartList" />
            </section>

            <section className="card delivery-account-card" style={{ marginTop: 18 }}>
              <div className="section-title"><h2><i className="bi bi-person-vcard app-icon" aria-hidden="true"></i><span>{t("delivery.checkout.customer.section_title")}</span></h2></div>
              <div className="grid grid-2" style={{ alignItems: "center" }}>
                <div>
                  <div className="delivery-account-user-row">
                    <div id="customerAccount" hidden={!customerUser}>
                      <strong id="customerAccountName">{customerUser?.displayName || t("delivery.checkout.customer.google_account")}</strong>
                    </div>
                    {customerUser ? <button
                      type="button"
                      className="delivery-account-logout"
                      id="customerLogoutButton"
                      aria-label={t("delivery.checkout.customer.logout")}
                      title={t("delivery.checkout.customer.logout")}
                      disabled={Boolean(customerBusy)}
                      onClick={logoutGoogle}
                    ><i className={customerBusy === "logout" ? "bi bi-hourglass-split app-icon" : "bi bi-box-arrow-right app-icon"} aria-hidden="true"></i></button> : null}
                  </div>
                  <div id="customerModeText" className="menu-category">{t(customerUser ? "delivery.checkout.customer.signed_in_mode" : "delivery.checkout.customer.guest_mode")}</div>
                </div>
                <div className="delivery-google-button-slot" style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  {!customerUser ? <button type="button" className="google-login-button delivery-google-login-button" id="googleLoginButton" disabled={Boolean(customerBusy)} onClick={loginGoogle}>
                    <img src="/assets/images/google-logo.svg" alt="" width="20" height="20" aria-hidden="true" />
                    <span>{t(customerBusy === "login" ? "delivery.checkout.customer.google_login_busy" : "delivery.checkout.customer.google_login")}</span>
                  </button> : null}
                </div>
              </div>
            </section>

            <section className="card" style={{ marginTop: 18 }}>
              <div className="section-title"><h2><i className="bi bi-truck app-icon"></i><span>{t("delivery.checkout.address.section_title")}</span></h2></div>
              <div className="grid grid-2 delivery-contact-grid">
                <div className="field"><label>{t("delivery.checkout.address.recipient_name")} *</label><input className="input" id="recipientName" required maxLength={120} value={recipientName} disabled={submitting} onChange={event => setRecipientName(event.target.value)} /><div className="address-lookup-status" aria-hidden="true">&nbsp;</div></div>
                <div className="field"><label>{t("delivery.checkout.address.phone")} *</label><input className="input" id="recipientPhone" type="tel" inputMode="tel" required maxLength={20} value={recipientPhone} disabled={submitting} onChange={event => setRecipientPhone(event.target.value)} /><div id="addressLookupStatus" className="address-lookup-status">{profileLoading ? t("delivery.checkout.address.loading") : (profile.addresses || []).length ? t("delivery.checkout.address.found", { count: (profile.addresses || []).length }) : t("delivery.checkout.address.none_for_store")}</div></div>
              </div>

              <section id="addressBook" className="address-book">
                <div className="address-book-head">
                  <div className="address-book-heading">
                    <strong>{t("delivery.checkout.address.book_title")}</strong>
                    <div className="address-book-meta">
                      <span id="addressCount" className="address-book-count">{t("delivery.checkout.address.count", { count: savedAddresses.length })}</span>
                    </div>
                  </div>
                  <button type="button" className="btn btn-primary btn-sm" id="addAddressButton"
                    disabled={locked || submitting || savedAddresses.length >= 5 || Boolean(customerBusy)}
                    onClick={() => setAddressEditor({ id: "", label: t("delivery.checkout.address.home_label"),
                      recipientName, address: "" })}>
                    <i className="bi bi-plus-lg app-icon" aria-hidden="true"></i>
                    <span>{t("delivery.checkout.address.add")}</span>
                  </button>
                </div>
                {!selectedAddressId && !addressEditor && !profileLoading ? <div
                  className="delivery-address-choice-notice" role="status" id="deliveryAddressChoiceNotice">
                  <i className="bi bi-geo-alt app-icon" aria-hidden="true"></i>
                  <div>
                    <strong>{t("delivery.checkout.address.choice_required_title")}</strong>
                    <p>{t(!(profile.addresses || []).length
                      ? "delivery.checkout.address.choice_no_saved"
                      : initialGps.status === "pending"
                        ? "delivery.checkout.address.choice_locating"
                        : initialGps.status === "ready"
                          ? "delivery.checkout.address.choice_no_nearby"
                          : "delivery.checkout.address.choice_gps_unavailable")}</p>
                    <small>{t("delivery.checkout.address.choice_help")}</small>
                    <button type="button" className="btn btn-primary btn-sm"
                      disabled={locked || submitting || Boolean(customerBusy) || (profile.addresses || []).length >= 5}
                      onClick={() => setAddressEditor({ id: "", label: t("delivery.checkout.address.home_label"),
                        recipientName, address: "" })}>
                      <i className="bi bi-plus-lg app-icon" aria-hidden="true"></i>
                      <span>{t("delivery.checkout.address.add")}</span>
                    </button>
                  </div>
                </div> : null}
                <div id="addressList" className="address-list">
                  {savedAddresses.length ? savedAddresses.map(address => (
                    <div className={"address-card" + (selectedAddressId === address.id ? " selected" : "")} key={address.id}>
                      <label className="address-card-choice">
                        <input type="radio" name="savedDeliveryAddressReact"
                          value={address.id} checked={selectedAddressId === address.id}
                          disabled={locked || submitting} onChange={() => selectAddress(address)} />
                        <span className="address-card-content">
                          <span className="address-card-title">{address.label || t("delivery.checkout.address.fallback_label")}</span>
                          {selectedAddressId === address.id ? <span className="address-card-subtitle">
                            {t("delivery.checkout.address.selected_delivery_address")}
                          </span> : null}
                        </span>
                      </label>
                      <div className="address-card-actions">
                        <button type="button" className="address-icon-button"
                          aria-label={t("delivery.checkout.address.edit")} title={t("delivery.checkout.address.edit")}
                          disabled={Boolean(customerBusy) || locked || submitting}
                          onClick={() => setAddressEditor({ ...address })}>
                          <i className="bi bi-pencil app-icon" aria-hidden="true"></i>
                        </button>
                        <button type="button" className="address-icon-button danger"
                          aria-label={t("delivery.checkout.address.delete")} title={t("delivery.checkout.address.delete")}
                          disabled={Boolean(customerBusy) || locked || submitting}
                          onClick={() => deleteAddress(address)}>
                          <i className="bi bi-trash3 app-icon" aria-hidden="true"></i>
                        </button>
                      </div>
                    </div>
                  )) : <div className="empty" style={{ padding: "20px 10px" }}>{t("delivery.checkout.address.none_saved")}</div>}
                </div>
                {addressEditor ? createPortal(
                  <div className="delivery-address-dialog-backdrop">
                    <section id="addressForm" className="address-form delivery-address-dialog"
                      role="dialog" aria-modal="true" aria-labelledby="deliveryAddressModalTitle">
                      <header className="delivery-address-dialog-header">
                        <div className="delivery-address-dialog-heading">
                          <span className="delivery-address-dialog-icon">
                            <i className="bi bi-geo-alt app-icon" aria-hidden="true"></i>
                          </span>
                          <div>
                            <h2 id="deliveryAddressModalTitle">{t(addressEditor.id
                              ? "delivery.checkout.address.edit" : "delivery.checkout.address.add")}</h2>
                            <p>{t("delivery.checkout.address.saved_pin_help")}</p>
                          </div>
                        </div>
                        <button type="button" className="delivery-address-dialog-close"
                          aria-label={t("delivery.checkout.address.cancel")}
                          disabled={customerBusy === "address"} onClick={() => setAddressEditor(null)}>
                          <i className="bi bi-x-lg app-icon" aria-hidden="true"></i>
                        </button>
                      </header>
                      <div className="delivery-address-dialog-body">
                        <div className="grid grid-2 delivery-address-edit-fields">
                          <div className="field"><label htmlFor="addressLabel">{t("delivery.checkout.address.label")} *</label>
                            <input className="input" id="addressLabel" maxLength={50} value={addressEditor.label || ""}
                              onChange={event => setAddressEditor(current => ({ ...current, label: event.target.value }))} /></div>
                          <div className="field"><label htmlFor="addressRecipient">{t("delivery.checkout.address.recipient")} *</label>
                            <input className="input" id="addressRecipient" maxLength={120} value={addressEditor.recipientName || ""}
                              onChange={event => setAddressEditor(current => ({ ...current, recipientName: event.target.value }))} /></div>
                        </div>
                        <div className="field delivery-address-details-field">
                          <label htmlFor="addressText">{t("delivery.checkout.address.details")} *</label>
                          <textarea className="input" id="addressText" maxLength={500} rows={3}
                            value={addressEditor.address || ""}
                            onChange={event => setAddressEditor(current => ({ ...current, address: event.target.value }))} />
                        </div>
                        {tenant ? <div className="delivery-saved-pin-editor">
                          <DeliveryLocationPicker slug={tenant.slug || slug} value={normalizeLocation(addressEditor)}
                            idPrefix="savedAddress" t={t} language={locale} disabled={customerBusy === "address"}
                            onChange={point => setAddressEditor(current => current ? { ...current, ...point } : current)} />
                        </div> : null}
                      </div>
                      {addressEditorError ? <div className="delivery-address-inline-error" role="alert">
                        <i className="bi bi-exclamation-circle app-icon" aria-hidden="true"></i>
                        <span>{addressEditorError}</span>
                      </div> : null}
                      <footer className="address-form-actions delivery-address-dialog-actions">
                        <button type="button" className="btn" id="cancelAddressButton"
                          disabled={customerBusy === "address"} onClick={() => setAddressEditor(null)}>
                          <i className="bi bi-x-lg app-icon" aria-hidden="true"></i>
                          <span>{t("delivery.checkout.address.cancel")}</span>
                        </button>
                        <button type="button" className="btn btn-primary" id="saveAddressButton"
                          disabled={locked || submitting || Boolean(customerBusy)} onClick={saveAddress}>
                          <i className="bi bi-floppy app-icon" aria-hidden="true"></i>
                          <span>{t("delivery.checkout.address.save")}</span>
                        </button>
                      </footer>
                    </section>
                  </div>, document.body
                ) : null}
              </section>

              <div className="field" style={{ marginTop: 12 }}><label>{t("delivery.checkout.address.delivery_address")} *</label><textarea className="input" id="deliveryAddress" required maxLength={500}
                value={deliveryAddress} readOnly placeholder={t("delivery.checkout.address.choice_required_title")} /></div>
              {tenant && selectedAddressId && deliveryLocation ? <DeliveryLocationPicker
                slug={tenant.slug || slug} value={deliveryLocation} t={t} language={locale}
                disabled showCurrentLocation={false} /> : null}
              {distanceStatus ? <div id="deliveryDistanceStatus" className={"delivery-distance-status" + (routeReady ? " is-ready" : routeState.error || (routeState.route && !routeState.route.inRange) ? " is-error" : "")}>{distanceStatus}</div> : null}

              <div className="field" style={{ marginTop: 12 }}>
                <label>{t("delivery.checkout.address.delivery_zone")} *</label>
                <select
                  className="input"
                  id="deliveryZone"
                  required
                  value={usesLalamove ? (lalamoveZone?.id || "") : (manualMode ? manualZoneId : (selectedZone?.id || ""))}
                  disabled={locked || submitting || !manualMode}
                  onChange={event => { if (manualMode) setManualZoneId(event.target.value); }}
                >
                  {usesLalamove
                    ? <option value="lalamove">{lalamoveZone ? `${lalamoveZone.label} • ${money(lalamoveZone.fee)} ${t("delivery.checkout.units.baht")}` : "Lalamove"}</option>
                    : zones.map(zone => <option key={zone.id} value={zone.id}>{zone.label} • {money(zone.fee)} {t("delivery.checkout.units.baht")}</option>)}
                </select>
              </div>

              {giftMenus.length ? <section id="deliveryFreeGiftSection" className="delivery-free-gift-section">
                <div className="delivery-free-gift-head"><div><h3><i className="bi bi-gift app-icon"></i><span>{t("delivery.checkout.promotion.gift_title")}</span></h3><div id="deliveryFreeGiftPeriod" className="menu-category">{giftConfig.validFrom && giftConfig.validUntil ? t("delivery.checkout.promotion.gift_period_range", { from: prettyDate(giftConfig.validFrom), until: prettyDate(giftConfig.validUntil) }) : giftConfig.validUntil ? t("delivery.checkout.promotion.gift_period", { date: prettyDate(giftConfig.validUntil) }) : ""}</div></div><span id="deliveryFreeGiftCounter" className="badge">{freeGiftIds.size} / {giftConfig.maxSelectableItems}</span></div>
                <div id="deliveryFreeGiftList" className="delivery-free-gift-list">{giftMenus.map(menu => {
                  const checked = freeGiftIds.has(String(menu.id));
                  const disabled = locked || (!checked && freeGiftIds.size >= giftConfig.maxSelectableItems);
                  return <label className={"delivery-free-gift-item" + (checked ? " is-selected" : "") + (disabled && !checked ? " is-limit-reached" : "")} key={menu.id}><input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleGift(String(menu.id))}/><span className="delivery-free-gift-item-content"><strong>{menu.name}</strong><small>{menu.category || t("delivery.checkout.menu.other")}</small></span></label>;
                })}</div>
                <div id="deliveryFreeGiftStatus" className={"delivery-free-gift-status" + (!freeGiftIds.size ? " is-required" : "")}>{freeGiftIds.size ? t("delivery.checkout.promotion.gift_selection", { selected: freeGiftIds.size, max: giftConfig.maxSelectableItems }) : t("delivery.checkout.promotion.gift_required")}</div>
              </section> : null}

              <div className="card" style={{ marginTop: 12, boxShadow: "none", background: "#f8fbf9" }}>
                <div className="receipt-row"><span>{t("delivery.checkout.summary.food_subtotal")}</span><strong><span id="deliverySubtotal">{money(subtotal)}</span> {t("delivery.checkout.units.baht")}</strong></div>
                <div className="receipt-row"><span>{t("delivery.checkout.summary.delivery_fee")}</span><strong><span id="deliveryFeeDisplay">{money(deliveryFee)}</span> {t("delivery.checkout.units.baht")}</strong></div>
                {freeShipping.enabled && subtotal > 0 ? <div id="deliveryFreeShippingStatus" className={"delivery-free-shipping-status" + (!freeShippingApplied ? " is-progress" : "")}>{freeShippingApplied ? t("delivery.checkout.promotion.free_shipping_applied", { minimum: money(freeShipping.minimumSubtotal) }) : t("delivery.checkout.promotion.free_shipping_progress", { remaining: money(Math.max(0, freeShipping.minimumSubtotal - subtotal)) })}</div> : null}
              </div>
              <div className="field" style={{ marginTop: 12 }}><label>{t("delivery.checkout.summary.order_note")}</label><textarea className="input" id="orderNote" maxLength={300} value={orderNote} disabled={submitting} onChange={event => setOrderNote(event.target.value)} /></div>
              <div className="field" style={{ marginTop: 12 }}><label>{t("delivery.checkout.summary.payment_method")} *</label><select className="input" id="paymentMethod" value={paymentMethod} disabled={submitting} onChange={event => { setPaymentMethod(event.target.value); setPaymentLocked(false); setLockedTotal(null); clearSlip(); }}><option value="promptpay">{t("delivery.checkout.payment.promptpay_option")}</option><option value="cod">{t("delivery.checkout.payment.cod_option")}</option></select></div>

              {paymentMethod === "promptpay" ? <div id="promptPaySection" className="card" style={{ marginTop: 12, textAlign: "center" }}>
                <h3 style={{ marginTop: 0 }}><i className="bi bi-qr-code app-icon"></i><span>{t("delivery.checkout.payment.promptpay_title")}</span></h3>
                {!paymentLocked && !promptPayQr.src ? <div id="promptPayPlaceholder" className="empty" style={{ padding: "24px 12px" }}>{promptPayQr.error || t("delivery.checkout.payment.add_items_for_qr")}</div> : null}
                {paymentLocked && promptPayQr.src ? <img id="promptPayQr" src={promptPayQr.src} width="220" height="220" alt={t("delivery.checkout.payment.qr_alt")} /> : null}
                {paymentLocked && promptPayQr.error ? <div className="empty">{promptPayQr.error}</div> : null}
                {paymentLocked ? <><div><strong id="promptPayAmount">{money(total)} {t("delivery.checkout.units.baht")}</strong></div><div id="promptPayName" className="menu-category">{settings.promptPayName || settings.promptPayAccountName || settings.shopName || ""}</div></> : null}
                <div id="paymentLockPanel" className="payment-lock-panel">
                  {!paymentLocked ? <div className="payment-lock-state" id="paymentLockState"><strong>{t("delivery.checkout.payment_lock.unlocked_title")}</strong><span>{t("delivery.checkout.payment_lock.unlocked_help")}</span></div> : <div className="payment-lock-summary" id="paymentLockSummary">
                    <div><span>{t("delivery.checkout.summary.food_subtotal")}</span><strong id="lockedSubtotal">{money(lockedTotal?.subtotal ?? subtotal)}</strong></div>
                    <div><span>{t("delivery.checkout.summary.delivery_fee")}</span><strong id="lockedDeliveryFee">{money(lockedTotal?.deliveryFee ?? deliveryFee)}</strong></div>
                    <div className="payment-lock-total"><span>{t("delivery.checkout.payment_lock.locked_total")}</span><strong id="lockedTotal">{money(lockedTotal?.total ?? total)}</strong></div>
                  </div>}
                  <div className="payment-lock-actions">
                    {paymentLocked && promptPayQr.src ? paymentQrDownloadUrl
                      ? <a className="btn btn-dark" id="downloadPaymentQr" href={paymentQrDownloadUrl} download={"promptpay-" + (tenant?.slug || "penguin") + ".png"}><i className="bi bi-download app-icon"></i><span>{t("delivery.checkout.payment_lock.download_short")}</span></a>
                      : <button className="btn btn-dark" id="downloadPaymentQr" type="button" disabled><i className="bi bi-download app-icon"></i><span>{t("delivery.checkout.payment_lock.download_short")}</span></button> : null}
                    {paymentLocked ? <button className="btn" id="editLockedOrder" type="button" onClick={() => { setPaymentLocked(false); setLockedTotal(null); clearSlip(); }}><i className="bi bi-pencil app-icon"></i><span>{t("delivery.checkout.payment_lock.edit_short")}</span></button> : null}
                  </div>
                </div>
                {paymentLocked ? <>
                  <div className="payment-slip-wrap" id="paymentSlipWrap" style={{ marginTop: 14, textAlign: "left" }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>{t("delivery.checkout.payment.slip_label")} *</label>
                    <div className={"payment-slip-dropzone" + (slipFile ? " has-file" : "")} id="paymentSlipDropzone">
                      <input id="paymentSlip" type="file" accept="image/*,.heic,.heif" onChange={event => chooseSlip(event.target.files?.[0] || null)} />
                      {!slipFile ? <div className="payment-slip-content" id="paymentSlipContent"><div className="payment-slip-icon">+</div><div className="payment-slip-title">{t("delivery.checkout.payment.slip_drop_title")}</div><div className="payment-slip-help">{t("delivery.checkout.payment.slip_help")}</div></div> : <div className="payment-slip-preview" id="paymentSlipPreviewWrap"><img id="paymentSlipPreview" src={slipPreview} alt={t("delivery.checkout.payment.slip_preview_alt")} /><div className="payment-slip-meta"><span id="paymentSlipFileName">{slipFile.name}</span><span id="paymentSlipFileSize">{(slipFile.size / 1024 / 1024).toFixed(2)} MB</span></div></div>}
                    </div>
                    <div className="payment-slip-error" id="paymentSlipError" hidden></div>
                    {slipFile ? <button type="button" className="btn btn-sm payment-slip-remove-icon" id="removePaymentSlip" aria-label={t("delivery.checkout.payment.remove_slip")} title={t("delivery.checkout.payment.remove_slip")} onClick={clearSlip}><i className="bi bi-x-lg app-icon" aria-hidden="true"></i></button> : null}
                  </div>
                  <small className="menu-category">{t("delivery.checkout.payment.review_note")}</small></> : null}
              </div> : null}
            </section>
          </div>
        </div>
      )}
    </main>

    <div className="cart-bar">
      <div><small>{t("delivery.checkout.summary.total_with_delivery")}</small><div style={{ fontSize: 20, fontWeight: 800 }}><span id="cartTotal">{money(total)}</span> {t("delivery.checkout.units.baht")}</div></div>
      <button className="btn btn-primary" id="submitOrder" type="button" disabled={!tenant || !cart.length || submitting || !storeAcceptingOrders || !selectedAddressId || !deliveryLocation || Boolean(addressEditor)} onClick={submit}>
        <i className={"bi bi-" + (submitting ? "hourglass-split" : paymentMethod === "promptpay" && !paymentLocked ? "credit-card" : "check-lg") + " app-icon"}></i>
        <span>{submitting ? t("delivery.checkout.submit.sending") : paymentMethod === "promptpay" && !paymentLocked ? t("delivery.checkout.summary.review_and_pay") : t("delivery.checkout.summary.submit_order")}</span>
      </button>
    </div>
    <PublicStorefrontFooter />
  </>;
}
