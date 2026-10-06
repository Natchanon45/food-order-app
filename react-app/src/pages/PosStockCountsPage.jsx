import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { canUseRetailPos, getRetailPosSession } from "@/auth/retailPosSession";
import { AppDeveloperPanel } from "@/components/AppDeveloperPanel";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { firstAllowedPosPage, getPosPermissions, PosNavigation } from "@/components/PosNavigation";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { sweetConfirm } from "@/components/sweetDialog";
import {
  commitRetailStockCount,
  listRetailProducts,
  listRetailStockCounts,
  watchRetailProducts,
  watchRetailStockCounts,
} from "@/data/retailProductsData";
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

function hasCountPermission(profile, roleRows, permission) {
  if (!profile) return false;
  const roleId = String(profile.roleId || profile.role || "");
  if (roleId === "owner") return true;
  const roles = Array.isArray(roleRows) ? roleRows : [];
  const role = roles.find(item => String(item?.id || "") === roleId);
  const permissions = Array.isArray(role?.permissions) ? role.permissions : [];
  if (permissions.includes("*")) return true;
  if (permissions.includes(permission)) return true;
  const hasGranular = permissions.some(key => String(key).startsWith("pos.stock_counts."));
  if (hasGranular) return false;
  if (roleId === "admin" || roleId === "manager" || roleId === "stock") {
    return [
      "pos.stock_counts.perform",
      "pos.stock_counts.view_value",
      "pos.stock_counts.view_history",
    ].includes(permission);
  }
  return false;
}

