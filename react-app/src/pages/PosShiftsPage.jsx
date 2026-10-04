import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { canUseRetailPos, getRetailPosSession } from "@/auth/retailPosSession";
import { AppDeveloperPanel } from "@/components/AppDeveloperPanel";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { firstAllowedPosPage, getPosPermissions, PosNavigation } from "@/components/PosNavigation";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { sweetConfirm } from "@/components/sweetDialog";
import { listPosSales, watchPosSales } from "@/data/retailPosData";
import { loadPosRoleSettings } from "@/data/retailPosSystemData";
import {
  clearLocalPosShiftHistory,
  listPosShiftsParity,
  submitLocalPosShiftClose,
  submitLocalPosShiftOpen,
  watchPosShiftsParity,
} from "@/data/retailPosShifts";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { useTenant } from "@/tenant/TenantProvider";

const asDate = value => {
  if (value?.toDate) return value.toDate();
  if (value?.seconds) return new Date(Number(value.seconds) * 1000);
  const date = value instanceof Date ? value : new Date(value || 0);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
};
const timeMs = value => asDate(value).getTime();
const clean = value => String(value || "").trim();
function hasShiftActionPermission(profile, roleRows, permission) {
  const roleId = String(profile?.roleId || profile?.role || "");
  if (roleId === "owner") return true;
  const role = Array.isArray(roleRows)
    ? roleRows.find(row => String(row?.id || "") === roleId)
    : null;
  const permissions = Array.isArray(role?.permissions) ? role.permissions : [];
  if (permissions.includes("*")) return true;
  if (permissions.includes(permission)) return true;
  const hasGranularShiftPermissions = permissions.some(key => String(key).startsWith("pos.shifts."));
  if (hasGranularShiftPermissions) return false;
  if (roleId === "admin" || roleId === "manager") return true;
  if (roleId === "cashier") {
    return [
      "pos.shifts.open",
      "pos.shifts.close",
      "pos.shifts.view_amount",
      "pos.shifts.view_history",
    ].includes(permission);
  }
  return false;
}

