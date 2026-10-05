import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { canUseRetailPos, getRetailPosSession } from "@/auth/retailPosSession";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { AppDeveloperPanel } from "@/components/AppDeveloperPanel";
import { firstAllowedPosPage, getPosPermissions, PosNavigation } from "@/components/PosNavigation";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { sweetAlert, sweetConfirm, sweetPrompt } from "@/components/sweetDialog";
import {
  applyPosLoyalty,
  completePosSale,
  holdPosBill,
  listHeldPosBills,
  listPosCustomers,
  listPosProducts,
  listPosSales,
  loadActivePosShift,
  loadPosCatalogOrder,
  loadPosLoyaltySettings,
  loadPosPaymentSettings,
  loadPosReceiptSettings,
  loadPosTaxSettings,
  releaseHeldPosBill,
} from "@/data/retailPosData";
import { updateCustomerDisplay } from "@/data/operationalData";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { useTenant } from "@/tenant/TenantProvider";
import { generatePromptPayPayload } from "@/utils/promptPay";

const safeDisplayId = value => {
  const cleaned = String(value || "").trim().replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return cleaned || "main-register";
};
const maskCustomerPhone = value => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 4) return `${digits.slice(0, 1)}***`;
  if (digits.length < 10) return `${digits.slice(0, 2)}xxx${digits.slice(-2)}`;
  return `${digits.slice(0, 3)}-xxx-xx${digits.slice(-2)}`;
};
const EMPTY_TAX = Object.freeze({
  vatRegistered: false,
  vatRate: 0,
  defaultVatMode: "include",
  vatCalculationBase: "after_discount_and_points",
});

const round2 = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const productImageUrl = product => {
  const nested = product?.image && typeof product.image === "object"
    ? product.image.url || product.image.src || product.image.downloadURL : "";
  return [product?.imageUrl, product?.imageURL, product?.photoUrl, product?.photoURL,
    product?.thumbnailUrl, product?.thumbnailURL, product?.productImageUrl, product?.pictureUrl,
    product?.imageDataUrl, product?.imageData, nested, product?.image]
    .find(value => typeof value === "string" && value.trim()) || "";
};
const productInitials = product => String(product?.name || "สินค้า").trim().slice(0, 2).toUpperCase();

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