export function PosStockCountsPage() {
  const authState = useAuth();
  const tenantState = useTenant();
  const { profile, user: authUser } = authState;
  const { tenant } = tenantState;
  const { t, formatNumber, formatDate } = useI18n();
  const tr = useCallback((key, replacements = {}) => t(`pos_stock.counts.${key}`, replacements), [t]);

  const stylesReady = useParityPage({
    title: tr("meta.title"),
    bodyClass: "pos-stock-counts-page",
    attributes: { "data-module": "retail-pos-stock-counts" },
    disabledGlobalStyles: ["app.css", "icons.css", "shared-responsive.css"],
    styles: [
      "app-version-badge-runtime.css",
      "retail-pos-font-local.css",
      "pos-locale-switcher-placement.css",
      "retail-pos.css",
      "retail-stock-counts.css",
      "retail-stock-counts-visual-dashboard.css",
      "retail-barcode-scan-tools.css",
      "retail-pos-navigation.css",
      "sweet-dialog.css",
    ],
  });

  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [initialReady, setInitialReady] = useState(false);
  const [roleRows, setRoleRows] = useState(() => cachedPosRoles());
  const [rolesReady, setRolesReady] = useState(() => {
    const session = getRetailPosSession();
    const roleId = String(session?.roleId || session?.role || "");
    return BUILTIN_POS_ROLES.has(roleId) || cachedPosRoles().length > 0;
  });
  const [actuals, setActuals] = useState({});
  const [countName, setCountName] = useState("");
  const [countDate, setCountDate] = useState(() => localDateKey(new Date()));
  const [countedBy, setCountedBy] = useState("");
  const [countNote, setCountNote] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [historySearch, setHistorySearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [countError, setCountError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");
  const [scanStatus, setScanStatus] = useState(() => t("pos_products.scanner.preparing"));

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
  const canView = pagePermissions.has("pos.stock_counts");
  const canPerform = hasCountPermission(posAccessProfile, roleRows, "pos.stock_counts.perform");
  const canViewValue = hasCountPermission(posAccessProfile, roleRows, "pos.stock_counts.view_value");
  const canViewHistory = hasCountPermission(posAccessProfile, roleRows, "pos.stock_counts.view_history");

  const redirectTarget = useMemo(() => {
    if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady) return "";
    const requested = location.pathname + location.search;
    if (!profile) return "/pos/login/?next=" + encodeURIComponent(requested);
    if (!canUseRetailPos(posAccessProfile) || tenantState.status === "error" || !tenant) return "/";
    if (!rolesReady) return "";
    if (!canView) {
      const first = firstAllowedPosPage(posAccessProfile, roleRows);
      return first === "/pos/forbidden"
        ? "/pos/forbidden/?permission=pos.stock_counts&next=" + encodeURIComponent(requested)
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
    }).catch(error => {
      console.warn("POS_STOCK_COUNTS_ROLE_SETTINGS_LOAD_FAILED", error);
      if (!alive) return;
      if (!cached.length && !BUILTIN_POS_ROLES.has(roleId)) setRoleRows([]);
    }).finally(() => {
      if (alive) setRolesReady(true);
    });
    return () => { alive = false; };
  }, [tenant?.id, profile, posAccessProfile?.roleId, posAccessProfile?.role]);

  const refresh = useCallback(async () => {
    if (!tenant?.id || !profile || !canView) return;
    const [nextProducts, nextHistory] = await Promise.all([
      listRetailProducts(tenant.id),
      listRetailStockCounts(tenant.id),
    ]);
    setProducts(nextProducts);
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
      "POS_STOCK_COUNTS_INITIAL_LOAD_TIMEOUT",
    ).catch(error => {
      console.warn("POS_STOCK_COUNTS_LOAD_FAILED", error);
    }).finally(() => {
      if (alive) setInitialReady(true);
    });
    return () => { alive = false; };
  }, [tenant?.id, profile, rolesReady, canView, redirectTarget, refresh]);

  useEffect(() => {
    if (!tenant?.id || !profile || !rolesReady || !canView || redirectTarget || !initialReady) {
      return undefined;
    }
    const onError = error => console.warn("POS_STOCK_COUNTS_WATCH_FAILED", error);
    const stopProducts = watchRetailProducts(tenant.id, setProducts, onError);
    const stopCounts = watchRetailStockCounts(tenant.id, setHistory, onError);
    return () => {
      stopProducts();
      stopCounts();
    };
  }, [tenant?.id, profile, rolesReady, canView, redirectTarget, initialReady]);
  const scannerText = useCallback(
    (key, replacements = {}) => t(`pos_products.scanner.${key}`, replacements),
    [t],
  );
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
  const focusProductActual = useCallback(productId => {
    window.setTimeout(() => {
      const selector = `#countTableBody tr[data-id="${CSS.escape(String(productId))}"] .actual-input`;
      const input = document.querySelector(selector);
      input?.focus();
      input?.select?.();
      input?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    }, 80);
  }, []);
  const acceptScan = useCallback(codeValue => {
    const code = String(codeValue || "").trim();
    if (!code) return false;
    const lowered = code.toLowerCase();
    const product = products.find(item =>
      String(item.barcode || "") === code
      || String(item.id || "").toLowerCase() === lowered);
    if (!product) {
      setSearch(code);
      showToast(scannerText("not_found"), "error");
      stopScanner();
      return true;
    }
    setSearch(product.barcode || product.id);
    setScanStatus(scannerText("found", { code }));
    signalScanSuccess();
    showToast(scannerText("success"));
    stopScanner();
    focusProductActual(product.id);
    return true;
  }, [focusProductActual, products, scannerText, showToast, signalScanSuccess, stopScanner]);
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
    } catch (error) {
      console.warn("POS_STOCK_COUNTS_BARCODE_SCANNER_FAILED", error);
      stopScanner();
      showToast(scannerText("failed"), "error");
    }
  }, [acceptScan, nativeScanLoop, scannerText, showToast, stopScanner]);
  useEffect(() => () => stopScanner(false), [stopScanner]);
  const rowData = useCallback(product => {
    const raw = actuals[product.id];
    const has = raw !== "" && raw != null;
    const actual = has ? Number(raw) : null;
    const system = Number(product.stock || 0);
    const variance = has && Number.isFinite(actual) ? actual - system : 0;
    const cost = Number.isFinite(Number(product.cost)) ? Number(product.cost) : 0;
    return { product, has, actual, system, variance, value: variance * cost, cost };
  }, [actuals]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.map(rowData).filter(row => {
      const matchesSearch = !query || [
        row.product.id,
        row.product.barcode,
        row.product.name,
      ].some(value => String(value || "").toLowerCase().includes(query));
      if (!matchesSearch) return false;
      if (filter === "difference") return row.has && row.variance !== 0;
      if (filter === "uncounted") return !row.has;
      return true;
    }).sort((left, right) =>
      String(left.product.name || "").localeCompare(String(right.product.name || ""), "th"));
  }, [products, rowData, search, filter]);

  const countedRows = useMemo(
    () => products.map(rowData).filter(row => row.has && Number.isFinite(row.actual)),
    [products, rowData],
  );
  const summary = useMemo(() => ({
    counted: countedRows.length,
    short: Math.abs(countedRows.filter(row => row.variance < 0)
      .reduce((sum, row) => sum + row.variance, 0)),
    over: countedRows.filter(row => row.variance > 0)
      .reduce((sum, row) => sum + row.variance, 0),
    value: countedRows.reduce((sum, row) => sum + row.value, 0),
  }), [countedRows]);

  const countVisual = useMemo(() => {
    const total = products.length;
    const counted = summary.counted;
    const remaining = Math.max(0, total - counted);
    const differences = countedRows.filter(row => row.variance !== 0);
    const progress = total > 0 ? Math.min(100, (counted / total) * 100) : 0;
    const changedUnits = summary.short + summary.over;
    const shortShare = changedUnits > 0 ? (summary.short / changedUnits) * 100 : 0;
    const overShare = changedUnits > 0 ? (summary.over / changedUnits) * 100 : 0;
    return {
      total,
      counted,
      remaining,
      differences: differences.length,
      progress,
      changedUnits,
      shortShare,
      overShare,
    };
  }, [products.length, countedRows, summary]);

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    return history.filter(record => !query || [
      record.id,
      record.name,
      record.countedBy,
      record.note,
    ].some(value => String(value || "").toLowerCase().includes(query)));
  }, [history, historySearch]);

  const money = value => formatNumber(Number(value || 0), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const reset = useCallback(() => {
    setActuals({});
    setCountName("");
    setCountDate(localDateKey(new Date()));
    setCountedBy("");
    setCountNote("");
    setCountError("");
  }, []);
  const fillSystem = () => {
    if (!canPerform) return;
    setActuals(Object.fromEntries(products.map(product => [
      product.id,
      String(Number(product.stock || 0)),
    ])));
  };
  const clearActual = () => {
    if (!canPerform) return;
    setActuals({});
  };
  const updateActual = (productId, value) => {
    if (!canPerform) return;
    if (value === "") {
      setActuals(current => {
        const next = { ...current };
        delete next[productId];
        return next;
      });
      return;
    }
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    setActuals(current => ({ ...current, [productId]: String(Math.max(0, number)) }));
  };
  const handleActualKeyDown = (event, productId) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const currentRow = event.currentTarget.closest('tr[data-id]');
    const domRows = [...document.querySelectorAll('#countTableBody tr[data-id]')];
    const index = domRows.indexOf(currentRow);
    const nextId = domRows[index + 1]?.dataset.id;
    if (!nextId) return;
    window.requestAnimationFrame(() => focusProductActual(nextId));
  };

  const confirmCount = async () => {
    if (busy || !canPerform) return;
    setCountError("");
    if (!countName.trim() || !countDate || !countedBy.trim()) {
      setCountError(tr("validation.required"));
      return;
    }
    if (!countedRows.length) {
      setCountError(tr("validation.actual_required"));
      return;
    }
    const differences = countedRows.filter(row => row.variance !== 0);
    const confirmed = await sweetConfirm(
      differences.length
        ? tr("confirm.with_difference", { count: formatNumber(differences.length) })
        : tr("confirm.no_difference"),
      {
        title: t("shared.dialog.confirm_title"),
        type: "warning",
        confirmText: t("shared.actions.confirm"),
        cancelText: t("shared.actions.cancel"),
      },
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      const countId = `COUNT-${Date.now()}`;
      const committed = await commitRetailStockCount(tenant.id, {
        id: countId,
        name: countName.trim(),
        countDate,
        countedBy: countedBy.trim(),
        note: countNote.trim(),
        movementNote: tr("movement_note", { id: countId }),
        items: countedRows.map(row => ({
          productId: row.product.id,
          documentId: row.product._documentId || row.product.id,
          actual: row.actual,
        })),
      });
      reset();
      showToast(tr("status.saved_synced", { id: committed?.id || "" }));
    } catch (error) {
      console.error("POS_STOCK_COUNT_COMMIT_FAILED", error);
      const message = String(error?.code || error?.message || "STOCK_COUNT_FAILED");
      setCountError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  };
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
        <PosNavigation profile={posAccessProfile} currentKey="pos.stock_counts" />
      </div>
    </header>

    <main data-pos-management className="count-container">
      <section className="count-visual-hero">
        <span className="count-hero-shape count-hero-shape-one"></span>
        <span className="count-hero-shape count-hero-shape-two"></span>
        <div className="count-hero-grid">
          <div className="count-hero-copy">
            <div className="count-hero-kicker">
              <i className="bi bi-clipboard2-data" aria-hidden="true"></i>
              <span>{tr("visual.kicker")}</span>
            </div>
            <h1>{tr("header.title")}</h1>
            <p>{tr("visual.hero_description")}</p>
            <div className="count-hero-date">
              <i className="bi bi-calendar-check" aria-hidden="true"></i>
              <span>{formatDate(new Date(`${countDate}T00:00:00`), { year: "numeric", month: "short", day: "numeric" })}</span>
            </div>
          </div>
          <div className="count-hero-metrics">
            <article>
              <span><i className="bi bi-box-seam" aria-hidden="true"></i>{tr("visual.total_products")}</span>
              <strong>{formatNumber(countVisual.total)}</strong>
            </article>
            <article>
              <span><i className="bi bi-check2-circle" aria-hidden="true"></i>{tr("summary.counted_items")}</span>
              <strong>{formatNumber(countVisual.counted)}</strong>
            </article>
            <article>
              <span><i className="bi bi-hourglass-split" aria-hidden="true"></i>{tr("visual.remaining")}</span>
              <strong>{formatNumber(countVisual.remaining)}</strong>
            </article>
            <article>
              <span><i className="bi bi-exclamation-diamond" aria-hidden="true"></i>{tr("visual.variance_items")}</span>
              <strong>{formatNumber(countVisual.differences)}</strong>
            </article>
          </div>
        </div>
      </section>

      <section className="count-insight-grid">
        <article className="panel count-progress-panel">
          <div className="count-visual-heading">
            <span className="count-visual-icon count-visual-icon-progress"><i className="bi bi-pie-chart-fill" aria-hidden="true"></i></span>
            <div>
              <h2>{tr("visual.progress_title")}</h2>
              <p>{tr("visual.progress_description")}</p>
            </div>
          </div>
          <div className="count-progress-content">
            <div className="count-progress-ring" style={{ "--count-progress": `${countVisual.progress * 3.6}deg` }}>
              <div>
                <strong>{formatNumber(Math.round(countVisual.progress))}%</strong>
                <span>{tr("visual.completed")}</span>
              </div>
            </div>
            <div className="count-progress-legend">
              <div><span className="count-dot count-dot-complete"></span><span>{tr("summary.counted_items")}</span><strong>{formatNumber(countVisual.counted)}</strong></div>
              <div><span className="count-dot count-dot-remaining"></span><span>{tr("visual.remaining")}</span><strong>{formatNumber(countVisual.remaining)}</strong></div>
              <small>{tr("visual.progress_hint")}</small>
            </div>
          </div>
        </article>

        <article className="panel count-variance-panel">
          <div className="count-visual-heading">
            <span className="count-visual-icon count-visual-icon-variance"><i className="bi bi-arrow-left-right" aria-hidden="true"></i></span>
            <div>
              <h2>{tr("visual.variance_title")}</h2>
              <p>{tr("visual.variance_description")}</p>
            </div>
          </div>
          <div className="count-variance-metrics">
            <div className="count-variance-short">
              <span>{tr("summary.short_qty")}</span>
              <strong>-{formatNumber(summary.short)}</strong>
            </div>
            <div className="count-variance-over">
              <span>{tr("summary.over_qty")}</span>
              <strong>+{formatNumber(summary.over)}</strong>
            </div>
          </div>
          <div className="count-variance-track" aria-hidden="true">
            <span className="count-variance-short-bar" style={{ width: `${countVisual.shortShare}%` }}></span>
            <span className="count-variance-over-bar" style={{ width: `${countVisual.overShare}%` }}></span>
          </div>
          <div className="count-value-summary">
            <span>{tr("summary.variance_value")}</span>
            <strong>{canViewValue ? money(summary.value) : "—"}</strong>
          </div>
        </article>
      </section>

      <section className="panel count-panel">
        <div className="count-heading section-heading">
          <div className="count-heading-copy">
            <h1><i className="bi bi-clipboard-check pos-context-icon" data-icon-tone="lime" aria-hidden="true"></i><span>{tr("new.title")}</span></h1>
            <p>{tr("new.description")}</p>
          </div>
          <div className="count-actions-top">
            <button id="fillSystemBtn" className="btn btn-secondary" type="button"
              hidden={!canPerform} disabled={!canPerform || busy} onClick={fillSystem}>
              <i className="bi bi-clipboard-check pos-context-icon" data-icon-tone="lime" aria-hidden="true"></i>
              <span>{tr("new.fill_system")}</span>
            </button>
            <button id="clearActualBtn" className="btn btn-secondary" type="button"
              hidden={!canPerform} disabled={!canPerform || busy} onClick={clearActual}>
              <i className="bi bi-x-lg pos-context-icon" data-icon-tone="rose" aria-hidden="true"></i>
              <span>{tr("new.clear_actual")}</span>
            </button>
          </div>
        </div>

        <div className="count-meta">
          <label className="count-meta-field count-meta-name">
            <span className="count-meta-label"><i className="bi bi-bookmark-star" aria-hidden="true"></i>{tr("fields.name")}</span>
            <input id="countName" maxLength={120} value={countName}
              disabled={!canPerform || busy}
              onChange={event => setCountName(event.target.value)}
              placeholder={tr("fields.name_placeholder")} />
          </label>
          <label className="count-meta-field count-meta-date">
            <span className="count-meta-label"><i className="bi bi-calendar3" aria-hidden="true"></i>{tr("fields.date")}</span>
            <input id="countDate" type="date" value={countDate}
              disabled={!canPerform || busy}
              onChange={event => setCountDate(event.target.value)} />
          </label>
          <label className="count-meta-field count-meta-person">
            <span className="count-meta-label"><i className="bi bi-person-check" aria-hidden="true"></i>{tr("fields.counted_by")}</span>
            <input id="countedBy" maxLength={100} value={countedBy}
              disabled={!canPerform || busy}
              onChange={event => setCountedBy(event.target.value)} />
          </label>
          <label className="count-meta-field count-meta-note">
            <span className="count-meta-label"><i className="bi bi-chat-left-text" aria-hidden="true"></i>{tr("fields.note")}</span>
            <input id="countNote" maxLength={200} value={countNote}
              disabled={!canPerform || busy}
              onChange={event => setCountNote(event.target.value)} />
          </label>
        </div>

        <div className="count-list-sticky-shell">
          <div className="count-list-controls">
            <div className="count-list-heading">
            <span className="count-list-heading-icon"><i className="bi bi-boxes" aria-hidden="true"></i></span>
            <div>
              <strong>{tr("visual.list_title")}</strong>
              <small>{tr("visual.list_description")}</small>
            </div>
            <span className="count-list-visible-badge">
              <i className="bi bi-eye" aria-hidden="true"></i>
              <strong>{formatNumber(visibleRows.length)}</strong>
              <span>/ {formatNumber(countVisual.total)}</span>
            </span>
          </div>

          <div className="count-toolbar">
            <label className="count-search-field">
              <span className="count-toolbar-label"><i className="bi bi-search" aria-hidden="true"></i>{tr("fields.search_placeholder")}</span>
              <div className="barcode-input-group">
                <input id="countSearch" value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder={tr("fields.search_placeholder")} />
                <button id="scanCountSearchBtn" className="scan-barcode-btn" type="button"
                  aria-label={scannerText("button")} title={scannerText("button")} onClick={startScanner}>
                  <i className="bi bi-upc-scan scan-barcode-icon" aria-hidden="true"></i>
                  <span>{scannerText("button")}</span>
                </button>
              </div>
            </label>
            <label className="count-filter-field">
              <span className="count-toolbar-label"><i className="bi bi-funnel" aria-hidden="true"></i>{tr("visual.filter_label")}</span>
              <select id="countFilter" value={filter} onChange={event => setFilter(event.target.value)}>
                <option value="all">{tr("filters.all")}</option>
                <option value="difference">{tr("filters.difference")}</option>
                <option value="uncounted">{tr("filters.uncounted")}</option>
              </select>
            </label>
            </div>
          </div>

          <div className={`count-table-sticky-head ${canViewValue ? "has-value" : "no-value"}`} aria-hidden="true">
            <span className="count-sticky-product"><i className="bi bi-box-seam" aria-hidden="true"></i>{tr("columns.product")}</span>
            <span className="count-sticky-system"><i className="bi bi-database-check" aria-hidden="true"></i>{tr("columns.system")}</span>
            <span className="count-sticky-actual"><i className="bi bi-pencil-square" aria-hidden="true"></i>{tr("columns.actual")}</span>
            <span className="count-sticky-variance"><i className="bi bi-arrow-left-right" aria-hidden="true"></i>{tr("columns.variance")}</span>
            <span className="count-sticky-value" hidden={!canViewValue}><i className="bi bi-cash-stack" aria-hidden="true"></i>{tr("columns.variance_value")}</span>
          </div>
        </div>

        <div className="table-wrap">
          <table className={`count-table ${canViewValue ? "has-value" : "no-value"}`}>
            <thead><tr>
              <th>{tr("columns.product")}</th>
              <th className="number">{tr("columns.system")}</th>
              <th className="number">{tr("columns.actual")}</th>
              <th className="number">{tr("columns.variance")}</th>
              <th className="number" hidden={!canViewValue}>{tr("columns.variance_value")}</th>
            </tr></thead>
            <tbody id="countTableBody">
              {visibleRows.map(row => <tr
                className={`count-row ${!row.has ? "is-uncounted" : row.variance > 0 ? "is-over" : row.variance < 0 ? "is-short" : "is-match"}`}
                key={row.product.id} data-id={row.product.id}>
                <td className="count-product">
                  <strong>{row.product.name || row.product.id}</strong>
                  <span>{row.product.id} • {row.product.barcode || ""}{canViewValue ? ` • ${t("pos_products.runtime.cost", { amount: money(row.cost) })}` : ""}</span>
                </td>
                <td className="number system-cell" data-label={tr("columns.system")}>
                  <span className="count-number-badge count-number-system">{formatNumber(row.system)}</span>
                </td>
                <td className="number actual-cell" data-label={tr("columns.actual")}>
                  <input className={`actual-input ${row.has ? "has-value" : ""}`} type="number" min="0" step="0.001"
                    disabled={!canPerform || busy}
                    value={actuals[row.product.id] ?? ""}
                    placeholder="-"
                    onChange={event => updateActual(row.product.id, event.target.value)}
                    onKeyDown={event => handleActualKeyDown(event, row.product.id)} />
                </td>
                <td className={`number variance-cell ${row.variance > 0 ? "variance-positive" : row.variance < 0 ? "variance-negative" : row.has ? "variance-neutral" : ""}`}
                  data-label={tr("columns.variance")}>
                  <span className="count-number-badge count-number-variance">
                    {row.has ? `${row.variance > 0 ? "+" : ""}${formatNumber(row.variance)}` : "-"}
                  </span>
                </td>
                <td className={`number variance-value-cell ${row.value > 0 ? "variance-positive" : row.value < 0 ? "variance-negative" : row.has ? "variance-neutral" : ""}`}
                  data-label={tr("columns.variance_value")} hidden={!canViewValue}>
                  <span className="count-number-badge count-number-value">{row.has ? money(row.value) : "-"}</span>
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <div id="countEmpty" className="empty-state count-empty" hidden={visibleRows.length > 0}>
          <span className="count-empty-icon"><i className="bi bi-search" aria-hidden="true"></i></span>
          <strong>{t("pos_products.table.empty")}</strong>
          <small>{tr("visual.empty_hint")}</small>
        </div>

        <div className="count-summary">
          <div className="count-summary-card count-summary-counted">
            <span className="count-summary-icon"><i className="bi bi-check2-square" aria-hidden="true"></i></span>
            <span>{tr("summary.counted_items")}</span>
            <strong id="countedItems">{formatNumber(summary.counted)}</strong>
          </div>
          <div className="count-summary-card count-summary-short">
            <span className="count-summary-icon"><i className="bi bi-arrow-down-right" aria-hidden="true"></i></span>
            <span>{tr("summary.short_qty")}</span>
            <strong id="shortQty">{formatNumber(summary.short)}</strong>
          </div>
          <div className="count-summary-card count-summary-over">
            <span className="count-summary-icon"><i className="bi bi-arrow-up-right" aria-hidden="true"></i></span>
            <span>{tr("summary.over_qty")}</span>
            <strong id="overQty">{formatNumber(summary.over)}</strong>
          </div>
          <div className="count-summary-card count-summary-value">
            <span className="count-summary-icon"><i className="bi bi-cash-stack" aria-hidden="true"></i></span>
            <span>{tr("summary.variance_value")}</span>
            <strong id="varianceValue" hidden={!canViewValue}>{money(summary.value)}</strong>
            <strong className="count-value-mask" hidden={canViewValue}>—</strong>
          </div>
        </div>
        <p id="countError" className="error-text">{countError}</p>
        <div className="count-footer-actions">
          <button id="resetCountBtn" className="btn btn-secondary" type="button"
            hidden={!canPerform} disabled={!canPerform || busy} onClick={reset}>
            <i className="bi bi-plus-lg pos-context-icon" data-icon-tone="emerald" aria-hidden="true"></i>
            <span>{tr("actions.reset")}</span>
          </button>
          <button id="confirmCountBtn" className="btn btn-pay" type="button"
            hidden={!canPerform} disabled={!canPerform || busy} onClick={confirmCount}>
            <i className="bi bi-check-lg pos-context-icon" data-icon-tone="emerald" aria-hidden="true"></i>
            <span>{tr("actions.confirm")}</span>
          </button>
        </div>
      </section>
      <section className="panel count-history-panel" hidden={!canViewHistory}>
        <div className="section-heading count-history-heading">
          <div className="count-history-title">
            <span className="count-history-title-icon"><i className="bi bi-clock-history" aria-hidden="true"></i></span>
            <div>
              <h2><i className="bi bi-clipboard-check pos-context-icon" data-icon-tone="lime" aria-hidden="true"></i><span>{tr("history.title")}</span></h2>
              <p>{tr("history.description")}</p>
            </div>
          </div>
          <span className="count-history-total-badge"><i className="bi bi-archive" aria-hidden="true"></i>{formatNumber(filteredHistory.length)}</span>
        </div>
        <label className="count-history-search">{tr("history.search_label")}
          <input id="historySearch" value={historySearch}
            onChange={event => setHistorySearch(event.target.value)}
            placeholder={tr("history.search_placeholder")} />
        </label>
        <div id="countHistory" className="count-history">
          {filteredHistory.map(record => {
            const differences = (Array.isArray(record.items) ? record.items : [])
              .filter(item => Number(item.difference ?? item.variance ?? 0) !== 0);
            const differenceCount = Number(record.differenceCount ?? differences.length);
            return <article className={`count-history-item ${differenceCount > 0 ? "has-difference" : "is-balanced"}`} key={record.id}>
              <div className="count-history-head">
                <div>
                  <strong>{record.name || record.id}</strong>
                  <span>{record.id} • {record.countDate
                    ? formatDate(new Date(String(record.countDate).includes("T") ? record.countDate : `${record.countDate}T00:00:00`), { year: "numeric", month: "numeric", day: "numeric" })
                    : "-"}</span>
                </div>
                <div className="count-history-total">
                  <strong hidden={!canViewValue}>{t("pos_stock.common.amount_thb", { amount: money(record.varianceValue) })}</strong>
                  <span>{tr("history.difference_count", { count: formatNumber(differenceCount) })}</span>
                </div>
              </div>
              <div className="count-history-meta">
                {tr("history.counted_by", { name: record.countedBy || "-" })}
                {record.note ? ` • ${record.note}` : ""}
              </div>
              <div className="count-history-lines">
                {differences.slice(0, 10).map((item, index) => {
                  const variance = Number(item.difference ?? item.variance ?? 0);
                  return <div className="count-history-line" key={item.productId || index}>
                    <span>{item.productName || item.productId || "-"}</span>
                    <strong className={variance > 0 ? "variance-positive" : "variance-negative"}>
                      {variance > 0 ? "+" : ""}{formatNumber(variance)}
                    </strong>
                  </div>;
                })}
                {!differences.length ? <div className="count-history-line">
                  <span>{tr("history.no_difference")}</span><strong>0</strong>
                </div> : null}
              </div>
            </article>;
          })}
        </div>
        <div id="countHistoryEmpty" className="empty-state count-history-empty" hidden={filteredHistory.length > 0}>
          <span className="count-empty-icon"><i className="bi bi-archive" aria-hidden="true"></i></span>
          <strong>{tr("history.empty")}</strong>
          <small>{tr("visual.history_empty_hint")}</small>
        </div>
      </section>
    </main>

    <dialog id="posScanDialog" ref={scanDialogRef} className="pos-scan-dialog" onClose={() => stopScanner(false)}>
      <div className="pos-scan-sheet">
        <div className="pos-scan-head">
          <div>
            <h2>{scannerText("title")}</h2>
            <p>{scannerText("help")}</p>
          </div>
          <button className="pos-scan-close" type="button" aria-label={scannerText("close")} onClick={() => stopScanner()}>
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
