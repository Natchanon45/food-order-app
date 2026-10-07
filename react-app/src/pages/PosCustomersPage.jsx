import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canUseRetailPos, getRetailPosSession } from "@/auth/retailPosSession";
import { useAuth } from "@/auth/AuthProvider";
import { AppDeveloperPanel } from "@/components/AppDeveloperPanel";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { firstAllowedPosPage, getPosPermissions, PosNavigation } from "@/components/PosNavigation";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { sweetAlert, sweetConfirm } from "@/components/sweetDialog";
import {
  deletePosCustomer,
  listPosCustomers,
  listPosLoyaltyLedger,
  listPosSales,
  savePosCustomer,
  watchPosCustomers,
  watchPosLoyaltyLedger,
  watchPosSales,
} from "@/data/retailPosData";
import { loadPosRoleSettings } from "@/data/retailPosSystemData";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { useTenant } from "@/tenant/TenantProvider";

const BUILTIN_POS_ROLES = new Set(["owner", "admin", "manager", "cashier", "stock", "kitchen"]);
const ROLE_SETTINGS_TIMEOUT_MS = 6000;
const INITIAL_DATA_TIMEOUT_MS = 10000;
const EMPTY_CUSTOMER = Object.freeze({
  id: "", customerCode: "", name: "", phone: "", email: "", address: "", note: "", points: 0, active: true,
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
    const error = new Error(code); error.code = code; reject(error);
  }, timeoutMs)),
]);
const asDate = value => value?.toDate?.() || new Date(value || 0);
const saleNet = sale => Math.max(0, Number(sale?.totalAmount ?? sale?.total ?? 0) - Number(sale?.refundTotal || 0));
const saleQty = sale => (sale?.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);

function hasCustomerPermission(profile, roleRows, permission) {
  if (!profile) return false;
  const roleId = String(profile.roleId || profile.role || "");
  if (roleId === "owner") return true;
  const role = (Array.isArray(roleRows) ? roleRows : []).find(item => String(item?.id || "") === roleId);
  const permissions = Array.isArray(role?.permissions) ? role.permissions : [];
  if (permissions.includes("*") || permissions.includes(permission)) return true;
  const hasGranular = permissions.some(key => String(key).startsWith("pos.customers."));
  if (hasGranular) return false;
  const common = [
    "pos.customers.create", "pos.customers.edit", "pos.customers.view_history",
    "pos.customers.view_points", "pos.customers.view_sales",
  ];
  if (roleId === "cashier") return common.includes(permission);
  if (roleId === "admin" || roleId === "manager") {
    return [...common, "pos.customers.delete"].includes(permission);
  }
  return false;
}

function nextCustomerCode(rows = []) {
  const max = rows.reduce((current, row) => {
    const number = Number(String(row.customerCode || "").match(/^C(\d+)$/i)?.[1] || 0);
    return Math.max(current, number);
  }, 0);
  return "C" + String(max + 1).padStart(5, "0");
}

