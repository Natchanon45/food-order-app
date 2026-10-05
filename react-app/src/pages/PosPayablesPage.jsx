import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canUseRetailPos, getRetailPosSession } from "@/auth/retailPosSession";
import { useAuth } from "@/auth/AuthProvider";
import { AppDeveloperPanel } from "@/components/AppDeveloperPanel";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { firstAllowedPosPage, getPosPermissions, PosNavigation } from "@/components/PosNavigation";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import {
  listPosPurchases,
  listPosSuppliers,
  recordPosPayablePayment,
  watchPosPurchases,
  watchPosSuppliers,
} from "@/data/retailPurchasingData";
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

const addDays = (value, days) => {
  const date = new Date(`${String(value || localDateKey(new Date())).slice(0, 10)}T00:00:00`);
  date.setDate(date.getDate() + Number(days || 0));
  return localDateKey(date);
};

function hasPayablePermission(profile, roleRows, permission) {
  if (!profile) return false;
  const roleId = String(profile.roleId || profile.role || "");
  if (roleId === "owner") return true;
  const role = (Array.isArray(roleRows) ? roleRows : [])
    .find(item => String(item?.id || "") === roleId);
  const permissions = Array.isArray(role?.permissions) ? role.permissions : [];
  if (permissions.includes("*")) return true;
  if (permissions.includes(permission)) return true;
  const hasGranular = permissions.some(key => String(key).startsWith("pos.payables."));
  if (hasGranular) return false;
  if (roleId === "admin" || roleId === "manager") {
    return ["pos.payables.pay", "pos.payables.view_amount"].includes(permission);
  }
  return false;
}

