import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { StoreBrandMark, brandedHeroStyle } from "@/components/StoreHeroBranding";
import { ParityFooter } from "@/components/ParityFooter";
import { UserMenu } from "@/components/UserMenu";
import { sweetConfirm } from "@/components/sweetDialog";
import {
  createWalkInOrder,
  getOperationalOrder,
  loadOperationalSnapshot,
  releaseQuickOrderHeldBill,
  saveQuickOrderHeldBill,
  updateCustomerDisplay,
  watchOperationalMenus,
  watchOperationalOrders,
  watchOperationalTables,
  watchQuickOrderHeldBills,
} from "@/data/operationalData";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { useTenant } from "@/tenant/TenantProvider";
import { qrDataUrl } from "@/utils/localQr";
import { generatePromptPayPayload } from "@/utils/promptPay";

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

function cashierRoute(path = "") {
  const prefix = "";
  return `${prefix}/cashier${path}`;
}

const moneyNumber = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const BEST_SELLER_LIMIT = 12;
const categoryKey = value => String(value || "").trim() || "อื่น ๆ";
const sameLocalMonth = (value, now = new Date()) => {
  const date = value?.toDate?.() || (value?.seconds ? new Date(Number(value.seconds) * 1000) : new Date(value || ""));
  return Number.isFinite(date.getTime())
    && date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth();
};
const activeTable = table => table?.active !== false && (!table?.status || table.status === "available") && !table?.walkInOrderId;
const heldMillis = value => {
  if (value?.toMillis) return value.toMillis();
  if (value?.seconds) return Number(value.seconds) * 1000;
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

function servicePreferenceKey(tenantId) {
  return `quick_order_default_service_v1:${tenantId || "default"}`;
}
function readServicePreference(tenantId) {
  try {
    const value = localStorage.getItem(servicePreferenceKey(tenantId));
    return ["dine_in", "takeaway"].includes(value) ? value : "dine_in";
  } catch {
    return "dine_in";
  }
}
function safeDisplayId(uid) {
  return `quick-order-${String(uid || "main").trim().replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "main"}`;
}

export function QuickOrderPage() {
  const authState = useAuth();
  const tenantState = useTenant();
  const { profile } = authState;
  const { tenant } = tenantState;
  const { t, formatNumber, formatDate: formatI18nDate } = useI18n();
  const stylesReady = useParityPage({
    title: t("quick_order.meta.title"),
    bodyClass: "quick-order-page",
    styles: ["app.css", "icons.css", "sweet-dialog.css", "quick-order.css", "page-ready-state.css", "store-hero-branding.css"],
    attributes: { "data-roles": "owner,admin,manager,cashier" },
  });
  const allowedRole = ["owner", "admin", "manager", "cashier"].includes(profile?.role);
  // Match firestore.rules: restaurant-only tenants have no retail_pos heldBills access.
  // Legacy tenants with no businessType retain both business units.
  const retailHeldEnabled = tenant?.businessType !== "restaurant_cafe";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [menus, setMenus] = useState([]);
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [storeSettings, setStoreSettings] = useState({});
  const [heldBills, setHeldBills] = useState([]);
  const [serviceType, setServiceTypeState] = useState("dine_in");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [tableCode, setTableCode] = useState("");
  const [category, setCategory] = useState("__all__");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState({});
  const [noteOpen, setNoteOpen] = useState({});
  const [orderNote, setOrderNote] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [cashOpen, setCashOpen] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [cashReplaceNext, setCashReplaceNext] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [heldSearch, setHeldSearch] = useState("");
  const [heldSort, setHeldSort] = useState("newest");
  const [busy, setBusy] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null);
  const pendingOrderId = useRef("");
  const pendingSignature = useRef("");
  const displayTimer = useRef(null);
  const displaySignature = useRef("");
  const heldDialogRef = useRef(null);
  const cashDialogRef = useRef(null);
  const resultDialogRef = useRef(null);

  const money = value => formatNumber(moneyNumber(value), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatTime = value => {
    const millis = heldMillis(value);
    if (!millis) return "-";
    return formatI18nDate(new Date(millis), {
      calendar: "gregory",
      timeZone: "Asia/Bangkok",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }) || "-";
  };
  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const summary = useMemo(() => ({
    qty: cartItems.reduce((sum, item) => sum + Number(item.qty || 0), 0),
    total: moneyNumber(cartItems.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0), 0)),
  }), [cartItems]);

  const occupiedWalkInCodes = useMemo(() => new Set(
    orders.filter(order => order.orderType === "walkin"
      && order.serviceType === "dine_in"
      && !["paid", "cancelled", "completed"].includes(String(order.status || ""))
      && order.tableCode)
      .map(order => String(order.tableCode).toUpperCase()),
  ), [orders]);
  const availableTables = useMemo(() => tables.filter(table => {
    const code = String(table.code || table.id || "").toUpperCase();
    return activeTable(table) && !occupiedWalkInCodes.has(code);
  }), [tables, occupiedWalkInCodes]);

  const categories = useMemo(() => {
    const names = [];
    const seen = new Set();
    menus.filter(menu => menu.active !== false).forEach(menu => {
      const name = categoryKey(menu.category);
      if (!seen.has(name)) { seen.add(name); names.push(name); }
    });
    return names;
  }, [menus]);

  const bestSellerRank = useMemo(() => {
    const now = new Date();
    const stats = new Map();
    const activeMenus = new Map(
      menus.filter(menu => menu.active !== false).map(menu => [String(menu.id), menu]),
    );
    const menuIdByName = new Map(
      menus
        .filter(menu => menu.active !== false)
        .map(menu => [String(menu.name || "").trim().toLocaleLowerCase(), String(menu.id)]),
    );

    for (const order of orders) {
      const status = String(order?.status || "").toLowerCase();
      const paymentStatus = String(order?.paymentStatus || "").toLowerCase();
      if (["cancelled", "voided", "deleted"].includes(status)) continue;
      if (paymentStatus !== "paid" && status !== "paid") continue;
      const soldAt = order?.paidAt || order?.paymentReceivedAt || order?.completedAt || order?.createdAt;
      if (!sameLocalMonth(soldAt, now)) continue;

      for (const item of Array.isArray(order?.items) ? order.items : []) {
        if (item?.cancelled === true) continue;
        let menuId = String(item?.menuId || item?.id || "").trim();
        if (!activeMenus.has(menuId)) {
          menuId = menuIdByName.get(String(item?.name || "").trim().toLocaleLowerCase()) || "";
        }
        if (!menuId || !activeMenus.has(menuId)) continue;
        const qty = Math.max(0, Number(item?.qty || item?.quantity || 0));
        if (!Number.isFinite(qty) || qty <= 0) continue;
        const revenue = qty * Math.max(0, Number(item?.price || activeMenus.get(menuId)?.price || 0));
        const current = stats.get(menuId) || { qty: 0, revenue: 0 };
        current.qty += qty;
        current.revenue += Number.isFinite(revenue) ? revenue : 0;
        stats.set(menuId, current);
      }
    }

    return new Map(
      [...stats.entries()]
        .sort((a, b) =>
          b[1].qty - a[1].qty
          || b[1].revenue - a[1].revenue
          || String(activeMenus.get(a[0])?.name || "").localeCompare(String(activeMenus.get(b[0])?.name || "")),
        )
        .slice(0, BEST_SELLER_LIMIT)
        .map(([id], index) => [String(id), index]),
    );
  }, [menus, orders]);

  const visibleMenus = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase();
    const rows = menus.filter(menu => {
      if (menu.active === false) return false;
      if (category === "__best__" && !bestSellerRank.has(String(menu.id))) return false;
      if (!["__all__", "__best__"].includes(category) && categoryKey(menu.category) !== category) return false;
      if (!keyword) return true;
      return [menu.name, menu.category].join(" ").toLocaleLowerCase().includes(keyword);
    });
    if (category === "__best__") {
      rows.sort((a, b) => (bestSellerRank.get(String(a.id)) ?? 9999) - (bestSellerRank.get(String(b.id)) ?? 9999));
    }
    return rows;
  }, [menus, category, search, bestSellerRank]);

  useEffect(() => {
    if (!tenant?.id || !allowedRole) return undefined;
    let alive = true;
    let stopMenus = () => {};
    let stopOrders = () => {};
    let stopTables = () => {};
    setLoading(true);
    setLoadError("");
    setHeldBills([]);
    setServiceTypeState(readServicePreference(tenant.id));

    loadOperationalSnapshot(tenant.id)
      .then(snapshot => {
        if (!alive) return;
        const settings = snapshot.settings || {};
        setMenus(snapshot.menus || []);
        setTables(snapshot.tables || []);
        setOrders(snapshot.orders || []);
        setStoreSettings(settings);
        setHeldBills(snapshot.heldBills || []);
        setLoading(false);

        stopMenus = watchOperationalMenus(
          tenant.id,
          settings.categoryOrder || [],
          rows => { if (alive) setMenus(rows || []); },
          error => console.warn("QUICK_ORDER_MENU_WATCH_FAILED", error),
        );
        stopOrders = watchOperationalOrders(
          tenant.id,
          rows => { if (alive) setOrders(rows || []); },
          error => console.warn("QUICK_ORDER_ORDER_WATCH_FAILED", error),
        );
        stopTables = watchOperationalTables(
          tenant.id,
          rows => { if (alive) setTables(rows || []); },
          error => console.warn("QUICK_ORDER_TABLE_WATCH_FAILED", error),
        );
      })
      .catch(error => {
        console.error("QUICK_ORDER_INITIAL_LOAD_FAILED", error);
        if (!alive) return;
        setLoadError(t("quick_order.loading.failed"));
        setLoading(false);
      });

    const stopHeld = retailHeldEnabled
      ? watchQuickOrderHeldBills(
          tenant.id,
          rows => { if (alive) setHeldBills(rows); },
          error => console.error("QUICK_ORDER_HELD_WATCH_FAILED", error),
        )
      : () => {};

    return () => {
      alive = false;
      stopMenus?.();
      stopOrders?.();
      stopTables?.();
      stopHeld?.();
    };
  }, [tenant?.id, retailHeldEnabled, allowedRole, t]);

  const setServiceType = (value, remember = true) => {
    const next = value === "takeaway" ? "takeaway" : "dine_in";
    setServiceTypeState(next);
    if (next === "takeaway") setTableCode("");
    if (remember && tenant?.id) {
      try { localStorage.setItem(servicePreferenceKey(tenant.id), next); } catch {}
    }
  };

  const patchCart = (id, updater) => {
    setCart(current => {
      const next = { ...current };
      const existing = next[id];
      const value = updater(existing);
      if (!value || Number(value.qty || 0) <= 0) delete next[id];
      else next[id] = value;
      return next;
    });
  };
  const addMenu = menu => {
    if (!menu || menu.active === false) return;
    patchCart(menu.id, existing => existing
      ? { ...existing, qty: Number(existing.qty || 0) + 1 }
      : { id: menu.id, name: menu.name, price: Number(menu.price || 0), qty: 1, note: "" });
  };
  const updateQty = (id, delta) => patchCart(id, item => item ? { ...item, qty: Number(item.qty || 0) + delta } : null);
  const setItemNote = (id, value) => patchCart(id, item => item ? { ...item, note: String(value || "").slice(0, 300) } : null);

  const resetDraft = () => {
    setCart({});
    setNoteOpen({});
    setOrderNote("");
    setTableCode("");
    setCashReceived("");
    setCashReplaceNext(false);
    setPaymentMethod("cash");
    pendingOrderId.current = "";
    pendingSignature.current = "";
  };

  const displayParams = new URLSearchParams(location.search);
  const pairedDisplayId = displayParams.get("displayId") || displayParams.get("registerId") || "";
  // A cashier opening the QR pairing link must write to the *same* display,
  // even if the cashier uses a different authenticated staff account.
  const displayId = /^quick-order-[A-Za-z0-9_-]{1,128}$/.test(pairedDisplayId)
    ? pairedDisplayId : safeDisplayId(profile?.uid || profile?.id || "main");
  const customerDisplayLink = `/cashier/customer-display?displayId=${encodeURIComponent(displayId)}`;

  useEffect(() => {
    if (!tenant?.id || !allowedRole) return undefined;
    window.clearTimeout(displayTimer.current);
    displayTimer.current = window.setTimeout(async () => {
      const now = Date.now();
      const items = cartItems.map((item, index) => {
        const unit = t("quick_order.payment.amount", { amount: money(item.price || 0) });
        const itemNote = String(item.note || "").trim();
        return {
          id: String(item.id), name: String(item.name || ""),
          meta: itemNote ? `${unit} • ${itemNote}` : unit,
          qty: Number(item.qty || 0), total: Number(item.price || 0) * Number(item.qty || 0),
          sortIndex: index, touchedAt: now + index,
        };
      });
      let paymentQr = null;
      if (paymentMethod === "promptpay" && summary.total > 0) {
        const promptPayId = String(storeSettings.promptPayId || "").trim();
        const accountName = String(storeSettings.promptPayName || storeSettings.promptPayAccountName || storeSettings.bankAccountName || storeSettings.shopName || tenant.name || "").trim();
        const base = {
          method: "promptpay", amount: summary.total, shopName: storeSettings.shopName || tenant.name || "",
          accountName, sourceOrigin: location.origin, tenantId: tenant.id, registerId: displayId,
          displayId, verified: false, updatedAt: now,
        };
        try {
          paymentQr = promptPayId
            ? { ...base, payload: generatePromptPayPayload(promptPayId, summary.total), verified: true }
            : { ...base, error: t("quick_order.payment.promptpay_not_configured") };
        } catch {
          paymentQr = { ...base, error: t("quick_order.payment.promptpay_invalid") };
        }
      }
      const snapshot = {
        id: displayId, tenantId: tenant.id, registerId: displayId, registerName: t("quick_order.header.title"),
        displayId, sessionId: `quick-order-session-${profile?.uid || "main"}`,
        status: items.length ? "editing" : "idle", customerName: "", customerDisplayName: "",
        customerPhone: "", customerDisplayPhone: "", itemCount: summary.qty, items,
        subtotal: summary.total, discount: 0, vatMode: "none", beforeVat: summary.total,
        vatAmount: 0, total: summary.total, paymentQr, updatedAt: now,
      };
      const signature = JSON.stringify({ items: items.map(({ id, name, meta, qty, total }) => ({ id, name, meta, qty, total })), total: summary.total, paymentQr });
      if (signature === displaySignature.current) return;
      displaySignature.current = signature;
      try { localStorage.setItem(`retail_pos_customer_display_${displayId}`, JSON.stringify(snapshot)); } catch {}
      try { await updateCustomerDisplay(tenant.id, displayId, snapshot); }
      catch (error) { displaySignature.current = ""; console.warn("QUICK_ORDER_CUSTOMER_DISPLAY_SYNC_FAILED", error); }
    }, 160);
    return () => window.clearTimeout(displayTimer.current);
  }, [tenant?.id, tenant?.name, profile?.uid, allowedRole, cartItems, summary.qty, summary.total, paymentMethod, storeSettings, t]);

  const cashValue = () => {
    const value = Number(String(cashReceived || "").trim());
    return Number.isFinite(value) && value >= 0 ? moneyNumber(value) : null;
  };
  const cashState = useMemo(() => {
    const received = cashValue();
    const sufficient = received !== null && received + .00001 >= summary.total;
    return {
      received, sufficient,
      change: sufficient ? moneyNumber(received - summary.total) : 0,
      shortfall: received === null ? summary.total : Math.max(0, moneyNumber(summary.total - received)),
    };
  }, [cashReceived, summary.total]);
  const cleanCash = value => {
    let text = String(value || "").replace(/[^0-9.]/g, "");
    const dot = text.indexOf(".");
    if (dot >= 0) text = text.slice(0, dot + 1) + text.slice(dot + 1).replace(/\./g, "").slice(0, 2);
    return text;
  };
  const appendCash = value => {
    let current = cashReplaceNext ? "" : String(cashReceived || "");
    setCashReplaceNext(false);
    if (value === ".") {
      if (current.includes(".")) return;
      current = current ? `${current}.` : "0.";
    } else current += value;
    setCashReceived(cleanCash(current));
  };
  const cashAction = action => {
    if (action === "exact") {
      setCashReceived(summary.total.toFixed(2));
      setCashReplaceNext(true);
    } else if (action === "clear") {
      setCashReceived("");
      setCashReplaceNext(false);
    } else if (action === "back") {
      setCashReceived(current => cleanCash(String(current || "").slice(0, -1)));
      setCashReplaceNext(false);
    }
  };

  const promptPayQr = useMemo(() => {
    if (paymentMethod !== "promptpay" || summary.total <= 0) return { src: "", error: "" };
    const id = String(storeSettings.promptPayId || "").trim();
    if (!id) return { src: "", error: t("quick_order.payment.promptpay_not_configured") };
    try {
      return { src: qrDataUrl(generatePromptPayPayload(id, summary.total), { size: 320, margin: 4 }), error: "" };
    } catch {
      return { src: "", error: t("quick_order.payment.promptpay_invalid") };
    }
  }, [paymentMethod, summary.total, storeSettings.promptPayId, t]);

  const holdCurrentBill = async () => {
    if (!summary.qty || busy) {
      if (!summary.qty) showToast(t("quick_order.errors.no_items"), "error");
      return;
    }
    setBusy(true);
    try {
      await saveQuickOrderHeldBill(tenant.id, {
        id: `held-${crypto.randomUUID()}`,
        createdAt: new Date().toISOString(),
        context: {
          serviceType, paymentMethod,
          tableCode: serviceType === "dine_in" ? tableCode : "",
          customerName: "",
          note: orderNote.trim(),
        },
        createdByName: String(profile?.displayName || profile?.email || "").trim(),
        items: cartItems.map(item => ({
          id: item.id, menuId: item.id, name: item.name, price: item.price,
          qty: Number(item.qty || 0), note: item.note || "",
        })),
        total: summary.total,
      });
      resetDraft();
      setCartOpen(false);
      showToast(t("quick_order.held.held"));
    } catch (error) {
      console.error("QUICK_ORDER_HOLD_FAILED", error);
      showToast(t("quick_order.held.storage_error"), "error");
    } finally { setBusy(false); }
  };

  const normalizeHeld = row => ({
    ...row,
    serviceType: row.context?.serviceType || row.serviceType || "dine_in",
    paymentMethod: row.context?.paymentMethod || row.paymentMethod || "cash",
    tableCode: row.context?.tableCode || row.tableCode || "",
    customerName: row.context?.customerName || row.customerName || "",
    note: row.context?.note || row.note || "",
    items: Array.isArray(row.items) ? row.items : [],
  });

  const restoreHeld = async raw => {
    const row = normalizeHeld(raw);
    if (busy) return;
    if (summary.qty > 0) {
      // Match Laravel MASTER: native <dialog> is in the browser top layer,
      // so close it synchronously before opening the shared confirmation.
      const heldDialog = heldDialogRef.current;
      setHeldOpen(false);
      if (heldDialog?.open) heldDialog.close();
      await new Promise(resolve => requestAnimationFrame(resolve));

      const ok = await sweetConfirm(t("quick_order.held.replace_message"), {
        title: t("quick_order.held.replace_title"),
        confirmText: t("quick_order.held.restore"),
        cancelText: t("quick_order.actions.close_cart"),
        type: "warning",
      });
      if (!ok) {
        setHeldOpen(true);
        return;
      }
    }
    let adjusted = false;
    const next = {};
    for (const saved of row.items) {
      const id = String(saved.menuId || saved.id || "");
      const menu = menus.find(item => String(item.id) === id);
      if (!menu || menu.active === false) { adjusted = true; continue; }
      if (Number(menu.price || 0) !== Number(saved.price || 0) || String(menu.name || "") !== String(saved.name || "")) adjusted = true;
      next[id] = {
        id, name: menu.name, price: Number(menu.price || 0),
        qty: Math.max(1, Number(saved.qty || 1)), note: String(saved.note || ""),
      };
    }
    if (!Object.keys(next).length) {
      setHeldOpen(true);
      showToast(t("quick_order.held.no_available_items"), "error");
      return;
    }
    let restoredTable = "";
    if (row.serviceType === "dine_in" && row.tableCode) {
      const found = availableTables.find(table => String(table.code || table.id) === String(row.tableCode));
      if (found) restoredTable = String(row.tableCode);
      else adjusted = true;
    }
    setBusy(true);
    try {
      await releaseQuickOrderHeldBill(tenant.id, row.id, "resume");
      setCart(next);
      setNoteOpen({});
      setServiceType(row.serviceType, false);
      setPaymentMethod(row.paymentMethod === "promptpay" ? "promptpay" : "cash");
      setOrderNote(String(row.note || ""));
      setTableCode(restoredTable);
      setCashReceived("");
      setHeldOpen(false);
      showToast(t(adjusted ? "quick_order.held.restored_adjusted" : "quick_order.held.restored"));
    } catch (error) {
      console.error("QUICK_ORDER_RESTORE_HELD_FAILED", error);
      setHeldOpen(true);
      showToast(t(error?.code === "HELD_BILL_ALREADY_RELEASED" ? "quick_order.held.already_released" : "quick_order.held.storage_error"), "error");
    } finally { setBusy(false); }
  };

  const deleteHeld = async row => {
    if (busy) return;
    setBusy(true);
    try {
      await releaseQuickOrderHeldBill(tenant.id, row.id, "delete");
      showToast(t("quick_order.held.deleted"));
    } catch (error) {
      console.error("QUICK_ORDER_DELETE_HELD_FAILED", error);
      showToast(t(error?.code === "HELD_BILL_ALREADY_RELEASED" ? "quick_order.held.already_released" : "quick_order.held.storage_error"), "error");
    } finally { setBusy(false); }
  };

  const draftPayload = state => ({
    serviceType,
    paymentMethod,
    cashReceived: paymentMethod === "cash" ? state.received : null,
    tableCode: serviceType === "dine_in" ? tableCode : "",
    note: orderNote.trim(),
    items: cartItems.map(item => ({ menuId: item.id, qty: Number(item.qty || 0), note: item.note || "" })),
  });
  const transientError = error => ["RESOURCE_EXHAUSTED", "UNAVAILABLE", "INTERNAL", "DEADLINE_EXCEEDED"].includes(String(error?.code || ""));
  const recoverOrder = async id => {
    const existing = await getOperationalOrder(tenant.id, id);
    return existing && String(existing.orderType || "").toLowerCase() === "walkin" ? existing : null;
  };
  const createSafely = async payload => {
    const delays = [0, 900, 2200, 5000, 10000];
    let lastError = null;
    let retryToast = false;
    for (const delay of delays) {
      if (delay) await new Promise(resolve => window.setTimeout(resolve, delay));
      try {
        const result = await createWalkInOrder(tenant.id, payload);
        return result?.item || result;
      } catch (error) {
        lastError = error;
        if (error?.code === "ORDER_ALREADY_EXISTS") {
          try {
            const existing = await recoverOrder(payload.id);
            if (existing) return existing;
          } catch (recoveryError) { lastError = recoveryError; }
        }
        const retryable = error?.code === "ORDER_ALREADY_EXISTS" || transientError(lastError);
        if (!retryable || delay === delays.at(-1)) break;
        if (!retryToast) { retryToast = true; showToast(t("quick_order.toast.retrying")); }
      }
    }
    try {
      const existing = await recoverOrder(payload.id);
      if (existing) return existing;
    } catch {}
    throw lastError || new Error("WALK_IN_ORDER_CREATE_FAILED");
  };

  const submitOrder = async ({ cashConfirmed = false } = {}) => {
    if (!summary.qty || busy) {
      if (!summary.qty) showToast(t("quick_order.errors.no_items"), "error");
      return;
    }
    if (paymentMethod === "cash" && !cashConfirmed) {
      setCashReceived(summary.total.toFixed(2));
      setCashReplaceNext(true);
      setCashOpen(true);
      return;
    }
    if (paymentMethod === "cash" && cashState.received === null) {
      showToast(t("quick_order.payment.cash_required"), "error");
      return;
    }
    if (paymentMethod === "cash" && !cashState.sufficient) {
      showToast(t("quick_order.payment.insufficient_cash", { amount: money(cashState.shortfall) }), "error");
      return;
    }
    if (paymentMethod !== "cash") {
      const ok = await sweetConfirm(t("quick_order.confirm.promptpay_message", { amount: money(summary.total) }), {
        title: t("quick_order.confirm.title"),
        confirmText: t("quick_order.actions.submit"),
        cancelText: t("quick_order.actions.close_cart"),
        type: "warning",
      });
      if (!ok) return;
    }

    const payload = draftPayload(cashState);
    const signature = JSON.stringify(payload);
    setBusy(true);
    try {
      if (pendingOrderId.current && pendingSignature.current && pendingSignature.current !== signature) {
        const previous = await recoverOrder(pendingOrderId.current);
        if (previous) {
          pendingOrderId.current = "";
          pendingSignature.current = "";
          setCashOpen(false);
          setPaymentResult(previous);
          showToast(t("quick_order.toast.recovered", { queue: previous.queueNo || "-" }));
          return;
        }
        pendingOrderId.current = "";
        pendingSignature.current = "";
      }
      if (!pendingOrderId.current) {
        pendingOrderId.current = `walkin-${crypto.randomUUID()}`;
        pendingSignature.current = signature;
      }
      const order = await createSafely({ id: pendingOrderId.current, ...payload });
      setCashOpen(false);
      resetDraft();
      setCartOpen(false);
      setPaymentResult(order);
      showToast(t("quick_order.toast.created", { queue: order?.queueNo || "-" }));
    } catch (error) {
      console.error("QUICK_ORDER_CREATE_FAILED", error);
      const code = String(error?.code || "");
      if (code === "TABLE_NOT_AVAILABLE") {
        pendingOrderId.current = "";
        pendingSignature.current = "";
        setTableCode("");
        showToast(t("quick_order.table.unavailable_error"), "error");
      } else if (["CASH_RECEIVED_REQUIRED", "CASH_RECEIVED_INVALID"].includes(code)) {
        pendingOrderId.current = "";
        pendingSignature.current = "";
        showToast(t("quick_order.payment.cash_required"), "error");
      } else if (code === "CASH_RECEIVED_INSUFFICIENT") {
        pendingOrderId.current = "";
        pendingSignature.current = "";
        showToast(t("quick_order.payment.cash_server_insufficient"), "error");
      } else if (["MENU_NOT_FOUND", "MENU_NOT_AVAILABLE"].includes(code)) {
        pendingOrderId.current = "";
        pendingSignature.current = "";
        showToast(t("quick_order.toast.menu_changed"), "error");
      } else if (transientError(error)) {
        showToast(t("quick_order.toast.temporarily_busy"), "error");
      } else {
        pendingOrderId.current = "";
        pendingSignature.current = "";
        showToast(t("quick_order.toast.create_failed"), "error");
      }
    } finally { setBusy(false); }
  };

  const printCompletedReceipt = () => {
    const id = String(paymentResult?.id || "").trim();
    if (!id) { setPaymentResult(null); return; }
    const url = cashierRoute(`/receipt/?order=${encodeURIComponent(id)}&autoprint=1&closeafterprint=quick-order`);
    const receiptWindow = window.open("", "_blank");
    if (receiptWindow) {
      receiptWindow.opener = null;
      receiptWindow.location.replace(url);
    } else location.assign(url);
    setPaymentResult(null);
  };

  useEffect(() => {
    const dialog = heldDialogRef.current;
    if (!dialog) return;
    if (heldOpen && !dialog.open) dialog.showModal?.();
    if (!heldOpen && dialog.open) dialog.close?.();
  }, [heldOpen]);
  useEffect(() => {
    const dialog = cashDialogRef.current;
    if (!dialog) return;
    if (cashOpen && !dialog.open) {
      dialog.showModal?.();
      requestAnimationFrame(() => dialog.querySelector("#quickCashReceived")?.focus({ preventScroll: true }));
    }
    if (!cashOpen && dialog.open) dialog.close?.();
  }, [cashOpen]);
  useEffect(() => {
    const dialog = resultDialogRef.current;
    if (!dialog) return;
    if (paymentResult && !dialog.open) dialog.showModal?.();
    if (!paymentResult && dialog.open) dialog.close?.();
  }, [paymentResult]);

  const filteredHeld = useMemo(() => {
    const keyword = heldSearch.trim().toLocaleLowerCase();
    const rows = heldBills.map(normalizeHeld).filter(row => {
      if (!keyword) return true;
      return [row.id, row.note, row.tableCode, ...(row.items || []).map(item => item.name || item.menuId || item.id)]
        .join(" ").toLocaleLowerCase().includes(keyword);
    });
    rows.sort((a, b) => {
      if (heldSort === "oldest") return heldMillis(a.createdAt) - heldMillis(b.createdAt);
      if (heldSort === "amount") return Number(b.total || 0) - Number(a.total || 0);
      return heldMillis(b.createdAt) - heldMillis(a.createdAt);
    });
    return rows;
  }, [heldBills, heldSearch, heldSort]);

  if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady || (allowedRole && loading)) {
    return <PageReadyOverlay context={t("quick_order.header.title")} title={t("quick_order.loading.title")} message={t("quick_order.loading.preparing")} />;
  }
  if (!profile) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (!allowedRole) return <Navigate to="/" replace />;
  if (tenantState.status === "error" || !tenant) return <Navigate to="/" replace />;

  const storeName = String(storeSettings.shopName || storeSettings.storeName || tenant.name || t("quick_order.hero.title")).trim();
  const receiver = String(storeSettings.promptPayName || storeSettings.promptPayAccountName || storeSettings.bankAccountName || storeName).trim();

  return (
    <>
      <header className="app-header">
        <div className="quick-header-left">
          <div className="brand"><span className="brand-mark">PG</span>{t("quick_order.header.title")}</div>
          <Link className="btn quick-header-back" to="/cashier" aria-label={t("quick_order.actions.back_cashier")} title={t("quick_order.actions.back_cashier")}><i className="bi bi-arrow-left app-icon" aria-hidden="true"></i><span>{t("quick_order.actions.back_cashier")}</span></Link>
        </div>
        <div className="app-header-actions" data-header-actions>
          <a className="btn quick-customer-display-link" id="quickCustomerDisplayLink" href={customerDisplayLink} target="_blank" rel="noopener noreferrer" title={t("quick_order.customer_display.open")} aria-label={t("quick_order.customer_display.open")}><i className="bi bi-display" aria-hidden="true"></i></a>
          <LocaleSwitcher style={{ marginLeft: 0, marginRight: 0 }} />
          <UserMenu profile={profile} />
        </div>
      </header>

      <div id="demoBanner"></div>
      <main className="container quick-order-shell">
        <section className="hero quick-order-hero store-branded-hero" style={brandedHeroStyle(storeSettings)}>
          <div>
            <h1 className="hero-title"><StoreBrandMark settings={storeSettings} /><span id="quickStoreName">{storeName}</span></h1>
            <p>{t("quick_order.hero.description")}</p>
          </div>
        </section>
        {loadError ? <div className="upload-error" role="alert">{loadError}</div> : null}

        <section className="card quick-order-settings">
          <div className="quick-order-setting-block">
            <span className="quick-order-setting-label">{t("quick_order.service.title")}</span>
            <div className="quick-segment" id="quickServiceType">
              <button type="button" className={serviceType === "dine_in" ? "active" : ""} data-service-type="dine_in" onClick={() => setServiceType("dine_in")}><i className="bi bi-shop" aria-hidden="true"></i><span>{t("quick_order.service.dine_in")}</span></button>
              <button type="button" className={serviceType === "takeaway" ? "active" : ""} data-service-type="takeaway" onClick={() => setServiceType("takeaway")}><img className="quick-service-icon app-icon" src="/assets/vendor/bootstrap-icons/icons/bag.svg" alt="" aria-hidden="true" /><span>{t("quick_order.service.takeaway")}</span></button>
            </div>
            <small className="quick-service-default-help"><i className="bi bi-pin-angle" aria-hidden="true"></i><span>{t("quick_order.service.default_help")}</span></small>
          </div>
          <label
            className="field quick-table-field"
            id="quickTableField"
            hidden={serviceType !== "dine_in"}
            style={serviceType !== "dine_in" ? { display: "none" } : undefined}
          >
            <span>{t("quick_order.table.label")}</span>
            <select
              className="input"
              id="quickTableSelect"
              value={serviceType === "dine_in" ? tableCode : ""}
              disabled={serviceType !== "dine_in"}
              onChange={e => setTableCode(e.target.value)}
            >
              <option value="">{t("quick_order.table.select_placeholder")}</option>
              {availableTables.map(table => <option key={table.id} value={table.code || table.id}>{table.name || table.code || table.id}</option>)}
            </select>
            <small>{t("quick_order.table.optional_help")}</small>
          </label>
        </section>

        <div className="quick-order-workspace">
          <section className="quick-menu-panel">
            <div className="quick-menu-toolbar">
              <div className="category-tabs" id="quickCategoryTabs">
                <button type="button" className={category === "__all__" ? "active" : ""} data-category="__all__" onClick={() => setCategory("__all__")}>{t("quick_order.categories.all")}</button>
                <button type="button" className={category === "__best__" ? "active" : ""} data-category="__best__" onClick={() => setCategory("__best__")}><i className="bi bi-fire" aria-hidden="true"></i>{t("quick_order.categories.best_sellers")}</button>
                {categories.map(name => <button type="button" className={category === name ? "active" : ""} data-category={name} key={name} onClick={() => setCategory(name)}>{name}</button>)}
              </div>
              <label className="quick-search"><i className="bi bi-search" aria-hidden="true"></i><input id="quickMenuSearch" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("quick_order.search.placeholder")} /></label>
            </div>
            <div className="quick-menu-status" id="quickMenuStatus" hidden></div>
            <div className="quick-menu-grid" id="quickMenuGrid">
              {visibleMenus.length ? visibleMenus.map(menu => {
                const imageX = Math.max(0, Math.min(100, Number(menu.imagePositionX ?? 50)));
                const imageY = Math.max(0, Math.min(100, Number(menu.imagePositionY ?? 50)));
                const addLabel = t("quick_order.menu.add_named", { name: menu.name || "" });
                return (
                  <article className="quick-menu-card" key={menu.id}>
                    <button
                      type="button"
                      className="quick-menu-image"
                      data-add-menu={menu.id}
                      aria-label={addLabel}
                      title={addLabel}
                      onClick={() => addMenu(menu)}
                    >
                      <img
                        src={String(menu.image || "").trim() || "/assets/images/default-food.svg"}
                        alt=""
                        loading="lazy"
                        data-menu-image
                        style={{ objectPosition: `${imageX}% ${imageY}%` }}
                      />
                      <span className="quick-menu-info-overlay" aria-hidden="true">
                        <span className="quick-menu-copy">
                          <strong className="quick-menu-name">{menu.name || ""}</strong>
                          <small className="quick-menu-category">{categoryKey(menu.category)}</small>
                        </span>
                        <span className="quick-menu-price-badge">{money(menu.price || 0)}</span>
                      </span>
                    </button>
                  </article>
                );
              }) : <div className="card empty">{t(category === "__best__" ? "quick_order.menu.best_sellers_empty" : "quick_order.menu.empty")}</div>}
            </div>
          </section>

          <aside className={`quick-cart-panel${cartOpen ? " is-open" : ""}`} id="quickCartPanel" aria-label={t("quick_order.cart.title")}>
            <div className="quick-cart-head">
              <div><h2>{t("quick_order.cart.title")}</h2><span id="quickCartCount">{t("quick_order.cart.items", { count: summary.qty })}</span></div>
              <div className="quick-cart-head-actions">
                <button type="button" className="quick-clear-cart" id="quickClearCart" hidden={!summary.qty} onClick={() => { setCart({}); setNoteOpen({}); }}>{t("quick_order.cart.clear")}</button>
                <button className="btn btn-sm quick-cart-close" id="quickCartClose" type="button" aria-label={t("quick_order.actions.close_cart")} onClick={() => setCartOpen(false)}><i className="bi bi-x-lg" aria-hidden="true"></i></button>
              </div>
            </div>

            <div id="quickCartList" className="quick-cart-list">
              {cartItems.length ? cartItems.map(item => {
                const open = noteOpen[item.id] === true;
                return <div className={`quick-cart-row${open ? " is-note-open" : ""}`} key={item.id}>
                  <div className="quick-cart-item-main">
                    <div className="quick-cart-copy"><div className="quick-cart-name">{item.name}</div><div className="quick-cart-meta">{t("quick_order.payment.amount", { amount: money(item.price) })}</div></div>
                    <div className="quick-qty">
                      <button type="button" data-dec-item={item.id} aria-label={t("quick_order.cart.decrease", { name: item.name || "" })} title={t("quick_order.cart.decrease_short")} onClick={() => updateQty(item.id, -1)}><i className="bi bi-dash-lg" aria-hidden="true"></i></button>
                      <strong>{item.qty}</strong>
                      <button type="button" data-inc-item={item.id} aria-label={t("quick_order.cart.increase", { name: item.name || "" })} title={t("quick_order.cart.increase_short")} onClick={() => updateQty(item.id, 1)}><i className="bi bi-plus-lg" aria-hidden="true"></i></button>
                      <button type="button" className="quick-remove-item" data-remove-item={item.id} aria-label={t("quick_order.cart.remove", { name: item.name || "" })} title={t("quick_order.cart.remove_short")} onClick={() => patchCart(item.id, () => null)}><i className="bi bi-trash3" aria-hidden="true"></i></button>
                    </div>
                  </div>
                  <div className="quick-line-total">{money(Number(item.price || 0) * Number(item.qty || 0))}</div>
                  <div className="quick-cart-note-row">
                    {open ? <div className="quick-cart-note-editor">
                      <input className="quick-cart-row-note" data-item-note={item.id} value={item.note || ""} maxLength="300" placeholder={t("quick_order.cart.item_note_placeholder")} onChange={e => setItemNote(item.id, e.target.value)} />
                      <button type="button" className="quick-cart-note-close" data-close-item-note={item.id} aria-label={t("quick_order.actions.close_cart")} onClick={() => setNoteOpen(current => ({ ...current, [item.id]: false }))}><i className="bi bi-check-lg" aria-hidden="true"></i></button>
                    </div> : <button type="button" className={`quick-cart-note-toggle${item.note ? " has-note" : ""}`} data-edit-item-note={item.id} title={item.note || t("quick_order.cart.note_add")} onClick={() => setNoteOpen(current => ({ ...current, [item.id]: true }))}>
                      <i className={`bi ${item.note ? "bi-pencil-square" : "bi-plus-circle"}`} aria-hidden="true"></i><span>{item.note || t("quick_order.cart.note_add")}</span>
                    </button>}
                  </div>
                </div>;
              }) : <div className="quick-cart-empty">{t("quick_order.cart.empty")}</div>}
            </div>

            <div className="quick-cart-checkout">
              <div className="quick-payment-section">
                <strong>{t("quick_order.payment.title")}</strong>
                <div className="quick-segment quick-payment-segment" id="quickPaymentMethod">
                  <button type="button" className={paymentMethod === "cash" ? "active" : ""} data-payment-method="cash" onClick={() => setPaymentMethod("cash")}><span>{t("quick_order.payment.cash")}</span></button>
                  <button type="button" className={paymentMethod === "promptpay" ? "active" : ""} data-payment-method="promptpay" onClick={() => setPaymentMethod("promptpay")}><span>{t("quick_order.payment.promptpay")}</span></button>
                </div>
                <div className="quick-promptpay" id="quickPromptPay" hidden={paymentMethod !== "promptpay"}>
                  <strong>{t("quick_order.payment.promptpay_title")}</strong>
                  <img id="quickPromptPayQr" src={promptPayQr.src || undefined} width="96" height="96" alt={t("quick_order.payment.promptpay_title")} hidden={!promptPayQr.src} />
                  <div className="quick-promptpay-placeholder" id="quickPromptPayPlaceholder">{promptPayQr.error}</div>
                  <div className="quick-promptpay-amount" id="quickPromptPayAmount">{t("quick_order.payment.amount", { amount: money(summary.total) })}</div>
                  <small id="quickPromptPayReceiver">{receiver ? t("quick_order.payment.receiver", { name: receiver }) : ""}</small>
                </div>
              </div>

              <label className="field quick-order-note-field"><span>{t("cashier.items.order_note_title")}</span><textarea className="input" id="quickOrderNote" rows="2" maxLength="500" value={orderNote} onChange={e => setOrderNote(e.target.value)} /></label>
              <div className="quick-cart-total"><span>{t("quick_order.cart.subtotal")}</span><strong id="quickCartTotal">{money(summary.total)}</strong></div>
              <div className="quick-cart-final-actions">
                {retailHeldEnabled ? <div className="quick-held-actions">
                  <button className="btn quick-hold-button" id="quickHoldBill" type="button" disabled={!summary.qty || busy} onClick={holdCurrentBill}><i className="bi bi-pause-circle app-icon" aria-hidden="true"></i><span>{t("quick_order.held.hold")}</span></button>
                  <button className="btn quick-held-list-button" id="quickHeldBillsButton" type="button" onClick={() => setHeldOpen(true)}><i className="bi bi-clock-history app-icon" aria-hidden="true"></i><span>{t("quick_order.held.open_list")}</span><strong className="quick-held-count" id="quickHeldCount">{heldBills.length}</strong></button>
                </div> : null}
                <button className="btn btn-primary quick-submit" id="quickSubmitOrder" type="button" disabled={!summary.qty || busy} onClick={() => submitOrder()}><span>{busy ? t("quick_order.actions.submitting") : t("quick_order.actions.submit")}</span></button>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <dialog className="quick-held-dialog" id="quickHeldBillsDialog" ref={heldDialogRef} onClose={() => setHeldOpen(false)}>
        <div className="quick-held-dialog-card">
          <div className="quick-held-dialog-head">
            <div><h2>{t("quick_order.held.title")}</h2><p>{t("quick_order.held.description")}</p></div>
            <button className="btn btn-sm" id="quickHeldBillsClose" type="button" aria-label={t("quick_order.actions.close_cart")} onClick={() => setHeldOpen(false)}><i className="bi bi-x-lg" aria-hidden="true"></i></button>
          </div>
          <div className="quick-held-toolbar">
            <label className="quick-held-search"><i className="bi bi-search" aria-hidden="true"></i><input className="input" id="quickHeldSearch" type="search" value={heldSearch} onChange={e => setHeldSearch(e.target.value)} placeholder={t("quick_order.held.search_placeholder")} /></label>
            <select className="input" id="quickHeldSort" aria-label={t("quick_order.held.title")} value={heldSort} onChange={e => setHeldSort(e.target.value)}>
              <option value="newest">{t("quick_order.held.sort_newest")}</option>
              <option value="oldest">{t("quick_order.held.sort_oldest")}</option>
              <option value="amount">{t("quick_order.held.sort_amount")}</option>
            </select>
          </div>
          <div className="quick-held-list" id="quickHeldBillsList">
            {filteredHeld.length ? filteredHeld.map(row => {
              const qty = (row.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
              const total = Number(row.total ?? row.totalAmount ?? 0);
              const service = t(row.serviceType === "takeaway" ? "quick_order.service.takeaway" : "quick_order.service.dine_in");
              const table = row.serviceType === "dine_in" && row.tableCode
                ? t("quick_order.cashier.table", { table: row.tableCode })
                : (row.serviceType === "dine_in" ? t("quick_order.cashier.table_unassigned") : "");
              const customer = String(row.customerName || "").trim();
              const creator = String(row.createdByName || "").trim();
              const billNo = String(row.id || "").replace(/^held-/, "").slice(0, 12);
              return <article className="quick-held-card" key={row.id}>
                <div className="quick-held-card-head">
                  <div>
                    <strong>{customer || service}</strong>
                    <small>{t("quick_order.held.bill_no", { id: billNo })} • {formatTime(row.createdAt || row.updatedAt)}</small>
                  </div>
                  <strong>{money(total)}</strong>
                </div>
                <div className="quick-held-meta">
                  <span>{service}</span>
                  {table ? <span>{table}</span> : null}
                  <span>{t("quick_order.cart.items", { count: qty })}</span>
                  {creator ? <span>{t("quick_order.held.held_by", { name: creator })}</span> : null}
                </div>
                <div className="quick-held-actions">
                  <button className="btn btn-primary btn-sm" type="button" data-held-open={row.id} disabled={busy} onClick={() => restoreHeld(row)}><i className="bi bi-arrow-return-left" aria-hidden="true"></i><span>{t("quick_order.held.restore")}</span></button>
                  <button className="btn btn-danger btn-sm" type="button" data-held-delete={row.id} disabled={busy} onClick={() => deleteHeld(row)}><i className="bi bi-trash" aria-hidden="true"></i><span>{t("quick_order.held.delete")}</span></button>
                </div>
              </article>;
            }) : <div className="quick-held-empty">{t("quick_order.held.empty")}</div>}
          </div>
        </div>
      </dialog>

      <dialog className="quick-cash-dialog" id="quickCashDialog" ref={cashDialogRef} onClose={() => setCashOpen(false)}>
        <div className="quick-cash-dialog-card">
          <div className="quick-cash-dialog-head">
            <div><h2>{t("quick_order.payment.title")}</h2><p>{t("quick_order.payment.cash_modal_help")}</p></div>
            <button className="btn btn-sm" id="quickCashDialogClose" type="button" aria-label={t("quick_order.payment.cancel")} onClick={() => setCashOpen(false)}><i className="bi bi-x-lg" aria-hidden="true"></i></button>
          </div>
          <div className="quick-cash-dialog-body">
            <div className="quick-cash-dialog-fields">
              <div className="quick-cash-total-card"><span>{t("quick_order.payment.total_due")}</span><strong id="quickCashDialogTotal">{money(summary.total)}</strong></div>
              <label className="field quick-cash-field"><span>{t("quick_order.payment.cash_received")}</span><input className="input" id="quickCashReceived" type="text" inputMode="decimal" autoComplete="off" placeholder="0.00" value={cashReceived} onChange={e => { setCashReceived(cleanCash(e.target.value)); setCashReplaceNext(false); }} /></label>
              <div className={`quick-cash-change${cashState.received !== null && !cashState.sufficient ? " is-insufficient" : ""}`} id="quickCashChangeWrap"><span>{t("quick_order.payment.change")}</span><strong id="quickCashChange">{cashState.sufficient ? money(cashState.change) : "-"}</strong></div>
              <small className="quick-cash-help" id="quickCashHelp">{cashState.received === null
                ? t("quick_order.payment.cash_help")
                : cashState.sufficient
                  ? t("quick_order.payment.change_ready", { amount: money(cashState.change) })
                  : t("quick_order.payment.insufficient_cash", { amount: money(cashState.shortfall) })}</small>
            </div>
            <section className="quick-number-pad" id="quickCashPad" aria-label={t("quick_order.payment.keypad_title")}>
              {["7","8","9","4","5","6","1","2","3","0","00","."].map(key => <button type="button" data-cash-key={key} key={key} onMouseDown={e => e.preventDefault()} onClick={() => appendCash(key)}>{key}</button>)}
              <button type="button" className="is-action" data-cash-action="exact" onClick={() => cashAction("exact")}>{t("quick_order.payment.exact_amount")}</button>
              <button type="button" className="is-danger" data-cash-action="clear" onClick={() => cashAction("clear")}>{t("quick_order.payment.clear")}</button>
              <button type="button" className="is-action" data-cash-action="back" aria-label={t("quick_order.payment.backspace")} title={t("quick_order.payment.backspace")} onClick={() => cashAction("back")}><i className="bi bi-backspace" aria-hidden="true"></i></button>
            </section>
          </div>
          <div className="quick-cash-dialog-actions">
            <button className="btn" id="quickCashCancel" type="button" onClick={() => setCashOpen(false)}><i className="bi bi-x-circle app-icon" aria-hidden="true"></i><span>{t("quick_order.payment.cancel")}</span></button>
            <button className="btn btn-primary" id="quickCashConfirm" type="button" disabled={busy || !cashState.sufficient} onClick={() => submitOrder({ cashConfirmed: true })}><i className="bi bi-cash-coin app-icon" aria-hidden="true"></i><span>{busy ? t("quick_order.actions.submitting") : t("quick_order.payment.confirm_cash")}</span></button>
          </div>
        </div>
      </dialog>

      <dialog className="quick-payment-result-dialog" id="quickPaymentResultDialog" ref={resultDialogRef} onClose={() => setPaymentResult(null)}>
        <div className="quick-payment-result-card">
          <div className="quick-payment-result-icon" aria-hidden="true"><i className="bi bi-check-circle-fill"></i></div>
          <div className="quick-payment-result-copy">
            <h2>{t("quick_order.payment.complete_title")}</h2>
            <p id="quickPaymentResultQueue">{paymentResult ? t("quick_order.payment.complete_queue", { queue: paymentResult.queueNo || "-" }) : ""}</p>
          </div>
          <div className="quick-payment-result-summary">
            <div><span>{t("quick_order.payment.order_total")}</span><strong id="quickPaymentResultTotal">{money(paymentResult?.totalAmount || 0)}</strong></div>
            <div id="quickPaymentResultCashRow" hidden={String(paymentResult?.paymentMethod || "").toLowerCase() !== "cash"}><span>{t("quick_order.payment.cash_received")}</span><strong id="quickPaymentResultCash">{money(paymentResult?.cashReceived || 0)}</strong></div>
            <div className="quick-payment-result-change" id="quickPaymentResultChangeRow" hidden={String(paymentResult?.paymentMethod || "").toLowerCase() !== "cash"}><span>{t("quick_order.payment.change")}</span><strong id="quickPaymentResultChange">{money(paymentResult?.changeAmount || 0)}</strong></div>
          </div>
          <div className="quick-payment-result-actions">
            <button className="btn" id="quickPaymentNoReceipt" type="button" onClick={() => setPaymentResult(null)}><i className="bi bi-plus-circle app-icon" aria-hidden="true"></i><span>{t("quick_order.payment.no_receipt_new_order")}</span></button>
            <button className="btn btn-primary" id="quickPaymentPrintReceipt" type="button" onClick={printCompletedReceipt}><i className="bi bi-printer app-icon" aria-hidden="true"></i><span>{t("quick_order.payment.print_receipt")}</span></button>
          </div>
        </div>
      </dialog>

      <div className={`quick-cart-backdrop${cartOpen ? " is-open" : ""}`} id="quickCartBackdrop" onClick={() => setCartOpen(false)}></div>
      <div className="quick-mobile-bar" id="quickMobileBar">
        <button type="button" id="quickOpenCart" onClick={() => setCartOpen(true)}>
          <span className="quick-mobile-cart-icon" aria-hidden="true"><i className="bi bi-cart3"></i></span>
          <span className="quick-mobile-cart-main">
            <span className="quick-mobile-cart-title">{t("quick_order.cart.title")}</span>
            <span className="quick-mobile-cart-meta" id="quickMobileMeta">{t("quick_order.cart.items", { count: summary.qty })} • {t("quick_order.payment.amount", { amount: money(summary.total) })}</span>
          </span>
          <span className="quick-mobile-cart-action">{t("quick_order.actions.open_cart")}</span>
        </button>
      </div>
      <ParityFooter />
    </>
  );
}