export function PosShiftsPage() {
  const authState = useAuth();
  const tenantState = useTenant();
  const { profile, user: authUser } = authState;
  const { tenant } = tenantState;
  const { t, formatNumber, formatDate } = useI18n();
  const tr = useCallback((key, replacements = {}) =>
    t(`pos_operations.shifts.${key}`, replacements), [t]);

  const stylesReady = useParityPage({
    title: tr("meta.title"),
    bodyClass: "pos-shifts-page",
    disabledGlobalStyles: ["app.css", "icons.css", "shared-responsive.css"],
    styles: [
      "app-version-badge-runtime.css",
      "retail-pos-font-local.css",
      "sweet-dialog.css",
      "pos-locale-switcher-placement.css",
      "retail-pos.css",
      "retail-shifts.css",
      "retail-pos-navigation.css",
      "retail-shifts-visual-dashboard.css",
    ],
  });

  const [shifts, setShifts] = useState([]);
  const [sales, setSales] = useState([]);
  const [roleRows, setRoleRows] = useState([]);
  const [initialDataReady, setInitialDataReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [cashierName, setCashierName] = useState("");
  const [terminalCode, setTerminalCode] = useState(() =>
    localStorage.getItem("retail_pos_terminal_code_v1") || "POS-01");
  const [openingCash, setOpeningCash] = useState("0");
  const [openNote, setOpenNote] = useState("");
  const [actualCash, setActualCash] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [openError, setOpenError] = useState("");
  const [closeError, setCloseError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");
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
  const hasAccess = pagePermissions.has("pos.shifts");
  const canOpen = hasShiftActionPermission(posAccessProfile, roleRows, "pos.shifts.open");
  const canClose = hasShiftActionPermission(posAccessProfile, roleRows, "pos.shifts.close");
  const canViewAmount = hasShiftActionPermission(posAccessProfile, roleRows, "pos.shifts.view_amount");
  const canViewHistory = hasShiftActionPermission(posAccessProfile, roleRows, "pos.shifts.view_history");
  const canClearHistory = hasShiftActionPermission(posAccessProfile, roleRows, "pos.shifts.clear_history");

  const redirectTarget = useMemo(() => {
    if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady) return "";
    const requested = location.pathname + location.search;
    if (!profile) return "/pos/login/?next=" + encodeURIComponent(requested);
    if (!canUseRetailPos(posAccessProfile) || tenantState.status === "error" || !tenant) return "/";
    if (!hasAccess) {
      const first = firstAllowedPosPage(posAccessProfile, roleRows);
      return first === "/pos/forbidden"
        ? "/pos/forbidden/?permission=pos.shifts&next=" + encodeURIComponent(requested)
        : first + "?from=permission";
    }
    return "";
  }, [
    authState.status,
    tenantState.status,
    tenant,
    profile,
    posAccessProfile,
    hasAccess,
    roleRows,
    stylesReady,
  ]);
  useEffect(() => {
    if (redirectTarget) location.replace(redirectTarget);
  }, [redirectTarget]);

  const showToast = useCallback((message, type = "success") => {
    setToastType(type === "error" ? "error" : "success");
    setToastMessage(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToastMessage(""), 2200);
  }, []);
  const refresh = useCallback(async () => {
    if (!tenant?.id || !profile || !hasAccess) return;
    setLoadError("");
    try {
      const [nextShifts, nextSales, nextRoles] = await Promise.all([
        listPosShiftsParity(tenant.id),
        listPosSales(tenant.id),
        loadPosRoleSettings(tenant.id),
      ]);
      setShifts(nextShifts);
      setSales(nextSales);
      setRoleRows(nextRoles);
      if (!cashierName) {
        setCashierName(
          posSession?.name
          || posAccessProfile?.displayName
          || posAccessProfile?.name
          || posAccessProfile?.email
          || "",
        );
      }
    } catch (error) {
      console.error("POS_SHIFTS_LOAD_FAILED", error);
      setLoadError(String(error?.message || "POS_SHIFTS_LOAD_FAILED"));
    } finally {
      setInitialDataReady(true);
    }
  }, [
    tenant?.id,
    profile,
    hasAccess,
    cashierName,
    posSession?.name,
    posAccessProfile?.displayName,
    posAccessProfile?.name,
    posAccessProfile?.email,
  ]);

  useEffect(() => {
    if (!redirectTarget && tenant?.id && profile && hasAccess) refresh();
  }, [redirectTarget, tenant?.id, profile, hasAccess, refresh]);

  useEffect(() => {
    if (!tenant?.id || !profile || !hasAccess || redirectTarget) return undefined;
    const stopSales = watchPosSales(tenant.id, rows => setSales(rows));
    const stopShifts = watchPosShiftsParity(
      tenant.id,
      rows => setShifts(rows),
      error => console.warn("POS_SHIFTS_WATCH_FAILED", error),
    );
    return () => {
      stopSales();
      stopShifts();
    };
  }, [tenant?.id, profile, hasAccess, redirectTarget]);
  const currentUserId = String(
    posAccessProfile?.uid
    || posAccessProfile?.id
    || authUser?.uid
    || "",
  );
  const activeShift = useMemo(() => {
    const openRows = shifts.filter(row => row.status === "open");
    return openRows.find(row =>
      !currentUserId
      || String(row.createdBy || row.cashierId || "") === currentUserId)
      || openRows[0]
      || null;
  }, [shifts, currentUserId]);

  const salesForActiveShift = useMemo(() => {
    if (!activeShift) return [];
    const openedAt = timeMs(activeShift.openedAt || activeShift.createdAt);
    const closedAt = activeShift.closedAt ? timeMs(activeShift.closedAt) : Infinity;
    return sales.filter(sale => {
      if (sale.shiftId && String(sale.shiftId) === String(activeShift.id)) return true;
      if (sale.shiftId) return false;
      const createdAt = timeMs(sale.createdAt || sale.updatedAt);
      return createdAt >= openedAt && createdAt <= closedAt;
    });
  }, [sales, activeShift]);

  const totals = useMemo(() => salesForActiveShift.reduce((summary, sale) => {
    const amount = Number(sale.totalAmount ?? sale.total ?? 0);
    summary.totalSales += amount;
    summary.billCount += 1;
    if ((sale.paymentMethod || sale.payment?.method) === "cash") {
      summary.totalCashSales += amount;
    } else {
      summary.totalNonCashSales += amount;
    }
    return summary;
  }, {
    totalSales: 0,
    totalCashSales: 0,
    totalNonCashSales: 0,
    billCount: 0,
  }), [salesForActiveShift]);

  const expectedCash = Number(activeShift?.openingCash || 0) + Number(totals.totalCashSales || 0);
  const cashDifference = Number(actualCash || 0) - expectedCash;
  const history = useMemo(() => shifts
    .filter(row => row.status === "closed")
    .sort((left, right) =>
      timeMs(right.updatedAt || right.closedAt || right.openedAt)
      - timeMs(left.updatedAt || left.closedAt || left.openedAt))
    .slice(0, 30), [shifts]);

  const shiftVisualStats = useMemo(() => {
    const source = history;
    let salesTotal = 0;
    let billCount = 0;
    let positiveCount = 0;
    let negativeCount = 0;
    let exactCount = 0;
    let cashTotal = 0;
    let nonCashTotal = 0;
    let differenceTotal = 0;
    source.forEach(shift => {
      const salesValue = Number(shift.salesTotal ?? shift.totalSales ?? 0);
      const cashValue = Number(shift.cashSales ?? shift.totalCashSales ?? 0);
      const nonCashValue = Number(shift.transferSales ?? shift.totalNonCashSales ?? 0);
      const difference = Number(shift.cashDifference || 0);
      salesTotal += salesValue;
      cashTotal += cashValue;
      nonCashTotal += nonCashValue;
      billCount += Number(shift.billCount || 0);
      differenceTotal += difference;
      if (difference > 0) positiveCount += 1;
      else if (difference < 0) negativeCount += 1;
      else exactCount += 1;
    });
    return {
      salesTotal,
      cashTotal,
      nonCashTotal,
      billCount,
      positiveCount,
      negativeCount,
      exactCount,
      differenceTotal,
    };
  }, [history]);

  const shiftTimeline = useMemo(() => history
    .slice(0, 10)
    .reverse()
    .map(shift => ({
      id: shift.id,
      label: formatDate(asDate(shift.closedAt || shift.updatedAt || shift.openedAt), { day: "2-digit", month: "short" }),
      sales: Number(shift.salesTotal ?? shift.totalSales ?? 0),
      difference: Number(shift.cashDifference || 0),
    })), [history, formatDate]);
  const shiftTimelineMax = Math.max(1, ...shiftTimeline.map(item => item.sales));

  const visualCashSales = activeShift ? Number(totals.totalCashSales || 0) : shiftVisualStats.cashTotal;
  const visualNonCashSales = activeShift ? Number(totals.totalNonCashSales || 0) : shiftVisualStats.nonCashTotal;
  const visualSalesTotal = visualCashSales + visualNonCashSales;
  const cashPercent = visualSalesTotal > 0 ? (visualCashSales / visualSalesTotal) * 100 : 0;
  const nonCashPercent = Math.max(0, 100 - cashPercent);
  const salesMixGradient = visualSalesTotal > 0
    ? `conic-gradient(#10b981 0 ${cashPercent}%,#6366f1 ${cashPercent}% 100%)`
    : "conic-gradient(#e5eee9 0 100%)";

  useEffect(() => {
    if (!activeShift) {
      setActualCash("");
      setCloseNote("");
      return;
    }
    setActualCash(current => current === "" ? expectedCash.toFixed(2) : current);
  }, [activeShift?.id, expectedCash]);

  const money = value => formatNumber(Number(value || 0), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const dateTime = value => value
    ? asDate(value).toLocaleString("th-TH", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : "-";

  const saveTerminal = value => {
    setTerminalCode(value);
    localStorage.setItem("retail_pos_terminal_code_v1", clean(value));
  };

  const openShift = async event => {
    event.preventDefault();
    if (busy || !canOpen) return;
    const name = clean(cashierName);
    const terminal = clean(terminalCode);
    const cash = Number(openingCash);
    if (!name || !terminal || !Number.isFinite(cash) || cash < 0) {
      setOpenError(tr("runtime.open_invalid"));
      return;
    }
    if (activeShift) {
      setOpenError(tr("runtime.already_open"));
      return;
    }
    setBusy(true);
    setOpenError("");
    showToast(tr("runtime.open_sending"));
    try {
      const result = await submitLocalPosShiftOpen({
        tenantId: tenant.id,
        cashierName: name,
        terminalCode: terminal,
        openingCash: cash,
        note: openNote,
      });
      setOpeningCash("0");
      setOpenNote("");
      if (result?.status === "conflict") {
        const message = tr("runtime.open_review", { error: result.error || "conflict" });
        setOpenError(message);
        showToast(tr("runtime.open_wait"));
      } else {
        showToast(result?.status === "synced"
          ? tr("runtime.open_synced")
          : tr("runtime.open_pending"));
      }
    } catch (error) {
      console.error("POS_SHIFT_OPEN_FAILED", error);
      setOpenError(String(error?.message || tr("runtime.open_invalid")));
    } finally {
      setBusy(false);
    }
  };
  const closeShift = async event => {
    event.preventDefault();
    if (busy || !canClose || !activeShift) return;
    const cash = Number(actualCash);
    if (!Number.isFinite(cash) || cash < 0) {
      setCloseError(tr("runtime.close_invalid"));
      return;
    }
    setBusy(true);
    setCloseError("");
    showToast(tr("runtime.close_sending"));
    try {
      const result = await submitLocalPosShiftClose({
        tenantId: tenant.id,
        shift: activeShift,
        actualCash: cash,
        totals,
        note: closeNote,
      });
      setActualCash("");
      setCloseNote("");
      if (result?.status === "conflict") {
        const message = tr("runtime.close_review", { error: result.error || "conflict" });
        setCloseError(message);
        showToast(tr("runtime.close_wait"));
      } else {
        showToast(result?.status === "synced"
          ? tr("runtime.close_synced")
          : tr("runtime.close_pending"));
      }
    } catch (error) {
      console.error("POS_SHIFT_CLOSE_FAILED", error);
      setCloseError(String(error?.message || tr("runtime.close_invalid")));
    } finally {
      setBusy(false);
    }
  };

  const clearHistory = async () => {
    if (!canClearHistory || !history.length) return;
    const confirmed = await sweetConfirm(tr("runtime.clear_confirm"), {
      title: t("shared.dialog.confirm_title"),
      type: "warning",
      confirmText: t("shared.actions.confirm"),
      cancelText: t("shared.actions.cancel"),
    });
    if (!confirmed) return;
    clearLocalPosShiftHistory(tenant.id);
    setShifts(current => current.filter(row => row.status !== "closed"));
    showToast(tr("runtime.cleared"));
  };

  const needsReady = authState.status === "loading"
    || tenantState.status === "loading"
    || !stylesReady
    || Boolean(redirectTarget)
    || (tenant?.id && profile && hasAccess && !initialDataReady);
  if (needsReady) {
    return <PageReadyOverlay title={t("shared.state.loading")} message={t("shared.state.please_wait")} />;
  }
  if (loadError) {
    return <PageReadyOverlay error title={tr("meta.title")} message={loadError} onRetry={refresh} />;
  }
  return <>
    <header className="pos-header" data-pos-management-header>
      <div className="app-title"><div>
        <strong>{tr("header.title")}</strong>
        <small>{tr("header.subtitle")}</small>
      </div></div>
      <div className="header-actions">
        <LocaleSwitcher />
        <PosNavigation profile={posAccessProfile} currentKey="pos.shifts" />
      </div>
    </header>

    <main data-pos-management className="shift-container">
      <section className={"shifts-visual-hero" + (activeShift ? " is-open" : " is-closed")}>
        <div className="shifts-hero-copy">
          <span className="shifts-hero-kicker">
            <i className={activeShift ? "bi bi-lightning-charge-fill" : "bi bi-clock-history"} aria-hidden="true"></i>
            {tr("header.title")}
          </span>
          <h1>{activeShift ? tr("active.title") : tr("open.title")}</h1>
          <p>{activeShift
            ? `${activeShift.cashierName || "-"} • ${activeShift.terminalCode || "-"} • ${tr("runtime.opened_at", { date: dateTime(activeShift.openedAt) })}`
            : tr("open.description")}</p>
          <div className="shifts-hero-status">
            <span className={"shift-live-dot" + (activeShift ? " is-open" : "")}></span>
            <strong>{activeShift ? tr("active.open") : tr("open.closed")}</strong>
          </div>
        </div>
        <div className="shifts-hero-metrics">
          <article>
            <span><i className="bi bi-clock-history" aria-hidden="true"></i>{activeShift ? tr("active.opening_cash") : tr("history.title")}</span>
            <strong>{activeShift
              ? (canViewAmount ? money(activeShift.openingCash) : "—")
              : (canViewHistory ? formatNumber(history.length) : "—")}</strong>
          </article>
          <article>
            <span><i className="bi bi-graph-up-arrow" aria-hidden="true"></i>{tr("active.sales")}</span>
            <strong>{activeShift
              ? (canViewAmount ? money(totals.totalSales) : "—")
              : (canViewAmount && canViewHistory ? money(shiftVisualStats.salesTotal) : "—")}</strong>
          </article>
          <article>
            <span><i className="bi bi-receipt" aria-hidden="true"></i>{tr("active.bills")}</span>
            <strong>{activeShift
              ? formatNumber(totals.billCount)
              : (canViewHistory ? formatNumber(shiftVisualStats.billCount) : "—")}</strong>
          </article>
          <article>
            <span><i className="bi bi-cash-stack" aria-hidden="true"></i>{activeShift ? tr("active.expected") : tr("history.difference")}</span>
            <strong className={!activeShift && canViewHistory && shiftVisualStats.differenceTotal < 0 ? "is-negative" : ""}>
              {activeShift
                ? (canViewAmount ? money(expectedCash) : "—")
                : (canViewAmount && canViewHistory ? money(shiftVisualStats.differenceTotal) : "—")}
            </strong>
          </article>
        </div>
      </section>

      {(canViewHistory || canViewAmount) ? <section className="shifts-insight-grid">
        {canViewHistory ? <article className="panel shifts-trend-panel">
          <div className="shifts-insight-head">
            <div>
              <span className="shifts-insight-icon"><i className="bi bi-bar-chart-fill" aria-hidden="true"></i></span>
              <div><h2>{tr("history.title")}</h2><p>{tr("history.description")}</p></div>
            </div>
            <strong>{formatNumber(history.length)}</strong>
          </div>
          {canViewAmount ? <div className="shifts-timeline" aria-label={tr("history.title")}>
            {shiftTimeline.length ? shiftTimeline.map(item => {
              const height = Math.max(8, Math.min(100, (item.sales / shiftTimelineMax) * 100));
              return <div className="shifts-timeline-column" key={item.id}>
                <span className="shifts-timeline-tooltip" style={{ "--shift-bar-height": `${height}%` }}>
                  {money(item.sales)} • {tr("history.difference")} {money(item.difference)}
                </span>
                <div className={"shifts-timeline-bar" + (item.difference < 0 ? " has-shortage" : item.difference > 0 ? " has-overage" : "")} style={{ height: `${height}%` }}></div>
                <span className="shifts-timeline-label">{item.label}</span>
              </div>;
            }) : <div className="shifts-timeline-empty">{tr("history.empty")}</div>}
          </div> : <div className="shifts-locked-visual">—</div>}
        </article> : null}

        {canViewAmount && (activeShift || canViewHistory) ? <article className="panel shifts-mix-panel">
          <div className="shifts-insight-head">
            <div>
              <span className="shifts-insight-icon mix"><i className="bi bi-pie-chart-fill" aria-hidden="true"></i></span>
              <div><h2>{tr("active.sales")}</h2><p>{activeShift ? tr("active.title") : tr("history.description")}</p></div>
            </div>
          </div>
          <div className="shifts-sales-ring" style={{ background: salesMixGradient }}>
            <div><span>{tr("active.sales")}</span><strong>{money(visualSalesTotal)}</strong></div>
          </div>
          <div className="shifts-sales-legend">
            <div><span><i className="cash"></i>{tr("active.cash_sales")}</span><strong>{cashPercent.toFixed(1)}%</strong></div>
            <div><span><i className="transfer"></i>{tr("active.transfer_sales")}</span><strong>{nonCashPercent.toFixed(1)}%</strong></div>
          </div>
        </article> : null}
      </section> : null}

      <section id="noActiveShift" className="panel shift-card" hidden={Boolean(activeShift)}>
        <div className="shift-heading">
          <div>
            <h1><i className="bi bi-clock-history pos-context-icon" data-icon-tone="violet" aria-hidden="true"></i><span>{tr("open.title")}</span></h1>
            <p>{tr("open.description")}</p>
          </div>
          <span className="status-badge closed">{tr("open.closed")}</span>
        </div>
        <form id="openShiftForm" className="shift-form" onSubmit={openShift}>
          <label><span className="shift-field-label"><i className="bi bi-person-badge" aria-hidden="true"></i>{tr("open.cashier")}</span>
            <input id="cashierName" required maxLength={100} value={cashierName}
              data-validation-state={clean(cashierName) ? "valid" : undefined}
              disabled={!canOpen || busy}
              onChange={event => setCashierName(event.target.value)}
              placeholder={tr("open.cashier_hint")} />
          </label>
          <label><span className="shift-field-label"><i className="bi bi-display" aria-hidden="true"></i>{tr("open.terminal")}</span>
            <input id="terminalCode" required maxLength={50} value={terminalCode}
              data-validation-state={clean(terminalCode) ? "valid" : undefined}
              disabled={!canOpen || busy}
              onChange={event => saveTerminal(event.target.value)} />
          </label>
          <label><span className="shift-field-label"><i className="bi bi-cash-stack" aria-hidden="true"></i>{tr("open.cash")}</span>
            <input id="openingCash" required type="number" min="0" step="0.01" value={openingCash}
              data-validation-state={Number.isFinite(Number(openingCash)) && Number(openingCash) >= 0 ? "valid" : undefined}
              disabled={!canOpen || busy}
              onChange={event => setOpeningCash(event.target.value)} />
          </label>
          <label className="full"><span className="shift-field-label"><i className="bi bi-sticky" aria-hidden="true"></i>{tr("open.note")}</span>
            <input id="openNote" maxLength={200} value={openNote}
              disabled={!canOpen || busy}
              onChange={event => setOpenNote(event.target.value)}
              placeholder={tr("open.optional")} />
          </label>
          <p id="openShiftError" className="error-text full">{openError}</p>
          <button className="btn btn-pay full" disabled={!canOpen || busy} type="submit">
            <i className="bi bi-play-circle pos-context-icon" data-icon-tone="emerald" aria-hidden="true"></i>
            <span>{tr("open.submit")}</span>
          </button>
        </form>
      </section>
      <section id="activeShiftPanel" className="panel shift-card" hidden={!activeShift}>
        {activeShift ? <>
          <div className="shift-heading">
            <div>
              <h1><i className="bi bi-clock-history pos-context-icon" data-icon-tone="violet" aria-hidden="true"></i><span>{tr("active.title")}</span></h1>
              <p id="activeShiftMeta">
                {activeShift.cashierName || "-"} • {activeShift.terminalCode || "-"} • {tr("runtime.opened_at", { date: dateTime(activeShift.openedAt) })}
              </p>
            </div>
            <span className="status-badge open">{tr("active.open")}</span>
          </div>
          <section className="shift-stats">
            <article><span><i className="bi bi-wallet2" aria-hidden="true"></i>{tr("active.opening_cash")}</span><strong id="openingCashDisplay" hidden={!canViewAmount}>{money(activeShift.openingCash)}</strong></article>
            <article><span><i className="bi bi-graph-up-arrow" aria-hidden="true"></i>{tr("active.sales")}</span><strong id="shiftSalesTotal" hidden={!canViewAmount}>{money(totals.totalSales)}</strong></article>
            <article><span><i className="bi bi-cash-coin" aria-hidden="true"></i>{tr("active.cash_sales")}</span><strong id="shiftCashSales" hidden={!canViewAmount}>{money(totals.totalCashSales)}</strong></article>
            <article><span><i className="bi bi-qr-code-scan" aria-hidden="true"></i>{tr("active.transfer_sales")}</span><strong id="shiftTransferSales" hidden={!canViewAmount}>{money(totals.totalNonCashSales)}</strong></article>
            <article><span><i className="bi bi-receipt" aria-hidden="true"></i>{tr("active.bills")}</span><strong id="shiftBillCount">{formatNumber(totals.billCount)}</strong></article>
            <article><span><i className="bi bi-safe2" aria-hidden="true"></i>{tr("active.expected")}</span><strong id="expectedCash" hidden={!canViewAmount}>{money(expectedCash)}</strong></article>
          </section>
          <form id="closeShiftForm" className="close-shift-form" onSubmit={closeShift}>
            <label><span className="shift-field-label"><i className="bi bi-calculator" aria-hidden="true"></i>{tr("active.actual")}</span>
              <input id="actualCash" required type="number" min="0" step="0.01" value={actualCash}
                data-validation-state={Number.isFinite(Number(actualCash)) && Number(actualCash) >= 0 ? "valid" : undefined}
                disabled={!canClose || busy}
                onChange={event => setActualCash(event.target.value)} />
            </label>
            <label><span className="shift-field-label"><i className="bi bi-journal-text" aria-hidden="true"></i>{tr("active.note")}</span>
              <input id="closeNote" maxLength={200} value={closeNote}
                disabled={!canClose || busy}
                onChange={event => setCloseNote(event.target.value)}
                placeholder={tr("open.optional")} />
            </label>
            <div className={"difference-box" + (cashDifference > 0 ? " positive" : cashDifference < 0 ? " negative" : "")}>
              <span><i className="bi bi-scales" aria-hidden="true"></i>{tr("active.difference")}</span>
              <strong id="cashDifference" hidden={!canViewAmount}>{money(cashDifference)}</strong>
            </div>
            <p id="closeShiftError" className="error-text">{closeError}</p>
            <button className="btn btn-danger" disabled={!canClose || busy} type="submit">
              <i className="bi bi-x-lg pos-context-icon" data-icon-tone="rose" aria-hidden="true"></i>
              <span>{tr("active.close")}</span>
            </button>
          </form>
        </> : null}
      </section>
      <section className="panel history-card" hidden={!canViewHistory}>
        <div className="history-head">
          <div>
            <h2><i className="bi bi-bar-chart-line pos-context-icon" data-icon-tone="indigo" aria-hidden="true"></i><span>{tr("history.title")}</span></h2>
            <p>{tr("history.description")}</p>
          </div>
          <button id="clearShiftHistory" className="btn btn-danger" type="button"
            hidden={!canClearHistory} onClick={clearHistory}>
            <i className="bi bi-x-lg pos-context-icon" data-icon-tone="rose" aria-hidden="true"></i>
            <span>{tr("history.clear")}</span>
          </button>
        </div>
        <div className="table-wrap">
          <table className="shift-table">
            <thead><tr>
              <th>{tr("history.cashier")}</th>
              <th>{tr("history.opened")}</th>
              <th>{tr("history.closed")}</th>
              <th className="number" hidden={!canViewAmount}>{tr("history.sales")}</th>
              <th className="number" hidden={!canViewAmount}>{tr("history.actual")}</th>
              <th className="number" hidden={!canViewAmount}>{tr("history.difference")}</th>
            </tr></thead>
            <tbody id="shiftHistoryBody">
              {history.map(shift => {
                const difference = Number(shift.cashDifference || 0);
                const differenceClass = difference > 0 ? "diff-positive" : difference < 0 ? "diff-negative" : "";
                return <tr key={shift.id}>
                  <td data-label={tr("history.cashier")}><strong>{shift.cashierName || "-"}</strong><div className="product-sub">{shift.terminalCode || "-"}</div></td>
                  <td data-label={tr("history.opened")}>{dateTime(shift.openedAt)}</td>
                  <td data-label={tr("history.closed")}>{dateTime(shift.closedAt)}</td>
                  <td data-label={tr("history.sales")} className="number" hidden={!canViewAmount}>{money(shift.salesTotal ?? shift.totalSales)}</td>
                  <td data-label={tr("history.actual")} className="number" hidden={!canViewAmount}>{money(shift.actualCash ?? shift.closingCash)}</td>
                  <td data-label={tr("history.difference")} className={"number " + differenceClass} hidden={!canViewAmount}>{money(difference)}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <div id="shiftHistoryEmpty" className="empty-state" hidden={history.length > 0}>{tr("history.empty")}</div>
      </section>
    </main>

    <div id="toast" className={`toast ${toastType}${toastMessage ? " show" : ""}`} role={toastType === "error" ? "alert" : "status"} aria-live="polite">
      <span className="app-toast-icon" aria-hidden="true"><i className={`bi bi-${toastType === "error" ? "x-circle" : "check-circle"} app-icon`}></i></span>
      <span className="app-toast-message">{toastMessage}</span>
    </div>
    <AppDeveloperPanel />
  </>;
}
