import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canUseRetailPos, getRetailPosSession } from "@/auth/retailPosSession";
import { useAuth } from "@/auth/AuthProvider";
import { AppDeveloperPanel } from "@/components/AppDeveloperPanel";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { firstAllowedPosPage, getPosPermissions, PosNavigation } from "@/components/PosNavigation";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { sweetAlert } from "@/components/sweetDialog";
import {
  listPosPurchases,
  listPosSuppliers,
  receivePosPurchase,
  watchPosPurchases,
  watchPosSuppliers,
} from "@/data/retailPurchasingData";
import { listRetailProducts, watchRetailProducts } from "@/data/retailProductsData";
import { loadPosRoleSettings } from "@/data/retailPosSystemData";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { useTenant } from "@/tenant/TenantProvider";

const BUILTIN_POS_ROLES = new Set(["owner", "admin", "manager", "cashier", "stock", "kitchen"]);
const ROLE_SETTINGS_TIMEOUT_MS = 6000;
const INITIAL_DATA_TIMEOUT_MS = 10000;

const cachedPosRoles = () => {
  try {
    const rows = JSON.parse(localStorage.getItem("retail_pos_roles_v1") || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
};
const withTimeout = (promise, timeoutMs, code) => Promise.race([
  promise,
  new Promise((_, reject) => window.setTimeout(() => {
    const error = new Error(code);
    error.code = code;
    reject(error);
  }, timeoutMs)),
]);
const localDateKey = value => {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};
const createLine = input => ({
  id: crypto.randomUUID(),
  productId: "",
  qty: 1,
  unitCost: "",
  ...(input || {}),
});
const csvCell = value => `"${String(value ?? "").replace(/"/g, '""')}"`;

function hasPurchasePermission(profile, roleRows, permission) {
  if (!profile) return false;
  const roleId = String(profile.roleId || profile.role || "");
  if (roleId === "owner") return true;
  const roles = Array.isArray(roleRows) ? roleRows : [];
  const role = roles.find(item => String(item?.id || "") === roleId);
  const permissions = Array.isArray(role?.permissions) ? role.permissions : [];
  if (permissions.includes("*")) return true;
  if (permissions.includes(permission)) return true;
  const hasGranular = permissions.some(key => String(key).startsWith("pos.purchases."));
  if (hasGranular) return false;
  if (roleId === "admin" || roleId === "manager" || roleId === "stock") {
    return ["pos.purchases.create", "pos.purchases.view_cost"].includes(permission);
  }
  return false;
}

let zxingLoader = null;
function loadZxing() {
  if (globalThis.ZXing) return Promise.resolve(globalThis.ZXing);
  if (zxingLoader) return zxingLoader;
  zxingLoader = new Promise((resolve, reject) => {
    const old = document.querySelector('script[data-zxing="1"]');
    if (old) {
      old.addEventListener("load", () => resolve(globalThis.ZXing), { once: true });
      old.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.dataset.zxing = "1";
    script.src = "https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js";
    script.onload = () => globalThis.ZXing ? resolve(globalThis.ZXing) : reject(new Error("ZXing not available"));
    script.onerror = reject;
    document.head.appendChild(script);
  }).catch(error => {
    zxingLoader = null;
    throw error;
  });
  return zxingLoader;
}

export function PosPurchasesPage() {
  const authState = useAuth();
  const tenantState = useTenant();
  const { profile, user: authUser } = authState;
  const { tenant } = tenantState;
  const { t, formatNumber, formatDate } = useI18n();
  const tr = useCallback(
    (key, replacements = {}) => t(`pos_purchasing.purchases.${key}`, replacements),
    [t],
  );
  const scannerText = useCallback(
    (key, replacements = {}) => t(`pos_products.scanner.${key}`, replacements),
    [t],
  );

  const stylesReady = useParityPage({
    title: tr("meta.title"),
    bodyClass: "pos-purchases-page",
    attributes: { "data-module": "retail-pos-purchases" },
    disabledGlobalStyles: ["app.css", "icons.css", "shared-responsive.css"],
    styles: [
      "app-version-badge-runtime.css",
      "retail-pos-font-local.css",
      "pos-locale-switcher-placement.css",
      "retail-pos.css",
      "retail-purchases.css",
      "retail-purchases-report.css",
      "retail-purchases-visual-dashboard.css",
      "retail-barcode-scan-tools.css",
      "retail-pos-navigation.css",
      "sweet-dialog.css",
    ],
  });

  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [history, setHistory] = useState([]);
  const [initialReady, setInitialReady] = useState(false);
  const [roleRows, setRoleRows] = useState(() => cachedPosRoles());
  const [rolesReady, setRolesReady] = useState(() => {
    const session = getRetailPosSession();
    const roleId = String(session?.roleId || session?.role || "");
    return BUILTIN_POS_ROLES.has(roleId) || cachedPosRoles().length > 0;
  });

  const [supplierName, setSupplierName] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => localDateKey(new Date()));
  const [note, setNote] = useState("");
  const [lines, setLines] = useState(() => [createLine()]);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");
  const [scanStatus, setScanStatus] = useState(() => scannerText("preparing"));

  const scanDialogRef = useRef(null);
  const scanVideoRef = useRef(null);
  const scanStreamRef = useRef(null);
  const scanFrameRef = useRef(0);
  const scanDetectorRef = useRef(null);
  const zxingReaderRef = useRef(null);
  const zxingControlsRef = useRef(null);

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
  const pagePermissions = useMemo(
    () => getPosPermissions(posAccessProfile, roleRows),
    [posAccessProfile, roleRows],
  );
  const canView = pagePermissions.has("pos.purchases");
  const canCreate = hasPurchasePermission(posAccessProfile, roleRows, "pos.purchases.create");
  const canViewCost = hasPurchasePermission(posAccessProfile, roleRows, "pos.purchases.view_cost");

  const redirectTarget = useMemo(() => {
    if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady) return "";
    const requested = location.pathname + location.search;
    if (!profile) return "/pos/login/?next=" + encodeURIComponent(requested);
    if (!canUseRetailPos(posAccessProfile) || tenantState.status === "error" || !tenant) return "/";
    if (!rolesReady) return "";
    if (!canView) {
      const first = firstAllowedPosPage(posAccessProfile, roleRows);
      return first === "/pos/forbidden"
        ? "/pos/forbidden/?permission=pos.purchases&next=" + encodeURIComponent(requested)
        : first + "?from=permission";
    }
    return "";
  }, [
    authState.status,
    tenantState.status,
    tenant,
    profile,
    posAccessProfile,
    roleRows,
    rolesReady,
    canView,
    stylesReady,
  ]);
  useEffect(() => {
    if (redirectTarget) location.replace(redirectTarget);
  }, [redirectTarget]);

  useEffect(() => {
    let alive = true;
    if (!tenant?.id || !profile) {
      setRoleRows([]);
      setRolesReady(true);
      return () => { alive = false; };
    }
    const cached = cachedPosRoles();
    const roleId = String(posAccessProfile?.roleId || posAccessProfile?.role || "");
    if (cached.length) setRoleRows(cached);
    setRolesReady(BUILTIN_POS_ROLES.has(roleId) || cached.length > 0);
    withTimeout(
      loadPosRoleSettings(tenant.id),
      ROLE_SETTINGS_TIMEOUT_MS,
      "POS_ROLE_SETTINGS_TIMEOUT",
    ).then(nextRoles => {
      if (!alive) return;
      const normalized = Array.isArray(nextRoles) ? nextRoles : [];
      setRoleRows(normalized);
      try { localStorage.setItem("retail_pos_roles_v1", JSON.stringify(normalized)); } catch {}
    }).catch(loadError => {
      console.warn("POS_PURCHASES_ROLE_SETTINGS_LOAD_FAILED", loadError);
      if (!alive) return;
      if (!cached.length && !BUILTIN_POS_ROLES.has(roleId)) setRoleRows([]);
    }).finally(() => {
      if (alive) setRolesReady(true);
    });
    return () => { alive = false; };
  }, [tenant?.id, profile, posAccessProfile?.roleId, posAccessProfile?.role]);

  const refresh = useCallback(async () => {
    if (!tenant?.id || !profile || !canView) return;
    const [nextProducts, nextSuppliers, nextHistory] = await Promise.all([
      listRetailProducts(tenant.id),
      listPosSuppliers(tenant.id),
      listPosPurchases(tenant.id),
    ]);
    setProducts(nextProducts);
    setSuppliers(nextSuppliers);
    setHistory(nextHistory);
  }, [tenant?.id, profile, canView]);

  useEffect(() => {
    let alive = true;
    if (!tenant?.id || !profile || !rolesReady || !canView || redirectTarget) {
      setInitialReady(false);
      return () => { alive = false; };
    }
    withTimeout(
      refresh(),
      INITIAL_DATA_TIMEOUT_MS,
      "POS_PURCHASES_INITIAL_LOAD_TIMEOUT",
    ).catch(loadError => {
      console.warn("POS_PURCHASES_LOAD_FAILED", loadError);
    }).finally(() => {
      if (alive) setInitialReady(true);
    });
    return () => { alive = false; };
  }, [tenant?.id, profile, rolesReady, canView, redirectTarget, refresh]);

  useEffect(() => {
    if (!tenant?.id || !profile || !rolesReady || !canView || redirectTarget || !initialReady) {
      return undefined;
    }
    const onError = watchError => console.warn("POS_PURCHASES_WATCH_FAILED", watchError);
    const stopProducts = watchRetailProducts(tenant.id, setProducts, onError);
    const stopSuppliers = watchPosSuppliers(tenant.id, setSuppliers, onError);
    const stopPurchases = watchPosPurchases(tenant.id, setHistory, onError);
    return () => {
      stopProducts();
      stopSuppliers();
      stopPurchases();
    };
  }, [tenant?.id, profile, rolesReady, canView, redirectTarget, initialReady]);

  const supplier = useMemo(() => {
    const key = supplierName.trim().toLowerCase();
    return suppliers.find(item => String(item.name || "").trim().toLowerCase() === key) || null;
  }, [suppliers, supplierName]);

  const supplierHint = useMemo(() => {
    if (!supplier) return tr("form.supplier_hint");
    return [
      supplier.contact ? tr("runtime.supplier_contact", { contact: supplier.contact }) : "",
      supplier.phone ? tr("runtime.supplier_phone", { phone: supplier.phone }) : "",
      Number(supplier.creditDays || 0) > 0
        ? tr("runtime.supplier_credit", { count: formatNumber(Number(supplier.creditDays || 0)) })
        : "",
    ].filter(Boolean).join(" • ") || tr("runtime.supplier_found");
  }, [supplier, tr, formatNumber]);

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "th")),
    [products],
  );
  const total = useMemo(
    () => lines.reduce((sum, line) =>
      sum + Number(line.qty || 0) * Number(line.unitCost || 0), 0),
    [lines],
  );
  const money = useCallback(value =>
    formatNumber(Number(value || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  [formatNumber]);
  const amountText = useCallback(
    value => t("pos_purchasing.common.amount_thb", { amount: money(value) }),
    [t, money],
  );

  const updateLine = useCallback((id, key, value) => {
    setLines(current => current.map(line => line.id === id ? { ...line, [key]: value } : line));
  }, []);
  const addLine = useCallback(() => {
    if (!canCreate || busy) return;
    setLines(current => [...current, createLine()]);
  }, [canCreate, busy]);
  const removeLine = useCallback(id => {
    if (!canCreate || busy) return;
    setLines(current => {
      const next = current.filter(line => line.id !== id);
      return next.length ? next : [createLine()];
    });
  }, [canCreate, busy]);
  const reset = useCallback(() => {
    if (!canCreate || busy) return;
    setSupplierName("");
    setInvoiceNo("");
    setPurchaseDate(localDateKey(new Date()));
    setNote("");
    setLines([createLine()]);
    setError("");
  }, [canCreate, busy]);

  const showToast = useCallback((message, variant = "success") => {
    setToastType(variant === "error" ? "error" : "success");
    setToastMessage(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToastMessage(""), 2200);
  }, []);

  const stopScanner = useCallback((closeDialog = true) => {
    window.cancelAnimationFrame(scanFrameRef.current);
    scanFrameRef.current = 0;
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
  }, []);
  const signalScanSuccess = useCallback(() => {
    try { navigator.vibrate?.(80); } catch {}
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(.04, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .12);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + .12);
      oscillator.addEventListener("ended", () => context.close());
    } catch {}
  }, []);
  const acceptScan = useCallback(codeValue => {
    const code = String(codeValue || "").trim();
    if (!code) return false;
    const lowered = code.toLowerCase();
    const product = products.find(item =>
      String(item.barcode || "") === code
      || String(item.id || "").toLowerCase() === lowered);
    if (!product) {
      showToast(scannerText("not_found"), "error");
      stopScanner();
      return true;
    }
    setLines(current => {
      const source = current.length ? current : [createLine()];
      let targetIndex = source.findIndex(line => !line.productId);
      if (targetIndex < 0) targetIndex = source.length - 1;
      return source.map((line, index) =>
        index === targetIndex ? { ...line, productId: product.id } : line);
    });
    setScanStatus(scannerText("found", { code }));
    signalScanSuccess();
    showToast(scannerText("success"));
    stopScanner();
    return true;
  }, [products, scannerText, showToast, signalScanSuccess, stopScanner]);
  const nativeScanLoop = useCallback(async function scanLoop() {
    if (!scanStreamRef.current || !scanDetectorRef.current || !scanVideoRef.current) return;
    try {
      const codes = await scanDetectorRef.current.detect(scanVideoRef.current);
      const value = String(codes?.[0]?.rawValue || "").trim();
      if (value && acceptScan(value)) return;
    } catch {}
    scanFrameRef.current = window.requestAnimationFrame(scanLoop);
  }, [acceptScan]);
  const startScanner = useCallback(async () => {
    if (!canCreate || busy) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast(scannerText("unsupported"), "error");
      return;
    }
    setScanStatus(scannerText("preparing"));
    if (!scanDialogRef.current?.open) scanDialogRef.current?.showModal?.();
    try {
      if ("BarcodeDetector" in window) {
        scanDetectorRef.current = new window.BarcodeDetector({
          formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "qr_code"],
        });
        scanStreamRef.current = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        scanVideoRef.current.srcObject = scanStreamRef.current;
        await scanVideoRef.current.play();
        setScanStatus(scannerText("scanning"));
        nativeScanLoop();
        return;
      }
      setScanStatus(scannerText("loading"));
      const ZXing = await loadZxing();
      zxingReaderRef.current = new ZXing.BrowserMultiFormatReader();
      setScanStatus(scannerText("scanning"));
      zxingControlsRef.current = await zxingReaderRef.current.decodeFromVideoDevice(
        null,
        scanVideoRef.current,
        result => {
          const value = String(result?.getText?.() || result?.text || "").trim();
          if (value) acceptScan(value);
        },
      );
    } catch (scanError) {
      console.warn("POS_PURCHASES_BARCODE_SCANNER_FAILED", scanError);
      stopScanner();
      showToast(scannerText("failed"), "error");
    }
  }, [acceptScan, busy, canCreate, nativeScanLoop, scannerText, showToast, stopScanner]);
  useEffect(() => () => stopScanner(false), [stopScanner]);

  const historyRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return history.filter(purchase => {
      if (!query) return true;
      const items = (purchase.items || [])
        .map(item => `${item.productName || ""} ${item.productId || ""}`)
        .join(" ");
      return [
        purchase.id,
        purchase.supplierName,
        purchase.invoiceNo,
        items,
      ].some(value => String(value || "").toLowerCase().includes(query));
    });
  }, [history, search]);

  const reportRows = useMemo(() => historyRows.filter(purchase => {
    const key = String(purchase.purchaseDate || "").slice(0, 10);
    return (!dateFrom || key >= dateFrom) && (!dateTo || key <= dateTo);
  }), [historyRows, dateFrom, dateTo]);

  const reportStats = useMemo(() => {
    const supplierMap = new Map();
    const productMap = new Map();
    let grandTotal = 0;
    let qtyTotal = 0;
    reportRows.forEach(purchase => {
      const purchaseTotal = Number(purchase.total || 0);
      grandTotal += purchaseTotal;
      const supplierKey = String(purchase.supplierName || "");
      supplierMap.set(supplierKey, (supplierMap.get(supplierKey) || 0) + purchaseTotal);
      (purchase.items || []).forEach(item => {
        qtyTotal += Number(item.qty || 0);
        const key = item.productId || item.productName;
        const current = productMap.get(key) || {
          name: item.productName || key,
          qty: 0,
          total: 0,
        };
        current.qty += Number(item.qty || 0);
        current.total += Number(item.lineTotal || 0);
        productMap.set(key, current);
      });
    });
    return {
      count: reportRows.length,
      grandTotal,
      qtyTotal,
      supplierCount: supplierMap.size,
      suppliers: [...supplierMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      products: [...productMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
    };
  }, [reportRows]);

  const purchaseTrend = useMemo(() => {
    const buckets = new Map();
    [...reportRows]
      .sort((a, b) => String(a.purchaseDate || "").localeCompare(String(b.purchaseDate || "")))
      .forEach(purchase => {
        const raw = String(purchase.purchaseDate || "").slice(0, 10);
        if (!raw) return;
        const date = new Date(`${raw}T00:00:00`);
        const current = buckets.get(raw) || {
          key: raw,
          label: formatDate(date, { day: "2-digit", month: "short" }),
          count: 0,
          qty: 0,
        };
        current.count += 1;
        current.qty += (purchase.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
        buckets.set(raw, current);
      });
    return [...buckets.values()].slice(-8);
  }, [reportRows, formatDate]);
  const purchaseTrendMax = useMemo(
    () => Math.max(1, ...purchaseTrend.map(item => item.count)),
    [purchaseTrend],
  );

  const applyThisMonth = useCallback(() => {
    const now = new Date();
    setDateFrom(localDateKey(new Date(now.getFullYear(), now.getMonth(), 1)));
    setDateTo(localDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  }, []);
  const applyAllDates = useCallback(() => {
    setDateFrom("");
    setDateTo("");
  }, []);

  const exportCsv = useCallback(async () => {
    if (!canViewCost) return;
    if (!reportRows.length) {
      await sweetAlert(tr("report.no_export_data"), {
        title: tr("report.export_csv"),
        type: "warning",
        confirmText: t("shared.actions.ok"),
      });
      return;
    }
    const rows = [[
      tr("csv.purchase_id"),
      tr("csv.date"),
      tr("csv.supplier"),
      tr("csv.invoice"),
      tr("csv.product_id"),
      tr("csv.product"),
      tr("csv.qty"),
      tr("csv.unit_cost"),
      tr("csv.total"),
      tr("csv.new_cost"),
      tr("csv.note"),
    ]];
    reportRows.forEach(purchase => (purchase.items || []).forEach(item => rows.push([
      purchase.id,
      purchase.purchaseDate,
      purchase.supplierName,
      purchase.invoiceNo,
      item.productId,
      item.productName,
      item.qty,
      Number(item.unitCost || 0).toFixed(2),
      Number(item.lineTotal || 0).toFixed(2),
      Number(item.newCost || 0).toFixed(4),
      purchase.note,
    ])));
    const blob = new Blob([
      "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n"),
    ], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `retail-purchases-${dateFrom || "all"}-${dateTo || "all"}.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [canViewCost, dateFrom, dateTo, reportRows, t, tr]);

  const submit = useCallback(async event => {
    event.preventDefault();
    if (!canCreate || busy || !tenant?.id) return;
    setError("");
    const items = lines.map(line => {
      const product = products.find(item => item.id === line.productId);
      return {
        productId: line.productId,
        documentId: product?._documentId || product?.id || line.productId,
        productName: product?.name || "",
        qty: Number(line.qty || 0),
        unitCost: Number(line.unitCost || 0),
      };
    });
    const valid = items.length
      && items.every(item => item.productId && item.qty > 0 && item.unitCost >= 0);
    if (!supplierName.trim() || !purchaseDate || !valid) {
      setError(tr("runtime.required"));
      return;
    }
    if (new Set(items.map(item => item.productId)).size !== items.length) {
      setError(tr("runtime.duplicate_product"));
      return;
    }
    setBusy(true);
    try {
      const purchaseId = `PO-${Date.now()}`;
      const saved = await receivePosPurchase({
        tenantId: tenant.id,
        purchaseId,
        supplierName,
        supplierId: supplier?.id || "",
        invoiceNo,
        purchaseDate,
        note,
        items,
      });
      setSupplierName("");
      setInvoiceNo("");
      setPurchaseDate(localDateKey(new Date()));
      setNote("");
      setLines([createLine()]);
      setError("");
      showToast(tr("runtime.saved_synced", { id: saved?.id || purchaseId }));
      await refresh();
    } catch (saveError) {
      console.error("POS_PURCHASES_SAVE_FAILED", saveError);
      const code = String(saveError?.message || "");
      if (code === "PURCHASE_REQUIRED_FIELDS" || code === "PURCHASE_ITEMS_REQUIRED") {
        setError(tr("runtime.required"));
      } else if (code === "PURCHASE_DUPLICATE_PRODUCT") {
        setError(tr("runtime.duplicate_product"));
      } else {
        setError(code || tr("runtime.local_conflict", { error: "" }));
      }
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    canCreate,
    invoiceNo,
    lines,
    note,
    products,
    purchaseDate,
    refresh,
    showToast,
    supplier,
    supplierName,
    tenant?.id,
    tr,
  ]);

  const needsReady = authState.status === "loading"
    || tenantState.status === "loading"
    || !stylesReady
    || Boolean(redirectTarget)
    || !rolesReady
    || (tenant?.id && profile && canView && !initialReady);
  if (needsReady) {
    return <PageReadyOverlay title={t("shared.state.loading")} message={t("shared.state.please_wait")} />;
  }

  return <>
    <header className="pos-header" data-pos-management-header>
      <div className="app-title"><div>
        <strong>{tr("header.title")}</strong>
        <small>{tr("header.subtitle")}</small>
      </div></div>
      <div className="header-actions">
        <LocaleSwitcher />
        <PosNavigation profile={posAccessProfile} currentKey="pos.purchases" />
      </div>
    </header>

    <main data-pos-management className="purchase-container">
      <section className="purchase-visual-hero">
        <span className="purchase-hero-orbit purchase-hero-orbit-one"></span>
        <span className="purchase-hero-orbit purchase-hero-orbit-two"></span>
        <div className="purchase-hero-grid">
          <div className="purchase-hero-copy">
            <div className="purchase-hero-kicker">
              <i className="bi bi-truck" aria-hidden="true"></i>
              <span>{tr("visual.kicker")}</span>
            </div>
            <h1>{tr("header.title")}</h1>
            <p>{tr("visual.hero_description")}</p>
            <div className="purchase-hero-status">
              <i className="bi bi-arrow-down-square" aria-hidden="true"></i>
              <span>{tr("visual.catalog_ready", { count: formatNumber(products.length) })}</span>
            </div>
          </div>
          <div className="purchase-hero-metrics">
            <article>
              <span><i className="bi bi-receipt" aria-hidden="true"></i>{tr("report.purchase_count")}</span>
              <strong>{formatNumber(reportStats.count)}</strong>
            </article>
            <article>
              <span><i className="bi bi-box-seam" aria-hidden="true"></i>{tr("report.qty_total")}</span>
              <strong>{formatNumber(reportStats.qtyTotal)}</strong>
            </article>
            <article>
              <span><i className="bi bi-buildings" aria-hidden="true"></i>{tr("report.supplier_count")}</span>
              <strong>{formatNumber(reportStats.supplierCount)}</strong>
            </article>
            <article>
              <span><i className="bi bi-cash-stack" aria-hidden="true"></i>{tr("report.grand_total")}</span>
              <strong>{canViewCost ? amountText(reportStats.grandTotal) : "—"}</strong>
            </article>
          </div>
        </div>
      </section>

      <section className="panel purchase-form-panel">
        <div className="section-heading purchase-form-heading">
          <div className="purchase-form-title">
            <span className="purchase-form-title-icon"><i className="bi bi-box-arrow-in-down" aria-hidden="true"></i></span>
            <div>
            <h1>
              <i className="bi bi-truck pos-context-icon" data-icon-tone="orange" aria-hidden="true"></i>
              <span>{tr("form.title")}</span>
            </h1>
            <p>{tr("form.subtitle")}</p>
            </div>
          </div>
          <span className="purchase-form-line-badge"><i className="bi bi-list-check" aria-hidden="true"></i>{formatNumber(lines.length)}</span>
        </div>

        <form id="purchaseForm" onSubmit={submit}>
          <div className="purchase-meta-grid">
            <label>{tr("form.supplier")}
              <input id="supplierName" maxLength={120} required list="supplierList"
                autoComplete="off" placeholder={tr("form.supplier_placeholder")}
                disabled={!canCreate || busy}
                value={supplierName} onChange={event => setSupplierName(event.target.value)} />
              <datalist id="supplierList">
                {suppliers.map(item =>
                  <option key={item.id || item.name} value={item.name}>
                    {[item.contact, item.phone].filter(Boolean).join(" • ")}
                  </option>)}
              </datalist>
              <small id="supplierHint">{supplierHint}</small>
            </label>

            <label>{tr("form.invoice")}
              <input id="purchaseInvoice" maxLength={80}
                placeholder={tr("form.invoice_placeholder")}
                disabled={!canCreate || busy}
                value={invoiceNo} onChange={event => setInvoiceNo(event.target.value)} />
            </label>

            <label>{tr("form.received_date")}
              <input id="purchaseDate" type="date" required
                disabled={!canCreate || busy}
                value={purchaseDate} onChange={event => setPurchaseDate(event.target.value)} />
            </label>

            <label>{tr("form.note")}
              <input id="purchaseNote" maxLength={200}
                disabled={!canCreate || busy}
                value={note} onChange={event => setNote(event.target.value)} />
            </label>
          </div>

          <div className="purchase-lines-heading">
            <h2>{tr("columns.product")}</h2>
            <button id="scanPurchaseLineBtn" className="scan-barcode-btn scan-toolbar-btn"
              type="button" hidden={!canCreate} disabled={!canCreate || busy}
              aria-label={scannerText("button")} title={scannerText("button")} onClick={startScanner}>
              <i className="bi bi-upc-scan scan-barcode-icon" aria-hidden="true"></i>
              <span>{scannerText("button")}</span>
            </button>
            <button id="addPurchaseLineBtn" className="btn btn-secondary" type="button"
              hidden={!canCreate} disabled={!canCreate || busy} onClick={addLine}>
              <i className="bi bi-plus-lg pos-context-icon" data-icon-tone="emerald" aria-hidden="true"></i>
              <span>{tr("actions.add_product")}</span>
            </button>
          </div>

          <div className="purchase-table-wrap">
            <table className="purchase-table">
              <thead><tr>
                <th>{tr("columns.product")}</th>
                <th className="number">{tr("columns.stock_before")}</th>
                <th className="number">{tr("columns.qty_received")}</th>
                <th className="number" hidden={!canViewCost}>{tr("columns.unit_cost")}</th>
                <th className="number" hidden={!canViewCost}>{tr("columns.total")}</th>
                <th></th>
              </tr></thead>
              <tbody id="purchaseLines">
                {lines.map(line => {
                  const product = products.find(item => item.id === line.productId);
                  return <tr className="purchase-line-row" key={line.id}>
                    <td className="purchase-line-product" data-label={tr("columns.product")}>
                      <select className="line-product" value={line.productId}
                        disabled={!canCreate || busy}
                        onChange={event => updateLine(line.id, "productId", event.target.value)}>
                        <option value="">{tr("runtime.select_product")}</option>
                        {sortedProducts.map(item =>
                          <option key={item.id} value={item.id}>{item.name} ({item.id})</option>)}
                      </select>
                    </td>
                    <td className="number line-stock" data-label={tr("columns.stock_before")}>{formatNumber(Number(product?.stock || 0))}</td>
                    <td className="purchase-line-qty" data-label={tr("columns.qty_received")}>
                      <input className="line-qty" type="number" min="0.001" step="0.001"
                        disabled={!canCreate || busy}
                        value={line.qty}
                        onChange={event => updateLine(line.id, "qty", event.target.value)} />
                    </td>
                    <td className="purchase-line-cost" data-label={tr("columns.unit_cost")} hidden={!canViewCost}>
                      <input className="line-cost" type="number" min="0" step="0.01"
                        disabled={!canCreate || busy}
                        value={line.unitCost}
                        onChange={event => updateLine(line.id, "unitCost", event.target.value)} />
                    </td>
                    <td className="number line-total" data-label={tr("columns.total")} hidden={!canViewCost}>
                      {money(Number(line.qty || 0) * Number(line.unitCost || 0))}
                    </td>
                    <td className="purchase-line-remove">
                      <button className="remove-line" type="button"
                        hidden={!canCreate} disabled={!canCreate || busy}
                        aria-label={tr("actions.remove")} title={tr("actions.remove")}
                        onClick={() => removeLine(line.id)}>
                        <i className="bi bi-trash3" aria-hidden="true"></i>
                      </button>
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>

          <div className="purchase-summary" hidden={!canViewCost}>
            <span>{tr("actions.grand_total")}</span>
            <strong id="purchaseTotal">{amountText(total)}</strong>
          </div>
          <p id="purchaseError" className="error-text">{error}</p>
          <div className="purchase-actions">
            <button id="resetPurchaseBtn" className="btn btn-secondary" type="button"
              hidden={!canCreate} disabled={!canCreate || busy} onClick={reset}>
              <i className="bi bi-x-lg pos-context-icon" data-icon-tone="slate" aria-hidden="true"></i>
              <span>{tr("actions.clear")}</span>
            </button>
            <button className="btn btn-pay" type="submit"
              hidden={!canCreate} disabled={!canCreate || busy}>
              <i className="bi bi-floppy pos-context-icon" data-icon-tone="emerald" aria-hidden="true"></i>
              <span>{busy ? t("shared.state.loading") : tr("actions.save")}</span>
            </button>
          </div>
        </form>
      </section>

      <section className="panel purchase-history-panel">
        <section className="purchase-report">
          <div className="purchase-report-visual-heading">
            <div className="purchase-report-title">
              <span className="purchase-report-title-icon"><i className="bi bi-graph-up-arrow" aria-hidden="true"></i></span>
              <div>
                <h2>{tr("visual.report_title")}</h2>
                <p>{tr("visual.report_description")}</p>
              </div>
            </div>
            <span className="purchase-report-result"><i className="bi bi-receipt-cutoff" aria-hidden="true"></i>{formatNumber(reportRows.length)}</span>
          </div>
          <div className="purchase-report-filters">
            <input id="purchaseDateFrom" type="date" value={dateFrom}
              aria-label={tr("csv.date")}
              onChange={event => setDateFrom(event.target.value)} />
            <input id="purchaseDateTo" type="date" value={dateTo}
              aria-label={tr("csv.date")}
              onChange={event => setDateTo(event.target.value)} />
            <button id="purchaseThisMonth" className="btn btn-secondary" type="button"
              onClick={applyThisMonth}>
              <i className="bi bi-calendar3 pos-context-icon" data-icon-tone="blue" aria-hidden="true"></i>
              <span>{tr("report.this_month")}</span>
            </button>
            <button id="purchaseAll" className="btn btn-secondary" type="button"
              onClick={applyAllDates}>
              <i className="bi bi-arrow-counterclockwise pos-context-icon" data-icon-tone="slate" aria-hidden="true"></i>
              <span>{tr("report.all")}</span>
            </button>
            <button id="exportPurchaseCsv" className="btn btn-pay" type="button"
              hidden={!canViewCost} onClick={exportCsv}>
              <i className="bi bi-download pos-context-icon" data-icon-tone="emerald" aria-hidden="true"></i>
              <span>{tr("report.export_csv")}</span>
            </button>
          </div>

          <div className="purchase-report-stats">
            <article className="purchase-stat-card purchase-stat-orders">
              <span className="purchase-stat-icon"><i className="bi bi-receipt" aria-hidden="true"></i></span>
              <span>{tr("report.purchase_count")}</span>
              <strong id="purchaseCount">{formatNumber(reportStats.count)}</strong>
            </article>
            <article className="purchase-stat-card purchase-stat-value" hidden={!canViewCost}>
              <span className="purchase-stat-icon"><i className="bi bi-cash-stack" aria-hidden="true"></i></span>
              <span>{tr("report.grand_total")}</span>
              <strong id="purchaseGrandTotal">{money(reportStats.grandTotal)}</strong>
            </article>
            <article className="purchase-stat-card purchase-stat-qty">
              <span className="purchase-stat-icon"><i className="bi bi-box-arrow-in-down" aria-hidden="true"></i></span>
              <span>{tr("report.qty_total")}</span>
              <strong id="purchaseQtyTotal">{formatNumber(reportStats.qtyTotal)}</strong>
            </article>
            <article className="purchase-stat-card purchase-stat-suppliers">
              <span className="purchase-stat-icon"><i className="bi bi-buildings" aria-hidden="true"></i></span>
              <span>{tr("report.supplier_count")}</span>
              <strong id="supplierCount">{formatNumber(reportStats.supplierCount)}</strong>
            </article>
          </div>

          <div className="purchase-activity-panel">
            <div className="purchase-activity-heading">
              <div>
                <span className="purchase-activity-icon"><i className="bi bi-bar-chart-line-fill" aria-hidden="true"></i></span>
                <div>
                  <h3>{tr("visual.activity_title")}</h3>
                  <p>{tr("visual.activity_description")}</p>
                </div>
              </div>
              <strong>{formatNumber(reportStats.count)}</strong>
            </div>
            <div className="purchase-activity-chart">
              {purchaseTrend.length ? purchaseTrend.map(item => {
                const height = Math.max(10, (item.count / purchaseTrendMax) * 100);
                return <div className="purchase-activity-column" key={item.key}>
                  <span className="purchase-activity-tooltip">{formatNumber(item.count)} {tr("visual.orders")}</span>
                  <span className="purchase-activity-bar" style={{ "--purchase-height": `${height}%`, height: `${height}%` }}></span>
                  <span className="purchase-activity-label">{item.label}</span>
                </div>;
              }) : <div className="purchase-chart-empty">
                <i className="bi bi-bar-chart" aria-hidden="true"></i>
                <span>{tr("report.empty")}</span>
              </div>}
            </div>
          </div>

          <div className="purchase-ranking-grid">
            <div hidden={!canViewCost}>
              <h3>{tr("report.top_suppliers")}</h3>
              <div id="supplierRanking" className="purchase-ranking">
                {reportStats.suppliers.length
                  ? reportStats.suppliers.map(([name, value], index) =>
                    <div key={name || index}>
                      <b>{index + 1}</b>
                      <span>{name}</span>
                      <strong>{money(value)}</strong>
                    </div>)
                  : <p className="empty-state">{tr("report.empty")}</p>}
              </div>
            </div>
            <div>
              <h3>{tr("report.top_products")}</h3>
              <div id="purchaseProductRanking" className="purchase-ranking">
                {reportStats.products.length
                  ? reportStats.products.map((item, index) =>
                    <div key={item.name || index}>
                      <b>{index + 1}</b>
                      <span>{item.name}</span>
                      <strong>{formatNumber(item.qty)}</strong>
                    </div>)
                  : <p className="empty-state">{tr("report.empty")}</p>}
              </div>
            </div>
          </div>
        </section>

        <div className="section-heading purchase-history-heading">
          <div className="purchase-history-title">
            <span className="purchase-history-title-icon"><i className="bi bi-clock-history" aria-hidden="true"></i></span>
            <div>
              <h2>
                <i className="bi bi-bar-chart-line pos-context-icon" data-icon-tone="blue" aria-hidden="true"></i>
                <span>{tr("history.title")}</span>
              </h2>
              <p>{tr("history.subtitle")}</p>
            </div>
          </div>
          <span className="purchase-history-count"><i className="bi bi-archive" aria-hidden="true"></i>{formatNumber(historyRows.length)}</span>
        </div>

        <label className="purchase-history-search">{tr("history.search_label")}
          <input id="purchaseSearch" value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={tr("history.search_placeholder")} />
        </label>

        <div id="purchaseHistory" className="purchase-history">
          {historyRows.map(purchase => {
            const hasLegacyCostGap = (purchase.items || [])
              .some(item => item.oldCost === null && Number(item.oldStock) > 0);
            const displayDate = purchase.purchaseDate
              ? formatDate(new Date(String(purchase.purchaseDate).includes("T")
                ? purchase.purchaseDate
                : `${purchase.purchaseDate}T00:00:00`), {
                year: "numeric",
                month: "numeric",
                day: "numeric",
              })
              : "-";
            return <article className="purchase-history-item purchase-history-visual-item" key={purchase.id}>
              <div className="purchase-history-head">
                <div>
                  <strong>{purchase.supplierName || "-"}</strong>
                  <span>{purchase.id}{purchase.invoiceNo ? " • " + purchase.invoiceNo : ""}</span>
                </div>
                <div className="purchase-history-total">
                  <strong hidden={!canViewCost}>{amountText(purchase.total)}</strong>
                  <span>{displayDate}</span>
                </div>
              </div>
              <div className="purchase-history-meta">{purchase.note || tr("history.no_note")}</div>
              <div className="purchase-history-lines">
                {(purchase.items || []).map((item, index) =>
                  <div className="purchase-history-line" key={item.productId || index}>
                    <span>{item.productName || item.productId || "-"} × {formatNumber(Number(item.qty || 0))}</span>
                    <strong hidden={!canViewCost}>{money(item.lineTotal)}</strong>
                  </div>)}
              </div>
              {hasLegacyCostGap && canViewCost
                ? <div className="average-cost-note">{tr("history.average_cost_note")}</div>
                : null}
            </article>;
          })}
        </div>
        <div id="purchaseHistoryEmpty" className="empty-state purchase-history-empty" hidden={historyRows.length > 0}>
          <span className="purchase-empty-icon"><i className="bi bi-inboxes" aria-hidden="true"></i></span>
          <strong>{tr("history.empty")}</strong>
          <small>{tr("visual.history_empty_hint")}</small>
        </div>
      </section>
    </main>

    <dialog id="posScanDialog" ref={scanDialogRef} className="pos-scan-dialog"
      onClose={() => stopScanner(false)}>
      <div className="pos-scan-sheet">
        <div className="pos-scan-head">
          <div>
            <h2>{scannerText("title")}</h2>
            <p>{scannerText("help")}</p>
          </div>
          <button className="pos-scan-close" type="button"
            aria-label={scannerText("close")} onClick={() => stopScanner()}>
            <i className="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </div>
        <div className="pos-scan-view">
          <video ref={scanVideoRef} id="posScanVideo" playsInline muted></video>
          <div className="pos-scan-guide"></div>
          <div className="pos-scan-line"></div>
        </div>
        <p id="posScanStatus" className="pos-scan-status">{scanStatus}</p>
      </div>
    </dialog>

    <div id="toast" className={`toast ${toastType}${toastMessage ? " show" : ""}`}
      role={toastType === "error" ? "alert" : "status"} aria-live="polite">
      <span className="app-toast-icon" aria-hidden="true">
        <i className={`bi bi-${toastType === "error" ? "x-circle" : "check-circle"} app-icon`}></i>
      </span>
      <span className="app-toast-message">{toastMessage}</span>
    </div>
    <AppDeveloperPanel />
  </>;
}
