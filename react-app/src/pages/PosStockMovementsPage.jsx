import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { canUseRetailPos, getRetailPosSession } from "@/auth/retailPosSession";
import { AppDeveloperPanel } from "@/components/AppDeveloperPanel";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { firstAllowedPosPage, getPosPermissions, PosNavigation } from "@/components/PosNavigation";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { sweetAlert } from "@/components/sweetDialog";
import {
  listRetailProducts,
  listRetailStockMovements,
  watchRetailProducts,
  watchRetailStockMovements,
} from "@/data/retailProductsData";
import { loadPosRoleSettings } from "@/data/retailPosSystemData";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { useTenant } from "@/tenant/TenantProvider";

const BUILTIN_POS_ROLES = new Set(["owner", "admin", "manager", "cashier", "stock", "kitchen"]);
const ROLE_SETTINGS_TIMEOUT_MS = 6000;
const INITIAL_DATA_TIMEOUT_MS = 10000;
const MOVEMENT_TYPES = ["purchase", "sale", "return", "count", "adjustment"];
const MOVEMENT_ICONS = Object.freeze({
  purchase: "box-arrow-in-down",
  sale: "cart-check",
  return: "arrow-counterclockwise",
  count: "clipboard2-check",
  adjustment: "sliders",
});

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

