import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { sweetConfirm } from "@/components/sweetDialog";
import { DeliveryLocationPicker } from "@/components/DeliveryLocationPicker";
import {
  PublicCartList, PublicMenuCatalog, PublicStorefrontFooter, PublicStorefrontHeader, showStorefrontToast,
} from "@/components/PublicStorefront";
import {
  createPublicDeliveryOrder, deliveryFreeGiftActive, loadPublicStorefront, normalizeDeliveryFreeGift,
  preparePublicOrderId, resolvePublicTenant, uploadPublicPaymentSlip,
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

const computeDeliveryRoute = httpsCallable(functions, "computeDeliveryRoute");
const quotePublicLalamoveDelivery = httpsCallable(functions, "quotePublicLalamoveDelivery");
const NEARBY_SAVED_ADDRESS_METERS = 100;

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}
function normalizeLocation(value = {}) {
  const latitude = Number(value?.latitude);
  const longitude = Number(value?.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}
function radians(degrees) {
  return degrees * Math.PI / 180;
}
function distanceMeters(fromValue, toValue) {
  const from = normalizeLocation(fromValue);
  const to = normalizeLocation(toValue);
  if (!from || !to) return Number.POSITIVE_INFINITY;
  const earthRadiusMeters = 6371008.8;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const latitude1 = radians(from.latitude);
  const latitude2 = radians(to.latitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
function nearestSavedAddress(addresses = [], location) {
  let nearest = null;
  for (const address of addresses) {
    const savedLocation = normalizeLocation(address);
    if (!savedLocation) continue;
    const meters = distanceMeters(location, savedLocation);
    if (!nearest || meters < nearest.meters) nearest = { address, meters };
  }
  return nearest;
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
  const detail = String(error?.details?.providerError || error?.serverResponse?.providerError || error?.code || error?.message || "");
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
  const [profileLoading, setProfileLoading] = useState(false);
  const [customerBusy, setCustomerBusy] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [addressEditor, setAddressEditor] = useState(null);

  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState(null);
  const locationResolveSerialRef = useRef(0);
  const locationSourceRef = useRef("");
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
        setProfile(nextProfile || { displayName: "", phone: "", addresses: [] });
        setFavoriteIds(new Set(favorites || []));
        if (nextProfile?.displayName) setRecipientName(current => current || nextProfile.displayName);
        if (nextProfile?.phone) setRecipientPhone(current => current || nextProfile.phone);
      } catch (error) {
        console.error("DELIVERY_CUSTOMER_PROFILE_LOAD_FAILED", error);
      } finally {
        if (alive) setProfileLoading(false);
      }
    });
    return () => { alive = false; stop?.(); };
  }, [tenant?.id]);

  useEffect(() => () => { if (slipPreview) URL.revokeObjectURL(slipPreview); }, [slipPreview]);

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

  const add = item => {
    if (paymentLocked) return;
    setCart(current => {
      const found = current.find(row => row.id === item.id);
      return found
        ? current.map(row => row.id === item.id ? { ...row, qty: row.qty + 1 } : row)
        : [...current, { ...item, qty: 1, note: "" }];
    });
  };
  const increase = id => { if (!paymentLocked) setCart(current => current.map(row => row.id === id ? { ...row, qty: row.qty + 1 } : row)); };
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
    const previous = favoriteIds;
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    setFavoriteIds(next);
    try {
      await saveDeliveryCustomerFavorites(tenant, [...next], customerUser);
    } catch (error) {
      console.error("DELIVERY_FAVORITE_SAVE_FAILED", error);
      setFavoriteIds(previous);
      showStorefrontToast(t("delivery.checkout.menu.favorite_save_failed"), "error");
    }
  };

  const selectAddress = address => {
    locationResolveSerialRef.current += 1;
    locationSourceRef.current = "saved-address";
    setSelectedAddressId(address.id);
    setRecipientName(address.recipientName || profile.displayName || "");
    setRecipientPhone(address.recipientPhone || profile.phone || "");
    setDeliveryAddress(address.address || "");
    const location = normalizeLocation(address);
    if (location) setDeliveryLocation(location);
  };

  const resolveDeliveryLocation = async (location, meta = {}) => {
    const next = normalizeLocation(location);
    if (!next) return;
    const source = String(meta?.source || "map");
    locationSourceRef.current = source;
    const serial = ++locationResolveSerialRef.current;
    const hadSelectedAddress = Boolean(selectedAddressId);

    setDeliveryLocation(next);
    setSelectedAddressId("");

    if (source === "current-location") {
      const nearest = nearestSavedAddress(profile.addresses || [], next);
      if (nearest && nearest.meters <= NEARBY_SAVED_ADDRESS_METERS) {
        selectAddress(nearest.address);
        return;
      }
    }

    if (
      serial === locationResolveSerialRef.current
      && hadSelectedAddress
      && ["current-location", "map", "manual"].includes(source)
    ) {
      setDeliveryAddress("");
    }
  };

  useEffect(() => {
    if (
      profileLoading
      || selectedAddressId
      || locationSourceRef.current !== "current-location"
      || !deliveryLocation
    ) return;
    const nearest = nearestSavedAddress(profile.addresses || [], deliveryLocation);
    if (nearest && nearest.meters <= NEARBY_SAVED_ADDRESS_METERS) {
      selectAddress(nearest.address);
    }
  }, [
    profileLoading,
    profile.addresses,
    selectedAddressId,
    deliveryLocation?.latitude,
    deliveryLocation?.longitude,
  ]);

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
      showStorefrontToast(t("delivery.checkout.address.required_fields"), "error"); return;
    }
    if (!deliveryLocation) {
      showStorefrontToast(t("delivery.checkout.validation.delivery_location_required"), "error"); return;
    }
    let addresses = [...(profile.addresses || [])];
    if (!addressEditor.id && addresses.length >= 5) {
      showStorefrontToast(t("delivery.checkout.address.max_five"), "error"); return;
    }
    const id = addressEditor.id || newAddressId();
    const isDefault = addressEditor.isDefault || addresses.length === 0;
    if (isDefault) addresses = addresses.map(row => ({ ...row, isDefault: false }));
    const row = {
      id, label, recipientName: name, recipientPhone: normalizePhone(recipientPhone),
      address, latitude: deliveryLocation.latitude, longitude: deliveryLocation.longitude, isDefault,
    };
    const index = addresses.findIndex(item => item.id === id);
    if (index >= 0) addresses[index] = row; else addresses.push(row);
    setCustomerBusy("address");
    try {
      await persistProfile({ ...profile, displayName: name, phone: normalizePhone(recipientPhone), addresses });
      setAddressEditor(null);
      selectAddress(row);
      showStorefrontToast(t(index >= 0 ? "delivery.checkout.address.updated" : "delivery.checkout.address.saved"));
    } catch (error) {
      console.error("DELIVERY_ADDRESS_SAVE_FAILED", error);
      showStorefrontToast(t("delivery.checkout.address.save_failed"), "error");
    } finally { setCustomerBusy(""); }
  };
  const deleteAddress = async address => {
    const ok = await sweetConfirm(t("delivery.checkout.address.delete_prompt"), {
      title: t("delivery.checkout.address.delete_title"),
      confirmText: t("delivery.checkout.common.confirm"), cancelText: t("delivery.checkout.common.cancel"), type: "warning",
    });
    if (!ok) return;
    let addresses = (profile.addresses || []).filter(row => row.id !== address.id);
    if (addresses.length && !addresses.some(row => row.isDefault)) addresses[0] = { ...addresses[0], isDefault: true };
    try {
      await persistProfile({ ...profile, addresses });
      if (selectedAddressId === address.id) setSelectedAddressId("");
      showStorefrontToast(t("delivery.checkout.address.deleted"));
    } catch (error) {
      console.error("DELIVERY_ADDRESS_DELETE_FAILED", error);
      showStorefrontToast(t("delivery.checkout.address.save_failed"), "error");
    }
  };
  const makeDefault = async address => {
    const addresses = (profile.addresses || []).map(row => ({ ...row, isDefault: row.id === address.id }));
    try {
      await persistProfile({ ...profile, addresses });
      showStorefrontToast(t("delivery.checkout.address.set_default_done"));
    } catch (error) {
      console.error("DELIVERY_ADDRESS_DEFAULT_FAILED", error);
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
    if (!cart.length) { showStorefrontToast(t("delivery.checkout.validation.add_items_first"), "error"); return false; }
    if (!recipientName.trim() || !recipientPhone.trim() || !deliveryAddress.trim()) {
      showStorefrontToast(t("delivery.checkout.validation.delivery_details_required"), "error"); return false;
    }
    if (!deliveryLocation) { showStorefrontToast(t("delivery.checkout.validation.delivery_location_required"), "error"); return false; }
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
    setSubmitting(true);
    try {
      const slip = paymentMethod === "promptpay" ? await uploadPublicPaymentSlip(tenant, slipFile, orderId) : { path: "" };
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

      await createPublicDeliveryOrder(tenant, payload, { menus, settings });

      // Preserve the legacy convenience behavior: save the current address after a successful order.
      try {
        const addresses = [...(profile.addresses || [])];
        const matched = addresses.find(row => String(row.address || "").trim() === deliveryAddress.trim());
        if (matched) {
          const next = addresses.map(row => row.id === matched.id ? {
            ...row, recipientName: recipientName.trim(), recipientPhone: normalizePhone(recipientPhone),
            latitude: deliveryLocation.latitude, longitude: deliveryLocation.longitude,
          } : row);
          await persistProfile({ ...profile, displayName: recipientName.trim(), phone: normalizePhone(recipientPhone), addresses: next });
        } else if (addresses.length < 5) {
          const next = [...addresses, {
            id: newAddressId(), label: t("delivery.checkout.address.latest_label"), recipientName: recipientName.trim(),
            recipientPhone: normalizePhone(recipientPhone), address: deliveryAddress.trim(),
            latitude: deliveryLocation.latitude, longitude: deliveryLocation.longitude, isDefault: addresses.length === 0,
          }];
          await persistProfile({ ...profile, displayName: recipientName.trim(), phone: normalizePhone(recipientPhone), addresses: next });
        }
      } catch (profileError) {
        console.warn("DELIVERY_PROFILE_SAVE_AFTER_ORDER_FAILED", profileError);
      }

      try { sessionStorage.removeItem("delivery_checkout_draft:" + (tenant.slug || slug)); } catch {}
      location.assign("/s/" + encodeURIComponent(tenant.slug || slug) + "/delivery/success?order=" + encodeURIComponent(orderId));
    } catch (error) {
      console.error("DELIVERY_REACT_SUBMIT_FAILED", error);
      showStorefrontToast(deliveryErrorMessage(error, t, settings), "error");
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

  if (!stylesReady) return null;
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

      {loadError ? <section className="card empty">{loadError}</section> : (
        <div className="delivery-pos">
          {loading ? <div className="delivery-menu-column"><div className="card empty">{t("common.loading")}</div></div> : (
            <PublicMenuCatalog menus={menus} prefix="delivery.checkout.menu" activeCategory={activeCategory}
              setActiveCategory={setActiveCategory} search={search} setSearch={setSearch} page={page} setPage={setPage}
              onAdd={add} disabled={submitting || locked}
              extraCategory="__favorites__" extraLabel={t("delivery.checkout.menu.favorites")}
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
                  <div><strong>{t("delivery.checkout.address.book_title")}</strong><div className="menu-category">{profileLoading ? t("delivery.checkout.address.loading") : t("delivery.checkout.address.book_help")}</div></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span id="addressCount" className="badge">{t("delivery.checkout.address.count", { count: (profile.addresses || []).length })}</span><button type="button" className="btn btn-primary btn-sm" id="addAddressButton" disabled={(profile.addresses || []).length >= 5 || Boolean(customerBusy)} onClick={() => setAddressEditor({ id: "", label: t("delivery.checkout.address.home_label"), recipientName, address: deliveryAddress, isDefault: !(profile.addresses || []).length })}><i className="bi bi-plus-lg app-icon"></i><span>{t("delivery.checkout.address.add")}</span></button></div>
                </div>
                <div id="addressList" className="address-list">
                  {(profile.addresses || []).length ? (profile.addresses || []).map(address => <label className={"address-card" + (selectedAddressId === address.id ? " selected" : "")} key={address.id}>
                    <input type="radio" name="savedDeliveryAddressReact" value={address.id} checked={selectedAddressId === address.id} onChange={() => selectAddress(address)} />
                    <div><div className="address-card-title">{address.label || t("delivery.checkout.address.fallback_label")}{address.isDefault ? <span className="address-default">{t("delivery.checkout.address.default_badge")}</span> : null}</div><div className="address-card-text"><strong>{address.recipientName || profile.displayName || ""}</strong><br/>{address.address}</div></div>
                    <div className="address-card-actions">
                      <button type="button" className="btn btn-sm" onClick={event => { event.preventDefault(); setAddressEditor({ ...address }); }}>{t("delivery.checkout.address.edit")}</button>
                      {!address.isDefault ? <button type="button" className="btn btn-sm" onClick={event => { event.preventDefault(); makeDefault(address); }}>{t("delivery.checkout.address.set_default")}</button> : null}
                      <button type="button" className="btn btn-danger btn-sm" onClick={event => { event.preventDefault(); deleteAddress(address); }}>{t("delivery.checkout.address.delete")}</button>
                    </div>
                  </label>) : <div className="empty" style={{ padding: "20px 10px" }}>{t("delivery.checkout.address.none_saved")}</div>}
                </div>
                {addressEditor ? <div id="addressForm" className="address-form">
                  <div className="grid grid-2">
                    <div className="field"><label>{t("delivery.checkout.address.label")} *</label><input className="input" id="addressLabel" maxLength={50} value={addressEditor.label || ""} onChange={event => setAddressEditor(current => ({ ...current, label: event.target.value }))} /></div>
                    <div className="field"><label>{t("delivery.checkout.address.recipient")} *</label><input className="input" id="addressRecipient" maxLength={120} value={addressEditor.recipientName || ""} onChange={event => setAddressEditor(current => ({ ...current, recipientName: event.target.value }))} /></div>
                  </div>
                  <div className="field" style={{ marginTop: 10 }}><label>{t("delivery.checkout.address.details")} *</label><textarea className="input" id="addressText" maxLength={500} value={addressEditor.address || ""} onChange={event => setAddressEditor(current => ({ ...current, address: event.target.value }))} /></div>
                  <label style={{ display: "block", marginTop: 10 }}><input type="checkbox" id="addressDefault" checked={Boolean(addressEditor.isDefault)} onChange={event => setAddressEditor(current => ({ ...current, isDefault: event.target.checked }))} /> {t("delivery.checkout.address.default_checkbox")}</label>
                  <div className="address-form-actions"><button type="button" className="btn" id="cancelAddressButton" onClick={() => setAddressEditor(null)}><i className="bi bi-x-lg app-icon"></i><span>{t("delivery.checkout.address.cancel")}</span></button><button type="button" className="btn btn-primary" id="saveAddressButton" disabled={customerBusy === "address"} onClick={saveAddress}><i className="bi bi-floppy app-icon"></i><span>{t("delivery.checkout.address.save")}</span></button></div>
                </div> : null}
              </section>

              <div className="field" style={{ marginTop: 12 }}><label>{t("delivery.checkout.address.delivery_address")} *</label><textarea className="input" id="deliveryAddress" required maxLength={500} value={deliveryAddress} disabled={submitting} onChange={event => { locationResolveSerialRef.current += 1; locationSourceRef.current = "manual"; setDeliveryAddress(event.target.value); setSelectedAddressId(""); }} /></div>
              {tenant ? <DeliveryLocationPicker slug={tenant.slug || slug} value={deliveryLocation} t={t} language={locale}
                disabled={submitting || locked} onChange={resolveDeliveryLocation} /> : null}
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
              <div className="field" style={{ marginTop: 12 }}><label>{t("delivery.checkout.summary.payment_method")} *</label><select className="input" id="paymentMethod" value={paymentMethod} disabled={locked || submitting} onChange={event => { setPaymentMethod(event.target.value); setPaymentLocked(false); setLockedTotal(null); clearSlip(); }}><option value="promptpay">{t("delivery.checkout.payment.promptpay_option")}</option><option value="cod">{t("delivery.checkout.payment.cod_option")}</option></select></div>

              {paymentMethod === "promptpay" ? <div id="promptPaySection" className="card" style={{ marginTop: 12, textAlign: "center" }}>
                <h3 style={{ marginTop: 0 }}><i className="bi bi-qr-code app-icon"></i><span>{t("delivery.checkout.payment.promptpay_title")}</span></h3>
                <div id="paymentLockPanel" className="payment-lock-panel">
                  {!paymentLocked ? <div className="payment-lock-state" id="paymentLockState"><strong>{t("delivery.checkout.payment_lock.unlocked_title")}</strong><span>{t("delivery.checkout.payment_lock.unlocked_help")}</span></div> : <div className="payment-lock-summary" id="paymentLockSummary">
                    <div><span>{t("delivery.checkout.summary.food_subtotal")}</span><strong id="lockedSubtotal">{money(lockedTotal?.subtotal ?? subtotal)}</strong></div>
                    <div><span>{t("delivery.checkout.summary.delivery_fee")}</span><strong id="lockedDeliveryFee">{money(lockedTotal?.deliveryFee ?? deliveryFee)}</strong></div>
                    <div className="payment-lock-total"><span>{t("delivery.checkout.payment_lock.locked_total")}</span><strong id="lockedTotal">{money(lockedTotal?.total ?? total)}</strong></div>
                  </div>}
                  <div className="payment-lock-actions">
                    {paymentLocked && promptPayQr.src ? <a className="btn btn-dark" id="downloadPaymentQr" href={promptPayQr.src} download={"promptpay-" + (tenant?.slug || "penguin") + ".png"}><i className="bi bi-download app-icon"></i><span>{t("delivery.checkout.payment_lock.download_short")}</span></a> : null}
                    {paymentLocked ? <button className="btn" id="editLockedOrder" type="button" onClick={() => { setPaymentLocked(false); setLockedTotal(null); clearSlip(); }}><i className="bi bi-pencil app-icon"></i><span>{t("delivery.checkout.payment_lock.edit_short")}</span></button> : null}
                  </div>
                </div>
                {!paymentLocked && !promptPayQr.src ? <div id="promptPayPlaceholder" className="empty" style={{ padding: "24px 12px" }}>{promptPayQr.error || t("delivery.checkout.payment.add_items_for_qr")}</div> : null}
                {paymentLocked && promptPayQr.src ? <img id="promptPayQr" src={promptPayQr.src} width="220" height="220" alt={t("delivery.checkout.payment.qr_alt")} /> : null}
                {paymentLocked && promptPayQr.error ? <div className="empty">{promptPayQr.error}</div> : null}
                {paymentLocked ? <><div><strong id="promptPayAmount">{money(total)} {t("delivery.checkout.units.baht")}</strong></div><div id="promptPayName" className="menu-category">{settings.promptPayName || settings.promptPayAccountName || settings.shopName || ""}</div>
                  <div className="payment-slip-wrap" id="paymentSlipWrap" style={{ marginTop: 14, textAlign: "left" }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>{t("delivery.checkout.payment.slip_label")} *</label>
                    <div className={"payment-slip-dropzone" + (slipFile ? " has-file" : "")} id="paymentSlipDropzone">
                      <input id="paymentSlip" type="file" accept="image/*,.heic,.heif" onChange={event => chooseSlip(event.target.files?.[0] || null)} />
                      {!slipFile ? <div className="payment-slip-content" id="paymentSlipContent"><div className="payment-slip-icon"><i className="bi bi-image"></i></div><div className="payment-slip-title">{t("delivery.checkout.payment.slip_drop_title")}</div><div className="payment-slip-help">{t("delivery.checkout.payment.slip_help")}</div></div> : <div className="payment-slip-preview" id="paymentSlipPreviewWrap"><img id="paymentSlipPreview" src={slipPreview} alt={t("delivery.checkout.payment.slip_preview_alt")} /><div className="payment-slip-meta"><span id="paymentSlipFileName">{slipFile.name}</span><span id="paymentSlipFileSize">{(slipFile.size / 1024 / 1024).toFixed(2)} MB</span></div></div>}
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
      <button className="btn btn-primary" id="submitOrder" type="button" disabled={!tenant || !cart.length || submitting} onClick={submit}>
        <i className={"bi bi-" + (submitting ? "hourglass-split" : paymentMethod === "promptpay" && !paymentLocked ? "credit-card" : "check-lg") + " app-icon"}></i>
        <span>{submitting ? t("delivery.checkout.submit.sending") : paymentMethod === "promptpay" && !paymentLocked ? t("delivery.checkout.summary.review_and_pay") : t("delivery.checkout.summary.submit_order")}</span>
      </button>
    </div>
    <PublicStorefrontFooter />
  </>;
}
