import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { SalesReportReadFailure } from "@/components/SalesReportReadFailure";
import { ParityFooter } from "@/components/ParityFooter";
import { UserMenu } from "@/components/UserMenu";
import { normalizeOrderGiftItems, subscribeCompleteTenantSalesOrders } from "@/data/salesReportData";
import { isCancelledSalesOrder, isReceiptHistoryOrder, receiptCancellationSource, itemCancellationSource, reportedSalesNet, historicalReceiptNet } from "@/data/salesCancellationReport.mjs";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { useTenant } from "@/tenant/TenantProvider";
import "@/ui/sales-report-source-mobile.css";
import {
  bangkokDateKey, bangkokMonthKey, bangkokHour, bangkokStartOfDay,
  bangkokEndOfDay, bangkokMonthRange, bangkokYearRange, bangkokDaysInRange,
  bangkokParts,
} from "@/utils/salesReportBangkok.mjs";

const REPORT_TIME_ZONE = "Asia/Bangkok";

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (Number.isFinite(value?.seconds)) return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
const localDateKey = bangkokDateKey;
const monthKey = bangkokMonthKey;
const startOfDay = bangkokStartOfDay;
const endOfDay = bangkokEndOfDay;
function paidDate(order) {
  return toDate(order.paidAt) || toDate(order.completedAt) || toDate(order.updatedAt) || toDate(order.createdAt);
}
function isPaidOrder(order) {
  return isReceiptHistoryOrder(order) && !isCancelledSalesOrder(order);
}
function isCancelledItem(item) {
  return item?.cancelled === true;
}
function orderNet(order) {
  if (Number.isFinite(Number(order.totalAmount))) return Number(order.totalAmount || 0);
  return (order.items || []).filter(item => !isCancelledItem(item))
    .reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0)
    + Number(order.deliveryFee || 0);
}
function paymentMethodKey(order) {
  const value = String(order.paymentMethod || "").toLowerCase();
  if (["cash", "เงินสด"].includes(value)) return "cash";
  if (["promptpay", "transfer", "bank", "qr"].includes(value)) return "promptpay";
  if (value === "cod") return "cod";
  return "other";
}
function receiptGroupKey(order) {
  if (order.receiptNumber) return `receipt:${order.receiptNumber}`;
  if (order.billId) return `bill:${order.billId}`;
  if (order.paymentGroupId) return `group:${order.paymentGroupId}`;
  if (order.orderType !== "delivery" && order.tableToken && order.paidAt) return `table:${order.tableToken}:${String(order.paidAt)}`;
  return `order:${order.id}`;
}
function receiptCode(receipt) {
  const explicit = receipt.orders.find(order => order.receiptNumber)?.receiptNumber;
  if (explicit) return String(explicit);
  const date = receipt.paidAt || new Date();
  const stamp = localDateKey(date).replaceAll("-", "").slice(2);
  return `R${stamp}-${String(receipt.orders[0]?.id || "").slice(-6).toUpperCase()}`;
}
function printUrl(receipt) {
  const ids = receipt.orders.map(order => order.id);
  const prefix = "";
  return ids.length > 1
    ? `${prefix}/cashier/receipt/?orders=${encodeURIComponent(ids.join(","))}`
    : `${prefix}/cashier/receipt/?order=${encodeURIComponent(ids[0])}`;
}

function Breakdown({ entries, money, empty }) {
  const max = Math.max(0, ...entries.map(entry => entry.value));
  if (!entries.length) return <div className="empty-report">{empty}</div>;
  return entries.map(entry => (
    <div className="breakdown-row" key={entry.key}>
      <span className="breakdown-label">{entry.label}</span>
      <div className="breakdown-track"><div className="breakdown-fill" style={{ width: `${max ? entry.value / max * 100 : 0}%` }}></div></div>
      <span className="breakdown-value">{money(entry.value)}</span>
    </div>
  ));
}

