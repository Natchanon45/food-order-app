import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { ParityFooter } from "@/components/ParityFooter";
import { UserMenu } from "@/components/UserMenu";
import {
  getRevenueShareAccess,
  getRevenueShareReport,
  getRevenueShareSlipUrl,
  listRevenueSharePayments,
  submitRevenueSharePayment,
} from "@/data/revenueShareReportData";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { useTenant } from "@/tenant/TenantProvider";

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

const MAX_SLIP_SIZE = 10 * 1024 * 1024;
const ALLOWED_SLIP_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const ALLOWED_SLIP_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "pdf"]);

function localDateKey(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}
function monthKey(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0")].join("-");
}
function fileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function statusClass(status) {
  return ["pending", "approved", "rejected"].includes(status) ? status : "pending";
}

export function RevenueShareReportPage() {
  const authState = useAuth();
  const tenantState = useTenant();
  const { profile } = authState;
  const { tenant } = tenantState;
  const { t, intlLocale, formatNumber } = useI18n();
  const stylesReady = useParityPage({
    title: t("revenue_share_report.meta.title"),
    bodyClass: "order-delivery-workspace revenue-share-report-page",
    styles: ["app.css", "icons.css", "tenant-admin.css", "revenue-share-report.css", "revenue-share-slip-dialog.css"],
  });

  const today = useMemo(() => localDateKey(new Date()), []);
  const [period, setPeriod] = useState("daily");
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(monthKey(new Date()));
  const [year, setYear] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [access, setAccess] = useState(null);
  const [report, setReport] = useState({ period: null, summary: {}, wallet: {}, lalamoveFailures: [] });
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialAccessReady, setInitialAccessReady] = useState(false);
  const [initialHistoryReady, setInitialHistoryReady] = useState(false);
  const [initialReportReady, setInitialReportReady] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentMessageError, setPaymentMessageError] = useState(false);
  const [slip, setSlip] = useState(null);
  const [slipError, setSlipError] = useState("");
  const [selectedSlipUrl, setSelectedSlipUrl] = useState("");
  const [dialogSlip, setDialogSlip] = useState(null);
  const dialogRef = useRef(null);

  const money = value => formatNumber(Number(value || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const displayDate = value => {
    if (!value) return "-";
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(intlLocale, { year: "numeric", month: "short", day: "numeric" }).format(parsed);
  };
  const displayMonth = value => {
    if (!value) return "-";
    const parsed = new Date(`${value}-01T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(intlLocale, { year: "numeric", month: "long" }).format(parsed);
  };
  const displayDateTime = value => {
    if (!value) return "-";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? String(value) : new Intl.DateTimeFormat(intlLocale, {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(parsed);
  };
  const displayHistoryPeriodLabel = value => {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : (raw || "-");
  };
  const periodLabel = period === "daily" ? displayDate(date)
    : period === "monthly" ? displayMonth(month)
      : period === "yearly" ? String(year)
        : `${displayDate(startDate)} – ${displayDate(endDate)}`;
  const periodPayload = useMemo(() => ({
    period,
    ...(period === "daily" ? { date } : {}),
    ...(period === "monthly" ? { month } : {}),
    ...(period === "yearly" ? { year } : {}),
    ...(period === "custom" ? { startDate, endDate } : {}),
  }), [period, date, month, year, startDate, endDate]);

  const loadAccess = useCallback(async () => {
    try {
      const next = await getRevenueShareAccess();
      setAccess(next);
      const cycle = next.billingCycle === "daily" ? "daily" : "monthly";
      setPeriod(cycle);
      if (next.enabled !== true) setError(t("revenue_share_report.explanation.disabled"));
      return next;
    } catch (loadError) {
      console.error("REVENUE_SHARE_ACCESS_FAILED", loadError);
      setError(t("revenue_share_report.states.load_failed"));
      return null;
    }
  }, [t]);

  const loadHistory = useCallback(async () => {
    try {
      setPayments(await listRevenueSharePayments());
    } catch (loadError) {
      console.error("REVENUE_SHARE_HISTORY_FAILED", loadError);
      setPayments(null);
    } finally {
      setInitialHistoryReady(true);
    }
  }, []);

  const loadReport = useCallback(async () => {
    if (!access?.enabled) return;
    setLoading(true);
    setError("");
    try {
      const data = await getRevenueShareReport(periodPayload);
      setReport({
        period: data.period || null,
        summary: data.summary || {},
        wallet: data.wallet || {},
        lalamoveFailures: Array.isArray(data.lalamoveFailures) ? data.lalamoveFailures : [],
      });
    } catch (loadError) {
      console.error("REVENUE_SHARE_REPORT_FAILED", loadError);
      setError(t("revenue_share_report.states.load_failed"));
    } finally {
      setLoading(false);
      setInitialReportReady(true);
    }
  }, [access?.enabled, periodPayload, t]);

  useEffect(() => {
    if (!tenant?.id || !["owner", "admin"].includes(profile?.role)) return undefined;
    let alive = true;
    setLoading(true);
    setInitialAccessReady(false);
    setInitialHistoryReady(false);
    setInitialReportReady(false);
    loadAccess()
      .then(next => {
        if (alive && next?.enabled !== true) setInitialReportReady(true);
      })
      .finally(() => {
        if (alive) {
          setInitialAccessReady(true);
          setLoading(false);
        }
      });
    loadHistory();
    return () => { alive = false; };
  }, [tenant?.id, profile?.role, loadAccess, loadHistory]);

  useEffect(() => {
    if (access?.enabled) loadReport();
  }, [access?.enabled, loadReport]);

  useEffect(() => () => {
    if (selectedSlipUrl) URL.revokeObjectURL(selectedSlipUrl);
  }, [selectedSlipUrl]);

  const initialReady = initialAccessReady && initialHistoryReady && initialReportReady;
  const summary = report.summary || {};
  const wallet = report.wallet || {};
  const failures = report.lalamoveFailures || [];
  const billingCycle = summary.revenueShareBillingCycle === "daily"
    ? "daily" : (access?.billingCycle === "daily" ? "daily" : "monthly");
  const cycleLabel = t(`revenue_share_report.payment.cycles.${billingCycle}`);
  const cycleMatches = period === billingCycle;
  const canSubmit = Number(summary.platformAmountDue || 0) > 0 && cycleMatches && !uploading;
  const suspensionPeriod = access?.suspendedPeriodStart || access?.suspendedPeriodEnd
    ? (access?.suspendedPeriodStart === access?.suspendedPeriodEnd || !access?.suspendedPeriodEnd
        ? displayDate(access?.suspendedPeriodStart || access?.suspendedPeriodEnd)
        : `${displayDate(access?.suspendedPeriodStart)} – ${displayDate(access?.suspendedPeriodEnd)}`)
    : t("revenue_share_report.suspension.period_unknown");
  const suspensionReasonKey = access?.suspensionReason === "missing_payment"
    ? "revenue_share_report.suspension.missing_payment"
    : access?.suspensionReason === "rejected_payment"
      ? "revenue_share_report.suspension.rejected_payment"
      : "revenue_share_report.suspension.generic";
  const suspensionMessage = access?.suspended === true ? t(suspensionReasonKey, { period: suspensionPeriod }) : "";
  const yearOptions = Array.from({ length: 8 }, (_, index) => new Date().getFullYear() - index);

  const transactionTypeLabel = type => {
    const key = `revenue_share_report.wallet.transaction_types.${String(type || "")}`;
    const value = t(key);
    return value === key ? String(type || "-") : value;
  };
  const failureStageLabel = stage => {
    const key = `revenue_share_report.wallet.failure_stages.${String(stage || "dispatch")}`;
    const value = t(key);
    return value === key ? String(stage || "dispatch") : value;
  };
  const failureReason = item => {
    const code = String(item?.error || "LALAMOVE_DISPATCH_FAILED");
    const key = `revenue_share_report.wallet.failure_reasons.${code}`;
    const value = t(key, { required: money(item?.requiredAmount), balance: money(item?.walletBalance), quote: money(item?.quoteFee) });
    return value === key ? String(item?.providerError || code) : value;
  };

  const validateSlip = file => {
    if (!file) return t("revenue_share_report.payment.slip_required");
    if (Number(file.size || 0) > MAX_SLIP_SIZE) return t("revenue_share_report.payment.slip_too_large");
    const mime = String(file.type || "").trim().toLowerCase();
    const extension = String(file.name || "").split(".").pop()?.toLowerCase() || "";
    const typeAllowed = !mime || ALLOWED_SLIP_TYPES.has(mime);
    if (!typeAllowed || !ALLOWED_SLIP_EXTENSIONS.has(extension)) {
      return t("revenue_share_report.payment.slip_type_invalid");
    }
    return "";
  };

  const onSlipChange = event => {
    const file = event.target.files?.[0] || null;
    setPaymentMessage("");
    setSlipError("");
    if (selectedSlipUrl) URL.revokeObjectURL(selectedSlipUrl);
    setSelectedSlipUrl("");
    if (!file) {
      setSlip(null);
      return;
    }
    const validation = validateSlip(file);
    if (validation) {
      setSlip(null);
      setSlipError(validation);
      showToast(validation, "error");
      event.target.value = "";
      return;
    }
    setSlip(file);
    setSelectedSlipUrl(URL.createObjectURL(file));
  };

  const clearSlip = () => {
    if (selectedSlipUrl) URL.revokeObjectURL(selectedSlipUrl);
    setSelectedSlipUrl("");
    setSlip(null);
    setSlipError("");
    const input = document.getElementById("revenueShareSlip");
    if (input) input.value = "";
  };

  const openSlip = async item => {
    try {
      let url = item?.slip?.url || "";
      if (!url && item?.slip?.path) url = await getRevenueShareSlipUrl(item.slip.path);
      if (!url) return;
      setDialogSlip({ ...item, url });
      dialogRef.current?.showModal?.();
      document.body.classList.add("tenant-modal-open");
    } catch (openError) {
      console.error("REVENUE_SHARE_SLIP_OPEN_FAILED", openError);
      setError(t("revenue_share_report.states.history_failed"));
    }
  };

  const previewSelectedSlip = () => {
    if (!slip || !selectedSlipUrl) return;
    setDialogSlip({
      period: { label: slip.name },
      slip: { name: slip.name, mime: slip.type },
      url: selectedSlipUrl,
      temporary: true,
    });
    dialogRef.current?.showModal?.();
    document.body.classList.add("tenant-modal-open");
  };

  const closeSlipDialog = () => {
    dialogRef.current?.close?.();
    setDialogSlip(null);
    document.body.classList.remove("tenant-modal-open");
  };

  const submitPayment = async event => {
    event.preventDefault();
    if (uploading) return;
    const validation = validateSlip(slip);
    if (validation) {
      setSlipError(validation);
      showToast(validation, "error");
      return;
    }
    setUploading(true);
    setPaymentMessage("");
    setPaymentMessageError(false);
    try {
      const submitted = await submitRevenueSharePayment(tenant.id, periodPayload, slip);
      clearSlip();
      await Promise.all([loadAccess(), loadReport(), loadHistory()]);
      const autoApproved = submitted?.status === "approved";
      setPaymentMessage(t(autoApproved
        ? "revenue_share_report.states.upload_auto_approved"
        : "revenue_share_report.states.upload_success"));
    } catch (submitError) {
      console.error("REVENUE_SHARE_SUBMIT_FAILED", submitError);
      const code = String(submitError?.code || "");
      const detail = `${code} ${String(submitError?.message || "")}`;
      let message = t("revenue_share_report.states.upload_failed");
      if (detail.includes("GOOGLE_VISION_API_KEY_REQUIRED")) {
        message = t("revenue_share_report.states.google_api_required");
      } else if (detail.includes("GOOGLE_VISION_API_KEY_INVALID")) {
        message = t("revenue_share_report.states.google_api_invalid");
      } else if (detail.includes("SLIP2GO_CONFIG_REQUIRED")) {
        message = t("revenue_share_report.states.slip2go_config_required");
      } else if (detail.includes("SLIP2GO_CONFIG_INVALID")) {
        message = t("revenue_share_report.states.slip2go_config_invalid");
      } else if (detail.includes("SLIP2GO_DUPLICATE_SLIP") || code.includes("already-exists")) {
        message = detail.includes("SLIP2GO_DUPLICATE_SLIP")
          ? t("revenue_share_report.states.slip2go_duplicate")
          : t("revenue_share_report.states.duplicate");
      } else if (code.includes("failed-precondition") && (!cycleMatches || detail.includes("Billing cycle"))) {
        message = t("revenue_share_report.payment.cycle_mismatch", { cycle: cycleLabel });
      }
      setPaymentMessage(message);
      setPaymentMessageError(true);
    } finally {
      setUploading(false);
    }
  };

  const ocrMessage = ocr => {
    if (!ocr || typeof ocr !== "object") return null;
    const status = String(ocr.status || "");
    const provider = String(ocr.provider || "");
    const reason = String(ocr.reason || "");
    const amount = Number(ocr.detectedAmount);
    let key = "revenue_share_report.payment.system_manual_review";
    let variant = "manual";
    const params = {};
    if (provider.includes("slip2go") && status === "matched") {
      key = "revenue_share_report.payment.system_slip2go_matched";
      variant = "matched";
      params.amount = Number.isFinite(amount) ? money(amount) : money(ocr.expectedAmount);
    } else if (status === "receiver_mismatch") {
      key = "revenue_share_report.payment.system_receiver_mismatch";
      variant = "mismatch";
    } else if (status === "duplicate") {
      key = "revenue_share_report.payment.system_duplicate_slip";
      variant = "mismatch";
    } else if (status === "invalid") {
      key = "revenue_share_report.payment.system_invalid_slip";
      variant = "mismatch";
    } else if (reason === "slip2go_fallback_vision") {
      key = "revenue_share_report.payment.system_fallback_review";
    } else if (status === "matched" && Number.isFinite(amount)) {
      key = "revenue_share_report.payment.system_amount_matched";
      variant = "matched";
      params.amount = money(amount);
    } else if (status === "mismatch" && Number.isFinite(amount)) {
      key = "revenue_share_report.payment.system_amount_mismatch";
      variant = "mismatch";
      params.amount = money(amount);
    } else if (status === "unreadable") {
      key = "revenue_share_report.payment.system_unreadable";
      variant = "unreadable";
    }
    return { text: t(key, params), variant };
  };

  const explanation = summary.revenueShareEnabled === true
    ? t("revenue_share_report.explanation.enabled", {
        sales: money(summary.combinedSales),
        rate: money(summary.revenueShareRate),
        share: money(summary.revenueShare),
        customerDelivery: money(summary.customerDeliveryFees),
        deliveryCost: money(summary.lalamoveDeliveryCost),
        walletCovered: money(summary.lalamoveWalletCoveredCost),
        outstanding: money(summary.lalamoveOutstandingCost),
        subsidy: money(summary.deliverySubsidy),
        due: money(summary.platformAmountDue),
      })
    : t("revenue_share_report.explanation.disabled");

  if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady || (["owner", "admin"].includes(profile?.role) && tenant?.id && !initialReady)) {
    return <PageReadyOverlay context="PENGUIN" title={t("shared.state.loading")} message={t("shared.state.please_wait")} />;
  }
  if (!profile) return <Navigate to="/login?next=%2Freports%2Frevenue-share" replace />;
  if (!["owner", "admin"].includes(profile.role)) return <Navigate to="/" replace />;
  if (tenantState.status === "error" || !tenant) return <Navigate to="/" replace />;

  return (
    <>
      <header className="app-header">
        <div className="revenue-share-header-leading">
          <div className="brand"><span className="brand-mark">PG</span><span>{t("revenue_share_report.header.title")}</span></div>
          <Link className="btn btn-sm revenue-share-header-back" to="/"><i className="bi bi-arrow-left" aria-hidden="true"></i><span>{t("revenue_share_report.header.back")}</span></Link>
        </div>
        <div className="app-header-actions" data-header-actions>
          <LocaleSwitcher style={{ marginLeft: 0, marginRight: 0 }} />
          <UserMenu profile={profile} />
        </div>
      </header>

      <main className="container revenue-share-page">
        <section className="hero revenue-share-hero">
          <div>
            <span className="report-eyebrow"><i className="bi bi-shield-lock" aria-hidden="true"></i>{t("revenue_share_report.hero.private")}</span>
            <h1>{t("revenue_share_report.hero.title")}</h1>
            <p>{t("revenue_share_report.hero.description")}</p>
          </div>
          <button className="btn btn-primary" id="refreshRevenueShare" type="button" disabled={loading} onClick={() => Promise.all([loadAccess(), loadReport(), loadHistory()])}>
            {loading ? <span className="tenant-button-spinner" aria-hidden="true"></span> : <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>}
            <span>{t(loading ? "revenue_share_report.states.loading" : "revenue_share_report.actions.refresh")}</span>
          </button>
        </section>

        {access?.suspended === true ? (
          <section className="report-suspension-notice" id="revenueShareSuspensionNotice" role="alert">
            <span className="report-suspension-icon" aria-hidden="true"><i className="bi bi-exclamation-triangle-fill"></i></span>
            <div className="report-suspension-content">
              <strong id="revenueShareSuspensionTitle">{t("revenue_share_report.suspension.title")}</strong>
              <p id="revenueShareSuspensionReason">{suspensionMessage}</p>
              <small id="revenueShareSuspensionHelp">{t("revenue_share_report.suspension.help")}</small>
            </div>
          </section>
        ) : null}

        <section className="card report-filter-card" aria-labelledby="reportPeriodTitle">
          <div className="report-section-heading">
            <div><h2 id="reportPeriodTitle">{t("revenue_share_report.period.title")}</h2><p>{t("revenue_share_report.period.description")}</p></div>
            <strong id="reportPeriodLabel">{loading ? t("revenue_share_report.states.loading") : periodLabel}</strong>
          </div>
          <div className="report-period-tabs" role="tablist" aria-label={t("revenue_share_report.period.aria")}>
            {[["daily","calendar-day"],["monthly","calendar-month"],["yearly","calendar3"],["custom","calendar-range"]].map(([value, icon]) => (
              <button key={value} className={period === value ? "active" : ""} type="button" data-report-period={value} aria-selected={period === value ? "true" : "false"} onClick={() => setPeriod(value)}>
                <i className={`bi bi-${icon}`} aria-hidden="true"></i><span>{t(`revenue_share_report.period.${value}`)}</span>
              </button>
            ))}
          </div>
          <div className="report-period-controls">
            <label data-period-control="daily" hidden={period !== "daily"}><span>{t("revenue_share_report.period.date")}</span><input className="input" id="reportDate" type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
            <label data-period-control="monthly" hidden={period !== "monthly"}><span>{t("revenue_share_report.period.month")}</span><input className="input" id="reportMonth" type="month" value={month} onChange={e => setMonth(e.target.value)} /></label>
            <label data-period-control="yearly" hidden={period !== "yearly"}><span>{t("revenue_share_report.period.year")}</span><select className="input" id="reportYear" value={year} onChange={e => setYear(Number(e.target.value))}>{yearOptions.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
            <div className="report-custom-period" data-period-control="custom" hidden={period !== "custom"}>
              <label><span>{t("revenue_share_report.period.start")}</span><input className="input" id="reportStartDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
              <label><span>{t("revenue_share_report.period.end")}</span><input className="input" id="reportEndDate" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></label>
            </div>
          </div>
        </section>

        <section className="report-summary-grid" aria-label={t("revenue_share_report.summary.aria")}>
          <article className="report-summary-card order"><span>{t("revenue_share_report.summary.order_sales")}</span><strong id="orderSales">{money(summary.orderSales)}</strong><small id="orderCount">{t("revenue_share_report.common.orders", { count: formatNumber(summary.orderCount || 0) })}</small></article>
          <article className="report-summary-card pos"><span>{t("revenue_share_report.summary.pos_sales")}</span><strong id="posSales">{money(summary.posSales)}</strong><small id="posCount">{t("revenue_share_report.common.receipts", { count: formatNumber(summary.posCount || 0) })}</small></article>
          <article className="report-summary-card total"><span>{t("revenue_share_report.summary.combined_sales")}</span><strong id="combinedSales">{money(summary.combinedSales)}</strong><small>{t("revenue_share_report.common.baht")}</small></article>
          <article className="report-summary-card share"><span id="shareRateLabel">{summary.revenueShareEnabled ? t("revenue_share_report.summary.revenue_share_rate", { rate: money(summary.revenueShareRate) }) : t("revenue_share_report.summary.revenue_share")}</span><strong id="revenueShare">{money(summary.revenueShare)}</strong><small>{t("revenue_share_report.common.baht")}</small></article>
          <article className="report-summary-card delivery-customer"><span>{t("revenue_share_report.summary.customer_delivery_fees")}</span><strong id="customerDeliveryFees">{money(summary.customerDeliveryFees)}</strong><small>{t("revenue_share_report.common.baht")}</small></article>
          <article className="report-summary-card delivery-cost"><span>{t("revenue_share_report.summary.lalamove_delivery_cost")}</span><strong id="lalamoveDeliveryCost">{money(summary.lalamoveDeliveryCost)}</strong><small>{t("revenue_share_report.common.baht")}</small></article>
          <article className="report-summary-card subsidy"><span>{t("revenue_share_report.summary.delivery_subsidy")}</span><strong id="deliverySubsidy">{money(summary.deliverySubsidy)}</strong><small>{t("revenue_share_report.common.baht")}</small></article>
          <article className="report-summary-card amount-due"><span>{t("revenue_share_report.summary.platform_amount_due")}</span><strong id="platformAmountDue">{money(summary.platformAmountDue)}</strong><small>{t("revenue_share_report.common.baht")}</small></article>
        </section>

        <section className="card report-wallet-card" aria-labelledby="reportWalletTitle">
          <div className="report-section-heading report-wallet-heading">
            <div><h2 id="reportWalletTitle"><i className="bi bi-wallet2" aria-hidden="true"></i> {t("revenue_share_report.wallet.title")}</h2><p>{t("revenue_share_report.wallet.description")}</p></div>
            <strong id="walletStatusLabel">{wallet.storageReady === true ? t("revenue_share_report.wallet.ready") : t("revenue_share_report.wallet.storage_missing")}</strong>
          </div>
          <div className="report-wallet-grid" aria-label={t("revenue_share_report.wallet.summary_aria")}>
            <article className="report-wallet-metric balance"><span>{t("revenue_share_report.wallet.balance")}</span><strong id="walletBalance">{money(wallet.balance)}</strong><small>{t("revenue_share_report.common.credit")}</small></article>
            <article className="report-wallet-metric topup-total"><span>{t("revenue_share_report.wallet.approved_topup_total")}</span><strong id="walletApprovedTopupTotal">{money(wallet.approvedTopupTotal)}</strong><small>{t("revenue_share_report.common.credit")}</small></article>
            <article className="report-wallet-metric topup-period"><span>{t("revenue_share_report.wallet.period_topup")}</span><strong id="walletPeriodTopup">{money(wallet.periodTopup)}</strong><small>{t("revenue_share_report.common.credit")}</small></article>
            <article className="report-wallet-metric debit"><span>{t("revenue_share_report.wallet.period_delivery_debit")}</span><strong id="walletPeriodDeliveryDebit">{money(wallet.periodDeliveryDebit)}</strong><small>{t("revenue_share_report.common.credit")}</small></article>
            <article className="report-wallet-metric refund"><span>{t("revenue_share_report.wallet.period_delivery_refund")}</span><strong id="walletPeriodDeliveryRefund">{money(wallet.periodDeliveryRefund)}</strong><small>{t("revenue_share_report.common.credit")}</small></article>
            <article className="report-wallet-metric pending"><span>{t("revenue_share_report.wallet.pending_topup")}</span><strong id="walletPendingTopupAmount">{money(wallet.pendingTopupAmount)}</strong><small id="walletPendingTopupCount">{t("revenue_share_report.wallet.pending_count", { count: formatNumber(wallet.pendingTopupCount || 0) })}</small></article>
          </div>
          <div className="report-wallet-note" id="walletAccountingNote"><i className="bi bi-info-circle" aria-hidden="true"></i><span>{t("revenue_share_report.wallet.accounting_note")}</span></div>
          <div className="report-wallet-note report-wallet-credit-policy" id="walletCreditPolicyNote"><i className="bi bi-shield-exclamation" aria-hidden="true"></i><span>{t("revenue_share_report.wallet.credit_policy")}</span></div>

          <div className="report-wallet-details">
            <section className="report-wallet-panel" aria-labelledby="walletTransactionsTitle">
              <div className="report-wallet-panel-head"><h3 id="walletTransactionsTitle">{t("revenue_share_report.wallet.transactions_title")}</h3><small>{t("revenue_share_report.wallet.transactions_description")}</small></div>
              <div className="report-wallet-list" id="walletTransactionList">
                {Array.isArray(wallet.recentTransactions) && wallet.recentTransactions.length ? wallet.recentTransactions.map(item => {
                  const direction = item.direction === "credit" ? "credit" : "debit";
                  const refs = [
                    item.orderId ? t("revenue_share_report.wallet.order_ref", { id: item.orderId }) : "",
                    item.lalamoveOrderId ? t("revenue_share_report.wallet.lalamove_ref", { id: item.lalamoveOrderId }) : "",
                  ].filter(Boolean).join(" • ");
                  return <article className={`report-wallet-item ${direction}`} key={item.id}>
                    <div className="report-wallet-item-main"><strong>{transactionTypeLabel(item.type)}</strong><small>{displayDateTime(item.createdAt)}</small>{refs ? <small>{refs}</small> : null}</div>
                    <div className="report-wallet-item-value"><strong>{direction === "credit" ? "+" : "−"}{money(item.amount)} {t("revenue_share_report.common.credit")}</strong><small>{t("revenue_share_report.wallet.balance_after", { amount: money(item.balanceAfter) })}</small></div>
                  </article>;
                }) : <div className="report-wallet-empty">{t("revenue_share_report.wallet.transactions_empty")}</div>}
              </div>
            </section>

            <section className="report-wallet-panel report-wallet-failures" aria-labelledby="lalamoveFailuresTitle">
              <div className="report-wallet-panel-head"><h3 id="lalamoveFailuresTitle">{t("revenue_share_report.wallet.failures_title")}</h3><small>{t("revenue_share_report.wallet.failures_description")}</small></div>
              <div className="report-wallet-list" id="lalamoveFailureList">
                {failures.length ? failures.map((item, index) => {
                  const meta = [
                    item.requiredAmount != null ? t("revenue_share_report.wallet.required_amount", { amount: money(item.requiredAmount) }) : "",
                    item.walletBalance != null ? t("revenue_share_report.wallet.balance_at_failure", { amount: money(item.walletBalance) }) : "",
                    item.quoteFee != null ? t("revenue_share_report.wallet.quote_amount", { amount: money(item.quoteFee) }) : "",
                    item.stage ? t("revenue_share_report.wallet.failure_stage", { stage: failureStageLabel(item.stage) }) : "",
                  ].filter(Boolean);
                  return <article className="report-wallet-failure" key={`${item.orderId}-${item.occurredAt}-${index}`}>
                    <div className="report-wallet-failure-head"><strong>{t("revenue_share_report.wallet.order_ref", { id: item.orderId || "-" })}</strong><small>{displayDateTime(item.occurredAt)}</small></div>
                    <p>{failureReason(item)}</p>{item.providerError ? <small>{item.providerError}</small> : null}
                    <div className="report-wallet-failure-meta">{meta.map(value => <span key={value}>{value}</span>)}</div>
                  </article>;
                }) : <div className="report-wallet-empty">{t("revenue_share_report.wallet.failures_empty")}</div>}
              </div>
            </section>
          </div>
        </section>

        <section className="card report-explanation">
          <div className="report-explanation-icon"><i className="bi bi-calculator" aria-hidden="true"></i></div>
          <div><h2>{t("revenue_share_report.explanation.title")}</h2><p id="shareExplanation">{loading ? t("revenue_share_report.explanation.loading") : explanation}</p></div>
        </section>

        <section className="card report-payment-card" aria-labelledby="reportPaymentTitle">
          <div className="report-section-heading">
            <div><h2 id="reportPaymentTitle">{t("revenue_share_report.payment.title")}</h2><p>{t("revenue_share_report.payment.description")}</p></div>
            <strong id="paymentBillingCycle">{t("revenue_share_report.payment.billing_cycle", { cycle: cycleLabel })}</strong>
          </div>
          <div className="report-payment-summary">
            <div><span>{t("revenue_share_report.payment.selected_period")}</span><strong id="paymentPeriodLabel">{periodLabel}</strong></div>
            <div><span>{t("revenue_share_report.payment.amount_due")}</span><strong><span id="paymentAmountDue">{money(summary.platformAmountDue)}</span> {t("revenue_share_report.common.baht")}</strong></div>
          </div>
          <form id="revenueSharePaymentForm" className="report-payment-form" onSubmit={submitPayment}>
            <div className="report-slip-field">
              <span>{t("revenue_share_report.payment.slip")}</span>
              <input id="revenueShareSlip" name="slip" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={onSlipChange} />
              <label className="report-slip-picker" htmlFor="revenueShareSlip"><i className="bi bi-paperclip" aria-hidden="true"></i><strong>{t("revenue_share_report.payment.choose_file")}</strong><small id="revenueShareSlipName">{slip?.name || t("revenue_share_report.payment.no_file")}</small></label>
              {slipError ? <small className="report-slip-error" id="revenueShareSlipError" role="alert">{slipError}</small> : <small className="report-slip-error" id="revenueShareSlipError" role="alert" hidden></small>}
              <small>{t("revenue_share_report.payment.slip_help")}</small>
              <div className="report-slip-selected" id="revenueShareSlipSelected" hidden={!slip}>
                <div className="report-slip-selected-meta"><i className="bi bi-file-earmark-check" aria-hidden="true"></i><div><strong id="revenueShareSelectedName">{slip?.name || "-"}</strong><small id="revenueShareSelectedSize">{slip ? fileSize(slip.size) : "-"}</small></div></div>
                <div className="report-slip-selected-actions">
                  <button className="btn btn-sm" id="previewRevenueShareSlip" type="button" onClick={previewSelectedSlip}><i className="bi bi-eye" aria-hidden="true"></i><span>{t("revenue_share_report.actions.preview_selected")}</span></button>
                  <button className="btn btn-danger btn-sm" id="removeRevenueShareSlip" type="button" onClick={clearSlip}><i className="bi bi-trash" aria-hidden="true"></i><span>{t("revenue_share_report.actions.remove_selected")}</span></button>
                </div>
              </div>
            </div>
            <button className="btn btn-primary report-submit-slip" id="submitRevenueShareSlip" type="submit" disabled={!canSubmit}>
              {uploading ? <span className="tenant-button-spinner" aria-hidden="true"></span> : <i className="bi bi-cloud-arrow-up" aria-hidden="true"></i>}
              <span>{t(uploading ? "revenue_share_report.states.uploading" : "revenue_share_report.actions.submit_slip")}</span>
            </button>
          </form>
          {!cycleMatches && !paymentMessage ? <div className="report-payment-message error" id="revenueSharePaymentMessage" role="status">{t("revenue_share_report.payment.cycle_mismatch", { cycle: cycleLabel })}</div>
            : paymentMessage ? <div className={`report-payment-message${paymentMessageError ? " error" : ""}`} id="revenueSharePaymentMessage" role="status">{paymentMessage}</div>
              : <div className="report-payment-message" id="revenueSharePaymentMessage" role="status" hidden></div>}
        </section>

        <section className="card report-history-card" aria-labelledby="reportHistoryTitle">
          <div className="report-section-heading">
            <div>
              <h2 id="reportHistoryTitle">{t("revenue_share_report.payment.history_title")}</h2>
              <p>{t("revenue_share_report.payment.history_description")}</p>
            </div>
          </div>
          <div className="report-payment-history" id="revenueSharePaymentHistory">
            {payments === null ? <div className="report-history-empty">{t("revenue_share_report.states.history_failed")}</div>
              : payments.length ? payments.map(item => {
                const status = statusClass(String(item.status || "pending"));
                const ocr = ocrMessage(item.ocr);
                return (
                  <article className="report-history-item" key={item.id}>
                    <div className="report-history-main">
                      <strong>{displayHistoryPeriodLabel(item.period?.label)}</strong>
                      <small>{t("revenue_share_report.payment.submitted_at", { date: displayDateTime(item.submittedAt) })}</small>
                    </div>
                    <div className="report-history-value">
                      <span>{t("revenue_share_report.payment.amount_due")}</span>
                      <strong>{money(item.platformAmountDue)} {t("revenue_share_report.common.baht")}</strong>
                      <small>{t("revenue_share_report.payment.amount_breakdown", {
                        share: money(item.revenueShareAmount),
                        delivery: money(item.lalamoveOutstandingCost),
                      })}</small>
                    </div>
                    <div className="report-history-value">
                      <span>{t("revenue_share_report.payment.rate", { rate: money(item.revenueShareRate) })}</span>
                      <span className={"report-status " + status}>{t(`revenue_share_report.payment.statuses.${status}`)}</span>
                    </div>
                    {ocr ? <div className={"report-history-system " + ocr.variant}><i className="bi bi-shield-check" aria-hidden="true"></i><span>{ocr.text}</span></div> : null}
                    {item.reviewNote ? <div className="report-history-note"><strong>{t("revenue_share_report.payment.review_note")}</strong><span>{item.reviewNote}</span></div> : null}
                    <div className="report-history-actions">
                      <button className="btn btn-sm" type="button" data-report-view-slip={item.id} onClick={() => openSlip(item)}>
                        <i className="bi bi-receipt" aria-hidden="true"></i><span>{t("revenue_share_report.actions.view_slip")}</span>
                      </button>
                    </div>
                  </article>
                );
              }) : <div className="report-history-empty">{t("revenue_share_report.payment.empty")}</div>}
          </div>
        </section>

        {error ? <div className="report-error" id="revenueShareError" role="alert">{error}</div>
          : <div className="report-error" id="revenueShareError" role="alert" hidden></div>}
      </main>

      <dialog
        id="revenueShareSlipDialog"
        className="tenant-dialog revenue-share-slip-dialog"
        aria-labelledby="revenueShareSlipDialogTitle"
        ref={dialogRef}
        onCancel={event => event.preventDefault()}
      >
        <div className="tenant-dialog-card">
          <div className="tenant-dialog-head">
            <div className="tenant-dialog-title">
              <span className="tenant-dialog-icon"><i className="bi bi-receipt" aria-hidden="true"></i></span>
              <div>
                <span className="tenant-dialog-eyebrow">{t("revenue_share_report.payment.history_title")}</span>
                <h2 id="revenueShareSlipDialogTitle">{t("revenue_share_report.payment.slip_title")}</h2>
                <p id="revenueShareSlipPeriod">{dialogSlip?.period?.label || dialogSlip?.slip?.name || "-"}</p>
              </div>
            </div>
            <button type="button" className="tenant-dialog-close" data-close-report-slip aria-label={t("revenue_share_report.actions.close")} onClick={closeSlipDialog}>
              <i className="bi bi-x-lg" aria-hidden="true"></i>
            </button>
          </div>
          <div className="tenant-dialog-body">
            <div className="revenue-share-slip-preview">
              <img
                id="revenueShareSlipImage"
                alt={t("revenue_share_report.payment.slip_title")}
                src={dialogSlip && String(dialogSlip?.slip?.mime || "").startsWith("image/") ? dialogSlip.url : undefined}
                hidden={!dialogSlip || !String(dialogSlip?.slip?.mime || "").startsWith("image/")}
              />
              <iframe
                id="revenueShareSlipFrame"
                title={t("revenue_share_report.payment.slip_title")}
                loading="eager"
                src={dialogSlip && !String(dialogSlip?.slip?.mime || "").startsWith("image/") ? dialogSlip.url : "about:blank"}
                hidden={!dialogSlip || String(dialogSlip?.slip?.mime || "").startsWith("image/")}
              ></iframe>
            </div>
          </div>
          <div className="tenant-dialog-actions revenue-share-slip-actions">
            <button type="button" className="btn btn-danger" data-close-report-slip onClick={closeSlipDialog}>
              <i className="bi bi-x-circle" aria-hidden="true"></i><span>{t("revenue_share_report.actions.close")}</span>
            </button>
          </div>
        </div>
      </dialog>

      <ParityFooter />
    </>
  );
}