const asDate = value => {
  if (value?.toDate) return value.toDate();
  if (value?.seconds) return new Date(Number(value.seconds) * 1000);
  const date = value instanceof Date ? value : new Date(value || 0);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
};
const dateKey = value => {
  const date = asDate(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};
const movementCreatedAt = row => row.createdAt || row.createdAtServer || row.updatedAt;
const movementType = item => {
  const note = String(item?.note || "").toLowerCase();
  if (note.includes("คืนสินค้า") || note.includes("return-")) return "return";
  if (note.includes("รับสินค้าเข้า") || note.includes("purchase") || note.includes("po-")) return "purchase";
  if (note.includes("ขายสินค้า") || note.includes("sale-")) return "sale";
  if (note.includes("ตรวจนับสต็อก") || note.includes("count-")) return "count";
  return "adjustment";
};
const normalizedMovement = item => {
  const before = Number(item?.before ?? item?.stockBefore ?? 0);
  const after = Number(item?.after ?? item?.stockAfter ?? 0);
  return {
    ...item,
    before,
    after,
    delta: after - before,
    type: movementType(item),
  };
};

function hasMovementPermission(profile, roleRows, permission) {
  if (!profile) return false;
  const roleId = String(profile.roleId || profile.role || "");
  if (roleId === "owner") return true;
  const roles = Array.isArray(roleRows) ? roleRows : [];
  const role = roles.find(item => String(item?.id || "") === roleId);
  const permissions = Array.isArray(role?.permissions) ? role.permissions : [];
  if (permissions.includes("*")) return true;
  if (permissions.includes(permission)) return true;
  const hasGranular = permissions.some(key => String(key).startsWith("pos.stock_movements."));
  if (hasGranular) return false;
  if (roleId === "admin" || roleId === "manager" || roleId === "stock") {
    return ["pos.stock_movements.view_quantity", "pos.stock_movements.export"].includes(permission);
  }
  return false;
}

export function PosStockMovementsPage() {
  const authState = useAuth();
  const tenantState = useTenant();
  const { profile, user: authUser } = authState;
  const { tenant } = tenantState;
  const { t, formatNumber, formatDate } = useI18n();
  const tr = useCallback((key, replacements = {}) => t(`pos_stock.movements.${key}`, replacements), [t]);

  const stylesReady = useParityPage({
    title: tr("meta.title"),
    bodyClass: "pos-stock-movements-page",
    attributes: { "data-module": "retail-pos-stock-movements" },
    disabledGlobalStyles: ["app.css", "icons.css", "shared-responsive.css"],
    styles: [
      "app-version-badge-runtime.css",
      "retail-pos-font-local.css",
      "pos-locale-switcher-placement.css",
      "retail-pos.css",
      "retail-stock-movements.css",
      "retail-stock-movements-visual-dashboard.css",
      "retail-barcode-scan-tools.css",
      "retail-pos-navigation.css",
      "sweet-dialog.css",
    ],
  });

  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [initialReady, setInitialReady] = useState(false);
  const [roleRows, setRoleRows] = useState(() => cachedPosRoles());
  const [rolesReady, setRolesReady] = useState(() => {
    const session = getRetailPosSession();
    const roleId = String(session?.roleId || session?.role || "");
    return BUILTIN_POS_ROLES.has(roleId) || cachedPosRoles().length > 0;
  });
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState("all");
  const [productSearch, setProductSearch] = useState("");
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
  const canView = pagePermissions.has("pos.stock_movements");
  const canViewQuantity = hasMovementPermission(
    posAccessProfile,
    roleRows,
    "pos.stock_movements.view_quantity",
  );
  const canExport = hasMovementPermission(
    posAccessProfile,
    roleRows,
    "pos.stock_movements.export",
  );

  const redirectTarget = useMemo(() => {
    if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady) return "";
    const requested = location.pathname + location.search;
    if (!profile) return "/pos/login/?next=" + encodeURIComponent(requested);
    if (!canUseRetailPos(posAccessProfile) || tenantState.status === "error" || !tenant) return "/";
    if (!rolesReady) return "";
    if (!canView) {
      const first = firstAllowedPosPage(posAccessProfile, roleRows);
      return first === "/pos/forbidden"
        ? "/pos/forbidden/?permission=pos.stock_movements&next=" + encodeURIComponent(requested)
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
      console.warn("POS_STOCK_MOVEMENTS_ROLE_SETTINGS_LOAD_FAILED", error);
      if (!alive) return;
      if (!cached.length && !BUILTIN_POS_ROLES.has(roleId)) setRoleRows([]);
    }).finally(() => {
      if (alive) setRolesReady(true);
    });
    return () => { alive = false; };
  }, [
    tenant?.id,
    profile?.id,
    profile?.uid,
    profile?.role,
    profile?.roleId,
    posAccessProfile?.role,
    posAccessProfile?.roleId,
  ]);
  const refresh = useCallback(async () => {
    if (!tenant?.id) return;
    const [nextRows, nextProducts] = await Promise.all([
      listRetailStockMovements(tenant.id),
      listRetailProducts(tenant.id),
    ]);
    setRows(nextRows);
    setProducts(nextProducts);
  }, [tenant?.id]);

  useEffect(() => {
    let alive = true;
    if (!tenant?.id || !profile || !rolesReady || !canView || redirectTarget) {
      return () => { alive = false; };
    }
    setInitialReady(false);
    withTimeout(
      refresh(),
      INITIAL_DATA_TIMEOUT_MS,
      "POS_STOCK_MOVEMENTS_INITIAL_LOAD_TIMEOUT",
    ).catch(error => {
      console.warn("POS_STOCK_MOVEMENTS_LOAD_FAILED", error);
    }).finally(() => {
      if (alive) setInitialReady(true);
    });
    return () => { alive = false; };
  }, [tenant?.id, profile, rolesReady, canView, redirectTarget, refresh]);

  useEffect(() => {
    if (!tenant?.id || !profile || !rolesReady || !canView || redirectTarget || !initialReady) {
      return undefined;
    }
    const onError = error => console.warn("POS_STOCK_MOVEMENTS_WATCH_FAILED", error);
    return [
      watchRetailStockMovements(tenant.id, setRows, onError),
      watchRetailProducts(tenant.id, setProducts, onError),
    ].reduce((stopAll, stop) => () => {
      stopAll();
      stop?.();
    }, () => {});
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
  const acceptScan = useCallback(codeValue => {
    const code = String(codeValue || "").trim();
    if (!code) return false;
    setScanStatus(scannerText("found", { code }));
    setProductSearch(code);
    signalScanSuccess();
    showToast(scannerText("success"));
    stopScanner();
    return true;
  }, [scannerText, showToast, signalScanSuccess, stopScanner]);
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
      console.warn("POS_STOCK_MOVEMENTS_BARCODE_SCANNER_FAILED", error);
      stopScanner();
      showToast(scannerText("failed"), "error");
    }
  }, [acceptScan, nativeScanLoop, scannerText, showToast, stopScanner]);
  useEffect(() => () => stopScanner(false), [stopScanner]);

  const productSearchById = useMemo(() => {
    const map = new Map();
    products.forEach(product => {
      const id = String(product.id || "");
      if (!id) return;
      map.set(id, `${product.name || id} ${id} ${product.barcode || ""}`.toLowerCase());
    });
    rows.forEach(item => {
      const id = String(item.productId || "");
      if (!id || map.has(id)) return;
      map.set(id, `${item.productName || id} ${id} ${item.barcode || ""}`.toLowerCase());
    });
    return map;
  }, [products, rows]);

  const productOptions = useMemo(() => {
    const map = new Map();
    rows.forEach(item => {
      const id = String(item.productId || "");
      if (id) map.set(id, { id, name: item.productName || id, barcode: String(item.barcode || "") });
    });
    products.forEach(item => {
      const id = String(item.id || "");
      if (id) map.set(id, { id, name: item.name || id, barcode: String(item.barcode || "") });
    });
    return [...map.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), "th"));
  }, [products, rows]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const productQuery = productSearch.trim().toLowerCase();
    return rows.map(normalizedMovement).filter(item => {
      const day = dateKey(movementCreatedAt(item));
      const text = `${item.productName || ""} ${item.productId || ""} ${item.note || ""}`.toLowerCase();
      const productText = productSearchById.get(String(item.productId))
        || `${item.productName || ""} ${item.productId || ""}`.toLowerCase();
      return (!query || text.includes(query))
        && (!from || day >= from)
        && (!to || day <= to)
        && (type === "all" || item.type === type)
        && (!productQuery || productText.includes(productQuery));
    }).sort((a, b) => asDate(movementCreatedAt(b)) - asDate(movementCreatedAt(a)));
  }, [rows, search, productSearch, from, to, type, productSearchById]);

  const stats = useMemo(() => filtered.reduce((summary, item) => {
    summary.count += 1;
    if (item.delta > 0) summary.incoming += item.delta;
    if (item.delta < 0) summary.outgoing += Math.abs(item.delta);
    summary.net += item.delta;
    return summary;
  }, { count: 0, incoming: 0, outgoing: 0, net: 0 }), [filtered]);

  const movementMix = useMemo(() => MOVEMENT_TYPES.map(value => {
    const matching = filtered.filter(item => item.type === value);
    return {
      type: value,
      count: matching.length,
      units: matching.reduce((sum, item) => sum + Math.abs(Number(item.delta || 0)), 0),
    };
  }).filter(item => item.count > 0), [filtered]);

  const movementInsights = useMemo(() => {
    const dominant = [...movementMix].sort((a, b) => b.count - a.count)[0];
    return {
      products: new Set(filtered.map(item => String(item.productId || "")).filter(Boolean)).size,
      dominantType: dominant?.type || "adjustment",
      largestChange: filtered.reduce((largest, item) => Math.max(largest, Math.abs(Number(item.delta || 0))), 0),
    };
  }, [filtered, movementMix]);

  const movementTrend = useMemo(() => {
    const ordered = [...filtered].sort(
      (a, b) => asDate(movementCreatedAt(a)) - asDate(movementCreatedAt(b)),
    );
    if (!ordered.length) return [];
    const sameDay = dateKey(movementCreatedAt(ordered[0]))
      === dateKey(movementCreatedAt(ordered[ordered.length - 1]));
    const buckets = new Map();
    ordered.forEach(item => {
      const date = asDate(movementCreatedAt(item));
      const key = sameDay
        ? `${dateKey(date)}-${String(date.getHours()).padStart(2, "0")}`
        : dateKey(date);
      const current = buckets.get(key) || {
        key,
        label: sameDay
          ? `${String(date.getHours()).padStart(2, "0")}:00`
          : formatDate(date, { day: "2-digit", month: "short" }),
        count: 0,
      };
      current.count += 1;
      buckets.set(key, current);
    });
    return [...buckets.values()].slice(-8);
  }, [filtered, formatDate]);
  const movementTrendMax = useMemo(
    () => Math.max(1, ...movementTrend.map(item => item.count)),
    [movementTrend],
  );

  const periodText = useMemo(() => {
    if (!from && !to) return tr("report.all_data");
    if (from && to) {
      return from === to
        ? tr("report.date", { date: from })
        : tr("report.from_to", { from, to });
    }
    return from ? tr("report.from", { from }) : tr("report.to", { to });
  }, [from, to, tr]);

  const setToday = () => {
    const value = dateKey(new Date());
    setFrom(value);
    setTo(value);
  };
  const setMonth = () => {
    const now = new Date();
    setFrom(dateKey(new Date(now.getFullYear(), now.getMonth(), 1)));
    setTo(dateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  };
  const clearFilters = () => {
    setSearch("");
    setProductSearch("");
    setFrom("");
    setTo("");
    setType("all");
  };
  const typeLabel = value => tr(`types.${MOVEMENT_TYPES.includes(value) ? value : "adjustment"}`);

  const exportCsv = async () => {
    if (!canExport) return;
    if (!filtered.length) {
      await sweetAlert(tr("errors.no_export_data"), {
        title: tr("report.export_csv"),
        type: "warning",
        confirmText: t("shared.actions.ok"),
      });
      return;
    }
    const lines = [[
      tr("columns.datetime"),
      tr("columns.product_id"),
      tr("columns.product"),
      tr("columns.type"),
      tr("columns.note"),
      tr("columns.before"),
      tr("columns.change"),
      tr("columns.after"),
    ]];
    filtered.forEach(item => lines.push([
      asDate(movementCreatedAt(item)).toLocaleString("th-TH"),
      item.productId || "",
      item.productName || "",
      typeLabel(item.type),
      item.note || "",
      item.before,
      item.delta,
      item.after,
    ]));
    const csvCell = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const blob = new Blob([
      "\uFEFF" + lines.map(line => line.map(csvCell).join(",")).join("\r\n"),
    ], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `retail-stock-movements-${from || "all"}-${to || "all"}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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

  const number = value => formatNumber(Number(value || 0));

  return <>
    <header className="pos-header" data-pos-management-header>
      <div className="app-title"><div>
        <strong>{tr("header.title")}</strong>
        <small>{tr("header.subtitle")}</small>
      </div></div>
      <div className="header-actions">
        <LocaleSwitcher />
        <PosNavigation profile={posAccessProfile} currentKey="pos.stock_movements" />
      </div>
    </header>

    <main data-pos-management className="movement-container">
      <section className="movement-visual-hero">
        <div className="movement-hero-orbit movement-hero-orbit-one"></div>
        <div className="movement-hero-orbit movement-hero-orbit-two"></div>
        <div className="movement-hero-grid">
          <div className="movement-hero-copy">
            <div className="movement-hero-kicker">
              <i className="bi bi-boxes" aria-hidden="true"></i>
              <span>{tr("visual.kicker")}</span>
            </div>
            <h1>{tr("header.title")}</h1>
            <p>{tr("visual.hero_description")}</p>
            <div className="movement-hero-period">
              <i className="bi bi-calendar3" aria-hidden="true"></i>
              <span>{periodText}</span>
            </div>
          </div>
          <div className="movement-hero-metrics">
            <article className="movement-hero-metric">
              <span><i className="bi bi-arrow-left-right" aria-hidden="true"></i>{tr("stats.count")}</span>
              <strong>{number(stats.count)}</strong>
            </article>
            <article className="movement-hero-metric">
              <span><i className="bi bi-box-seam" aria-hidden="true"></i>{tr("visual.active_products")}</span>
              <strong>{number(movementInsights.products)}</strong>
            </article>
            <article className="movement-hero-metric">
              <span><i className="bi bi-stars" aria-hidden="true"></i>{tr("visual.dominant_type")}</span>
              <strong className="movement-hero-text-value">{typeLabel(movementInsights.dominantType)}</strong>
            </article>
            <article className="movement-hero-metric">
              <span><i className="bi bi-lightning-charge" aria-hidden="true"></i>{tr("visual.largest_change")}</span>
              <strong>{canViewQuantity ? number(movementInsights.largestChange) : "—"}</strong>
            </article>
          </div>
        </div>
      </section>

      <section className="panel movement-filter-panel">
        <div className="movement-filter-heading">
          <div>
            <span className="movement-filter-icon"><i className="bi bi-funnel" aria-hidden="true"></i></span>
            <div>
              <strong>{tr("visual.filters_title")}</strong>
              <small>{periodText}</small>
            </div>
          </div>
          <span className="movement-filter-result"><i className="bi bi-layers" aria-hidden="true"></i>{number(filtered.length)}</span>
        </div>
        <div className="movement-toolbar">
          <input id="movementSearch" value={search} onChange={event => setSearch(event.target.value)}
            placeholder={tr("search_placeholder")} />
          <input id="movementDateFrom" type="date" value={from} onChange={event => setFrom(event.target.value)} />
          <input id="movementDateTo" type="date" value={to} onChange={event => setTo(event.target.value)} />
          <select id="movementTypeFilter" value={type} onChange={event => setType(event.target.value)}>
            <option value="all">{tr("types.all")}</option>
            {MOVEMENT_TYPES.map(value => <option key={value} value={value}>{tr(`types.${value}`)}</option>)}
          </select>
          <button id="movementTodayBtn" className="btn btn-secondary" type="button" onClick={setToday}>
            <i className="bi bi-calendar3 pos-context-icon" data-icon-tone="blue" aria-hidden="true"></i>
            <span>{tr("ranges.today")}</span>
          </button>
          <button id="movementMonthBtn" className="btn btn-secondary" type="button" onClick={setMonth}>
            <i className="bi bi-calendar3 pos-context-icon" data-icon-tone="blue" aria-hidden="true"></i>
            <span>{tr("ranges.month")}</span>
          </button>
          <button id="movementAllBtn" className="btn btn-secondary" type="button" onClick={clearFilters}>
            <i className="bi bi-x-circle pos-context-icon" data-icon-tone="rose" aria-hidden="true"></i>
            <span>{tr("ranges.all")}</span>
          </button>
        </div>
      </section>

      <section className="movement-stats">
        <article className="movement-stat-card">
          <div className="movement-stat-icon movement-stat-icon-count"><i className="bi bi-list-check" aria-hidden="true"></i></div>
          <span>{tr("stats.count")}</span><strong id="movementCount">{number(stats.count)}</strong>
          <small>{tr("visual.filtered_result")}</small>
        </article>
        <article className="movement-stat-card">
          <div className="movement-stat-icon movement-stat-icon-in"><i className="bi bi-box-arrow-in-down" aria-hidden="true"></i></div>
          <span>{tr("stats.incoming")}</span><strong id="movementIn" hidden={!canViewQuantity}>{number(stats.incoming)}</strong>
          <span className="movement-permission-mask" hidden={canViewQuantity}>—</span>
          <small>{tr("types.purchase")}</small>
        </article>
        <article className="movement-stat-card">
          <div className="movement-stat-icon movement-stat-icon-out"><i className="bi bi-box-arrow-up" aria-hidden="true"></i></div>
          <span>{tr("stats.outgoing")}</span><strong id="movementOut" hidden={!canViewQuantity}>{number(stats.outgoing)}</strong>
          <span className="movement-permission-mask" hidden={canViewQuantity}>—</span>
          <small>{tr("types.sale")}</small>
        </article>
        <article className="movement-stat-card">
          <div className="movement-stat-icon movement-stat-icon-net"><i className="bi bi-activity" aria-hidden="true"></i></div>
          <span>{tr("stats.net")}</span><strong id="movementNet" hidden={!canViewQuantity}
            className={stats.net > 0 ? "movement-positive" : stats.net < 0 ? "movement-negative" : ""}>
            {stats.net > 0 ? "+" : ""}{number(stats.net)}
          </strong>
          <span className="movement-permission-mask" hidden={canViewQuantity}>—</span>
          <small>{tr("visual.net_hint")}</small>
        </article>
      </section>

      <section className="movement-insight-grid">
        <article className="panel movement-activity-panel">
          <div className="movement-insight-heading">
            <div className="movement-insight-title">
              <span className="movement-insight-icon movement-insight-icon-trend"><i className="bi bi-bar-chart-line-fill" aria-hidden="true"></i></span>
              <div>
                <h2>{tr("visual.activity_title")}</h2>
                <p>{tr("visual.activity_description")}</p>
              </div>
            </div>
            <strong>{number(stats.count)}</strong>
          </div>
          <div className="movement-activity-chart" data-points={movementTrend.length}>
            {movementTrend.length ? movementTrend.map(item => {
              const height = Math.max(10, (item.count / movementTrendMax) * 100);
              return <div className="movement-activity-column" key={item.key}>
                <span className="movement-activity-tooltip">{number(item.count)} {tr("visual.events")}</span>
                <span className="movement-activity-bar" style={{ "--movement-height": `${height}%`, height: `${height}%` }}></span>
                <span className="movement-activity-label">{item.label}</span>
              </div>;
            }) : <div className="movement-chart-empty">
              <i className="bi bi-bar-chart" aria-hidden="true"></i>
              <span>{tr("report.empty")}</span>
            </div>}
          </div>
        </article>

        <article className="panel movement-mix-panel">
          <div className="movement-insight-heading">
            <div className="movement-insight-title">
              <span className="movement-insight-icon movement-insight-icon-mix"><i className="bi bi-pie-chart-fill" aria-hidden="true"></i></span>
              <div>
                <h2>{tr("visual.mix_title")}</h2>
                <p>{tr("visual.mix_description")}</p>
              </div>
            </div>
          </div>
          <div className="movement-mix-list">
            {movementMix.length ? movementMix.map(item => {
              const percent = stats.count > 0 ? (item.count / stats.count) * 100 : 0;
              return <div className={`movement-mix-item movement-mix-${item.type}`} key={item.type}>
                <div className="movement-mix-line">
                  <span><i className="bi bi-circle-fill" aria-hidden="true"></i>{typeLabel(item.type)}</span>
                  <strong>{number(item.count)}</strong>
                </div>
                <div className="movement-mix-track">
                  <span style={{ width: `${Math.max(4, percent)}%` }}></span>
                </div>
              </div>;
            }) : <div className="movement-mix-empty">{tr("report.empty")}</div>}
          </div>
          <div className="movement-balance-card">
            <div>
              <span>{tr("visual.flow_balance")}</span>
              <strong>{canViewQuantity ? number(stats.incoming + stats.outgoing) : "—"}</strong>
            </div>
            <div className="movement-balance-track" aria-hidden="true">
              <span className="movement-balance-in" style={{
                width: canViewQuantity && stats.incoming + stats.outgoing > 0
                  ? `${(stats.incoming / (stats.incoming + stats.outgoing)) * 100}%`
                  : "50%",
              }}></span>
            </div>
            <small>{tr("visual.flow_balance_hint")}</small>
          </div>
        </article>
      </section>

      <section className="panel movement-report-panel">
        <div className="movement-report-heading section-heading">
          <div className="movement-report-title">
            <span className="movement-report-icon"><i className="bi bi-clock-history" aria-hidden="true"></i></span>
            <div>
              <h1><i className="bi bi-bookmark-star pos-context-icon" data-icon-tone="green" aria-hidden="true"></i><span>{tr("report.title")}</span></h1>
              <p id="movementPeriodText">{periodText}</p>
            </div>
          </div>
          <button id="exportMovementCsv" className="btn btn-pay" type="button"
            hidden={!canExport} onClick={exportCsv}>
            <i className="bi bi-download pos-context-icon" data-icon-tone="blue" aria-hidden="true"></i>
            <span>{tr("report.export_csv")}</span>
          </button>
        </div>
        <div className="movement-product-filter">
          <div className="movement-product-filter-label">
            <i className="bi bi-search" aria-hidden="true"></i>
            <span>{tr("visual.product_filter")}</span>
          </div>
          <div className="barcode-input-group movement-product-input">
            <input id="movementProductFilter" list="movementProductOptions" autoComplete="off"
              value={productSearch} onChange={event => setProductSearch(event.target.value)}
              placeholder={tr("product_search_placeholder")} />
            <button className="movement-filter-clear" type="button" hidden={!productSearch.trim()}
              aria-label={t("pos_products.categories.clear_search")} title={t("pos_products.categories.clear_search")}
              onClick={() => setProductSearch("")}>
              <i className="bi bi-x-lg" aria-hidden="true"></i>
            </button>
            <button id="scanMovementProductBtn" className="scan-barcode-btn" type="button"
              aria-label={scannerText("button")} title={scannerText("button")} onClick={startScanner}>
              <i className="bi bi-upc-scan scan-barcode-icon" aria-hidden="true"></i>
              <span>{scannerText("button")}</span>
            </button>
          </div>
          <datalist id="movementProductOptions">
            {productOptions.map(product => <option key={product.id} value={product.name}>
              {[product.id, product.barcode].filter(Boolean).join(" • ")}
            </option>)}
          </datalist>
        </div>
        <div className="table-wrap">
          <table className="movement-table">
            <thead><tr>
              <th>{tr("columns.datetime")}</th>
              <th>{tr("columns.product")}</th>
              <th>{tr("columns.type")}</th>
              <th>{tr("columns.note")}</th>
              <th className="number" hidden={!canViewQuantity}>{tr("columns.before")}</th>
              <th className="number" hidden={!canViewQuantity}>{tr("columns.change")}</th>
              <th className="number" hidden={!canViewQuantity}>{tr("columns.after")}</th>
            </tr></thead>
            <tbody id="movementTableBody">
              {filtered.map(item => <tr className={`movement-row movement-row-${item.type}`} key={item.id}>
                <td className="movement-date">
                  <span className="movement-date-icon"><i className="bi bi-clock" aria-hidden="true"></i></span>
                  <span>{asDate(movementCreatedAt(item)).toLocaleString("th-TH")}</span>
                </td>
                <td className="movement-product">
                  <strong>{item.productName || item.productId || "-"}</strong>
                  <span>{item.productId || "-"}</span>
                </td>
                <td data-label={tr("columns.type")}>
                  <span className={`movement-badge movement-${item.type}`}>
                    <i className={`bi bi-${MOVEMENT_ICONS[item.type] || MOVEMENT_ICONS.adjustment}`} aria-hidden="true"></i>
                    <span>{typeLabel(item.type)}</span>
                  </span>
                </td>
                <td className="movement-note" data-label={tr("columns.note")}>{item.note || "-"}</td>
                <td className="number" data-label={tr("columns.before")} hidden={!canViewQuantity}>{number(item.before)}</td>
                <td className={`number ${item.delta > 0 ? "movement-positive" : item.delta < 0 ? "movement-negative" : ""}`}
                  data-label={tr("columns.change")} hidden={!canViewQuantity}>
                  {item.delta > 0 ? "+" : ""}{number(item.delta)}
                </td>
                <td className="number" data-label={tr("columns.after")} hidden={!canViewQuantity}>{number(item.after)}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <div id="movementEmpty" className="empty-state movement-empty" hidden={filtered.length > 0}>
          <span className="movement-empty-icon"><i className="bi bi-inboxes" aria-hidden="true"></i></span>
          <strong>{tr("report.empty")}</strong>
          <small>{tr("visual.empty_hint")}</small>
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