export function AdminSalesReportPage() {
  const authState = useAuth();
  const tenantState = useTenant();
  const { profile } = authState;
  const { tenant } = tenantState;
  const { t, locale, intlLocale, formatNumber, formatDate: formatI18nDate } = useI18n();
  const stylesReady = useParityPage({
    title: t("sales_report.meta.title"),
    bodyClass: "order-delivery-workspace sales-report-workspace admin-vr-page admin-vr-report",
    styles: [
      "app.css", "icons.css", "sales-report.css", "order-delivery-workspace-theme.css",
      "sales-report-modern.css", "admin-sales-report-retail-pos-parity.css", "sales-report-period-tabs.css",
      "super-admin-header.css", "sales-report-source-wrapper.css", "sales-report-cancellation-port.css",
      "admin-sales-source-polish.css", "sales-report-source-cascade.css",
    ],
    attributes: { "data-roles": "admin,owner", "data-admin-workspace-refresh": "1" },
  });

  const now = useMemo(() => new Date(), []);
  const today = localDateKey(now);
  const [period, setPeriod] = useState("daily");
  const [reportDate, setReportDate] = useState(today);
  const [reportMonth, setReportMonth] = useState(monthKey(now));
  const [reportYear, setReportYear] = useState(bangkokParts(now).year);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [orderType, setOrderType] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [search, setSearch] = useState("");
  const [receiptStatus, setReceiptStatus] = useState("");
  const [orders, setOrders] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [readyTenantId, setReadyTenantId] = useState("");
  const [page, setPage] = useState(1);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const dialogRef = useRef(null);
  const pageSize = 20;

  const formatDate = (value, options = {}) => {
    const date = value instanceof Date ? value : toDate(value);
    if (!date) return "-";
    return formatI18nDate(date, { timeZone: REPORT_TIME_ZONE, ...options }) || "-";
  };
  const formatDateTime = value => formatDate(value, {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const money = value => new Intl.NumberFormat(intlLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
  const paymentLabel = key => ({
    cash: t("sales_report.payment.cash"),
    promptpay: t("sales_report.payment.promptpay"),
    cod: t("sales_report.payment.cod"),
    other: t("sales_report.payment.other"),
  })[key] || t("sales_report.payment.other");
  const orderTypeLabel = key => key === "delivery"
    ? t("sales_report.order_type.delivery")
    : key === "walkin" ? t("sales_report.order_type.walkin") : t("sales_report.order_type.storefront");

  useEffect(() => {
    if (!tenant?.id || !["owner", "admin"].includes(profile?.role)) return undefined;
    setLoadError("");
    setReadyTenantId("");
    return subscribeCompleteTenantSalesOrders(
      tenant.id,
      rows => {
        // A verified complete read is the only event that restores KPI charts.
        setOrders(rows);
        setLoadError("");
        setReadyTenantId(tenant.id);
      },
      error => {
        // Do not present stale figures or zeroes as authoritative on a failed
        // financial read; a later successful poll restores the source layout.
        setLoadError(error?.message || "SALES_REPORT_LOAD_FAILED");
        setReadyTenantId(tenant.id);
      },
    );
  }, [tenant?.id, profile?.role]);

  const receipts = useMemo(() => {
    const groups = new Map();
    orders.filter(isReceiptHistoryOrder).forEach(order => {
      // Keep cancelled rounds separate from active rounds sharing a receipt.
      const key = receiptGroupKey(order) + (isCancelledSalesOrder(order) ? ":void" : ":normal");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(order);
    });
    return [...groups.values()].map(group => {
      const sorted = [...group].sort((a, b) => (paidDate(a)?.getTime() || 0) - (paidDate(b)?.getTime() || 0));
      const first = sorted[0];
      const allItems = sorted.flatMap(order => normalizeOrderGiftItems(order)
        .map(item => ({ ...item, orderId: order.id })));
      const items = allItems.filter(item => !isCancelledItem(item));
      const cancelledReceipt = sorted.every(isCancelledSalesOrder);
      const subtotal = sorted.reduce((sum, order) => sum + Number(order.subtotalAmount ?? (orderNet(order) - Number(order.deliveryFee || 0))), 0);
      const deliveryFee = sorted.reduce((sum, order) => sum + Number(order.deliveryFee || 0), 0);
      const discount = sorted.reduce((sum, order) => sum + Number(order.discountAmount || order.discount || 0), 0);
      const total = sorted.reduce((sum, order) => sum + orderNet(order), 0);
      const paidAt = paidDate(sorted[sorted.length - 1]) || paidDate(first) || new Date();
      const type = sorted.some(order => order.orderType === "delivery") ? "delivery"
        : sorted.some(order => order.orderType === "walkin") ? "walkin" : "table";
      const customer = type === "delivery"
        ? (first.recipientName || t("sales_report.receipt.delivery_customer"))
        : type === "walkin"
          ? (first.customerName || (first.serviceType === "dine_in"
            ? (first.tableCode ? t("quick_order.cashier.table", { table: first.tableCode }) : t("quick_order.cashier.table_unassigned"))
            : t("quick_order.cashier.takeaway_title")))
          : t("sales_report.receipt.table_customer", { code: first.tableCode || "-" });
      const receipt = {
        key: receiptGroupKey(first) + (cancelledReceipt ? ":void" : ":normal"),
        orders: sorted,
        items,
        allItems,
        status: cancelledReceipt ? "cancelled" : "normal",
        cancellationSource: receiptCancellationSource(sorted),
        originalTotal: sorted.reduce((sum, order) => sum + Number(order.originalPaidTotal ?? order.totalAmount ?? 0), 0),
        subtotal, // Historical bill breakdown, also for cancelled receipts.
        deliveryFee,
        discount,
        total: reportedSalesNet(sorted), // Accounting-only: cancelled = 0.
        displayTotal: cancelledReceipt ? sorted.reduce((sum, order) => sum + historicalReceiptNet(order), 0) : reportedSalesNet(sorted),
        paidAt,
        type,
        customer,
        paymentKey: paymentMethodKey(first),
        itemCount: items.reduce((sum, item) => sum + Number(item.qty || 0), 0),
      };
      receipt.code = receiptCode(receipt);
      return receipt;
    }).sort((a, b) => b.paidAt - a.paidAt);
  }, [orders, t]);

  const range = useMemo(() => {
    if (period === "daily") {
      const value = reportDate || today;
      return { start: startOfDay(value), end: endOfDay(value), label: formatDate(new Date(`${value}T12:00:00+07:00`), { dateStyle: "long" }) };
    }
    if (period === "monthly") {
      const value = reportMonth || monthKey(now);
      const dates = bangkokMonthRange(value);
      return { start: dates?.start, end: dates?.end,
        label: dates ? formatDate(dates.start, { month: "long", year: "numeric" }) : "-" };
    }
    if (period === "yearly") {
      const year = Number(reportYear || bangkokParts(now).year);
      const dates = bangkokYearRange(year);
      const displayYear = locale === "th" ? year + 543 : year;
      return { start: dates?.start, end: dates?.end, label: t("sales_report.range.year", { year: displayYear }) };
    }
    const startValue = startDate || today;
    const endValue = endDate || startValue;
    return {
      start: startOfDay(startValue),
      end: endOfDay(endValue),
      label: t("sales_report.range.custom", {
        start: formatDate(new Date(`${startValue}T12:00:00+07:00`)),
        end: formatDate(new Date(`${endValue}T12:00:00+07:00`)),
      }),
    };
  }, [period, reportDate, reportMonth, reportYear, startDate, endDate, today, now, locale, intlLocale, t]);

  const matchingReceipts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return receipts.filter(receipt => {
      if (!range.start || !range.end || range.start > range.end ||
          receipt.paidAt < range.start || receipt.paidAt > range.end) return false;
      if (orderType !== "all" && receipt.type !== orderType) return false;
      if (paymentMethod !== "all" && receipt.paymentKey !== paymentMethod) return false;
      if (keyword) {
        const haystack = [
          receipt.code,
          receipt.customer,
          receipt.cancellationSource,
          ...receipt.orders.map(order => order.id),
          ...receipt.items.map(item => item.name),
        ].join(" ").toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    });
  }, [receipts, range, orderType, paymentMethod, search]);
  // KPI/charts remain independent of the receipt-history filter. A voided
  // payment must never become a sale merely because the user views its row.
  const filteredReceipts = useMemo(() => matchingReceipts.filter(r => r.status === "normal"), [matchingReceipts]);
  const receiptRows = useMemo(() => matchingReceipts.filter(r => !receiptStatus || r.status === receiptStatus), [matchingReceipts, receiptStatus]);

  useEffect(() => setPage(1), [period, reportDate, reportMonth, reportYear, startDate, endDate, orderType, paymentMethod, search, receiptStatus]);

  const summary = useMemo(() => {
    const total = filteredReceipts.reduce((sum, receipt) => sum + receipt.total, 0);
    const count = filteredReceipts.length;
    const items = filteredReceipts.reduce((sum, receipt) => sum + receipt.itemCount, 0);
    return { total, count, items, average: count ? total / count : 0 };
  }, [filteredReceipts]);

  const orderBreakdown = useMemo(() => {
    const totals = { table: 0, walkin: 0, delivery: 0 };
    filteredReceipts.forEach(receipt => { totals[receipt.type] += receipt.total; });
    return Object.entries(totals).map(([key, value]) => ({ key, label: orderTypeLabel(key), value }));
  }, [filteredReceipts, t]);

  const paymentBreakdown = useMemo(() => {
    const totals = { cash: 0, promptpay: 0, cod: 0, other: 0 };
    filteredReceipts.forEach(receipt => { totals[receipt.paymentKey] += receipt.total; });
    return Object.entries(totals).map(([key, value]) => ({ key, label: paymentLabel(key), value }));
  }, [filteredReceipts, t]);

  const chart = useMemo(() => {
    if (period === "daily") {
      return {
        title: t("sales_report.sections.hourly_sales"),
        yearly: false,
        buckets: Array.from({ length: 24 }, (_, hour) => ({
          key: hour,
          label: `${String(hour).padStart(2, "0")}:00`,
          value: filteredReceipts.filter(receipt => bangkokHour(receipt.paidAt) === hour).reduce((sum, receipt) => sum + receipt.total, 0),
        })),
      };
    }
    if (period === "yearly") {
      const year = bangkokParts(range.start)?.year ?? bangkokParts(now).year;
      return {
        title: t("sales_report.sections.monthly_sales"),
        yearly: true,
        buckets: Array.from({ length: 12 }, (_, month) => ({
          key: month,
          label: formatDate(bangkokStartOfDay(`${year}-${String(month + 1).padStart(2,"0")}-01`), { month: "short" }),
          value: filteredReceipts.filter(receipt => bangkokParts(receipt.paidAt)?.month === month + 1).reduce((sum, receipt) => sum + receipt.total, 0),
        })),
      };
    }
    const days = bangkokDaysInRange(range.start,range.end,367) || [];
    const buckets = days.map(key => ({
      key, label: formatDate(bangkokStartOfDay(key),{day:"numeric",month:"short"}),value:0,
    }));
    const index = new Map(buckets.map(bucket => [bucket.key, bucket]));
    filteredReceipts.forEach(receipt => {
      const bucket = index.get(localDateKey(receipt.paidAt));
      if (bucket) bucket.value += receipt.total;
    });
    return { title: t("sales_report.sections.daily_sales"), yearly: false, buckets };
  }, [period, filteredReceipts, range, intlLocale, t]);
  const chartMax = Math.max(0, ...chart.buckets.map(bucket => bucket.value));

  const topItems = useMemo(() => {
    const totals = new Map();
    filteredReceipts.forEach(receipt => receipt.items.forEach(item => {
      const key = String(item.name || t("sales_report.top_items.unnamed"));
      const current = totals.get(key) || { qty: 0, value: 0 };
      current.qty += Number(item.qty || 0);
      current.value += Number(item.qty || 0) * Number(item.price || 0);
      totals.set(key, current);
    }));
    return [...totals.entries()].sort((a, b) => b[1].qty - a[1].qty || b[1].value - a[1].value).slice(0, 10);
  }, [filteredReceipts, t]);

  const bestPeriod = useMemo(() => {
    const daily = new Map(), monthly = new Map();
    filteredReceipts.forEach(receipt => {
      const day = localDateKey(receipt.paidAt), month = monthKey(receipt.paidAt);
      daily.set(day, (daily.get(day) || 0) + receipt.total);
      monthly.set(month, (monthly.get(month) || 0) + receipt.total);
    });
    const bestDay = [...daily.entries()].sort((a, b) => b[1] - a[1])[0];
    const bestMonth = [...monthly.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      dayLabel: bestDay ? formatDate(new Date(`${bestDay[0]}T12:00:00+07:00`), { dateStyle: "long" }) : "-",
      dayValue: bestDay?.[1] || 0,
      monthLabel: bestMonth ? formatDate(new Date(`${bestMonth[0]}-01T12:00:00+07:00`), { month: "long", year: "numeric" }) : "-",
      monthValue: bestMonth?.[1] || 0,
    };
  }, [filteredReceipts, intlLocale]);

  const invalidRange = !range.start || !range.end || range.start > range.end ||
    (period === "custom" && !bangkokDaysInRange(range.start,range.end,367));
  const pageCount = Math.max(1, Math.ceil(receiptRows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleReceipts = receiptRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const yearOptions = Array.from({ length: 7 }, (_, index) => bangkokParts(now).year - 5 + index).reverse();

  const pagination = useMemo(() => {
    const pages = Math.ceil(receiptRows.length / pageSize);
    if (pages <= 1) return [];
    const values = [];
    for (let value = 1; value <= pages; value += 1) {
      if (pages > 9 && value > 2 && value < pages - 1 && Math.abs(value - safePage) > 1) {
        if (values.at(-1) !== "ellipsis") values.push("ellipsis");
        continue;
      }
      values.push(value);
    }
    return values;
  }, [receiptRows.length, safePage]);

  const openReceipt = receipt => {
    setSelectedReceipt(receipt);
    dialogRef.current?.showModal?.();
  };
  const closeReceipt = () => {
    dialogRef.current?.close?.();
    setSelectedReceipt(null);
  };

  if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady ||
      (tenant?.id && ["owner", "admin"].includes(profile?.role) && readyTenantId !== tenant.id)) {
    return <PageReadyOverlay context="PENGUIN" title={t("shared.state.loading")} message={t("shared.state.please_wait")} />;
  }
  if (!profile) return <Navigate to="/login?next=%2Fadmin%2Fsales-report" replace />;
  if (!["owner", "admin"].includes(profile.role)) return <Navigate to="/" replace />;
  if (tenantState.status === "error" || !tenant) return <Navigate to="/" replace />;
  if (loadError) {
    // Read failure remains fail-closed and isolated from the SOURCE success JSX.
    return createElement(SalesReportReadFailure, {
      title: t("sales_report.hero.title"), error: loadError,
    });
  }

  return (
    <>
      <header className="app-header super-admin-header">
        <div className="super-admin-header-leading sales-report-header-leading">
          <div className="brand sales-report-header-brand"><span className="brand-mark">PG</span><i className="bi bi-bar-chart-line app-icon" aria-hidden="true"></i><span>{t("sales_report.header.title")}</span></div>
          <Link className="btn btn-dark btn-sm sales-back-link super-admin-header-back" to="/admin"><i className="bi bi-arrow-left app-icon" aria-hidden="true"></i><span>{t("sales_report.header.back")}</span></Link>
        </div>
        <div className="app-header-actions" data-header-actions>
          <LocaleSwitcher style={{ marginLeft: 0, marginRight: 0 }} />
          <UserMenu profile={profile} />
        </div>
      </header>

      <div id="demoBanner"></div>

      <main className="container sales-report-page">
        <section className="hero">
          <h1><i className="bi bi-graph-up-arrow" aria-hidden="true"></i><span>{t("sales_report.hero.title")}</span></h1>
          <p>{t("sales_report.hero.description")}</p>
        </section>

        {loadError ? <div className="upload-error" role="alert">{loadError}</div> : null}

        <section className="card report-filter-card">
          <div className="section-title"><h2><i className="bi bi-funnel" aria-hidden="true"></i><span>{t("sales_report.filters.title")}</span></h2></div>
          <div className="report-period-tabs" role="tablist" aria-label={t("sales_report.filters.period_aria")}>
            {[["daily","calendar-day"],["monthly","calendar-month"],["yearly","calendar3"],["custom","calendar-range"]].map(([key, icon]) => (
              <button key={key} type="button" className={"period-tab" + (period === key ? " active" : "")} data-period={key} onClick={() => setPeriod(key)}><i className={`bi bi-${icon}`} aria-hidden="true"></i><span>{t(`sales_report.filters.${key}`)}</span></button>
            ))}
          </div>
          <div className="report-filter-grid">
            <fieldset className="field period-control sales-dynamic-field" data-control="daily" hidden={period !== "daily"}><legend><label htmlFor="reportDate"><i className="bi bi-calendar-check" aria-hidden="true"></i><span>{t("sales_report.filters.date")}</span></label></legend><input className="input" id="reportDate" type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} /></fieldset>
            <fieldset className="field period-control sales-dynamic-field" data-control="monthly" hidden={period !== "monthly"}><legend><label htmlFor="reportMonth"><i className="bi bi-calendar-month" aria-hidden="true"></i><span>{t("sales_report.filters.month")}</span></label></legend><input className="input" id="reportMonth" type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} /></fieldset>
            <fieldset className="field period-control sales-dynamic-field" data-control="yearly" hidden={period !== "yearly"}><legend><label htmlFor="reportYear"><i className="bi bi-calendar3" aria-hidden="true"></i><span>{t("sales_report.filters.year")}</span></label></legend><select className="input" id="reportYear" value={reportYear} onChange={e => setReportYear(Number(e.target.value))}>{yearOptions.map(year => <option key={year} value={year}>{locale === "th" ? year + 543 : year}</option>)}</select></fieldset>
            <div className="period-control custom-date-grid" data-control="custom" hidden={period !== "custom"}>
              <fieldset className="field sales-dynamic-field"><legend><label htmlFor="startDate"><i className="bi bi-calendar-plus" aria-hidden="true"></i><span>{t("sales_report.filters.start_date")}</span></label></legend><input className="input" id="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></fieldset>
              <fieldset className="field sales-dynamic-field"><legend><label htmlFor="endDate"><i className="bi bi-calendar-minus" aria-hidden="true"></i><span>{t("sales_report.filters.end_date")}</span></label></legend><input className="input" id="endDate" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></fieldset>
            </div>
            <fieldset className="field sales-dynamic-field"><legend><label htmlFor="orderTypeFilter"><i className="bi bi-shop" aria-hidden="true"></i><span>{t("sales_report.filters.order_type")}</span></label></legend><select className="input" id="orderTypeFilter" value={orderType} onChange={e => setOrderType(e.target.value)}><option value="all">{t("sales_report.filters.all")}</option><option value="table">{t("sales_report.order_type.storefront")}</option><option value="walkin">{t("sales_report.order_type.walkin")}</option><option value="delivery">{t("sales_report.order_type.delivery")}</option></select></fieldset>
            <fieldset className="field sales-dynamic-field"><legend><label htmlFor="paymentMethodFilter"><i className="bi bi-credit-card" aria-hidden="true"></i><span>{t("sales_report.filters.payment_method")}</span></label></legend><select className="input" id="paymentMethodFilter" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}><option value="all">{t("sales_report.filters.all")}</option><option value="cash">{t("sales_report.payment.cash")}</option><option value="promptpay">{t("sales_report.payment.promptpay")}</option><option value="cod">{t("sales_report.payment.cod")}</option><option value="other">{t("sales_report.payment.other")}</option></select></fieldset>
            <fieldset className="field sales-dynamic-field"><legend><label htmlFor="receiptSearch"><i className="bi bi-search" aria-hidden="true"></i><span>{t("sales_report.filters.search_label")}</span></label></legend><input className="input" id="receiptSearch" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("sales_report.filters.search_placeholder")} /></fieldset>
          </div>
        </section>

        {invalidRange ? (
          <div className="card empty sales-report-range-error" role="alert"
            data-sales-report-range-state="invalid">
            <p>ช่วงวันที่ไม่ถูกต้อง หรือเกิน 367 วัน กรุณาเลือกวันที่เริ่มต้นและสิ้นสุดใหม่</p>
          </div>
        ) : (
          <>
        <section className="sales-summary-grid sales-kpi-grid" aria-label={t("sales_report.hero.title")}>
          <article className="sales-kpi-card sales-kpi-card--primary">
            <div className="sales-kpi-card__head">
              <span className="sales-kpi-card__icon" aria-hidden="true"><i className="bi bi-cash-stack"></i></span>
              <span className="sales-kpi-card__label">{t("sales_report.summary.net_sales")}</span>
            </div>
            <div className="sales-kpi-card__metric"><strong id="totalSales">{money(summary.total)}</strong><small>{t("sales_report.units.baht")}</small></div>
          </article>
          <article className="sales-kpi-card sales-kpi-card--receipt">
            <div className="sales-kpi-card__head">
              <span className="sales-kpi-card__icon" aria-hidden="true"><i className="bi bi-receipt-cutoff"></i></span>
              <span className="sales-kpi-card__label">{t("sales_report.summary.receipt_count")}</span>
            </div>
            <div className="sales-kpi-card__metric"><strong id="receiptCount">{formatNumber(summary.count, { maximumFractionDigits: 0 })}</strong><small>{t("sales_report.units.receipt")}</small></div>
          </article>
          <article className="sales-kpi-card sales-kpi-card--average">
            <div className="sales-kpi-card__head">
              <span className="sales-kpi-card__icon" aria-hidden="true"><i className="bi bi-calculator"></i></span>
              <span className="sales-kpi-card__label">{t("sales_report.summary.average_receipt")}</span>
            </div>
            <div className="sales-kpi-card__metric"><strong id="averageReceipt">{money(summary.average)}</strong><small>{t("sales_report.units.baht")}</small></div>
          </article>
          <article className="sales-kpi-card sales-kpi-card--items">
            <div className="sales-kpi-card__head">
              <span className="sales-kpi-card__icon" aria-hidden="true"><i className="bi bi-bag-check"></i></span>
              <span className="sales-kpi-card__label">{t("sales_report.summary.sold_items")}</span>
            </div>
            <div className="sales-kpi-card__metric"><strong id="soldItemCount">{formatNumber(summary.items, { maximumFractionDigits: 0 })}</strong><small>{t("sales_report.units.item")}</small></div>
          </article>
        </section>

        <section className="grid grid-2 report-breakdown-grid">
          <article className="card"><div className="section-title"><h2><i className="bi bi-diagram-3" aria-hidden="true"></i><span>{t("sales_report.sections.order_type_sales")}</span></h2></div><div id="orderTypeSummary" className="breakdown-list"><Breakdown entries={orderBreakdown} money={value => `${money(value)} ${t("sales_report.units.baht")}`} empty={t("sales_report.chart.no_sales")} /></div></article>
          <article className="card"><div className="section-title"><h2><i className="bi bi-wallet2" aria-hidden="true"></i><span>{t("sales_report.sections.payment_sales")}</span></h2></div><div id="paymentSummary" className="breakdown-list"><Breakdown entries={paymentBreakdown} money={value => `${money(value)} ${t("sales_report.units.baht")}`} empty={t("sales_report.chart.no_sales")} /></div></article>
        </section>

        <section className="card report-chart-card">
          <div className="section-title"><div><h2 id="chartTitle"><i className="bi bi-bar-chart-steps" aria-hidden="true"></i><span>{chart.title}</span></h2><div className="menu-category" id="chartSubtitle">{range.label}</div></div></div>
          <div id="salesChart" className={"sales-chart hourly-chart-scroll" + (chart.yearly ? " yearly-chart-full" : "")} data-horizontal-scroll={chart.yearly ? "false" : "true"}>
            {chart.buckets.map(bucket => (
              <div className="chart-column" key={bucket.key} title={`${bucket.label}: ${money(bucket.value)} ${t("sales_report.units.baht")}`}>
                <div className="chart-value">{bucket.value ? money(bucket.value) : ""}</div>
                <div className="chart-bar-wrap"><div className="chart-bar" style={{ height: `${chartMax ? Math.max(2, bucket.value / chartMax * 100) : 2}%` }}></div></div>
                <div className="chart-label">{bucket.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-2 report-analysis-grid">
          <article className="card">
            <div className="section-title"><h2><i className="bi bi-award" aria-hidden="true"></i><span>{t("sales_report.sections.top_items")}</span></h2></div>
            <div id="topItems" className="rank-list">
              {topItems.length ? topItems.map(([name, value], index) => (
                <div className="rank-row" key={name}>
                  <span className="rank-number">{index + 1}</span>
                  <div><div className="rank-name">{name}</div><div className="rank-meta">{formatNumber(value.qty, { maximumFractionDigits: 0 })} {t("sales_report.units.piece")}</div></div>
                  <div className="rank-value">{money(value.value)} {t("sales_report.units.baht")}</div>
                </div>
              )) : <div className="empty-report">{t("sales_report.top_items.empty")}</div>}
            </div>
          </article>
          <article className="card">
            <div className="section-title"><h2><i className="bi bi-trophy" aria-hidden="true"></i><span>{t("sales_report.sections.best_period")}</span></h2></div>
            <div id="bestPeriod" className="best-period">
              <div className="best-period-card"><span className="menu-category">{t("sales_report.best.day")}</span><strong>{bestPeriod.dayLabel}</strong><div>{money(bestPeriod.dayValue)} {t("sales_report.units.baht")}</div></div>
              <div className="best-period-card"><span className="menu-category">{t("sales_report.best.month")}</span><strong>{bestPeriod.monthLabel}</strong><div>{money(bestPeriod.monthValue)} {t("sales_report.units.baht")}</div></div>
              <div className="best-period-card"><span className="menu-category">{t("sales_report.best.period")}</span><strong>{range.label}</strong><div>{formatNumber(filteredReceipts.length, { maximumFractionDigits: 0 })} {t("sales_report.units.receipts")}</div></div>
            </div>
          </article>
        </section>

        <section className="card receipt-section">
          <div className="section-title receipt-heading"><div><h2><i className="bi bi-table" aria-hidden="true"></i><span>{t("sales_report.sections.receipts")}</span></h2><div className="menu-category" id="receiptRangeLabel">{range.label}</div></div><div className="receipt-cancellation-controls"><fieldset className="sales-dynamic-select sales-receipt-status-filter"><legend><label htmlFor="receiptStatusFilter">{t("sales_report.cancel.status_filter")}</label></legend><select className="input" id="receiptStatusFilter" value={receiptStatus} onChange={e=>setReceiptStatus(e.target.value)}><option value="">{t("sales_report.cancel.all")}</option><option value="normal">{t("sales_report.cancel.normal")}</option><option value="cancelled">{t("sales_report.cancel.cancelled")}</option></select></fieldset><span className="badge" id="receiptResultCount">{t("sales_report.receipt.result_count", { count: formatNumber(receiptRows.length, { maximumFractionDigits: 0 }) })}</span></div></div>
          <div className="table-scroll receipt-table-scroll" data-horizontal-scroll="true" aria-label={t("sales_report.sections.receipts")}>
            <table className="table-list receipt-table">
              <thead><tr><th>{t("sales_report.receipt.number")}</th><th>{t("sales_report.receipt.date_time")}</th><th>{t("sales_report.receipt.channel")}</th><th>{t("sales_report.receipt.customer_table")}</th><th>{t("sales_report.receipt.payment")}</th><th>{t("sales_report.receipt.quantity")}</th><th className="number">{t("sales_report.receipt.net_total")}</th><th>{t("sales_report.cancel.status_filter")}</th><th></th></tr></thead>
              <tbody id="receiptRows">
                {visibleReceipts.length ? visibleReceipts.map(receipt => (
                  <tr key={receipt.key}>
                    <td><span className={"receipt-code" + (receipt.status === "cancelled" ? " receipt-code-cancelled" : "")}>{receipt.code}</span></td>
                    <td>{formatDateTime(receipt.paidAt)}</td>
                    <td>{orderTypeLabel(receipt.type)}</td>
                    <td>{receipt.customer}</td>
                    <td>{paymentLabel(receipt.paymentKey)}</td>
                    <td>{formatNumber(receipt.itemCount, { maximumFractionDigits: 0 })}</td>
                    <td className="number">{money(receipt.displayTotal)}</td>
                    <td>{receipt.status === "cancelled" ? <span className="receipt-cancelled-stripe">{t("sales_report.cancel.cancelled")} · {t("sales_report.cancel.actor_"+receipt.cancellationSource)}</span> : <span className="receipt-status-normal">{t("sales_report.cancel.normal")}</span>}</td>
                    <td><div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}><button type="button" className="btn btn-sm receipt-row-action receipt-view-action" data-view-receipt={receipt.key} onClick={() => openReceipt(receipt)}><i className="bi bi-eye" aria-hidden="true"></i><span>{t("sales_report.receipt.view")}</span></button><a className="btn btn-sm receipt-row-action receipt-print-row-action" href={printUrl(receipt)} target="_blank" rel="noopener"><i className="bi bi-printer" aria-hidden="true"></i><span>{t("sales_report.receipt.print")}</span></a></div></td>
                  </tr>
                )) : <tr><td colSpan="9"><div className="empty-report">{t("sales_report.receipt.no_results")}</div></td></tr>}
              </tbody>
            </table>
          </div>
          {pagination.length ? <nav id="receiptPagination" className="report-pagination">
            {pagination.map((value, index) => value === "ellipsis"
              ? <span key={`ellipsis-${index}`}>…</span>
              : <button key={value} type="button" className={value === safePage ? "active" : ""} data-page={value} onClick={() => { setPage(value); document.querySelector(".receipt-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>{value}</button>)}
          </nav> : <nav id="receiptPagination" className="report-pagination" hidden></nav>}
        </section>
          </>
        )}
      </main>

      <dialog id="receiptDialog" className="receipt-dialog" ref={dialogRef} onCancel={e => { e.preventDefault(); closeReceipt(); }} onClick={e => { if (e.target === dialogRef.current) closeReceipt(); }}>
        <div className="receipt-dialog-card">
          <div className="section-title"><h2><i className="bi bi-receipt" aria-hidden="true"></i><span>{t("sales_report.sections.receipt_detail")}</span></h2><button type="button" className="receipt-dialog-close" id="closeReceiptDialog" aria-label={t("sales_report.receipt.close")} title={t("sales_report.receipt.close")} onClick={closeReceipt}><i className="bi bi-x-lg" aria-hidden="true"></i></button></div>
          <div id="receiptDetail">
            {selectedReceipt ? <>
              {selectedReceipt.status === "cancelled" ? <div className="receipt-cancelled-banner">{t("sales_report.cancel.cancelled")} · {t("sales_report.cancel.source_"+selectedReceipt.cancellationSource)}</div> : null}
              <div className="receipt-detail-head"><div className="receipt-detail-identity"><span className="receipt-detail-label">{t("sales_report.receipt.number")}</span><div className="receipt-code">{selectedReceipt.code}</div></div><a className="btn btn-dark receipt-print-action" href={printUrl(selectedReceipt)} target="_blank" rel="noopener"><i className="bi bi-printer" aria-hidden="true"></i><span>{t("sales_report.receipt.print")}</span></a></div>
              <div className="receipt-detail-facts">
                <div><span>{t("sales_report.receipt.date_time")}</span><strong>{formatDateTime(selectedReceipt.paidAt)}</strong></div>
                <div><span>{t("sales_report.receipt.channel")}</span><strong>{orderTypeLabel(selectedReceipt.type)}</strong></div>
                <div><span>{t("sales_report.receipt.customer_table")}</span><strong>{selectedReceipt.customer}</strong></div>
                <div><span>{t("sales_report.receipt.payment")}</span><strong>{paymentLabel(selectedReceipt.paymentKey)}</strong></div>
              </div>
              <div className="receipt-detail-section-head"><strong>{t("sales_report.receipt.items_title")}</strong><span>{t("sales_report.receipt.item_count", { count: formatNumber(selectedReceipt.itemCount, { maximumFractionDigits: 0 }) })}</span></div>
              <div className="receipt-item-list">
                {selectedReceipt.allItems.length ? selectedReceipt.allItems.map((item, index) => {
                  const isGift = item.isGift === true;
                  const name = `${item.name || t("sales_report.receipt.item_fallback")}${isGift ? ` ${t("sales_report.receipt.gift_suffix")}` : ""}`;
                  const lineTotal = Number(item.qty || 0) * Number(item.price || 0);
                  return <div className={"receipt-item-row" + (isGift ? " is-gift" : "") + (item.cancelled ? " is-cancelled" : "")} key={`${item.orderId}-${item.menuId || item.id || index}-${index}`}><div className="receipt-item-main"><div className="receipt-item-name">{name}{item.cancelled ? <small className="receipt-cancelled-stripe">{t("sales_report.cancel.cancelled")} · {t("sales_report.cancel.source_"+itemCancellationSource(item))}</small> : null}</div><div className="receipt-item-meta">{formatNumber(Number(item.qty || 0), { maximumFractionDigits: 0 })} × {money(item.price || 0)}{isGift ? <span className="receipt-gift-badge">{t("sales_report.receipt.gift_badge")}</span> : null}</div></div><strong className="receipt-item-total">{money(lineTotal)}</strong></div>;
                }) : <div className="empty-report">{t("sales_report.receipt.no_items")}</div>}
              </div>
              <div className="receipt-totals">
                <div className="receipt-total-row"><span>{t("sales_report.receipt.subtotal")}</span><strong>{money(selectedReceipt.subtotal)}</strong></div>
                {selectedReceipt.discount ? <div className="receipt-total-row"><span>{t("sales_report.receipt.discount")}</span><strong>-{money(selectedReceipt.discount)}</strong></div> : null}
                <div className="receipt-total-row"><span>{t("sales_report.receipt.delivery_fee")}</span><strong>{money(selectedReceipt.deliveryFee)}</strong></div>
                {selectedReceipt.status === "cancelled" ? <div className="receipt-total-row"><span>{t("sales_report.cancel.sales_counted_total")}</span><strong>{money(selectedReceipt.total)} {t("sales_report.units.baht")}</strong></div> : null}
                <div className="receipt-total-row grand"><span>{t("sales_report.receipt.total")}</span><strong>{money(selectedReceipt.displayTotal)} {t("sales_report.units.baht")}</strong></div>
              </div>
            </> : null}
          </div>
        </div>
      </dialog>

      <ParityFooter />
    </>
  );
}