export function PosCustomersPage() {
  const authState = useAuth(), tenantState = useTenant();
  const { profile, user: authUser } = authState, { tenant } = tenantState;
  const { t, formatNumber, formatDate } = useI18n();
  const tr = useCallback((key, replacements = {}) => t(`pos_customers.${key}`, replacements), [t]);
  const stylesReady = useParityPage({
    title: tr("meta.title"),
    bodyClass: "pos-customers-page",
    attributes: { "data-module": "retail-pos-customers" },
    disabledGlobalStyles: ["app.css", "icons.css", "shared-responsive.css"],
    styles: [
      "app-version-badge-runtime.css", "retail-pos-font-local.css", "pos-locale-switcher-placement.css",
      "retail-pos.css", "retail-customers.css", "retail-loyalty.css",
      "retail-customers-visual-dashboard.css", "retail-pos-navigation.css",
      "sweet-dialog.css", "page-ready-state.css",
    ],
  });

  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [initialReady, setInitialReady] = useState(false);
  const [roleRows, setRoleRows] = useState(() => cachedPosRoles());
  const [rolesReady, setRolesReady] = useState(() => {
    const session = getRetailPosSession(), roleId = String(session?.roleId || session?.role || "");
    return BUILTIN_POS_ROLES.has(roleId) || cachedPosRoles().length > 0;
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState(() => ({ ...EMPTY_CUSTOMER }));
  const [selected, setSelected] = useState(null);
  const [loyaltyCustomer, setLoyaltyCustomer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");
  const formRef = useRef(null), historyRef = useRef(null), loyaltyRef = useRef(null), nameRef = useRef(null), toastTimerRef = useRef(0);

  const posSession = useMemo(() => getRetailPosSession(), [
    authUser?.uid, profile?.id, profile?.uid, profile?.tenantId, profile?.role, profile?.roleId,
  ]);
  const posAccessProfile = useMemo(() => ({
    ...(profile || {}), ...(posSession || {}),
    role: posSession?.role || profile?.role || profile?.roleId || "",
    roleId: posSession?.roleId || posSession?.role || profile?.roleId || profile?.role || "",
  }), [profile, posSession]);
  const pagePermissions = useMemo(() => getPosPermissions(posAccessProfile, roleRows), [posAccessProfile, roleRows]);
  const canView = pagePermissions.has("pos.customers");
  const canCreate = hasCustomerPermission(posAccessProfile, roleRows, "pos.customers.create");
  const canEdit = hasCustomerPermission(posAccessProfile, roleRows, "pos.customers.edit");
  const canDelete = hasCustomerPermission(posAccessProfile, roleRows, "pos.customers.delete");
  const canViewHistory = hasCustomerPermission(posAccessProfile, roleRows, "pos.customers.view_history");
  const canViewPoints = hasCustomerPermission(posAccessProfile, roleRows, "pos.customers.view_points");
  const canViewSales = hasCustomerPermission(posAccessProfile, roleRows, "pos.customers.view_sales");

  const redirectTarget = useMemo(() => {
    if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady) return "";
    const requested = location.pathname + location.search;
    if (!profile) return "/pos/login/?next=" + encodeURIComponent(requested);
    if (!canUseRetailPos(posAccessProfile) || tenantState.status === "error" || !tenant) return "/";
    if (!rolesReady) return "";
    if (!canView) {
      const first = firstAllowedPosPage(posAccessProfile, roleRows);
      return first === "/pos/forbidden"
        ? "/pos/forbidden/?permission=pos.customers&next=" + encodeURIComponent(requested)
        : first + "?from=permission";
    }
    return "";
  }, [authState.status, tenantState.status, tenant, profile, posAccessProfile, roleRows, rolesReady, canView, stylesReady]);
  useEffect(() => { if (redirectTarget) location.replace(redirectTarget); }, [redirectTarget]);

  useEffect(() => {
    let alive = true;
    if (!tenant?.id || !profile) { setRoleRows([]); setRolesReady(true); return () => { alive = false; }; }
    const cached = cachedPosRoles(), roleId = String(posAccessProfile?.roleId || posAccessProfile?.role || "");
    if (cached.length) setRoleRows(cached);
    setRolesReady(BUILTIN_POS_ROLES.has(roleId) || cached.length > 0);
    withTimeout(loadPosRoleSettings(tenant.id), ROLE_SETTINGS_TIMEOUT_MS, "POS_ROLE_SETTINGS_TIMEOUT")
      .then(next => {
        if (!alive) return;
        const rows = Array.isArray(next) ? next : [];
        setRoleRows(rows);
        try { localStorage.setItem("retail_pos_roles_v1", JSON.stringify(rows)); } catch {}
      })
      .catch(loadError => {
        console.warn("POS_CUSTOMERS_ROLE_SETTINGS_LOAD_FAILED", loadError);
        if (alive && !cached.length && !BUILTIN_POS_ROLES.has(roleId)) setRoleRows([]);
      })
      .finally(() => { if (alive) setRolesReady(true); });
    return () => { alive = false; };
  }, [tenant?.id, profile, posAccessProfile?.roleId, posAccessProfile?.role]);

  const refresh = useCallback(async () => {
    if (!tenant?.id || !profile || !canView) return;
    const [nextCustomers, nextSales, nextLedger] = await Promise.all([
      listPosCustomers(tenant.id),
      listPosSales(tenant.id),
      listPosLoyaltyLedger(tenant.id),
    ]);
    setCustomers(nextCustomers); setSales(nextSales); setLedger(nextLedger);
  }, [tenant?.id, profile, canView]);

  useEffect(() => {
    let alive = true;
    if (!tenant?.id || !profile || !rolesReady || !canView || redirectTarget) {
      setInitialReady(false);
      return () => { alive = false; };
    }
    withTimeout(refresh(), INITIAL_DATA_TIMEOUT_MS, "POS_CUSTOMERS_INITIAL_LOAD_TIMEOUT")
      .catch(loadError => console.warn("POS_CUSTOMERS_LOAD_FAILED", loadError))
      .finally(() => { if (alive) setInitialReady(true); });
    return () => { alive = false; };
  }, [tenant?.id, profile, rolesReady, canView, redirectTarget, refresh]);

  useEffect(() => {
    if (!tenant?.id || !profile || !rolesReady || !canView || redirectTarget || !initialReady) return undefined;
    const onError = watchError => console.warn("POS_CUSTOMERS_WATCH_FAILED", watchError);
    const stopCustomers = watchPosCustomers(tenant.id, setCustomers, onError);
    const stopSales = watchPosSales(tenant.id, setSales, onError);
    const stopLedger = watchPosLoyaltyLedger(tenant.id, setLedger, onError);
    return () => { stopCustomers(); stopSales(); stopLedger(); };
  }, [tenant?.id, profile, rolesReady, canView, redirectTarget, initialReady]);

  const money = useCallback(value => formatNumber(Number(value || 0), {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }), [formatNumber]);
  const amountText = useCallback(value => tr("runtime.amount_thb", { amount: money(value) }), [tr, money]);
  const dateText = useCallback(value => {
    if (!value) return "-";
    const date = asDate(value);
    return Number.isNaN(date.getTime()) ? "-" : formatDate(date, { year: "numeric", month: "short", day: "2-digit" });
  }, [formatDate]);
  const dateTimeText = useCallback(value => {
    if (!value) return "-";
    const date = asDate(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
  }, []);

  const salesMap = useMemo(() => {
    const map = new Map();
    sales.forEach(sale => {
      const keys = [String(sale.customerId || ""), String(sale.customerName || "").trim().toLowerCase()].filter(Boolean);
      const primary = keys[0] || keys[1];
      if (!primary) return;
      const current = map.get(primary) || { count: 0, total: 0, last: null, rows: [] };
      current.count += 1;
      current.total += saleNet(sale);
      current.rows.push(sale);
      if (!current.last || asDate(sale.createdAt) > asDate(current.last)) current.last = sale.createdAt;
      map.set(primary, current);
      keys.slice(1).forEach(key => { if (!map.has(key)) map.set(key, current); });
    });
    return map;
  }, [sales]);

  const summaryFor = useCallback(customer =>
    salesMap.get(String(customer?.id || ""))
    || salesMap.get(String(customer?.name || "").trim().toLowerCase())
    || { count: 0, total: 0, last: null, rows: [] },
  [salesMap]);

  const ledgerFor = useCallback(customer => ledger
    .filter(row => String(row.customerId || "") === String(customer?.id || ""))
    .sort((a, b) => asDate(b.createdAt || b.updatedAt) - asDate(a.createdAt || a.updatedAt)),
  [ledger]);

  const customerRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter(customer => {
      const history = summaryFor(customer), hasHistory = history.count > 0;
      const match = !q || [customer.customerCode, customer.id, customer.name, customer.phone, customer.email]
        .some(value => String(value || "").toLowerCase().includes(q));
      return match && (filter === "all" || (filter === "active" && hasHistory) || (filter === "inactive" && !hasHistory));
    }).sort((a, b) => String(a.customerCode || a.id).localeCompare(String(b.customerCode || b.id)));
  }, [customers, search, filter, summaryFor]);

  const stats = useMemo(() => {
    const withHistory = customers.filter(customer => summaryFor(customer).count > 0).length;
    const points = customers.reduce((sum, customer) => sum + Math.max(0, Number(customer.points || 0)), 0);
    const totals = customers.reduce((acc, customer) => {
      const history = summaryFor(customer);
      acc.sales += history.total; acc.bills += history.count;
      return acc;
    }, { sales: 0, bills: 0 });
    return {
      total: customers.length,
      withHistory,
      points,
      averagePoints: customers.length ? points / customers.length : 0,
      sales: totals.sales,
      bills: totals.bills,
    };
  }, [customers, summaryFor]);

  const showToast = useCallback((message, variant = "success") => {
    setToastType(variant === "error" ? "error" : "success"); setToastMessage(message);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(""), 2200);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);

  const closeForm = useCallback(() => {
    if (busy) return;
    if (formRef.current?.open) formRef.current.close();
    setError("");
  }, [busy]);
  const openAdd = useCallback(() => {
    if (!canCreate) return;
    setForm({ ...EMPTY_CUSTOMER, customerCode: nextCustomerCode(customers) });
    setError(""); formRef.current?.showModal?.();
    window.setTimeout(() => nameRef.current?.focus?.(), 50);
  }, [canCreate, customers]);
  const openEdit = useCallback(customer => {
    if (!canEdit) return;
    setForm({ ...EMPTY_CUSTOMER, ...customer });
    setError(""); formRef.current?.showModal?.();
    window.setTimeout(() => nameRef.current?.focus?.(), 50);
  }, [canEdit]);
  const change = useCallback((key, value) => setForm(current => ({ ...current, [key]: value })), []);

  const submit = useCallback(async event => {
    event.preventDefault();
    const editing = Boolean(form.id), allowed = editing ? canEdit : canCreate;
    if (!allowed || busy) return;
    const name = String(form.name || "").trim();
    if (!name) { setError(tr("runtime.name_required")); return; }
    setBusy(true); setError("");
    try {
      const saved = await savePosCustomer(tenant.id, { ...form, name }, form.id);
      setCustomers(current => {
        const exists = current.some(row => String(row.id) === String(saved.id));
        return (exists ? current.map(row => String(row.id) === String(saved.id) ? saved : row) : [...current, saved])
          .sort((a, b) => String(a.customerCode || a.id).localeCompare(String(b.customerCode || b.id)));
      });
      if (formRef.current?.open) formRef.current.close();
      showToast(tr(editing ? "runtime.edited_synced" : "runtime.added_synced", { code: saved.customerCode || "" }));
    } catch (submitError) {
      console.error("POS_CUSTOMER_SAVE_FAILED", submitError);
      const message = String(submitError?.message || "");
      const translated = message.includes("CUSTOMER_NAME_REQUIRED")
        ? tr("runtime.name_required")
        : tr("runtime.save_failed", { error: message || "SAVE_FAILED" });
      setError(translated); showToast(translated, "error");
    } finally {
      setBusy(false);
    }
  }, [form, canEdit, canCreate, busy, tenant?.id, tr, showToast]);

  const remove = useCallback(async customer => {
    if (!canDelete || busy) return;
    const history = summaryFor(customer);
    if (history.count > 0) {
      await sweetAlert({ title: tr("runtime.delete_used"), confirmText: t("shared.action.ok") });
      return;
    }
    const approved = await sweetConfirm({
      title: tr("runtime.delete_confirm", { name: customer.name }),
      confirmText: tr("runtime.delete"),
      cancelText: tr("form.cancel"),
      tone: "danger",
    });
    if (!approved) return;
    setBusy(true);
    try {
      await deletePosCustomer(tenant.id, customer.id);
      setCustomers(current => current.filter(row => String(row.id) !== String(customer.id)));
      showToast(tr("runtime.deleted_synced"));
    } catch (deleteError) {
      console.error("POS_CUSTOMER_DELETE_FAILED", deleteError);
      const message = tr("runtime.delete_failed", { error: String(deleteError?.message || "DELETE_FAILED") });
      showToast(message, "error");
      await sweetAlert({ title: message, confirmText: t("shared.action.ok") });
    } finally {
      setBusy(false);
    }
  }, [canDelete, busy, summaryFor, tenant?.id, tr, t, showToast]);

  const showHistory = useCallback(customer => {
    if (!canViewHistory) return;
    setSelected(customer); historyRef.current?.showModal?.();
  }, [canViewHistory]);
  const showLoyalty = useCallback(customer => {
    if (!canViewPoints) return;
    setLoyaltyCustomer(customer); loyaltyRef.current?.showModal?.();
  }, [canViewPoints]);

  const selectedSales = useMemo(() => selected
    ? [...summaryFor(selected).rows].sort((a, b) => asDate(b.createdAt) - asDate(a.createdAt))
    : [], [selected, summaryFor]);
  const loyaltyRows = useMemo(() => loyaltyCustomer ? ledgerFor(loyaltyCustomer) : [], [loyaltyCustomer, ledgerFor]);
  const loyaltySummary = useMemo(() => loyaltyRows.reduce((acc, row) => {
    const isReturn = row.type === "return";
    acc.earned += isReturn ? Number(row.pointsUsedRestored || 0) : Number(row.pointsEarned || 0);
    acc.used += isReturn ? Number(row.pointsEarnedDeducted || 0) : Number(row.pointsUsed || 0);
    return acc;
  }, {
    count: loyaltyRows.length,
    earned: 0,
    used: 0,
    balance: Math.max(0, Number(loyaltyCustomer?.points ?? loyaltyRows[0]?.balanceAfter ?? 0)),
  }), [loyaltyCustomer?.points, loyaltyRows]);

  const needsReady = authState.status === "loading" || tenantState.status === "loading" || !stylesReady
    || Boolean(redirectTarget) || !rolesReady || (tenant?.id && profile && canView && !initialReady);
  if (needsReady) return <PageReadyOverlay title={t("shared.state.loading")} message={t("shared.state.please_wait")} />;

  return <>
    <header className="pos-header" data-pos-management-header>
      <div className="app-title"><div><strong>{tr("header.title")}</strong><small>{tr("header.subtitle")}</small></div></div>
      <div className="header-actions"><LocaleSwitcher/><PosNavigation profile={posAccessProfile} currentKey="pos.customers"/></div>
    </header>

    <main data-pos-management className="customer-container">
      <section className="customer-visual-hero">
        <span className="customer-hero-orbit customer-hero-orbit-one"></span>
        <span className="customer-hero-orbit customer-hero-orbit-two"></span>
        <div className="customer-hero-grid">
          <div className="customer-hero-copy">
            <div className="customer-hero-kicker"><i className="bi bi-people-fill" aria-hidden="true"></i><span>{tr("visual.kicker")}</span></div>
            <h1>{tr("header.title")}</h1>
            <p>{tr("visual.hero_description")}</p>
            <div className="customer-hero-status"><i className="bi bi-stars" aria-hidden="true"></i><span>{tr("visual.integrated")}</span></div>
          </div>
          <div className="customer-hero-metrics">
            <article><span><i className="bi bi-person-vcard" aria-hidden="true"></i>{tr("stats.total")}</span><strong>{formatNumber(stats.total)}</strong></article>
            <article><span><i className="bi bi-bag-check" aria-hidden="true"></i>{tr("stats.active")}</span><strong>{formatNumber(stats.withHistory)}</strong></article>
            <article><span><i className="bi bi-star-fill" aria-hidden="true"></i>{tr("visual.average_points")}</span><strong>{canViewPoints ? formatNumber(Math.round(stats.averagePoints)) : "—"}</strong></article>
            <article><span><i className="bi bi-receipt" aria-hidden="true"></i>{tr("stats.bill_total")}</span><strong>{canViewSales ? formatNumber(stats.bills) : "—"}</strong></article>
          </div>
        </div>
      </section>

      <section className="customer-stats">
        <article className="customer-stat-card customer-stat-total"><span className="customer-stat-icon"><i className="bi bi-people" aria-hidden="true"></i></span><span>{tr("stats.total")}</span><strong id="customerTotal">{formatNumber(stats.total)}</strong><small>{tr("visual.total_hint")}</small></article>
        <article className="customer-stat-card customer-stat-active"><span className="customer-stat-icon"><i className="bi bi-bag-heart" aria-hidden="true"></i></span><span>{tr("stats.active")}</span><strong id="activeCustomerTotal">{formatNumber(stats.withHistory)}</strong><small>{tr("visual.history_hint")}</small></article>
        <article className="customer-stat-card customer-stat-sales"><span className="customer-stat-icon"><i className="bi bi-cash-stack" aria-hidden="true"></i></span><span>{tr("stats.sales_total")}</span><strong id="customerSalesTotal" hidden={!canViewSales}>{amountText(stats.sales)}</strong><strong className="customer-sales-mask" hidden={canViewSales}>—</strong><small>{tr("visual.sales_hint")}</small></article>
        <article className="customer-stat-card customer-stat-bills"><span className="customer-stat-icon"><i className="bi bi-receipt-cutoff" aria-hidden="true"></i></span><span>{tr("stats.bill_total")}</span><strong id="customerBillTotal" hidden={!canViewSales}>{formatNumber(stats.bills)}</strong><strong className="customer-sales-mask" hidden={canViewSales}>—</strong><small>{tr("visual.bills_hint")}</small></article>
      </section>

      <section className="panel customer-panel">
        <div className="section-heading customer-list-heading">
          <div className="customer-list-title"><span className="customer-list-title-icon"><i className="bi bi-person-lines-fill" aria-hidden="true"></i></span><div><h2>{tr("panel.title")}</h2><p>{tr("panel.subtitle")}</p></div></div>
          <button id="addCustomerBtn" className="btn btn-pay" type="button" hidden={!canCreate} onClick={openAdd}><i className="bi bi-person-plus" aria-hidden="true"></i><span>{tr("add")}</span></button>
        </div>
        <div className="customer-toolbar">
          <label><span><i className="bi bi-search" aria-hidden="true"></i>{tr("visual.search_label")}</span><input id="customerSearch" value={search} onChange={event => setSearch(event.target.value)} placeholder={tr("search_placeholder")}/></label>
          <label><span><i className="bi bi-filter-circle" aria-hidden="true"></i>{tr("visual.filter_label")}</span><select id="customerFilter" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">{tr("filters.all")}</option><option value="active">{tr("filters.active")}</option><option value="inactive">{tr("filters.inactive")}</option></select></label>
        </div>

        <div id="customerGrid" className="customer-grid">
          {customerRows.map(customer => {
            const history = summaryFor(customer), hasHistory = history.count > 0;
            return <article className={`customer-card ${hasHistory ? "has-history" : "no-history"}`} key={customer.id}>
              <div className="customer-card-head">
                <div className="customer-card-identity">
                  <span className="customer-avatar"><i className="bi bi-person-fill" aria-hidden="true"></i></span>
                  <div><h3>{customer.name}</h3><span>{tr("runtime.member_code", { code: customer.customerCode || customer.id })}</span></div>
                </div>
                <span className={`customer-history-badge ${hasHistory ? "is-active" : "is-new"}`}><i className={`bi bi-${hasHistory ? "bag-check" : "sparkles"}`} aria-hidden="true"></i>{hasHistory ? dateText(history.last) : tr("visual.never_purchased")}</span>
              </div>
              <div className="customer-contact">
                {customer.phone ? <span><i className="bi bi-telephone" aria-hidden="true"></i>{tr("runtime.phone", { phone: customer.phone })}</span> : null}
                {customer.email ? <span><i className="bi bi-envelope" aria-hidden="true"></i>{customer.email}</span> : null}
                {customer.address ? <span><i className="bi bi-geo-alt" aria-hidden="true"></i>{customer.address}</span> : null}
              </div>
              <button className="customer-points-badge" data-loyalty-customer-id={customer.id} type="button" hidden={!canViewPoints} onClick={() => showLoyalty(customer)}>
                <i className="bi bi-star-fill" aria-hidden="true"></i><span>{tr("runtime.points", { count: formatNumber(customer.points || 0) })}</span><i className="bi bi-chevron-right" aria-hidden="true"></i>
              </button>
              <div className="customer-summary" hidden={!canViewSales}>
                <div><span>{tr("history.bill_count")}</span><strong>{formatNumber(history.count)}</strong></div>
                <div><span>{tr("stats.sales_total")}</span><strong>{amountText(history.total)}</strong></div>
                <div><span>{tr("history.latest_purchase")}</span><strong>{history.last ? dateText(history.last) : "-"}</strong></div>
              </div>
              <div className="customer-actions">
                <button data-action="history" type="button" hidden={!canViewHistory} onClick={() => showHistory(customer)}><i className="bi bi-clock-history" aria-hidden="true"></i><span>{tr("runtime.history")}</span></button>
                <button data-action="edit" type="button" hidden={!canEdit} onClick={() => openEdit(customer)}><i className="bi bi-pencil-square" aria-hidden="true"></i><span>{tr("runtime.edit")}</span></button>
                <button className="delete" data-action="delete" type="button" hidden={!canDelete} onClick={() => remove(customer)}><i className="bi bi-trash3" aria-hidden="true"></i><span>{tr("runtime.delete")}</span></button>
              </div>
            </article>;
          })}
        </div>
        <div id="customerEmpty" className="empty-state customer-empty" hidden={customerRows.length > 0}><span className="customer-empty-icon"><i className="bi bi-people" aria-hidden="true"></i></span><strong>{tr("empty")}</strong><small>{tr("visual.empty_hint")}</small></div>
      </section>
    </main>

    <dialog id="customerDialog" ref={formRef} className="customer-dialog customer-editor-dialog" onCancel={event => event.preventDefault()}>
      <form id="customerForm" className="payment-form" onSubmit={submit}>
        <div className="dialog-head customer-dialog-head">
          <div className="customer-dialog-title"><span className="customer-dialog-title-icon"><i className="bi bi-person-plus" aria-hidden="true"></i></span><div><h2 id="customerDialogTitle">{form.id ? tr("form.edit_title") : tr("form.add_title")}</h2><p>{tr("visual.form_description")}</p></div></div>
          <button id="closeCustomerDialog" type="button" className="icon-btn" aria-label={tr("form.close")} disabled={busy} onClick={closeForm}><i className="bi bi-x-lg" aria-hidden="true"></i></button>
        </div>
        <input id="editingCustomerId" type="hidden" value={form.id || ""} readOnly/>
        <div className="customer-code-preview"><i className="bi bi-person-badge" aria-hidden="true"></i><span>{tr("runtime.member_code", { code: form.customerCode || nextCustomerCode(customers) })}</span></div>
        <div className="customer-form-grid">
          <label className="full">{tr("form.name")}<span className="customer-field"><i className="bi bi-person" aria-hidden="true"></i><input id="customerName" ref={nameRef} maxLength={120} required value={form.name} onChange={event => change("name", event.target.value)}/></span></label>
          <label>{tr("form.phone")}<span className="customer-field"><i className="bi bi-telephone" aria-hidden="true"></i><input id="customerPhone" maxLength={30} inputMode="tel" value={form.phone} onChange={event => change("phone", event.target.value)}/></span></label>
          <label>{tr("form.email")}<span className="customer-field"><i className="bi bi-envelope" aria-hidden="true"></i><input id="customerEmail" maxLength={120} type="email" value={form.email} onChange={event => change("email", event.target.value)}/></span></label>
          <label className="full">{tr("form.address")}<span className="customer-field customer-field-area"><i className="bi bi-geo-alt" aria-hidden="true"></i><textarea id="customerAddress" rows={3} maxLength={500} value={form.address} onChange={event => change("address", event.target.value)}></textarea></span></label>
          <label className="full">{tr("form.note")}<span className="customer-field customer-field-area"><i className="bi bi-sticky" aria-hidden="true"></i><textarea id="customerNote" rows={2} maxLength={300} value={form.note} onChange={event => change("note", event.target.value)}></textarea></span></label>
        </div>
        <p id="customerFormError" className="error-text">{error}</p>
        <div className="dialog-actions customer-form-actions">
          <button id="cancelCustomerBtn" type="button" className="btn btn-secondary" disabled={busy} onClick={closeForm}><i className="bi bi-x-circle" aria-hidden="true"></i><span>{tr("form.cancel")}</span></button>
          <button type="submit" className="btn btn-pay" disabled={busy || (!form.id && !canCreate) || (Boolean(form.id) && !canEdit)}><i className="bi bi-floppy" aria-hidden="true"></i><span>{busy ? tr("runtime.saving") : tr("form.save")}</span></button>
        </div>
      </form>
    </dialog>

    <dialog id="customerHistoryDialog" ref={historyRef} className="customer-history-modal" onCancel={event => event.preventDefault()}>
      <div className="customer-history-dialog">
        <div className="dialog-head customer-history-head"><div className="customer-history-title-wrap"><span className="customer-history-title-icon"><i className="bi bi-clock-history" aria-hidden="true"></i></span><div><h2 id="customerHistoryTitle">{tr("history.title")}{selected ? ` — ${selected.name}` : ""}</h2><p>{tr("visual.history_description")}</p></div></div><button id="closeCustomerHistory" type="button" className="icon-btn" onClick={() => historyRef.current?.close?.()}><i className="bi bi-x-lg" aria-hidden="true"></i></button></div>
        <div id="customerHistoryList" className="customer-history-list">
          {selectedSales.length ? selectedSales.map(sale => <article className="customer-history-item" key={sale.id}>
            <div><strong>{sale.saleNumber || sale.id}</strong><span>{dateTimeText(sale.createdAt)} • {tr("history.items", { count: formatNumber(saleQty(sale)) })}</span></div>
            <div className="customer-history-total" hidden={!canViewSales}><strong>{amountText(saleNet(sale))}</strong><span>{(sale.paymentMethod || sale.payment?.method) === "cash" ? tr("history.payment_cash") : tr("history.payment_transfer")}</span></div>
          </article>) : <div className="empty-state customer-history-empty">{tr("history.no_history")}</div>}
        </div>
      </div>
    </dialog>

    <dialog id="loyaltyHistoryDialog" ref={loyaltyRef} className="customer-loyalty-modal" onCancel={event => event.preventDefault()}>
      <div className="loyalty-history-dialog">
        <div className="dialog-head customer-history-head loyalty-history-head">
          <div className="customer-history-title-wrap">
            <span className="customer-history-title-icon loyalty"><i className="bi bi-star-fill" aria-hidden="true"></i></span>
            <div>
              <h2 id="loyaltyHistoryTitle">{tr("loyalty.title")}{loyaltyCustomer ? ` — ${loyaltyCustomer.name}` : ""}</h2>
              <p>{tr("visual.loyalty_description")}</p>
            </div>
          </div>
          <button id="closeLoyaltyHistory" type="button" className="icon-btn" aria-label={tr("form.close")} onClick={() => loyaltyRef.current?.close?.()}><i className="bi bi-x-lg" aria-hidden="true"></i></button>
        </div>
        <div className="loyalty-history-summary" aria-label={tr("loyalty.summary_title")}>
          <article className="loyalty-summary-card balance"><span className="loyalty-summary-icon"><i className="bi bi-star" aria-hidden="true"></i></span><div><span>{tr("loyalty.summary_balance")}</span><strong>{formatNumber(loyaltySummary.balance)}</strong></div></article>
          <article className="loyalty-summary-card activity"><span className="loyalty-summary-icon"><i className="bi bi-arrow-left-right" aria-hidden="true"></i></span><div><span>{tr("loyalty.summary_movements")}</span><strong>{formatNumber(loyaltySummary.count)}</strong></div></article>
          <article className="loyalty-summary-card earned"><span className="loyalty-summary-icon"><i className="bi bi-arrow-up-right" aria-hidden="true"></i></span><div><span>{tr("loyalty.summary_earned")}</span><strong>+{formatNumber(loyaltySummary.earned)}</strong></div></article>
          <article className="loyalty-summary-card used"><span className="loyalty-summary-icon"><i className="bi bi-arrow-down-right" aria-hidden="true"></i></span><div><span>{tr("loyalty.summary_used")}</span><strong>-{formatNumber(loyaltySummary.used)}</strong></div></article>
        </div>
        <div className="loyalty-history-section-head"><div><i className="bi bi-clock-history" aria-hidden="true"></i><span>{tr("loyalty.activity_title")}</span></div><span>{tr("loyalty.activity_count", { count: formatNumber(loyaltySummary.count) })}</span></div>
        <div id="loyaltyHistoryList" className="loyalty-history-list">
          {loyaltyRows.length ? loyaltyRows.map(row => {
            const isReturn = row.type === "return";
            const positive = isReturn ? Number(row.pointsUsedRestored || 0) : Number(row.pointsEarned || 0);
            const negative = isReturn ? Number(row.pointsEarnedDeducted || 0) : Number(row.pointsUsed || 0);
            const transactionId = row.returnId || row.saleNumber || row.saleId || "";
            return <article className={`loyalty-history-item ${isReturn ? "is-return" : "is-sale"}`} key={row.id}>
              <span className="loyalty-history-row-icon"><i className={`bi bi-${isReturn ? "arrow-counterclockwise" : "receipt"}`} aria-hidden="true"></i></span>
              <div className="loyalty-history-copy">
                <div className="loyalty-history-row-title"><strong>{isReturn ? tr("loyalty.return") : tr("loyalty.sale")} {transactionId}</strong><span className={`loyalty-type-badge ${isReturn ? "is-return" : "is-sale"}`}>{isReturn ? tr("loyalty.return") : tr("loyalty.sale")}</span></div>
                <div className="loyalty-history-meta">
                  <span><i className="bi bi-clock" aria-hidden="true"></i>{dateTimeText(row.createdAt)}</span>
                  {row.saleId ? <span><i className="bi bi-link-45deg" aria-hidden="true"></i>{tr("loyalty.reference", { id: row.saleId })}</span> : null}
                </div>
              </div>
              <div className="loyalty-history-values">
                <div className="loyalty-history-deltas">
                  {positive > 0 ? <strong className="loyalty-positive">+{formatNumber(positive)}</strong> : null}
                  {negative > 0 ? <strong className="loyalty-negative">-{formatNumber(negative)}</strong> : null}
                </div>
                <span className="loyalty-balance-pill"><i className="bi bi-wallet2" aria-hidden="true"></i>{tr("loyalty.balance", { count: formatNumber(row.balanceAfter || 0) })}</span>
              </div>
            </article>;
          }) : <div className="empty-state customer-history-empty">{tr("loyalty.empty")}</div>}
        </div>
      </div>
    </dialog>

    <div id="toast" className={`toast ${toastType}${toastMessage ? " show" : ""}`} role={toastType === "error" ? "alert" : "status"} aria-live="polite"><span className="app-toast-icon" aria-hidden="true"><i className={`bi bi-${toastType === "error" ? "x-circle" : "check-circle"} app-icon`}></i></span><span className="app-toast-message">{toastMessage}</span></div>
    <AppDeveloperPanel/>
  </>;
}