export function PosPayablesPage() {
  const authState = useAuth();
  const tenantState = useTenant();
  const { profile, user: authUser } = authState;
  const { tenant } = tenantState;
  const { t, formatNumber, formatDate } = useI18n();
  const tr = useCallback(
    (key, replacements = {}) => t(`pos_purchasing.payables.${key}`, replacements),
    [t],
  );

  const stylesReady = useParityPage({
    title: tr("meta.title"),
    bodyClass: "pos-payables-page",
    attributes: { "data-module": "retail-pos-payables" },
    disabledGlobalStyles: ["app.css", "icons.css", "shared-responsive.css"],
    styles: [
      "app-version-badge-runtime.css",
      "retail-pos-font-local.css",
      "pos-locale-switcher-placement.css",
      "retail-pos.css",
      "retail-payables.css",
      "retail-payables-visual-dashboard.css",
      "retail-pos-navigation.css",
      "page-ready-state.css",
    ],
  });

  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [initialReady, setInitialReady] = useState(false);
  const [roleRows, setRoleRows] = useState(() => cachedPosRoles());
  const [rolesReady, setRolesReady] = useState(() => {
    const session = getRetailPosSession();
    const roleId = String(session?.roleId || session?.role || "");
    return BUILTIN_POS_ROLES.has(roleId) || cachedPosRoles().length > 0;
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [selected, setSelected] = useState(null);
  const [paymentDate, setPaymentDate] = useState(() => localDateKey(new Date()));
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");

  const dialogRef = useRef(null);
  const amountRef = useRef(null);
  const toastTimerRef = useRef(0);

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
  const canView = pagePermissions.has("pos.payables");
  const canPay = hasPayablePermission(posAccessProfile, roleRows, "pos.payables.pay");
  const canViewAmount = hasPayablePermission(posAccessProfile, roleRows, "pos.payables.view_amount");

  const redirectTarget = useMemo(() => {
    if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady) return "";
    const requested = location.pathname + location.search;
    if (!profile) return "/pos/login/?next=" + encodeURIComponent(requested);
    if (!canUseRetailPos(posAccessProfile) || tenantState.status === "error" || !tenant) return "/";
    if (!rolesReady) return "";
    if (!canView) {
      const first = firstAllowedPosPage(posAccessProfile, roleRows);
      return first === "/pos/forbidden"
        ? "/pos/forbidden/?permission=pos.payables&next=" + encodeURIComponent(requested)
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
      console.warn("POS_PAYABLES_ROLE_SETTINGS_LOAD_FAILED", loadError);
      if (!alive) return;
      if (!cached.length && !BUILTIN_POS_ROLES.has(roleId)) setRoleRows([]);
    }).finally(() => {
      if (alive) setRolesReady(true);
    });
    return () => { alive = false; };
  }, [tenant?.id, profile, posAccessProfile?.roleId, posAccessProfile?.role]);

  const refresh = useCallback(async () => {
    if (!tenant?.id || !profile || !canView) return;
    const [nextPurchases, nextSuppliers] = await Promise.all([
      listPosPurchases(tenant.id),
      listPosSuppliers(tenant.id),
    ]);
    setPurchases(nextPurchases);
    setSuppliers(nextSuppliers);
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
      "POS_PAYABLES_INITIAL_LOAD_TIMEOUT",
    ).catch(loadError => {
      console.warn("POS_PAYABLES_LOAD_FAILED", loadError);
    }).finally(() => {
      if (alive) setInitialReady(true);
    });
    return () => { alive = false; };
  }, [tenant?.id, profile, rolesReady, canView, redirectTarget, refresh]);

  useEffect(() => {
    if (!tenant?.id || !profile || !rolesReady || !canView || redirectTarget || !initialReady) {
      return undefined;
    }
    const onError = watchError => console.warn("POS_PAYABLES_WATCH_FAILED", watchError);
    const stopPurchases = watchPosPurchases(tenant.id, setPurchases, onError);
    const stopSuppliers = watchPosSuppliers(tenant.id, setSuppliers, onError);
    return () => {
      stopPurchases();
      stopSuppliers();
    };
  }, [tenant?.id, profile, rolesReady, canView, redirectTarget, initialReady]);

  const money = useCallback(value =>
    formatNumber(Number(value || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  [formatNumber]);
  const amountText = useCallback(
    value => t("pos_purchasing.common.amount_thb", { amount: money(value) }),
    [t, money],
  );
  const dateText = useCallback(value => {
    if (!value) return "-";
    const raw = String(value).slice(0, 10);
    const date = new Date(`${raw}T00:00:00`);
    return formatDate(date, { year: "numeric", month: "short", day: "numeric" });
  }, [formatDate]);

  const todayKey = localDateKey(new Date());
  const normalized = useMemo(() => {
    const supplierById = new Map();
    const supplierByName = new Map();
    suppliers.forEach(item => {
      if (item?.id) supplierById.set(String(item.id), item);
      const key = String(item?.name || "").trim().toLowerCase();
      if (key) supplierByName.set(key, item);
    });
    return purchases.map(purchase => {
      const supplier = supplierById.get(String(purchase.supplierId || ""))
        || supplierByName.get(String(purchase.supplierName || "").trim().toLowerCase())
        || null;
      const creditDays = Math.max(0, Number(purchase.creditDays ?? supplier?.creditDays ?? 0));
      const payments = Array.isArray(purchase.payments) ? purchase.payments : [];
      const paidAmount = payments.length
        ? payments.reduce((sum, item) => sum + Number(item?.amount || 0), 0)
        : Number(purchase.paidAmount || 0);
      const total = Number(purchase.total || 0);
      const balance = Math.max(0, total - paidAmount);
      const purchaseDate = String(purchase.purchaseDate || "").slice(0, 10);
      const dueDate = String(purchase.dueDate || addDays(purchaseDate || todayKey, creditDays)).slice(0, 10);
      const paymentStatus = balance <= 0 ? "paid" : paidAmount > 0 ? "partial" : "unpaid";
      const overdue = balance > 0 && dueDate < todayKey;
      const daysUntilDue = Math.ceil(
        (new Date(`${dueDate}T00:00:00`) - new Date(`${todayKey}T00:00:00`)) / 86400000,
      );
      const dueSoon = balance > 0 && daysUntilDue >= 0 && daysUntilDue <= 7;
      return {
        ...purchase,
        creditDays,
        payments,
        paidAmount,
        total,
        balance,
        purchaseDate,
        dueDate,
        paymentStatus,
        overdue,
        dueSoon,
        daysUntilDue,
      };
    });
  }, [purchases, suppliers, todayKey]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return normalized
      .filter(row => {
        const match = !query || [row.supplierName, row.invoiceNo, row.id]
          .some(value => String(value || "").toLowerCase().includes(query));
        if (!match) return false;
        if (statusFilter === "all") return true;
        if (statusFilter === "open") return row.balance > 0;
        if (statusFilter === "overdue") return row.overdue;
        return row.paymentStatus === statusFilter;
      })
      .sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")));
  }, [normalized, search, statusFilter]);

  const stats = useMemo(() => {
    const openRows = normalized.filter(row => row.balance > 0);
    const outstanding = openRows.reduce((sum, row) => sum + row.balance, 0);
    const dueSoonRows = openRows.filter(row => row.dueSoon);
    const overdueRows = openRows.filter(row => row.overdue);
    const supplierSet = new Set(openRows.map(row => String(row.supplierName || "")).filter(Boolean));
    return {
      outstanding,
      openCount: openRows.length,
      dueSoon: dueSoonRows.reduce((sum, row) => sum + row.balance, 0),
      dueSoonCount: dueSoonRows.length,
      overdue: overdueRows.reduce((sum, row) => sum + row.balance, 0),
      overdueCount: overdueRows.length,
      partialCount: normalized.filter(row => row.paymentStatus === "partial").length,
      paidCount: normalized.filter(row => row.paymentStatus === "paid").length,
      supplierCount: supplierSet.size,
    };
  }, [normalized]);

  const supplierSummary = useMemo(() => {
    const map = new Map();
    normalized.filter(row => row.balance > 0).forEach(row => {
      const name = String(row.supplierName || "-");
      map.set(name, (map.get(name) || 0) + row.balance);
    });
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [normalized]);

  const riskCounts = useMemo(() => {
    const openRows = normalized.filter(row => row.balance > 0);
    const overdue = openRows.filter(row => row.overdue).length;
    const soon = openRows.filter(row => row.dueSoon && !row.overdue).length;
    const later = Math.max(0, openRows.length - overdue - soon);
    const max = Math.max(1, overdue, soon, later);
    return [
      { key: "overdue", label: tr("visual.overdue_count"), value: overdue, tone: "danger", width: (overdue / max) * 100 },
      { key: "soon", label: tr("visual.due_soon_count"), value: soon, tone: "warning", width: (soon / max) * 100 },
      { key: "later", label: tr("visual.later_count"), value: later, tone: "safe", width: (later / max) * 100 },
    ];
  }, [normalized, tr]);

  const statusText = useCallback(status => {
    if (status === "paid") return tr("runtime.status_paid");
    if (status === "partial") return tr("runtime.status_partial");
    return tr("runtime.status_unpaid");
  }, [tr]);

  const showToast = useCallback((message, variant = "success") => {
    setToastType(variant === "error" ? "error" : "success");
    setToastMessage(message);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(""), 2200);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);

  const closePayment = useCallback(() => {
    if (busy) return;
    if (dialogRef.current?.open) dialogRef.current.close();
    setPaymentError("");
  }, [busy]);

  const openPayment = useCallback(row => {
    if (!canPay || !row || row.balance <= 0) return;
    setSelected(row);
    setPaymentDate(localDateKey(new Date()));
    setPaymentAmount(canViewAmount ? Number(row.balance || 0).toFixed(2) : "");
    setPaymentMethod("cash");
    setPaymentReference("");
    setPaymentNote("");
    setPaymentError("");
    dialogRef.current?.showModal?.();
    window.setTimeout(() => amountRef.current?.select?.(), 50);
  }, [canPay, canViewAmount]);

  const submitPayment = useCallback(async event => {
    event.preventDefault();
    if (!selected || !canPay || busy) return;
    const amount = Number(paymentAmount || 0);
    if (!paymentDate || !Number.isFinite(amount) || amount <= 0 || amount > selected.balance + 0.001) {
      setPaymentError(tr("runtime.invalid_amount"));
      return;
    }
    setBusy(true);
    setPaymentError("");
    try {
      const committed = await recordPosPayablePayment(tenant.id, selected.id, {
        date: paymentDate,
        amount,
        method: paymentMethod,
        reference: paymentReference.trim(),
        note: paymentNote.trim(),
      });
      if (committed?.id) {
        setPurchases(current => current.map(row => String(row.id) === String(committed.id) ? committed : row));
      }
      if (dialogRef.current?.open) dialogRef.current.close();
      showToast(tr("runtime.saved_synced"));
    } catch (submitError) {
      console.error("POS_PAYABLE_PAYMENT_FAILED", submitError);
      const message = String(submitError?.message || "");
      const translated = message.includes("PAYMENT_AMOUNT_INVALID")
        ? tr("runtime.invalid_amount")
        : (message || tr("runtime.local_conflict", { error: "PAYMENT_FAILED" }));
      setPaymentError(translated);
      showToast(translated, "error");
    } finally {
      setBusy(false);
    }
  }, [
    selected,
    canPay,
    busy,
    paymentAmount,
    paymentDate,
    paymentMethod,
    paymentReference,
    paymentNote,
    tenant?.id,
    tr,
    showToast,
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
        <PosNavigation profile={posAccessProfile} currentKey="pos.payables" />
      </div>
    </header>

    <main data-pos-management className="payable-container">
      <section className="payable-visual-hero">
        <span className="payable-hero-orbit payable-hero-orbit-one"></span>
        <span className="payable-hero-orbit payable-hero-orbit-two"></span>
        <div className="payable-hero-grid">
          <div className="payable-hero-copy">
            <div className="payable-hero-kicker">
              <i className="bi bi-wallet2" aria-hidden="true"></i>
              <span>{tr("visual.kicker")}</span>
            </div>
            <h1>{tr("header.title")}</h1>
            <p>{tr("visual.hero_description")}</p>
            <div className="payable-hero-status">
              <i className="bi bi-buildings" aria-hidden="true"></i>
              <span>{tr("visual.open_suppliers", { count: formatNumber(stats.supplierCount) })}</span>
            </div>
          </div>
          <div className="payable-hero-metrics">
            <article>
              <span><i className="bi bi-cash-stack" aria-hidden="true"></i>{tr("stats.outstanding")}</span>
              <strong>{canViewAmount ? amountText(stats.outstanding) : "—"}</strong>
            </article>
            <article>
              <span><i className="bi bi-receipt" aria-hidden="true"></i>{tr("stats.open_count")}</span>
              <strong>{formatNumber(stats.openCount)}</strong>
            </article>
            <article>
              <span><i className="bi bi-calendar2-week" aria-hidden="true"></i>{tr("visual.due_soon_count")}</span>
              <strong>{formatNumber(stats.dueSoonCount)}</strong>
            </article>
            <article>
              <span><i className="bi bi-exclamation-triangle" aria-hidden="true"></i>{tr("visual.overdue_count")}</span>
              <strong>{formatNumber(stats.overdueCount)}</strong>
            </article>
          </div>
        </div>
      </section>

      <section className="payable-stats">
        <article className="payable-stat-card payable-stat-outstanding">
          <span className="payable-stat-icon"><i className="bi bi-wallet2" aria-hidden="true"></i></span>
          <span>{tr("stats.outstanding")}</span>
          <strong id="payableOutstanding" hidden={!canViewAmount}>{amountText(stats.outstanding)}</strong>
          <strong className="payable-amount-mask" hidden={canViewAmount}>—</strong>
          <small>{tr("visual.outstanding_hint")}</small>
        </article>
        <article className="payable-stat-card payable-stat-open">
          <span className="payable-stat-icon"><i className="bi bi-files" aria-hidden="true"></i></span>
          <span>{tr("stats.open_count")}</span>
          <strong id="payableOpenCount">{formatNumber(stats.openCount)}</strong>
          <small>{tr("visual.open_hint")}</small>
        </article>
        <article className="payable-stat-card payable-stat-soon warning">
          <span className="payable-stat-icon"><i className="bi bi-clock-history" aria-hidden="true"></i></span>
          <span>{tr("stats.due_soon")}</span>
          <strong id="payableDueSoon" hidden={!canViewAmount}>{amountText(stats.dueSoon)}</strong>
          <strong className="payable-amount-mask" hidden={canViewAmount}>—</strong>
          <small>{tr("visual.due_soon_hint", { count: formatNumber(stats.dueSoonCount) })}</small>
        </article>
        <article className="payable-stat-card payable-stat-overdue danger">
          <span className="payable-stat-icon"><i className="bi bi-exclamation-octagon" aria-hidden="true"></i></span>
          <span>{tr("stats.overdue")}</span>
          <strong id="payableOverdue" hidden={!canViewAmount}>{amountText(stats.overdue)}</strong>
          <strong className="payable-amount-mask" hidden={canViewAmount}>—</strong>
          <small>{tr("visual.overdue_hint", { count: formatNumber(stats.overdueCount) })}</small>
        </article>
      </section>

      <section className="payable-insight-grid">
        <article className="panel payable-risk-panel">
          <div className="payable-insight-heading">
            <span className="payable-insight-icon payable-risk-icon"><i className="bi bi-speedometer2" aria-hidden="true"></i></span>
            <div>
              <h2>{tr("visual.risk_title")}</h2>
              <p>{tr("visual.risk_description")}</p>
            </div>
          </div>
          <div className="payable-risk-list">
            {riskCounts.map(item => <div className={`payable-risk-item is-${item.tone}`} key={item.key}>
              <div><span>{item.label}</span><strong>{formatNumber(item.value)}</strong></div>
              <div className="payable-risk-track"><span style={{ width: `${Math.max(item.value ? 8 : 0, item.width)}%` }}></span></div>
            </div>)}
          </div>
          <div className="payable-risk-footer">
            <span><i className="bi bi-check2-circle" aria-hidden="true"></i>{tr("visual.paid_count")}</span>
            <strong>{formatNumber(stats.paidCount)}</strong>
          </div>
        </article>

        <article className="panel payable-supplier-panel" hidden={!canViewAmount}>
          <div className="payable-insight-heading">
            <span className="payable-insight-icon payable-supplier-icon"><i className="bi bi-buildings-fill" aria-hidden="true"></i></span>
            <div>
              <h2>{tr("visual.supplier_title")}</h2>
              <p>{tr("visual.supplier_description")}</p>
            </div>
          </div>
          <div id="supplierPayableSummary" className="supplier-payable-summary">
            {supplierSummary.length ? supplierSummary.map(([name, value], index) =>
              <article className="supplier-payable-card" key={name}>
                <span className="supplier-rank">{index + 1}</span>
                <div><span>{name}</span><strong>{amountText(value)}</strong></div>
              </article>) : <div className="payable-insight-empty">{tr("empty")}</div>}
          </div>
        </article>
      </section>

      <section className="panel payable-panel">
        <div className="section-heading payable-list-heading">
          <div className="payable-list-title">
            <span className="payable-list-title-icon"><i className="bi bi-list-check" aria-hidden="true"></i></span>
            <div>
              <h2>{tr("panel.title")}</h2>
              <p>{tr("panel.subtitle")}</p>
            </div>
          </div>
          <span className="payable-result-badge"><i className="bi bi-funnel" aria-hidden="true"></i>{formatNumber(filtered.length)}</span>
        </div>

        <div className="payable-filter-surface">
          <label className="payable-search-label">
            <span><i className="bi bi-search" aria-hidden="true"></i>{tr("visual.search_label")}</span>
            <input id="payableSearch" value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={tr("search_placeholder")} />
          </label>
          <label className="payable-status-label">
            <span><i className="bi bi-filter-circle" aria-hidden="true"></i>{tr("visual.status_label")}</span>
            <select id="payableStatusFilter" value={statusFilter}
              onChange={event => setStatusFilter(event.target.value)}>
              <option value="open">{tr("filters.open")}</option>
              <option value="all">{tr("filters.all")}</option>
              <option value="unpaid">{tr("filters.unpaid")}</option>
              <option value="partial">{tr("filters.partial")}</option>
              <option value="paid">{tr("filters.paid")}</option>
              <option value="overdue">{tr("filters.overdue")}</option>
            </select>
          </label>
        </div>

        <div className="table-wrap payable-table-wrap">
          <table className="payable-table">
            <thead><tr>
              <th>{tr("columns.supplier")}</th>
              <th>{tr("columns.invoice")}</th>
              <th>{tr("columns.received_date")}</th>
              <th>{tr("columns.due_date")}</th>
              <th className="number" hidden={!canViewAmount}>{tr("columns.total")}</th>
              <th className="number" hidden={!canViewAmount}>{tr("columns.paid")}</th>
              <th className="number" hidden={!canViewAmount}>{tr("columns.balance")}</th>
              <th>{tr("columns.status")}</th>
              <th></th>
            </tr></thead>
            <tbody id="payableTableBody">
              {filtered.map(row => <tr className={`payable-row ${row.overdue ? "is-overdue" : row.dueSoon ? "is-due-soon" : row.paymentStatus === "paid" ? "is-paid" : "is-open"}`} key={row.id}>
                <td className="payable-supplier-cell" data-label={tr("columns.supplier")}>
                  <span className="payable-supplier-icon"><i className="bi bi-building" aria-hidden="true"></i></span>
                  <strong>{row.supplierName || "-"}</strong>
                </td>
                <td className="payable-document-cell" data-label={tr("columns.invoice")}>
                  <strong>{row.invoiceNo || row.id}</strong>
                  <span>{row.id}</span>
                </td>
                <td data-label={tr("columns.received_date")}>{dateText(row.purchaseDate)}</td>
                <td className={row.overdue ? "status-overdue" : ""} data-label={tr("columns.due_date")}>
                  {dateText(row.dueDate)}
                </td>
                <td className="number" data-label={tr("columns.total")} hidden={!canViewAmount}>{amountText(row.total)}</td>
                <td className="number" data-label={tr("columns.paid")} hidden={!canViewAmount}>{amountText(row.paidAmount)}</td>
                <td className="number payable-balance-cell" data-label={tr("columns.balance")} hidden={!canViewAmount}>
                  <strong>{amountText(row.balance)}</strong>
                </td>
                <td data-label={tr("columns.status")}>
                  <span className={`status-badge status-${row.paymentStatus}`}>
                    <i className={`bi bi-${row.paymentStatus === "paid" ? "check-circle" : row.paymentStatus === "partial" ? "circle-half" : "clock"}`} aria-hidden="true"></i>
                    {statusText(row.paymentStatus)}
                  </span>
                </td>
                <td className="payable-action-cell">
                  {row.balance > 0 ? <button className="payable-action" data-pay-id={row.id}
                    type="button" hidden={!canPay} onClick={() => openPayment(row)}>
                    <i className="bi bi-credit-card" aria-hidden="true"></i>
                    <span>{tr("runtime.pay_action")}</span>
                  </button> : null}
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>

        <div id="payableEmpty" className="empty-state payable-empty" hidden={filtered.length > 0}>
          <span className="payable-empty-icon"><i className="bi bi-inboxes" aria-hidden="true"></i></span>
          <strong>{tr("empty")}</strong>
          <small>{tr("visual.empty_hint")}</small>
        </div>
      </section>
    </main>

    <dialog id="paymentDialog" ref={dialogRef} className="payment-dialog payable-payment-dialog"
      onCancel={event => event.preventDefault()}>
      <form id="supplierPaymentForm" className="payment-form" onSubmit={submitPayment}>
        <div className="dialog-head payable-dialog-head">
          <div className="payable-dialog-title">
            <span className="payable-dialog-title-icon"><i className="bi bi-credit-card-2-front" aria-hidden="true"></i></span>
            <div>
              <h2>{tr("payment.title")}</h2>
              <p>{tr("visual.payment_description")}</p>
            </div>
          </div>
          <button id="closePaymentDialog" type="button" className="icon-btn"
            aria-label={tr("payment.close")} disabled={busy} onClick={closePayment}>
            <i className="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </div>
        <input id="paymentPurchaseId" type="hidden" value={selected?.id || ""} readOnly />
        <div id="paymentPurchaseInfo" className="payment-purchase-info">
          <span><i className="bi bi-building" aria-hidden="true"></i>{selected?.supplierName || "-"}</span>
          <strong>{selected?.invoiceNo || selected?.id || "-"}</strong>
          <small>{canViewAmount && selected
            ? tr("runtime.balance_info", { amount: money(selected.balance) })
            : tr("visual.amount_hidden")}</small>
        </div>

        <div className="payment-grid">
          <label>{tr("payment.date")}
            <span className="payment-field"><i className="bi bi-calendar3" aria-hidden="true"></i>
              <input id="supplierPaymentDate" type="date" required value={paymentDate}
                disabled={!canPay || busy} onChange={event => setPaymentDate(event.target.value)} />
            </span>
          </label>
          <label>{tr("payment.amount")}
            <span className="payment-field"><i className="bi bi-cash-coin" aria-hidden="true"></i>
              <input id="supplierPaymentAmount" ref={amountRef} type="number" min="0.01" step="0.01"
                max={canViewAmount && selected ? Number(selected.balance || 0).toFixed(2) : undefined}
                required value={paymentAmount} disabled={!canPay || busy}
                onChange={event => setPaymentAmount(event.target.value)} />
            </span>
          </label>
          <label>{tr("payment.method")}
            <span className="payment-field"><i className="bi bi-wallet2" aria-hidden="true"></i>
              <select id="supplierPaymentMethod" value={paymentMethod}
                disabled={!canPay || busy} onChange={event => setPaymentMethod(event.target.value)}>
                <option value="cash">{tr("payment.cash")}</option>
                <option value="transfer">{tr("payment.transfer")}</option>
                <option value="cheque">{tr("payment.cheque")}</option>
                <option value="other">{tr("payment.other")}</option>
              </select>
            </span>
          </label>
          <label>{tr("payment.reference")}
            <span className="payment-field"><i className="bi bi-hash" aria-hidden="true"></i>
              <input id="supplierPaymentReference" maxLength={100} value={paymentReference}
                disabled={!canPay || busy} onChange={event => setPaymentReference(event.target.value)} />
            </span>
          </label>
          <label className="payment-note">{tr("payment.note")}
            <span className="payment-field"><i className="bi bi-card-text" aria-hidden="true"></i>
              <input id="supplierPaymentNote" maxLength={200} value={paymentNote}
                disabled={!canPay || busy} onChange={event => setPaymentNote(event.target.value)} />
            </span>
          </label>
        </div>

        <p id="supplierPaymentError" className="error-text">{paymentError}</p>
        <div className="dialog-actions payment-actions">
          <button id="cancelPaymentBtn" type="button" className="btn btn-secondary"
            disabled={busy} onClick={closePayment}>
            <i className="bi bi-x-circle" aria-hidden="true"></i>
            <span>{tr("payment.cancel")}</span>
          </button>
          <button type="submit" className="btn btn-pay" disabled={!canPay || busy}>
            <i className="bi bi-floppy" aria-hidden="true"></i>
            <span>{busy ? t("shared.state.loading") : tr("payment.save")}</span>
          </button>
        </div>
      </form>
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