export function PosPage() {
  const authState = useAuth();
  const tenantState = useTenant();
  const { profile, user: authUser } = authState;
  const { tenant } = tenantState;
  const { t, formatNumber } = useI18n();
  const stylesReady = useParityPage({
    title: t("pos.meta.title"),
    attributes: { "data-module": "retail-pos" },
    disabledGlobalStyles: ["app.css", "icons.css", "shared-responsive.css"],
    styles: [
      "app-version-badge-runtime.css",
      "pos-locale-switcher-placement.css",
      "retail-pos.css",
      "retail-pos-catalog.css",
      "retail-pos-home.css",
      "retail-pos-hold.css",
      "retail-pos-customer-search.css",
      "retail-loyalty.css",
      "retail-pos-navigation.css",
      "retail-pos-mobile-polish.css",
      "retail-mobile-cart-bar.css",
      "retail-pos-customer-display-link.css",
      "sweet-dialog.css",
      "retail-pos-loyalty-placement.css",
      "retail-pos-sticky-cart.css",
      "retail-pos-product-card-restore.css",
      "retail-pos-modern-panel.css",
      "retail-pos-sale-workspace.css",
      "retail-pos-payment-enter.css",
      "retail-pos-promptpay-payment.css",
      "retail-pos-tailwind-responsive.css",
      "retail-pos-barcode-scanner.css",
    ],
  });

  const paymentDialogRef = useRef(null);
  const heldDialogRef = useRef(null);
  const scanDialogRef = useRef(null);
  const scanVideoRef = useRef(null);
  const scanStreamRef = useRef(null);
  const scanRafRef = useRef(0);
  const scanDetectorRef = useRef(null);
  const zxingReaderRef = useRef(null);
  const zxingControlsRef = useRef(null);
  const barcodeRef = useRef(null);
  const receivedRef = useRef(null);
  const customerSearchRef = useRef(null);
  const replaceNumericRef = useRef(false);
  const displayTimerRef = useRef(0);
  const mobileCartTouchStartRef = useRef(0);
  const displayOwnsStateRef = useRef(false);
  const displaySignatureRef = useRef("");
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [catalogOrder, setCatalogOrder] = useState([]);
  const [activeCategory, setActiveCategory] = useState("quick");
  const [renderLimit, setRenderLimit] = useState(99);
  const [cart, setCart] = useState([]);
  const [heldBills, setHeldBills] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [loyalty, setLoyalty] = useState({ enabled: true, spendPerPoint: 10, pointValue: 1 });
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [paymentSettings, setPaymentSettings] = useState({ shopName: "", promptPayId: "", promptPayAccountName: "", promptPayEnabled: false });
  const [receiptSettings, setReceiptSettings] = useState({ autoPrint: false, paperSize: "80" });
  const [tax, setTax] = useState(EMPTY_TAX);
  const [shift, setShift] = useState(null);
  const [search, setSearch] = useState("");
  const [barcode, setBarcode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [vatMode, setVatMode] = useState("include");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [received, setReceived] = useState(0);
  const [numericTarget, setNumericTarget] = useState("received");
  const [paymentError, setPaymentError] = useState("");
  const [loading, setLoading] = useState(true);
  const [initialDataReady, setInitialDataReady] = useState(false);
  const [savingSale, setSavingSale] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState("กำลังเตรียมกล้อง...");

  const posSession = useMemo(() => getRetailPosSession(), [
    authUser?.uid,
    profile?.id,
    profile?.uid,
    profile?.tenantId,
    profile?.role,
    profile?.roleId,
  ]);
  const posAccessProfile = useMemo(() => ({
    ...(profile || {}),
    ...(posSession || {}),
    role: posSession?.role || profile?.role || profile?.roleId || "",
    roleId: posSession?.roleId || posSession?.role || profile?.roleId || profile?.role || "",
  }), [profile, posSession]);
  const posPermissions = useMemo(() => getPosPermissions(posAccessProfile), [posAccessProfile]);
  const hasSaleAccess = posPermissions.has("pos.sale");
  const posRedirectTarget = useMemo(() => {
    if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady) return "";
    const requested = `${location.pathname}${location.search}`;
    if (!profile) return `/pos/login/?next=${encodeURIComponent(requested)}`;
    if (!canUseRetailPos(posAccessProfile) || tenantState.status === "error" || !tenant) return "/";
    if (!hasSaleAccess) {
      const firstAllowed = firstAllowedPosPage(posAccessProfile);
      if (firstAllowed === "/pos/forbidden") {
        return `/pos/forbidden/?permission=pos.sale&next=${encodeURIComponent(requested)}`;
      }
      return `${firstAllowed}?from=permission`;
    }
    return "";
  }, [
    authState.status,
    tenantState.status,
    tenant?.id,
    profile,
    posAccessProfile,
    hasSaleAccess,
    stylesReady,
  ]);

  useEffect(() => {
    if (posRedirectTarget) location.replace(posRedirectTarget);
  }, [posRedirectTarget]);

  const money = value => formatNumber(round2(value), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const displayConfig = useMemo(() => {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem("retail_pos_register_config") || "{}"); } catch {}
    const params = new URLSearchParams(location.search);
    const registerId = safeDisplayId(params.get("registerId") || saved.registerId || "main-register");
    const displayId = safeDisplayId(params.get("displayId") || saved.displayId || registerId);
    const registerName = String(params.get("registerName") || saved.registerName || "").trim();
    const next = { registerId, displayId, registerName };
    try { localStorage.setItem("retail_pos_register_config", JSON.stringify(next)); } catch {}
    return next;
  }, []);
  const displaySessionId = useMemo(() => {
    const key = `retail_pos_display_session_${displayConfig.registerId}_${displayConfig.displayId}`;
    let value = localStorage.getItem(key);
    if (!value) {
      value = `display-session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      try { localStorage.setItem(key, value); } catch {}
    }
    return value;
  }, [displayConfig]);


  const refresh = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const [nextProducts, nextSales, nextCatalogOrder, nextTax, nextHeld, activeShift, nextCustomers, nextLoyalty, nextPaymentSettings, nextReceiptSettings] = await Promise.all([
        listPosProducts(tenant.id),
        listPosSales(tenant.id).catch(() => []),
        loadPosCatalogOrder(tenant.id).catch(() => []),
        loadPosTaxSettings(tenant.id).catch(() => EMPTY_TAX),
        listHeldPosBills(tenant.id).catch(() => []),
        loadActivePosShift(tenant.id).catch(() => null),
        listPosCustomers(tenant.id).catch(() => []),
        loadPosLoyaltySettings(tenant.id).catch(() => ({ enabled: true, spendPerPoint: 10, pointValue: 1 })),
        loadPosPaymentSettings(tenant.id).catch(() => ({ shopName: "", promptPayId: "", promptPayAccountName: "", promptPayEnabled: false })),
        loadPosReceiptSettings(tenant.id).catch(() => ({ autoPrint: false, paperSize: "80" })),
      ]);
      setProducts(nextProducts);
      setSales(nextSales);
      setCatalogOrder(nextCatalogOrder);
      setCustomers(nextCustomers);
      setLoyalty(nextLoyalty);
      setPaymentSettings(nextPaymentSettings);
      setReceiptSettings(nextReceiptSettings);
      setTax(nextTax);
      setVatMode(nextTax.defaultVatMode === "exclude" ? "exclude" : "include");
      setHeldBills(nextHeld);
      setShift(activeShift);
    } catch (error) {
      console.error("POS_LOAD_FAILED", error);
      showToast(t("pos.catalog.load_failed"), "error");
    } finally {
      setLoading(false);
      setInitialDataReady(true);
    }
  };

  useEffect(() => {
    if (tenant?.id && profile && canUseRetailPos(posAccessProfile) && hasSaleAccess) refresh();
  }, [tenant?.id, profile, posAccessProfile, hasSaleAccess]);

  const catalogRanking = useMemo(() => {
    const ranking = new Map();
    sales.forEach(sale => (Array.isArray(sale?.items) ? sale.items : []).forEach(item => {
      const productId = String(item?.productId || item?.id || "").trim();
      if (!productId) return;
      const current = ranking.get(productId) || { qty: 0, revenue: 0 };
      const qty = Number(item?.qty ?? item?.quantity ?? 0);
      current.qty += qty;
      current.revenue += qty * Number(item?.price ?? item?.unitPrice ?? 0);
      ranking.set(productId, current);
    }));
    return ranking;
  }, [sales]);

  const catalogTabs = useMemo(() => {
    const activeProducts = products.filter(product => product.showOnPos !== false);
    const categories = [...new Set(activeProducts.map(product => String(product.category || "ทั่วไป").trim() || "ทั่วไป"))];
    const available = ["quick", ...categories.map(name => `category:${name}`), "all"];
    const ordered = [
      ...catalogOrder.filter(id => available.includes(id)),
      ...available.filter(id => !catalogOrder.includes(id)),
    ];
    return ordered.map(id => ({
      id,
      label: id === "quick" ? t("pos.catalog.best_sellers") : id === "all" ? t("pos.catalog.all") : id.slice(9),
    }));
  }, [products, catalogOrder, t]);

  const catalogCategoryRank = useMemo(
    () => new Map(catalogTabs.map((tab, index) => [tab.id, index])),
    [catalogTabs],
  );

  const visibleProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const searching = Boolean(keyword);
    const rows = products.filter(product => {
      if (product.showOnPos === false) return false;
      if (searching) {
        return `${product.name || ""} ${product.id || ""} ${product.barcode || ""} ${product.category || ""}`
          .toLowerCase().includes(keyword);
      }
      if (activeCategory === "quick") return Number(catalogRanking.get(product.id)?.qty || 0) > 0;
      if (activeCategory === "all") return true;
      if (activeCategory.startsWith("category:")) {
        return String(product.category || "ทั่วไป").trim() === activeCategory.slice(9);
      }
      return true;
    });

    return rows.sort((a, b) => {
      if (activeCategory === "quick" && !searching) {
        const salesA = catalogRanking.get(a.id) || { qty: 0, revenue: 0 };
        const salesB = catalogRanking.get(b.id) || { qty: 0, revenue: 0 };
        return salesB.qty - salesA.qty
          || salesB.revenue - salesA.revenue
          || String(a.name || "").localeCompare(String(b.name || ""), "th");
      }
      const categoryA = catalogCategoryRank.get(`category:${String(a.category || "ทั่วไป").trim() || "ทั่วไป"}`) ?? 9999;
      const categoryB = catalogCategoryRank.get(`category:${String(b.category || "ทั่วไป").trim() || "ทั่วไป"}`) ?? 9999;
      if ((activeCategory === "all" || searching) && categoryA !== categoryB) return categoryA - categoryB;
      return Number(a.sortOrder ?? 9999) - Number(b.sortOrder ?? 9999)
        || String(a.name || "").localeCompare(String(b.name || ""), "th");
    });
  }, [products, search, activeCategory, catalogRanking, catalogCategoryRank]);

  const renderedProducts = visibleProducts.slice(0, renderLimit);
  const catalogEmptyMessage = search.trim()
    ? t("pos.catalog.not_found")
    : activeCategory === "quick"
      ? t("pos.catalog.no_best_sellers")
      : t("pos.catalog.no_category");

  const selectedCustomer = customers.find(item => item.id === selectedCustomerId) || null;
  const customerMatches = useMemo(() => {
    const keyword = customerSearch.trim().toLowerCase();
    if (!keyword) return customers.slice(0, 8);
    return customers.filter(customer =>
      `${customer.customerCode || ""} ${customer.name || ""} ${customer.phone || ""}`
        .toLowerCase().includes(keyword)
    ).slice(0, 8);
  }, [customers, customerSearch]);
  const cartSubtotal = round2(cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0));
  const baseDiscount = round2(Math.max(0, Math.min(cartSubtotal, Number(discount || 0))));
  const availablePoints = loyalty.enabled && selectedCustomer
    ? Math.max(0, Math.floor(Number(selectedCustomer.points || 0))) : 0;
  const maxRedeemPoints = loyalty.enabled && selectedCustomer
    ? Math.max(0, Math.min(
        availablePoints,
        Math.floor(Math.max(0, cartSubtotal - baseDiscount) / Math.max(0.01, Number(loyalty.pointValue || 1)))
      )) : 0;
  const safeRedeemPoints = Math.max(0, Math.min(Math.floor(Number(redeemPoints || 0)), maxRedeemPoints));
  const pointDiscount = round2(safeRedeemPoints * Number(loyalty.pointValue || 1));

  const totals = useMemo(() => {
    const subtotal = cartSubtotal;
    const discountValue = round2(Math.max(0, Math.min(subtotal, baseDiscount + pointDiscount)));
    const discountedBase = round2(Math.max(0, subtotal - discountValue));
    const vatRegistered = tax.vatRegistered === true && Number(tax.vatRate || 0) > 0;
    const rate = vatRegistered ? Math.max(0, Math.min(100, Number(tax.vatRate || 0))) : 0;
    const mode = vatRegistered ? (vatMode === "exclude" ? "exclude" : "include") : "none";
    let beforeVat = discountedBase;
    let vatAmount = 0;
    let total = discountedBase;
    if (vatRegistered && mode === "include") {
      vatAmount = round2(discountedBase * rate / (100 + rate));
      beforeVat = round2(discountedBase - vatAmount);
    } else if (vatRegistered && mode === "exclude") {
      vatAmount = round2(discountedBase * rate / 100);
      total = round2(discountedBase + vatAmount);
    }
    return {
      subtotal,
      discount: discountValue,
      pointDiscount,
      discountedBase,
      taxableBase: beforeVat,
      beforeVat,
      vatAmount,
      vatRate: rate,
      vatMode: mode,
      vatRegistered,
      vatCalculationBase: tax.vatCalculationBase || "after_discount_and_points",
      total,
    };
  }, [cartSubtotal, baseDiscount, pointDiscount, tax, vatMode]);

  const itemCount = cart.reduce((sum, item) => sum + Number(item.qty || 0), 0);

  useEffect(() => {
    if (!mobileCartOpen) {
      document.body.classList.remove("mobile-cart-drawer-open");
      return undefined;
    }
    document.body.classList.add("mobile-cart-drawer-open");
    const closeOnEscape = event => {
      if (event.key === "Escape") setMobileCartOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("mobile-cart-drawer-open");
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileCartOpen]);

  useEffect(() => {
    if (mobileCartOpen && totals.total <= 0 && heldBills.length <= 0) setMobileCartOpen(false);
  }, [mobileCartOpen, totals.total, heldBills.length]);

  const cashPayment = paymentMethod === "cash";
  const effectiveReceived = cashPayment ? Number(received || 0) : totals.total;
  const change = round2(Math.max(0, effectiveReceived - totals.total));
  const promptPayInfo = useMemo(() => {
    if (paymentMethod !== "promptpay") return { visible: false, error: "", qrImageUrl: "" };
    const promptPayId = String(paymentSettings.promptPayId || "").replace(/\D/g, "");
    const accountName = paymentSettings.promptPayAccountName
      || paymentSettings.shopName
      || t("pos.promptpay_payment.store_fallback");
    if (!paymentSettings.promptPayEnabled || !promptPayId) {
      return { visible: true, accountName, error: t("pos.promptpay_payment.not_configured"), qrImageUrl: "" };
    }
    if (!(totals.total > 0)) {
      return { visible: true, accountName, error: t("pos.promptpay_payment.invalid_amount"), qrImageUrl: "" };
    }
    try {
      const payload = generatePromptPayPayload(promptPayId, totals.total);
      return {
        visible: true,
        accountName,
        error: "",
        payload,
        qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(payload)}`,
      };
    } catch (error) {
      console.warn("POS_PROMPTPAY_QR_FAILED", error);
      return { visible: true, accountName, error: t("pos.promptpay_payment.qr_failed"), qrImageUrl: "" };
    }
  }, [paymentMethod, paymentSettings, totals.total, t]);

  useEffect(() => {
    if (paymentDialogRef.current?.open && cashPayment) setReceived(totals.total);
  }, [totals.total, cashPayment]);

  useEffect(() => {
    if (!tenant?.id || !authUser?.uid) return undefined;
    window.clearTimeout(displayTimerRef.current);
    displayTimerRef.current = window.setTimeout(async () => {
      const hasItems = cart.length > 0 && itemCount > 0;
      if (!hasItems && !displayOwnsStateRef.current) return;
      if (hasItems) displayOwnsStateRef.current = true;
      const now = Date.now();
      const items = cart.map((item, index) => ({
        id: String(item.id || ""),
        name: String(item.name || ""),
        meta: t("pos.common.price_per_unit", { amount: money(item.price), unit: item.unit || "" }),
        qty: Number(item.qty || 0),
        total: round2(Number(item.price || 0) * Number(item.qty || 0)),
        sortIndex: index,
        touchedAt: now + index,
      })).reverse();
      const paymentQr = paymentMethod === "promptpay" && paymentDialogRef.current?.open
        ? {
            method: "promptpay",
            amount: totals.total,
            shopName: paymentSettings.shopName || tenant.name || "",
            accountName: promptPayInfo.accountName || "",
            tenantId: tenant.id,
            registerId: displayConfig.registerId,
            displayId: displayConfig.displayId,
            payload: promptPayInfo.payload || "",
            qrImageUrl: promptPayInfo.qrImageUrl || "",
            verified: Boolean(promptPayInfo.payload && !promptPayInfo.error),
            error: promptPayInfo.error || "",
            updatedAt: now,
          } : null;
      const snapshot = {
        id: displayConfig.displayId,
        tenantId: tenant.id,
        registerId: displayConfig.registerId,
        registerName: displayConfig.registerName,
        displayId: displayConfig.displayId,
        sessionId: displaySessionId,
        status: hasItems ? "editing" : "idle",
        customerId: selectedCustomer?.id || "",
        customerName: selectedCustomer?.name || "",
        customerPhone: selectedCustomer?.phone || "",
        customerDisplayName: selectedCustomer?.name || "",
        customerDisplayPhone: maskCustomerPhone(selectedCustomer?.phone || ""),
        itemCount,
        items,
        subtotal: totals.subtotal,
        discount: totals.discount,
        vatMode: totals.vatMode,
        beforeVat: totals.beforeVat,
        vatAmount: totals.vatAmount,
        total: totals.total,
        paymentQr,
        updatedAt: now,
      };
      const signature = JSON.stringify({
        customerId: snapshot.customerId,
        items: snapshot.items.map(({ id, name, meta, qty, total }) => ({ id, name, meta, qty, total })),
        subtotal: snapshot.subtotal,
        discount: snapshot.discount,
        vatMode: snapshot.vatMode,
        beforeVat: snapshot.beforeVat,
        vatAmount: snapshot.vatAmount,
        total: snapshot.total,
        paymentQr: snapshot.paymentQr,
      });
      if (signature === displaySignatureRef.current) return;
      displaySignatureRef.current = signature;
      try {
        localStorage.setItem(`retail_pos_customer_display_${displayConfig.displayId}`, JSON.stringify(snapshot));
        if (displayConfig.displayId === "main-register") {
          localStorage.setItem("retail_pos_customer_display_main", JSON.stringify(snapshot));
        }
      } catch {}
      try {
        await updateCustomerDisplay(tenant.id, displayConfig.displayId, snapshot);
      } catch (error) {
        displaySignatureRef.current = "";
        console.warn("POS_CUSTOMER_DISPLAY_SYNC_FAILED", error);
      }
    }, 180);
    return () => window.clearTimeout(displayTimerRef.current);
  }, [
    tenant?.id, tenant?.name, authUser?.uid, cart, itemCount, totals, paymentMethod,
    paymentSettings, promptPayInfo, selectedCustomer, displayConfig, displaySessionId, t,
  ]);

  const addProduct = productId => {
    if (savingSale) return;
    const product = products.find(item => item.id === productId);
    if (!product || Number(product.stock || 0) <= 0) return;
    setCart(current => {
      const found = current.find(item => item.id === productId);
      const quantity = Number(found?.qty || 0);
      if (quantity >= Number(product.stock || 0)) {
        showToast(t("pos.runtime.stock_limit"), "error");
        return current;
      }
      if (found) return current.map(item => item.id === productId ? { ...item, qty: item.qty + 1 } : item);
      return [...current, { ...product, qty: 1 }];
    });
  };

  const changeQty = (id, delta) => {
    if (savingSale) return;
    const product = products.find(item => item.id === id);
    setCart(current => {
      const found = current.find(item => item.id === id);
      if (!found || !product) return current;
      const next = Number(found.qty || 0) + delta;
      if (next > Number(product.stock || 0)) {
        showToast(t("pos.runtime.stock_limit"), "error");
        return current;
      }
      if (next <= 0) return current.filter(item => item.id !== id);
      return current.map(item => item.id === id ? { ...item, qty: next } : item);
    });
  };

  const resetSaleState = () => {
    setCart([]);
    setDiscount(0);
    setSelectedCustomerId("");
    setCustomerSearch("");
    setRedeemPoints(0);
    setPaymentError("");
    requestAnimationFrame(() => barcodeRef.current?.focus());
  };

  const clearSale = () => {
    if (savingSale) return;
    resetSaleState();
  };

  const addProductByCode = codeValue => {
    const code = String(codeValue || "").trim();
    const product = products.find(item => item.barcode === code || String(item.id || "").toLowerCase() === code.toLowerCase());
    if (product) {
      addProduct(product.id);
      return true;
    }
    showToast(t("pos.runtime.barcode_not_found"), "error");
    return false;
  };

  const scanBarcode = event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addProductByCode(barcode);
    setBarcode("");
  };

  const stopScanner = (closeDialog = true) => {
    window.cancelAnimationFrame(scanRafRef.current);
    scanRafRef.current = 0;
    try { zxingControlsRef.current?.stop?.(); } catch {}
    try { zxingReaderRef.current?.reset?.(); } catch {}
    zxingControlsRef.current = null;
    zxingReaderRef.current = null;
    scanDetectorRef.current = null;
    if (scanStreamRef.current) {
      scanStreamRef.current.getTracks().forEach(track => track.stop());
      scanStreamRef.current = null;
    }
    if (scanVideoRef.current) scanVideoRef.current.srcObject = null;
    if (closeDialog && scanDialogRef.current?.open) scanDialogRef.current.close();
    barcodeRef.current?.focus?.();
  };

  const finishScan = value => {
    const code = String(value || "").trim();
    if (!code) return;
    setScanStatus(`พบรหัส: ${code}`);
    addProductByCode(code);
    showToast("สแกนบาร์โค้ดสำเร็จ");
    stopScanner();
  };

  const nativeScanLoop = async () => {
    if (!scanStreamRef.current || !scanDetectorRef.current || !scanVideoRef.current) return;
    try {
      const codes = await scanDetectorRef.current.detect(scanVideoRef.current);
      const value = String(codes?.[0]?.rawValue || "").trim();
      if (value) {
        finishScan(value);
        return;
      }
    } catch {}
    scanRafRef.current = window.requestAnimationFrame(nativeScanLoop);
  };

  const loadZxing = () => {
    if (window.ZXing) return Promise.resolve(window.ZXing);
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-zxing="1"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(window.ZXing), { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.dataset.zxing = "1";
      script.src = "https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js";
      script.onload = () => window.ZXing ? resolve(window.ZXing) : reject(new Error("ZXING_UNAVAILABLE"));
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const startScanner = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast("อุปกรณ์นี้ไม่สามารถเปิดกล้องได้", "error");
      barcodeRef.current?.focus?.();
      return;
    }
    setScanStatus("กำลังเตรียมกล้อง...");
    if (!scanDialogRef.current?.open) scanDialogRef.current?.showModal?.();
    try {
      if ("BarcodeDetector" in window) {
        scanDetectorRef.current = new window.BarcodeDetector({
          formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "qr_code"],
        });
        scanStreamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        scanVideoRef.current.srcObject = scanStreamRef.current;
        await scanVideoRef.current.play();
        setScanStatus("กำลังสแกน...");
        nativeScanLoop();
        return;
      }
      setScanStatus("กำลังโหลดตัวอ่านบาร์โค้ด...");
      const ZXing = await loadZxing();
      zxingReaderRef.current = new ZXing.BrowserMultiFormatReader();
      setScanStatus("กำลังสแกน...");
      zxingControlsRef.current = await zxingReaderRef.current.decodeFromVideoDevice(null, scanVideoRef.current, result => {
        const value = String(result?.getText?.() || result?.text || "").trim();
        if (value) finishScan(value);
      });
    } catch (error) {
      console.error("POS_BARCODE_SCANNER_FAILED", error);
      stopScanner();
      showToast("เปิดกล้องไม่สำเร็จ กรุณาอนุญาตการใช้งานกล้อง", "error");
    }
  };

  useEffect(() => () => stopScanner(false), []);

  const setNumericValue = value => {
    if (numericTarget === "customer") {
      setCustomerSearch(String(value || "").replace(/\D/g, "").slice(0, 10));
      return;
    }
    const cleaned = String(value || "").replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    setReceived(parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}` : parts[0]);
  };

  const activateNumericTarget = (target, input) => {
    setNumericTarget(target);
    if (!window.matchMedia?.("(min-width: 801px)")?.matches) return;
    replaceNumericRef.current = true;
    window.setTimeout(() => {
      try { input?.select?.(); } catch {}
    }, 0);
  };

  const pressNumericKey = value => {
    if (numericTarget === "customer" && (value === "." || value === "00")) return;
    let current = replaceNumericRef.current
      ? ""
      : numericTarget === "customer" ? String(customerSearch || "") : String(received ?? "");
    replaceNumericRef.current = false;
    if (numericTarget === "received" && value === ".") {
      if (current.includes(".")) return;
      current = current ? `${current}.` : "0.";
      setNumericValue(current);
      return;
    }
    setNumericValue(current + value);
  };

  const numericAction = action => {
    const current = numericTarget === "customer" ? String(customerSearch || "") : String(received ?? "");
    replaceNumericRef.current = false;
    if (action === "back") setNumericValue(current.slice(0, -1));
    if (action === "clear") setNumericValue("");
    if (action === "exact" && numericTarget === "received") setReceived(totals.total.toFixed(2));
  };

  const openPayment = () => {
    if (!cart.length || totals.total <= 0 || savingSale) return;
    setSelectedCustomerId("");
    setCustomerSearch("");
    setRedeemPoints(0);
    setPaymentMethod("cash");
    setNumericTarget("received");
    setReceived(totals.total);
    setPaymentError("");
    paymentDialogRef.current?.showModal?.();
    window.setTimeout(() => receivedRef.current?.select?.(), 50);
  };

  const closePayment = () => {
    if (savingSale) return;
    paymentDialogRef.current?.close?.();
    setSelectedCustomerId("");
    setCustomerSearch("");
    setRedeemPoints(0);
    setPaymentError("");
  };

  const openReceiptForSale = (sale, { auto = false } = {}) => {
    if (!sale?.id) return null;
    const receiptUrl = `/pos/receipt?saleId=${encodeURIComponent(sale.id)}&auto=${auto ? "1" : "0"}&paper=${encodeURIComponent(receiptSettings.paperSize || "80")}`;
    const width = 460;
    const height = 760;
    const left = Math.max(0, Math.round((window.screen.width - width) / 2));
    const top = Math.max(0, Math.round((window.screen.height - height) / 2));
    return window.open(
      receiptUrl,
      `pos_receipt_${String(sale.id).replace(/[^a-zA-Z0-9]/g, "_")}`,
      `popup=yes,width=${width},height=${height},left=${left},top=${top},noopener,noreferrer`,
    );
  };

  const confirmPayment = async () => {
    if (savingSale || !tenant?.id) return;
    if (cashPayment && effectiveReceived < totals.total) {
      setPaymentError(t("pos.runtime.insufficient_payment"));
      return;
    }
    setSavingSale(true);
    setPaymentError("");
    try {
      const sale = await completePosSale({
        tenantId: tenant.id,
        items: cart,
        totals,
        paymentMethod,
        received: effectiveReceived,
        customer: selectedCustomer,
        shift,
      });
      if (selectedCustomer) {
        try {
          await applyPosLoyalty({
            tenantId: tenant.id,
            sale,
            customer: selectedCustomer,
            pointsUsed: safeRedeemPoints,
            settings: loyalty,
          });
        } catch (loyaltyError) {
          console.error("POS_LOYALTY_APPLY_FAILED", loyaltyError);
        }
      }
      paymentDialogRef.current?.close?.();
      showToast(t("pos.runtime.sale_success", { number: sale?.saleNumber || sale?.id || "-" }));
      resetSaleState();
      if (receiptSettings.autoPrint && sale?.id) openReceiptForSale(sale, { auto: true });
      await refresh();
    } catch (error) {
      console.error("POS_COMPLETE_SALE_FAILED", error);
      const message = String(error?.message || "");
      if (message.startsWith("INSUFFICIENT_STOCK:")) {
        setPaymentError(t("pos.runtime.insufficient_stock", { product: message.split(":").slice(1).join(":") }));
      } else if (message.startsWith("PRODUCT_NOT_FOUND:")) {
        setPaymentError(t("pos.runtime.product_not_found", { product: message.split(":").slice(1).join(":") }));
      } else if (message === "AUTH_REQUIRED") {
        setPaymentError(t("pos.runtime.auth_required"));
      } else {
        setPaymentError(t("pos.runtime.sale_failed"));
      }
    } finally {
      setSavingSale(false);
    }
  };

  const holdBill = async () => {
    if (!tenant?.id || savingSale) return;
    if (!cart.length) {
      await sweetAlert(t("pos.held.no_items_message"), {
        title: t("pos.held.hold_title"),
        type: "warning",
      });
      return;
    }
    const name = await sweetPrompt(t("pos.held.prompt_message"), "", {
      title: t("pos.held.hold_title"),
      placeholder: t("pos.held.prompt_placeholder"),
      confirmText: t("pos.cart.hold_bill"),
      cancelText: t("pos.common.cancel"),
      type: "warning",
    });
    if (name === null) return;
    try {
      await holdPosBill(tenant.id, {
        name: String(name || "").trim() || t("pos.held.default_name"),
        items: cart,
        discount: totals.discount,
        total: totals.total,
        totalAmount: totals.total,
      });
      resetSaleState();
      setHeldBills(await listHeldPosBills(tenant.id));
      await sweetAlert(t("pos.held.saved_synced"), {
        title: t("pos.held.saved_title"),
        type: "success",
      });
    } catch (error) {
      console.error("POS_HOLD_FAILED", error);
      await sweetAlert(t("pos.runtime.sale_failed"), {
        title: t("pos.held.hold_title"),
        type: "error",
      });
    }
  };

  const openHeldBills = async () => {
    if (!tenant?.id) return;
    try {
      setHeldBills(await listHeldPosBills(tenant.id));
    } catch (error) {
      console.warn("POS_HELD_REFRESH_FAILED", error);
    }
    heldDialogRef.current?.showModal?.();
  };

  const resumeHeld = async bill => {
    if (!tenant?.id || savingSale) return;
    const reopenHeldDialog = Boolean(heldDialogRef.current?.open);
    if (cart.length) {
      if (reopenHeldDialog) heldDialogRef.current?.close?.();
      const confirmed = await sweetConfirm(t("pos.held.resume_confirm"), {
        title: t("pos.held.resume_title"),
        confirmText: t("pos.held.resume_confirm_button"),
        cancelText: t("pos.common.cancel"),
        type: "warning",
      });
      if (reopenHeldDialog && !heldDialogRef.current?.open) heldDialogRef.current?.showModal?.();
      if (!confirmed) return;
    }
    try {
      await releaseHeldPosBill(tenant.id, bill.id);
      setCart(Array.isArray(bill.items) ? bill.items : []);
      setDiscount(Number(bill.discount || 0));
      setHeldBills(await listHeldPosBills(tenant.id));
      heldDialogRef.current?.close?.();
    } catch (error) {
      console.error("POS_HELD_RESUME_FAILED", error);
      if (heldDialogRef.current?.open) heldDialogRef.current.close();
      await sweetAlert(t("pos.held.resume_failed", { error: String(error?.message || "error") }), {
        title: t("pos.held.resume_failed_title"),
        type: "error",
      });
      if (reopenHeldDialog && !heldDialogRef.current?.open) heldDialogRef.current?.showModal?.();
    }
  };

  const deleteHeld = async bill => {
    if (!tenant?.id) return;
    const reopenHeldDialog = Boolean(heldDialogRef.current?.open);
    if (reopenHeldDialog) heldDialogRef.current?.close?.();
    const confirmed = await sweetConfirm(t("pos.held.delete_confirm", { name: bill.name || t("pos.held.default_name") }), {
      title: t("pos.held.delete_title"),
      confirmText: t("pos.held.delete"),
      cancelText: t("pos.common.cancel"),
      type: "warning",
    });
    if (reopenHeldDialog && !heldDialogRef.current?.open) heldDialogRef.current?.showModal?.();
    if (!confirmed) return;
    try {
      await releaseHeldPosBill(tenant.id, bill.id);
      setHeldBills(await listHeldPosBills(tenant.id));
    } catch (error) {
      console.error("POS_HELD_DELETE_FAILED", error);
      if (heldDialogRef.current?.open) heldDialogRef.current.close();
      await sweetAlert(String(error?.message || t("pos.runtime.sale_failed")), {
        title: t("pos.held.delete_title"),
        type: "error",
      });
      if (reopenHeldDialog && !heldDialogRef.current?.open) heldDialogRef.current?.showModal?.();
    }
  };

  const openMobileCart = () => {
    if (totals.total <= 0 && heldBills.length <= 0) return;
    setMobileCartOpen(true);
  };

  const checkoutFromMobileCart = () => {
    if (totals.total <= 0) return;
    setMobileCartOpen(false);
    openPayment();
  };

  const holdFromMobileCart = () => {
    if (!cart.length) return;
    setMobileCartOpen(false);
    holdBill();
  };

  const heldBillsFromMobileCart = () => {
    if (!heldBills.length) return;
    setMobileCartOpen(false);
    openHeldBills();
  };

  const closeMobileCartOnSwipe = event => {
    const endY = event.changedTouches?.[0]?.clientY || 0;
    if (endY - mobileCartTouchStartRef.current > 80) setMobileCartOpen(false);
  };

  if (
    authState.status === "loading"
    || tenantState.status === "loading"
    || !stylesReady
    || Boolean(posRedirectTarget)
    || (tenantState.status === "ready" && tenant?.id && profile && canUseRetailPos(posAccessProfile) && hasSaleAccess && !initialDataReady)
  ) {
    return <PageReadyOverlay context="PENGUIN" title={t("shared.state.loading")} message={t("shared.state.please_wait")} progress={92} />;
  }

  return (
    <>
      <header className="pos-header tw:w-full tw:min-w-0 tw:flex-wrap tw:sm:flex-nowrap" data-pos-tailwind-header>
        <div className="app-title tw:min-w-0 tw:flex-1">
          <div className="tw:min-w-0"><strong className="tw:block tw:truncate">{t("pos.header.title")}</strong><small className="tw:block tw:truncate">{t("pos.header.subtitle")}</small></div>
        </div>
        <div className="header-actions tw:shrink-0">
          <a className="btn btn-secondary tw:inline-flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:p-0" href={`/pos/customer-display?displayId=${encodeURIComponent(displayConfig.displayId)}`} target="_blank" rel="noopener" aria-label={t("pos.header.customer_display_aria")} title={t("pos.header.customer_display_aria")}><i className="bi bi-display" aria-hidden="true"></i></a>
          <LocaleSwitcher style={{ marginLeft: 0, marginRight: 0 }} />
          <PosNavigation profile={posAccessProfile} currentKey="pos.sale" />
        </div>
      </header>

      <main className="pos-layout" data-pos-tailwind>
        <section className="panel product-panel tw:min-w-0" data-pos-tailwind-panel>
          <div className="section-heading">
            <div className="tw:min-w-0"><h2><i className="bi bi-box-seam pos-context-icon" data-icon-tone="teal" aria-hidden="true"></i>{t("pos.products.title")}</h2><p>{t("pos.products.description")}</p></div>
            <div className="section-actions tw:shrink-0"><button id="clearSaleBtn" className="btn btn-danger tw:whitespace-nowrap" type="button" disabled={savingSale} onClick={clearSale}><i className="bi bi-x-lg pos-context-icon" data-icon-tone="slate" aria-hidden="true"></i><span>{t("pos.products.clear_bill")}</span></button></div>
          </div>
          <div className="search-row" data-pos-tailwind-search>
            <div className="barcode-input-group tw:min-w-0">
              <input id="barcodeInput" ref={barcodeRef} className="tw:min-w-0" autoComplete="off" inputMode="numeric" value={barcode} onChange={e => setBarcode(e.target.value)} onKeyDown={scanBarcode} placeholder={t("pos.products.barcode_placeholder")} />
              <button id="scanBarcodeBtn" className="btn scan-barcode-btn" type="button" onClick={startScanner} aria-label="สแกนต่อเนื่อง" title="สแกนต่อเนื่อง"><i className="bi bi-upc-scan scan-barcode-icon" aria-hidden="true"></i><span>สแกนต่อเนื่อง</span></button>
            </div>
            <input id="searchInput" className="tw:min-w-0" autoComplete="off" value={search} onChange={e => { setSearch(e.target.value); setRenderLimit(99); }} placeholder={t("pos.products.search_placeholder")} />
          </div>
          <div id="catalogTabs" className="catalog-tabs" aria-label={t("pos.products.title")}>
            {catalogTabs.map(tab => (
              <button
                type="button"
                className={`catalog-tab${activeCategory === tab.id ? " active" : ""}`}
                data-category={tab.id}
                onClick={() => { setActiveCategory(tab.id); setRenderLimit(99); }}
                key={tab.id}
              >{tab.label}</button>
            ))}
          </div>
          <div id="productGrid" className="product-grid tw:w-full tw:min-w-0" data-renderer="catalog">
            {renderedProducts.length ? renderedProducts.map(product => {
                const imageUrl = productImageUrl(product);
                const soldOut = Number(product.stock || 0) <= 0;
                const productName = product.name || t("pos.runtime.default_product");
                const stockLabel = soldOut
                  ? t("pos.catalog.out_of_stock")
                  : t("pos.catalog.stock", { stock: `${formatNumber(product.stock)} ${product.unit || ""}` });
                const productCode = [product.id, product.barcode].filter(Boolean).join(" • ");
                return (
                  <button
                    className={`product-card visual-card${imageUrl ? " pos-product-card-image" : ""}${soldOut ? " is-sold-out" : ""}`}
                    type="button"
                    data-product-id={product.id}
                    disabled={savingSale || soldOut}
                    aria-disabled={soldOut ? "true" : undefined}
                    aria-label={`${productName} ${stockLabel} ${t("pos.common.amount_thb", { amount: money(product.price) })}`}
                    onClick={() => addProduct(product.id)}
                    key={product.id}
                  >
                    {imageUrl ? (
                      <>
                        <span className="pos-card-image-wrap"><img src={imageUrl} alt={product.name || ""} loading="lazy" decoding="async" /></span>
                        <span className="pos-card-title">{productName}</span>
                        <span className="pos-card-code">{productCode}</span>
                        <span className="pos-card-stock">{stockLabel}</span>
                        <span className="pos-card-price">{t("pos.common.amount_thb", { amount: money(product.price) })}</span>
                        <span className="pos-card-hover-info" aria-hidden="true">
                          <strong>{productName}</strong>
                          <span className="pos-hover-stock">{stockLabel}</span>
                          <span className="pos-hover-price">{t("pos.common.amount_thb", { amount: money(product.price) })}</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="product-image" data-product-name={productName}>{productInitials(product)}</div>
                        <div className="product-card-body">
                          <span className="name">{productName}</span>
                          <span className="code">{product.id} • {product.barcode || "-"}</span>
                          <span className="stock">{stockLabel}</span>
                          <span className="price">{t("pos.common.amount_thb", { amount: money(product.price) })}</span>
                        </div>
                        <div className="product-info-overlay" aria-hidden="true">
                          <strong>{productName}</strong>
                          <span>{t("pos.common.amount_thb", { amount: money(product.price) })} • {soldOut ? t("pos.catalog.out_of_stock") : t("pos.catalog.remaining", { stock: `${formatNumber(product.stock)} ${product.unit || ""}` })}</span>
                        </div>
                      </>
                    )}
                  </button>
                );
              }) : <div className="catalog-empty">{catalogEmptyMessage}</div>}
            {visibleProducts.length > renderedProducts.length ? (
              <button
                id="catalogLoadMore"
                type="button"
                className="catalog-load-more"
                onClick={() => setRenderLimit(current => current + 99)}
              >
                <i className="bi bi-plus-lg pos-context-icon" data-icon-tone="emerald" aria-hidden="true"></i>
                {t("pos.catalog.show_more", { count: formatNumber(Math.min(99, visibleProducts.length - renderedProducts.length)) })}
                <small>{t("pos.catalog.from_total", { count: formatNumber(visibleProducts.length) })}</small>
              </button>
            ) : visibleProducts.length ? (
              <div className="catalog-result-count">{t("pos.catalog.showing", { count: formatNumber(visibleProducts.length) })}</div>
            ) : null}
          </div>
        </section>

        <aside className="panel cart-panel tw:w-full tw:min-w-0" data-pos-tailwind-panel>
          <div className="cart-title tw:min-w-0"><h1 className="tw:min-w-0"><i className="bi bi-cart3 pos-context-icon" data-icon-tone="emerald" aria-hidden="true"></i>{t("pos.cart.title")}</h1><span id="itemCount" className="tw:shrink-0 tw:whitespace-nowrap">{t("pos.common.item_count", { count: itemCount })}</span></div>
          <div id="cartEmpty" className="empty-state" hidden={cart.length > 0}>{t("pos.cart.empty")}</div>
          <div id="cartList" className="cart-list tw:min-w-0">
            {cart.map(item => (
              <div className="cart-row" key={item.id}>
                <div>
                  <div className="cart-name">{item.name}</div>
                  <div className="cart-meta">{t("pos.common.price_per_unit", { amount: money(item.price), unit: item.unit })}</div>
                  <div className="qty-tools">
                    <button type="button" className="qty-action qty-decrease" disabled={savingSale} aria-label={t("pos.runtime.decrease_qty", { product: item.name })} onClick={() => changeQty(item.id, -1)}><i className="bi bi-dash-lg" aria-hidden="true"></i></button>
                    <strong>{item.qty}</strong>
                    <button type="button" className="qty-action qty-increase" disabled={savingSale} aria-label={t("pos.runtime.increase_qty", { product: item.name })} onClick={() => changeQty(item.id, 1)}><i className="bi bi-plus-lg" aria-hidden="true"></i></button>
                    <button type="button" className="remove qty-remove" disabled={savingSale} aria-label={t("pos.runtime.remove_item", { product: item.name })} onClick={() => setCart(current => current.filter(row => row.id !== item.id))}><i className="bi bi-trash3" aria-hidden="true"></i></button>
                  </div>
                </div>
                <div className="line-total">{money(Number(item.price || 0) * Number(item.qty || 0))}</div>
              </div>
            ))}
          </div>
          <div className="summary tw:min-w-0">
            <div><span>{t("pos.cart.subtotal")}</span><strong id="subtotal">{money(totals.subtotal)}</strong></div>
            <label><span>{t("pos.cart.discount")}</span><input id="discountInput" type="number" min="0" step="0.01" value={discount} onChange={e => setDiscount(Math.max(0, Number(e.target.value || 0)))} /></label>
            <select id="vatMode" hidden aria-hidden="true" tabIndex="-1" value={vatMode} onChange={e => setVatMode(e.target.value)}><option value="include">include VAT</option><option value="exclude">exclude VAT</option></select>
            <div id="beforeVatWrap" hidden={!tax.vatRegistered}><span>{t("pos.cart.before_vat")}</span><strong id="beforeVatAmount">{money(totals.beforeVat)}</strong></div>
            <div id="vatAmountWrap" hidden={!tax.vatRegistered}><span id="vatAmountLabel">VAT {Number(tax.vatRate || 0)}%</span><strong id="vatAmount">{money(totals.vatAmount)}</strong></div>
            <div className="grand-total"><span>{t("pos.cart.net_total")}</span><strong id="grandTotal">{money(totals.total)}</strong></div>
          </div>
          <div className="cart-actions tw:grid tw:grid-cols-1 tw:sm:grid-cols-2">
            <button id="holdBillBtn" className="btn btn-secondary" type="button" disabled={savingSale} data-pos-icon="pause-circle" onClick={holdBill}><i className="bi bi-pause-circle pos-context-icon" data-icon-tone="amber" aria-hidden="true"></i><span>{t("pos.cart.hold_bill")}</span></button>
            <button id="heldBillsBtn" className={`btn btn-secondary${heldBills.length ? " has-held" : ""}`} type="button" data-pos-icon="receipt" onClick={openHeldBills}><i className="bi bi-receipt pos-context-icon" data-icon-tone="green" aria-hidden="true"></i><span>{t("pos.cart.held_bills")}</span> <span id="heldBillsCount" className="held-count">{heldBills.length}</span></button>
          </div>
          <button id="payBtn" className="btn btn-pay tw:w-full" type="button" disabled={!cart.length || totals.total <= 0 || savingSale} onClick={openPayment}><i className="bi bi-credit-card pos-context-icon" data-icon-tone="blue" aria-hidden="true"></i><span>{t("pos.cart.pay")}</span></button>
        </aside>
      </main>

      <button
        type="button"
        className="mobile-cart-bar"
        data-mobile-cart-bar
        hidden={mobileCartOpen || (totals.total <= 0 && heldBills.length <= 0)}
        onClick={openMobileCart}
      >
        <span className="mobile-cart-icon" aria-hidden="true"><i className="bi bi-cart3"></i></span>
        <span className="mobile-cart-main">
          <span className="mobile-cart-title">{t("pos.mobile_cart.title")}</span>
          <span className="mobile-cart-meta" data-mobile-cart-meta>
            {totals.total > 0
              ? `${t("pos.common.item_count", { count: formatNumber(itemCount) })} • ${t("pos.common.amount_thb", { amount: money(totals.total) })}`
              : `${formatNumber(heldBills.length)} ${t("pos.cart.held_bills")}`}
          </span>
        </span>
        <span className="mobile-cart-pay" data-mobile-cart-action-label>
          {totals.total > 0 ? t("pos.mobile_cart.view_bill") : t("pos.cart.held_bills")}
        </span>
      </button>

      <div
        className={`mobile-cart-backdrop${mobileCartOpen ? " open" : ""}`}
        data-mobile-cart-backdrop
        onClick={() => setMobileCartOpen(false)}
      ></div>

      <section
        className={`mobile-cart-drawer${mobileCartOpen ? " open" : ""}`}
        data-mobile-cart-drawer
        role="dialog"
        aria-modal="true"
        aria-label={t("pos.cart.title")}
        onTouchStart={event => { mobileCartTouchStartRef.current = event.touches?.[0]?.clientY || 0; }}
        onTouchEnd={closeMobileCartOnSwipe}
      >
        <div className="mobile-cart-handle" data-mobile-cart-close onClick={() => setMobileCartOpen(false)}></div>
        <header className="mobile-cart-drawer-head">
          <div>
            <h3>{t("pos.cart.title")}</h3>
            <small data-mobile-cart-drawer-meta>
              {heldBills.length > 0
                ? `${t("pos.common.item_count", { count: formatNumber(itemCount) })} • ${t("pos.cart.held_bills")} ${formatNumber(heldBills.length)}`
                : t("pos.common.item_count", { count: formatNumber(itemCount) })}
            </small>
          </div>
          <button type="button" className="mobile-cart-close" data-mobile-cart-close aria-label={t("pos.common.close")} onClick={() => setMobileCartOpen(false)}>
            <i className="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </header>
        <div className="mobile-cart-items" data-mobile-cart-items>
          {cart.length ? cart.map(item => (
            <div className="mobile-cart-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>{t("pos.common.price_per_unit", { amount: money(item.price), unit: item.unit || "" })} • x{formatNumber(item.qty)}</span>
              </div>
              <b>{money(Number(item.price || 0) * Number(item.qty || 0))}</b>
            </div>
          )) : <div className="mobile-cart-empty">{t("pos.cart.empty")}</div>}
        </div>
        <footer className="mobile-cart-footer">
          <div className="mobile-cart-total">
            <span>{t("pos.cart.net_total")}</span>
            <strong data-mobile-cart-drawer-total>{t("pos.common.amount_thb", { amount: money(totals.total) })}</strong>
          </div>
          <div className="mobile-cart-secondary-actions">
            <button type="button" className="mobile-cart-secondary" data-mobile-cart-hold disabled={!cart.length || savingSale} onClick={holdFromMobileCart}>
              <i className="bi bi-pause-circle" aria-hidden="true"></i><span>{t("pos.cart.hold_bill")}</span>
            </button>
            <button type="button" className="mobile-cart-secondary" data-mobile-cart-held disabled={!heldBills.length} onClick={heldBillsFromMobileCart}>
              <i className="bi bi-receipt" aria-hidden="true"></i><span>{t("pos.cart.held_bills")}</span>
              <span className="mobile-cart-held-count" data-mobile-cart-held-count>{formatNumber(heldBills.length)}</span>
            </button>
          </div>
          <button type="button" className="mobile-cart-checkout" data-mobile-cart-checkout disabled={!cart.length || totals.total <= 0 || savingSale} onClick={checkoutFromMobileCart}>
            {t("pos.cart.pay")}
          </button>
        </footer>
      </section>

      <dialog id="posScanDialog" ref={scanDialogRef} className="pos-scan-dialog" onClose={() => stopScanner(false)} onCancel={event => { event.preventDefault(); stopScanner(); }}>
        <div className="pos-scan-sheet">
          <div className="pos-scan-head"><div><h2>สแกนบาร์โค้ด</h2><p>วางบาร์โค้ดให้อยู่ในกรอบสีเขียว</p></div><button className="pos-scan-close" type="button" aria-label="ปิด" onClick={() => stopScanner()}><i className="bi bi-x-lg" aria-hidden="true"></i></button></div>
          <div className="pos-scan-view"><video id="posScanVideo" ref={scanVideoRef} playsInline muted></video><div className="pos-scan-guide"></div><div className="pos-scan-line"></div></div>
          <p id="posScanStatus" className="pos-scan-status">{scanStatus}</p>
        </div>
      </dialog>

      <dialog id="paymentDialog" ref={paymentDialogRef} className="tw:max-w-[calc(100vw-1.25rem)] tw:sm:max-w-[calc(100vw-2rem)]" data-pos-tailwind-dialog>
        <form method="dialog" className="payment-form has-pos-pad tw:min-w-0" onSubmit={e => e.preventDefault()}>
          <div className="dialog-head"><h2><i className="bi bi-credit-card pos-context-icon" data-icon-tone="blue" aria-hidden="true"></i>{t("pos.payment.title")}</h2><button type="button" className="icon-btn" aria-label={t("pos.common.close")} disabled={savingSale} onClick={closePayment}><i className="bi bi-x-lg" aria-hidden="true"></i></button></div>
          <div className="payment-total tw:flex-col tw:gap-1 tw:sm:flex-row tw:sm:items-center"><span>{t("pos.payment.total_due")}</span><strong id="paymentTotal">{t("pos.common.amount_thb", { amount: money(totals.total) })}</strong></div>
          <label>{t("pos.payment.method")}<select id="paymentMethod" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}><option value="cash">{t("pos.payment.cash")}</option><option value="promptpay">{t("pos.payment.promptpay")}</option></select></label>

          <section id="promptPayPaymentPanel" className="promptpay-payment-panel" hidden={!promptPayInfo.visible} aria-live="polite">
            <div className="promptpay-payment-copy">
              <span>{t("pos.promptpay_payment.title")}</span>
              <strong id="promptPayPaymentAmount">{t("pos.common.amount_thb", { amount: money(totals.total) })}</strong>
              <small id="promptPayPaymentVerify">{promptPayInfo.error ? t("pos.promptpay_payment.setup_help") : t("pos.promptpay_payment.recipient", { name: promptPayInfo.accountName || t("pos.promptpay_payment.store_fallback") })}</small>
            </div>
            <div className="promptpay-payment-qr-wrap">
              {promptPayInfo.qrImageUrl ? <img id="promptPayPaymentQr" className="promptpay-payment-qr" src={promptPayInfo.qrImageUrl} alt={t("pos.promptpay_payment.qr_alt")} /> : <img id="promptPayPaymentQr" className="promptpay-payment-qr" alt={t("pos.promptpay_payment.qr_alt")} hidden />}
              <div id="promptPayPaymentError" className="promptpay-payment-error" hidden={!promptPayInfo.error}>{promptPayInfo.error || t("pos.promptpay_payment.waiting_qr")}</div>
            </div>
          </section>

          <div className="customer-picker">
            <span>{t("pos.customer.label")}</span>
            <div className="customer-search-wrap">
              <input id="saleCustomerSearch" ref={customerSearchRef} className="customer-search-input" autoComplete="off" value={customerSearch} onFocus={e => activateNumericTarget("customer", e.currentTarget)} onPointerDown={e => activateNumericTarget("customer", e.currentTarget)} onChange={e => { replaceNumericRef.current = false; setCustomerSearch(e.target.value); }} placeholder={t("pos.customer.search_placeholder")} data-numeric-pad="phone" />
              <button id="clearSaleCustomer" className="customer-clear-btn" type="button" aria-label={t("pos.customer.clear_aria")} onClick={() => { setSelectedCustomerId(""); setCustomerSearch(""); setRedeemPoints(0); }}><i className="bi bi-x-lg" aria-hidden="true"></i></button>
              <div id="saleCustomerResults" className="customer-search-results" hidden={!customerSearch}>
                <button className={`customer-search-option ${selectedCustomerId ? "" : "is-active"}`} type="button" onClick={() => { setSelectedCustomerId(""); setCustomerSearch(""); setRedeemPoints(0); }}>
                  <span className="customer-option-avatar"><i className="bi bi-person" aria-hidden="true"></i></span>
                  <span className="customer-option-body"><span className="customer-option-name">{t("pos.customer.walk_in_name")} <small>{t("pos.customer.not_member")}</small></span><span className="customer-option-contact">{t("pos.customer.unlinked_sale")}</span></span>
                  <span className="customer-option-check"><i className="bi bi-check-lg" aria-hidden="true"></i></span>
                </button>
                {customerMatches.length ? customerMatches.map(customer => (
                  <button className={`customer-search-option ${selectedCustomerId === customer.id ? "is-active" : ""}`} type="button" data-customer-id={customer.id} key={customer.id} onClick={() => { setSelectedCustomerId(customer.id); setCustomerSearch(""); setRedeemPoints(0); }}>
                    <span className="customer-option-avatar"><i className="bi bi-person-badge" aria-hidden="true"></i></span>
                    <span className="customer-option-body"><span className="customer-option-name">{customer.name || customer.customerCode || customer.id}</span><span className="customer-option-contact">{[customer.customerCode, customer.phone].filter(Boolean).join(" • ")}</span></span>
                    <span className="customer-option-check"><i className="bi bi-check-lg" aria-hidden="true"></i></span>
                  </button>
                )) : <div className="empty-state">{t("pos.customer.not_found")}</div>}
              </div>
            </div>
            <small id="saleCustomerSelectedNote" className="customer-selected-note">{selectedCustomer ? `${selectedCustomer.name || selectedCustomer.customerCode || selectedCustomer.id} • ${t("pos.loyalty.balance", { count: formatNumber(selectedCustomer.points || 0) })}` : t("pos.customer.walk_in")}</small>
          </div>

          <div id="loyaltyBox" className="loyalty-box" hidden={!loyalty.enabled || !selectedCustomer}>
            <div className="loyalty-head"><strong>{t("pos.loyalty.title")}</strong><span id="loyaltyBalance">{t("pos.loyalty.balance", { count: formatNumber(availablePoints) })}</span></div>
            <div className="loyalty-controls"><input id="loyaltyRedeemInput" type="number" min="0" max={maxRedeemPoints} step="1" value={safeRedeemPoints} inputMode="numeric" placeholder={t("pos.loyalty.redeem_placeholder")} onChange={e => setRedeemPoints(Math.max(0, Math.min(maxRedeemPoints, Math.floor(Number(e.target.value || 0)))))} /><button id="useAllPointsBtn" className="btn btn-secondary" type="button" onClick={() => setRedeemPoints(maxRedeemPoints)}>{t("pos.loyalty.use_maximum")}</button></div>
            <small id="loyaltyNote" className="loyalty-note">{safeRedeemPoints > 0 ? t("pos.loyalty.redeemed", { points: formatNumber(safeRedeemPoints), amount: money(pointDiscount) }) : t("pos.loyalty.earning_rule", { spend: money(loyalty.spendPerPoint), value: money(loyalty.pointValue) })}</small>
          </div>

          <label id="receivedWrap" hidden={!cashPayment}>{t("pos.payment.received")}<input id="receivedInput" ref={receivedRef} type="text" inputMode="decimal" autoComplete="off" value={received} onFocus={e => activateNumericTarget("received", e.currentTarget)} onPointerDown={e => activateNumericTarget("received", e.currentTarget)} onKeyDown={e => { replaceNumericRef.current = false; if (e.key === "Enter" && !savingSale) { e.preventDefault(); confirmPayment(); } }} onChange={e => { replaceNumericRef.current = false; setNumericValue(e.target.value); }} data-numeric-pad="money" /></label>
          <div className="change-row tw:flex-wrap tw:gap-2"><span>{t("pos.payment.change")}</span><strong id="changeAmount">{t("pos.common.amount_thb", { amount: money(change) })}</strong></div>
          <p id="paymentError" className="error-text">{paymentError}</p>
          <section className="pos-number-pad" aria-label="แป้นตัวเลข POS" onPointerDown={event => event.preventDefault()}>
            <p className="pos-number-pad-title">แป้นตัวเลข</p>
            {["7","8","9","4","5","6","1","2","3","0","00","."].map(key => <button type="button" data-key={key} key={key} onClick={() => pressNumericKey(key)}>{key}</button>)}
            <button type="button" className="is-action" data-action="exact" onClick={() => numericAction("exact")}>รับพอดี</button>
            <button type="button" className="is-danger" data-action="clear" onClick={() => numericAction("clear")}>ล้าง</button>
            <button type="button" className="is-action pos-pad-backspace" data-action="back" aria-label="ลบตัวเลขล่าสุด" title="ลบตัวเลขล่าสุด" onClick={() => numericAction("back")}><i className="bi bi-backspace" aria-hidden="true"></i></button>
          </section>
          <div className="dialog-actions tw:grid tw:grid-cols-1 tw:sm:grid-cols-2"><button type="button" className="btn btn-secondary" disabled={savingSale} onClick={closePayment}><i className="bi bi-x-lg pos-context-icon" data-icon-tone="slate" aria-hidden="true"></i><span>{t("pos.common.cancel")}</span></button><button id="confirmPaymentBtn" className="btn btn-pay" type="button" disabled={savingSale} onClick={confirmPayment}><i className="bi bi-credit-card pos-context-icon" data-icon-tone="blue" aria-hidden="true"></i><span>{t(savingSale ? "pos.runtime.saving" : "pos.payment.confirm")}</span></button></div>
        </form>
      </dialog>

      <dialog id="heldBillsDialog" ref={heldDialogRef} className="held-dialog tw:max-w-[calc(100vw-1.25rem)] tw:sm:max-w-[620px]" data-pos-tailwind-dialog>
        <div className="held-dialog-content tw:min-w-0">
          <div className="dialog-head"><h2>{t("pos.held.title")}</h2><button id="closeHeldDialog" className="icon-btn" type="button" aria-label={t("pos.common.close")} onClick={() => heldDialogRef.current?.close?.()}><i className="bi bi-x-lg" aria-hidden="true"></i></button></div>
          <div id="heldBillsList" className="held-bills-list tw:min-w-0">
            {heldBills.length ? heldBills.map(bill => {
              const itemTotal = (bill.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
              const createdAt = bill.createdAt ? new Date(bill.createdAt) : null;
              const timeText = createdAt && !Number.isNaN(createdAt.getTime())
                ? createdAt.toLocaleString("th-TH")
                : "-";
              return (
                <article className="held-bill-card" key={bill.id}>
                  <div>
                    <strong>{bill.name || t("pos.held.default_name")}</strong>
                    <div>{t("pos.held.summary", { time: timeText, count: formatNumber(itemTotal) })}</div>
                  </div>
                  <div className="held-bill-side">
                    <strong>{t("pos.common.amount_thb", { amount: money(bill.totalAmount ?? bill.total ?? 0) })}</strong>
                    <div>
                      <button type="button" onClick={() => resumeHeld(bill)}>{t("pos.held.resume")}</button>
                      <button type="button" className="danger" onClick={() => deleteHeld(bill)}>{t("pos.held.delete")}</button>
                    </div>
                  </div>
                </article>
              );
            }) : <div className="empty-state">{t("pos.held.empty")}</div>}
          </div>
        </div>
      </dialog>

      <div id="toast" className="toast" role="status"></div>
      <AppDeveloperPanel />
    </>
  );
}
