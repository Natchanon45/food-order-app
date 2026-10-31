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
import { firstTenantRegistrationDate, resolveBillingCycleRange } from "@/utils/billingCycleDisplay";
import { MerchantServiceTerms } from "@/components/MerchantServiceTerms";
import { monthlyReportLabel, reportingQuery, formatReportDateRange } from "@/utils/revenueReportPeriod.mjs";

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
    styles: ["app.css", "icons.css", "tenant-admin.css", "revenue-share-report.css", "revenue-share-slip-dialog.css", "revenue-share-wallet-scroll-port.css", "merchant-service-terms-port.css"],
  });

  const today = useMemo(() => localDateKey(new Date()), []);
  const [period, setPeriod] = useState("daily");
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(monthKey(new Date()));
  const [year, setYear] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [access, setAccess] = useState(null);
  const [report, setReport] = useState({
    period: null, summary: {}, billingPeriod: null, billingSummary: null,
    wallet: {}, lalamoveFailures: [],
  });
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
  const initializedFilterTenantRef = useRef("");

  const money = value => formatNumber(Number(value || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rc = (th, en) => intlLocale.startsWith("th") ? th : en;
  const displayDate = value => {
    if (!value) return "-";
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(intlLocale, { year: "numeric", month: "short", day: "numeric" }).format(parsed);
  };
  const displayMonth = value => {
    if (!value) return "-";
    const parsed = new Date(`${value}-01T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(intlLocale, { year: "numeric", month: "long", calendar: "gregory" }).format(parsed);
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
  const periodLabel = period === "monthly" ? monthlyReportLabel(month)
    : period === "daily" ? displayDate(date)
      : period === "yearly" ? String(year)
        : displayDate(startDate) + " – " + displayDate(endDate);
  // The captions summarize the selected filter, not an invoice date range.
  // Keep periodLabel (and backend report dates) unchanged for all other UI.
  const reportSummaryPeriodLabel = period === "monthly" ? displayMonth(month)
    : period === "yearly" ? String(year) : periodLabel;
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
      // Apply the billing preference only on the first load for each shop.
      // Clicking Refresh MUST preserve the user's Daily/Monthly/Yearly/Custom filter.
      if (initializedFilterTenantRef.current !== String(tenant?.id || "")) {
        initializedFilterTenantRef.current = String(tenant?.id || "");
        setPeriod(next.billingCycle === "daily" ? "daily" : "monthly");
        if (next.suspended === true && next.suspendedPeriodType === "daily"
          && /^\d{4}-\d{2}-\d{2}$/.test(String(next.suspendedPeriodStart || ""))) {
          setDate(next.suspendedPeriodStart);
        }
      }
      if (next.enabled !== true) setError(t("revenue_share_report.explanation.disabled"));
      return next;
    } catch (loadError) {
      console.error("REVENUE_SHARE_ACCESS_FAILED", loadError);
      setError(t("revenue_share_report.states.load_failed"));
      return null;
    }
  }, [t, tenant?.id]);

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
      // Reporting is calendar-based. Only actual monthly invoice submissions
      // retain the original anniversary-based monthly request and amount.
      const needsBillingSummary = periodPayload.period === "monthly" && access.billingCycle === "monthly";
      const [data, billing] = await Promise.all([
        getRevenueShareReport(reportingQuery(periodPayload)),
        needsBillingSummary
          ? getRevenueShareReport(periodPayload).catch(billingError => {
              console.error("REVENUE_SHARE_BILLING_SUMMARY_FAILED", billingError);
              return null; // Allow the selected report; disable invoicing until valid.
            })
          : Promise.resolve(null),
      ]);
      setReport({
        period: data.period || null,
        summary: data.summary || {},
        billingPeriod: billing?.period || null,
        billingSummary: billing?.summary || null,
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
  }, [access?.enabled, access?.billingCycle, periodPayload, t]);

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
  const centralShare = access?.centralDeliveryShare === true;
  const centralThreshold = Number(access?.deliveryThreshold ?? summary.revenueShareDeliveryThreshold ?? 0);
  const centralRate = Number(access?.deliveryShareRate ?? summary.deliveryShareRate ?? 0);
  const monthlyDeliverySales = Math.max(0, Number(summary.monthlyDeliverySales || 0));
  const progressPercent = centralThreshold > 0
    ? Math.min(100, monthlyDeliverySales / centralThreshold * 100) : 100;
  const thresholdReached = centralThreshold <= 0 || monthlyDeliverySales >= centralThreshold;
  // Prefer server-calculated anniversary. The live callable may predate
  // those fields, so derive DISPLAY ONLY from the current Firestore tenant
  // activation timestamp (same source/priority as server billing-anniversary).
  const billingCycleRange = resolveBillingCycleRange(summary, tenant);
  const firstRegisteredDate = firstTenantRegistrationDate(tenant);
  const monthLabel = billingCycleRange
    || displayMonth(summary.monthlyDeliveryMonth || today.slice(0, 7));
  const remainingToThreshold = Math.max(0, centralThreshold - monthlyDeliverySales);
  const inStoreTotal = Number(summary.inStoreSales || 0);
  const deliveryTotal = Number(summary.deliveryOrderSales || 0);
  const deliveryShareDue = Number(summary.deliveryShareAmount || 0);
  const failures = report.lalamoveFailures || [];
  const billingCycle = summary.revenueShareBillingCycle === "daily"
    ? "daily" : (access?.billingCycle === "daily" ? "daily" : "monthly");
  const cycleLabel = t(`revenue_share_report.payment.cycles.${billingCycle}`);
  const cycleMatches = period === billingCycle;
  const paymentPeriodLabel = cycleMatches && report.billingPeriod?.startDate
    ? formatReportDateRange(report.billingPeriod.startDate, report.billingPeriod.endDate)
    : periodLabel;
  // Delivery-only policy: never expose obsolete POS/table legacy share as
  // money owed, even while a previous callable version is being replaced.
  // The backend also independently enforces the same charge on slip submission.
  const platformSharePayable = Math.round(Math.max(0, Number(summary.deliveryShareAmount || 0)) * 100) / 100;
  // Do not submit the report-month total as an anniversary invoice amount.
  const billingSummaryReady = period !== "monthly" || billingCycle !== "monthly"
    || Boolean(report.billingSummary && report.billingPeriod);
  const paymentSharePayable = cycleMatches && period === "monthly" && billingCycle === "monthly"
    ? Math.round(Math.max(0, Number(report.billingSummary?.deliveryShareAmount || 0)) * 100) / 100
    : platformSharePayable;
  const noAmountDue = !loading && billingSummaryReady && paymentSharePayable <= 0;
  const canSubmit = access?.enabled === true && !loading && billingSummaryReady
    && !noAmountDue && cycleMatches && !uploading;
  const paymentUnavailableMessage = !cycleMatches
    ? t("revenue_share_report.payment.cycle_mismatch", { cycle: cycleLabel })
    : !billingSummaryReady ? t("revenue_share_report.states.load_failed")
      : noAmountDue ? t("revenue_share_report.payment.no_amount_due") : "";
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
    if (!canSubmit) {
      if (paymentUnavailableMessage) setPaymentMessage(paymentUnavailableMessage);
      setPaymentMessageError(!cycleMatches);
      return;
    }
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

      <main className="container revenue-share-page revenue-share-dashboard">
        <section className="hero revenue-share-hero">
          <span className="report-hero-symbol" aria-hidden="true"><i className="bi bi-bar-chart-line-fill"></i></span>
          <div className="report-hero-content">
            <h1>{t("revenue_share_report.hero.title")}</h1>
            <p>{rc("สรุปยอดขายแยกตามช่องทาง ขายที่ร้าน / POS และ Delivery พร้อมคำนวณส่วนแบ่งตามเกณฑ์ที่กำหนด", "Channel sales, in-store / POS and Delivery, with threshold-based revenue sharing")}</p>
          </div>
          <div className="report-hero-art" aria-hidden="true"><i className="bi bi-receipt"></i><i className="bi bi-bar-chart-fill"></i><i className="bi bi-pie-chart-fill"></i></div>
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
            <div><h2 id="reportPeriodTitle"><i className="bi bi-graph-up-arrow" aria-hidden="true"></i>{t("revenue_share_report.period.title")}</h2><p>{t("revenue_share_report.period.description")}</p>{billingCycleRange ? <p id="revenueShareBillingPeriod">{rc("รอบคิดค่าบริการปัจจุบัน", "Current billing cycle")}: <strong>{billingCycleRange}</strong></p> : null}<p id="revenueShareFirstRegistered" className="report-registration-date">{rc("วันที่สมัคร/เปิดใช้งานครั้งแรก", "First registered / activated")}: <strong>{firstRegisteredDate || rc("ไม่มีข้อมูล", "Not available")}</strong></p></div>
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
          <button className="btn report-filter-refresh" id="refreshRevenueShare" type="button" disabled={loading} onClick={() => Promise.all([loadAccess(), loadReport(), loadHistory()])} aria-label={t(loading ? "revenue_share_report.states.loading" : "revenue_share_report.actions.refresh")} title={t("revenue_share_report.actions.refresh")}>
            {loading ? <span className="tenant-button-spinner" aria-hidden="true"></span> : <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>}
          </button>
        </section>

        <section className="card report-channel-overview" aria-labelledby="reportChannelsTitle">
          <div className="report-section-heading">
            <div>
              <h2 id="reportChannelsTitle"><i className="bi bi-check-circle-fill" aria-hidden="true"></i> {rc("แยกยอดขายร้านอาหาร / คาเฟ่", "Restaurant and café sales by channel")}</h2>
              <p>{rc("ยอดขายอาหารตามช่วงรายงานที่เลือก แยกหน้าร้านและจัดส่งชัดเจน", "Food sales for the selected report period, separated by channel")}: {reportSummaryPeriodLabel}</p>
            </div>
          </div>
          <div className="report-channel-grid">
            <article className="report-channel-card store">
              <span className="report-channel-icon"><i className="bi bi-shop-window" aria-hidden="true"></i></span>
              <div><span>{rc("ขายที่ร้าน / POS", "In-store / POS")}</span>
                <strong id="inStoreSales">{money(inStoreTotal)} <small>{rc("บาท", "THB")}</small></strong>
                <small>{rc("ออร์เดอร์หน้าร้าน", "In-store orders")}: {money(summary.storefrontOrderSales)} · Retail POS: <span id="posSales">{money(summary.posSales)}</span></small>
                <p>{rc("ไม่รวมในฐานคิดส่วนแบ่ง Delivery", "Excluded from the Delivery share base")}</p>
              </div>
            </article>
            <article className="report-channel-card delivery">
              <span className="report-channel-icon"><i className="delivery-bike-line-icon" aria-hidden="true"></i></span>
              <div><span>{rc("ขาย Delivery", "Delivery sales")}</span>
                <strong id="orderSales">{money(deliveryTotal)} <small>{rc("บาท", "THB")}</small></strong>
                <small id="orderCount">{rc("ยอดอาหาร ไม่รวมค่าจัดส่ง", "Merchandise only; delivery fees excluded")}</small>
                <p>{rc("ยอดของช่วงรายงานนี้ ไม่ใช่ยอดสะสมทั้งรอบบิล", "For this report period; not the billing-cycle cumulative amount")}</p>
              </div>
            </article>
          </div>
        </section>

        <section className="card report-month-progress" aria-labelledby="reportProgressTitle">
          <div className="report-section-heading">
            <div><h2 id="reportProgressTitle"><i className="bi bi-bullseye" aria-hidden="true"></i> {rc("Progress ยอด Delivery สะสมรอบบิลนี้", "Delivery progress this billing cycle")}</h2>
              <p>{rc("ติดตามยอดสินค้าที่ชำระแล้ว ไม่รวมค่าส่ง", "Tracks paid merchandise excluding delivery fees")} · {monthLabel}</p></div>
            <span className="report-progress-asof"><i className="bi bi-calendar-check" aria-hidden="true"></i>{rc("ข้อมูล ณ วันที่ ", "As of ")}{displayDate(today)}</span>
          </div>
          <div className="report-progress-barline">
            <div className="report-progress-track" role="progressbar" aria-label={rc("ยอด Delivery สะสมรอบบิลปัจจุบัน", "Current billing-cycle Delivery total")} aria-valuemin={0} aria-valuemax={Math.max(centralThreshold, 1)} aria-valuenow={Math.min(monthlyDeliverySales, Math.max(centralThreshold, 1))}>
              <span className="report-progress-fill" style={{ width: Math.max(0, Math.min(100, progressPercent)) + "%" }}></span>
            </div>
            <strong className="report-progress-percent" id="monthlyDeliveryPercent">{formatNumber(progressPercent, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%</strong>
          </div>
          <div className="report-progress-caption">
            <span><strong id="monthlyDeliverySales">{money(monthlyDeliverySales)}</strong> / <strong id="monthlyDeliveryThreshold">{money(centralThreshold)}</strong> {rc("บาท", "THB")}</span>
            <small>{thresholdReached ? rc("ครบเกณฑ์แล้ว", "Target reached") : rc("เหลืออีก " + money(remainingToThreshold) + " บาท", money(remainingToThreshold) + " THB remaining")}</small>
          </div>
          <p className="report-progress-note"><i className="bi bi-info-circle" aria-hidden="true"></i>
            {thresholdReached ? rc("ยอดสะสมถึงเพดานแล้ว ระบบคิดส่วนแบ่งเฉพาะยอด Delivery ที่เกินเพดานเท่านั้น ไม่ย้อนหลังวันก่อนหน้า", "The threshold is reached. Only Delivery merchandise above the threshold is chargeable, never the exempt first portion.")
              : rc("เริ่มคิดส่วนแบ่งเมื่อยอด Delivery สะสมครบ " + money(centralThreshold) + " บาท (100%) ภายในรอบบิลนี้ และเริ่มนับใหม่วันครบรอบถัดไป", "Revenue share begins when paid Delivery merchandise reaches " + money(centralThreshold) + " THB (100%) within this billing cycle, resetting on the next anniversary.")}</p>
        </section>

        <section className="card report-share-math" aria-labelledby="reportShareMathTitle">
          <div className="report-section-heading">
            <div><h2 id="reportShareMathTitle"><i className="bi bi-calculator" aria-hidden="true"></i> {rc("ผลการคิดส่วนแบ่ง Delivery", "Delivery revenue-share result")}</h2>
              <p>{rc("คำนวณจากฐานยอดที่เข้าเกณฑ์ในช่วงรายงาน", "Calculated on eligible merchandise for the selected reporting period")}: {reportSummaryPeriodLabel}</p></div>
            <span className={"report-share-state " + (deliveryShareDue > 0 ? "is-chargeable" : "")}>{deliveryShareDue > 0 ? rc("มีส่วนแบ่ง Delivery", "Delivery share due") : thresholdReached ? rc("เดือนนี้ถึงเกณฑ์แล้ว", "Monthly threshold reached") : rc("ยังไม่ถึงเกณฑ์ จึงไม่มีส่วนแบ่ง", "Below threshold: no share")}</span>
          </div>
          <div className="report-share-equation">
            <div className="report-share-month"><span className="report-equation-icon"><i className="delivery-bike-line-icon" aria-hidden="true"></i></span><div><span>{rc("ยอด Delivery สะสมรอบบิลนี้", "Billing-cycle Delivery total")}</span><strong>{money(monthlyDeliverySales)} <small>{rc("บาท", "THB")}</small></strong></div></div>
            <b aria-hidden="true" className="report-equation-operator"><i className="bi bi-arrow-right report-equation-arrow-desktop"></i><i className="bi bi-arrow-down report-equation-arrow-mobile"></i></b>
            <div className="report-share-base"><span className="report-equation-icon"><i className="bi bi-cash-stack" aria-hidden="true"></i></span><div><span>{rc("ยอดที่เข้าเกณฑ์แล้ว", "Eligible amount")}</span><strong id="deliveryShareBase">{money(summary.deliveryShareBase)} <small>{rc("บาท", "THB")}</small></strong></div></div>
            <b aria-hidden="true" className="report-equation-operator">×</b>
            <div className="report-share-rate"><span className="report-equation-icon"><i className="bi bi-percent" aria-hidden="true"></i></span><div><span>{rc("อัตราส่วนแบ่ง", "Share rate")}</span><strong>{money(centralRate)} <small>%</small></strong></div></div>
            <b aria-hidden="true" className="report-equation-operator">=</b>
            <div className="result"><span className="report-equation-icon"><i className="bi bi-wallet2" aria-hidden="true"></i></span><div><span>{rc("ค่าส่วนแบ่งที่ต้องชำระ", "Delivery share payable")}</span><strong id="deliveryShareAmount">{money(summary.deliveryShareAmount)} <small>{rc("บาท", "THB")}</small></strong></div></div>
          </div>
          <p className="report-rule-note" id="shareExplanation"><i className="bi bi-shield-check" aria-hidden="true"></i>
            {rc("ยอด Delivery " + money(centralThreshold) + " บาทแรกของรอบบิลได้รับยกเว้น คิดส่วนแบ่งเฉพาะยอดสินค้าที่ชำระแล้วส่วนที่เกินเพดาน และเริ่มนับใหม่เมื่อครบรอบสมัคร", "The first " + money(centralThreshold) + " THB in each anniversary billing cycle is exempt. Only paid Delivery merchandise above the threshold is charged; the exemption resets at renewal.")}</p>
          <details className="report-pricing-disclosure"><summary><i className="bi bi-gem" aria-hidden="true"></i>{rc("ข้อมูลแพ็กเกจ Premium (เพิ่มเติม)", "Premium pricing (details)")}<i className="bi bi-chevron-down" aria-hidden="true"></i></summary><div className="report-policy-inline"><span>{rc("Premium ส่วนกลาง", "Central Premium")}: {access?.premiumMonthlyPrice != null ? money(access.premiumMonthlyPrice) : "—"} {rc("บาท/เดือน", "THB/month")} · {access?.premiumAnnualPrice != null ? money(access.premiumAnnualPrice) : "—"} {rc("บาท/ปี", "THB/year")} <small>{rc("(เรียกเก็บแยก ไม่รวมยอดรายงานนี้)", "(billed separately, not included in this report)")}</small></span></div>
            <MerchantServiceTerms
              locale={intlLocale}
              pricing={{ storageReady: access != null, pricing: {
                monthly: { payable: access?.premiumMonthlyPrice ?? null },
                annual: { payable: access?.premiumAnnualPrice ?? null },
              }, config: {} }}
              threshold={Number.isFinite(centralThreshold) && centralThreshold > 0 ? centralThreshold : null}
              shareRate={Number.isFinite(centralRate) && centralRate >= 0 ? centralRate : null}
              context="report"
            />
          </details>
        </section>

        <section className="card report-related-amounts" aria-labelledby="reportRelatedTitle">
          <div className="report-section-heading">
            <div><h2 id="reportRelatedTitle"><i className="bi bi-stack" aria-hidden="true"></i> {rc("ยอดที่เกี่ยวข้องอื่น", "Other related totals")}</h2>
              <p>{rc("ค่าจัดส่ง Lalamove หักจากเครดิตล่วงหน้า ไม่ถูกนำมาคิดเป็นยอดโอน Platform ซ้ำ", "Lalamove delivery costs are debited from prepaid credits and never added to Platform share payable")}</p></div>
          </div>
          <div className="report-related-grid">
            <article className="report-related-tile"><span className="report-related-icon"><i className="delivery-bike-line-icon" aria-hidden="true"></i></span><div><span>{rc("ค่าจัดส่งที่ลูกค้าชำระ", "Customer delivery fees")}</span><strong id="customerDeliveryFees">{money(summary.customerDeliveryFees)} <small>{rc("บาท", "THB")}</small></strong><small>{rc("รวมจากออร์เดอร์ในช่วงรายงาน", "From selected period orders")}</small></div></article>
            <article className="report-related-tile"><span className="report-related-icon"><i className="bi bi-box-seam" aria-hidden="true"></i></span><div><span>{rc("ต้นทุน Lalamove", "Lalamove delivery cost")}</span><strong>{money(summary.lalamoveDeliveryCost)} <small>{rc("บาท", "THB")}</small></strong><small>{rc("ไม่ใช่ฐานคิดส่วนแบ่ง", "Not part of revenue share")}</small></div></article>
            <article className="report-related-tile report-related-platform"><span className="report-related-icon"><i className="bi bi-wallet2" aria-hidden="true"></i></span><div><span>{rc("ยอดที่ต้องโอนให้ Platform", "Platform amount due")}</span><strong id="platformAmountDue">{money(platformSharePayable)} <small>{rc("บาท", "THB")}</small></strong><small>{platformSharePayable <= 0 ? rc("ไม่มีส่วนแบ่งค้างชำระ", "No share payable") : rc("เฉพาะส่วนแบ่งยอดขาย ไม่รวมค่าขนส่งที่ตัดเครดิตแล้ว", "Revenue share only; prepaid delivery is excluded")}</small></div></article>
          </div>
        <section className={"card report-payment-card" + (noAmountDue ? " report-payment-card-zero" : "")} aria-labelledby="reportPaymentTitle">
          <div className="report-section-heading">
            <div><h2 id="reportPaymentTitle"><i className="bi bi-file-earmark-text" aria-hidden="true"></i> {t("revenue_share_report.payment.title")}</h2><p>{t("revenue_share_report.payment.description")}</p></div>
            <strong id="paymentBillingCycle">{t("revenue_share_report.payment.billing_cycle", { cycle: cycleLabel })}</strong>
          </div>
          <div className="report-payment-summary">
            <div><span>{t("revenue_share_report.payment.selected_period")}</span><strong id="paymentPeriodLabel">{paymentPeriodLabel}</strong></div>
            <div><span>{t("revenue_share_report.payment.amount_due")}</span><strong><span id="paymentAmountDue">{money(paymentSharePayable)}</span> {t("revenue_share_report.common.baht")}</strong></div>
          </div>
          {noAmountDue ? <div className="report-payment-zero"><i className="bi bi-check-circle" aria-hidden="true"></i><span>{rc("ยังไม่มียอดต้องชำระในช่วงนี้ จึงไม่ต้องแนบสลิป", "No amount due for this period; no payment slip is required.")}</span></div> : null}
          {!noAmountDue ? <>
          <form id="revenueSharePaymentForm" className="report-payment-form" onSubmit={submitPayment}>
            <div className="report-slip-field">
              <span>{t("revenue_share_report.payment.slip")}</span>
              <input id="revenueShareSlip" name="slip" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={!canSubmit} onChange={onSlipChange} />
              <label className={"report-slip-picker" + (!canSubmit ? " is-disabled" : "")} htmlFor="revenueShareSlip"><i className="bi bi-paperclip" aria-hidden="true"></i><strong>{t("revenue_share_report.payment.choose_file")}</strong><small id="revenueShareSlipName">{slip?.name || t("revenue_share_report.payment.no_file")}</small></label>
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
            <button className="btn btn-primary report-submit-slip" id="submitRevenueShareSlip" type="submit" disabled={!canSubmit} aria-describedby="revenueSharePaymentMessage" title={paymentUnavailableMessage || undefined}>
              {uploading ? <span className="tenant-button-spinner" aria-hidden="true"></span> : <i className="bi bi-cloud-arrow-up" aria-hidden="true"></i>}
              <span>{t(uploading ? "revenue_share_report.states.uploading" : "revenue_share_report.actions.submit_slip")}</span>
            </button>
          </form>
          </> : null}
          {paymentUnavailableMessage ? <div className={"report-payment-message" + (!cycleMatches ? " error" : "")} id="revenueSharePaymentMessage" role="status">{paymentUnavailableMessage}</div>
            : paymentMessage ? <div className={`report-payment-message${paymentMessageError ? " error" : ""}`} id="revenueSharePaymentMessage" role="status">{paymentMessage}</div>
              : <div className="report-payment-message" id="revenueSharePaymentMessage" role="status" hidden></div>}
        </section>

        </section>

        <details className="report-extra">
          <summary><i className="bi bi-wallet2" aria-hidden="true"></i> {rc("รายละเอียด Wallet และ Lalamove (เพิ่มเติม)", "Wallet and Lalamove details (optional)")} <i className="bi bi-chevron-down" aria-hidden="true"></i></summary>
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

        </details>

        <details className="report-history-disclosure" open={Boolean(payments?.length)}>
          <summary><i className="bi bi-clock-history" aria-hidden="true"></i><span>{t("revenue_share_report.payment.history_title")} {payments?.length ? "(" + payments.length + ")" : ""}</span><i className="bi bi-chevron-down" aria-hidden="true"></i></summary>
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
                const historicalShare = Math.max(0, Number(item.revenueShareAmount || 0));
                const historicalRecorded = Math.max(0, Number(item.platformAmountDue || 0));
                const historicalPrepaidGap = historicalRecorded > historicalShare + 0.009;
                return (
                  <article className="report-history-item" key={item.id}>
                    <div className="report-history-main">
                      <strong>{displayHistoryPeriodLabel(item.period?.label)}</strong>
                      <small>{t("revenue_share_report.payment.submitted_at", { date: displayDateTime(item.submittedAt) })}</small>
                    </div>
                    <div className="report-history-value">
                      <span>{t("revenue_share_report.payment.amount_due")}</span>
                      <strong>{money(historicalShare)} {t("revenue_share_report.common.baht")}</strong>
                      {historicalPrepaidGap
                        ? <small>{rc(
                          "ยอดบันทึกเดิม " + money(historicalRecorded) + " บาท รวมรายการขนส่ง ไม่ใช่ยอดส่วนแบ่งค้างชำระใหม่",
                          "Historical recorded amount " + money(historicalRecorded) + " THB included delivery; it is not a new revenue-share debt",
                        )}</small>
                        : <small>{rc("บันทึกส่วนแบ่งยอดขาย", "Recorded revenue share")}</small>}
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
        </details>

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
