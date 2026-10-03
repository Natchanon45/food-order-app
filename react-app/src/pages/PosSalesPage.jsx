import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { canUseRetailPos, getRetailPosSession } from "@/auth/retailPosSession";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { AppDeveloperPanel } from "@/components/AppDeveloperPanel";
import { firstAllowedPosPage, getPosPermissions, PosNavigation } from "@/components/PosNavigation";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { sweetConfirm } from "@/components/sweetDialog";
import {
  listPosCustomers,
  listPosSales,
  loadPosReceiptSettings,
  watchPosSales,
} from "@/data/retailPosData";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { useTenant } from "@/tenant/TenantProvider";

const SALES_KEY = "retail_pos_sales_v1";
const LEDGER_KEY = "retail_pos_loyalty_ledger_v1";
const round2 = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const asDate = value => {
  if (value?.toDate) return value.toDate();
  if (value?.seconds) return new Date(Number(value.seconds) * 1000);
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
};
const localDateKey = value => {
  const date = asDate(value);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
};
const inputDate = value => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : asDate(value);
};
const saleDisplayNumber = sale => String(sale?.saleNumber || sale?.number || sale?.id || "");
const saleTotalAmount = sale => Number(sale?.totalAmount ?? sale?.total ?? 0);
const paymentMethod = sale => sale?.payment?.method || sale?.paymentMethod || "cash";
const isVatSale = sale => sale?.vatRegistered === true || sale?.vatRegistered === "yes" || Number(sale?.vatAmount || 0) > 0;
const beforeVatOf = sale => isVatSale(sale)
  ? Number(sale?.beforeVat ?? sale?.taxableBase ?? sale?.discountedBase ?? sale?.subtotal ?? 0)
  : 0;
const saleDiscount = sale => Number(sale?.discount || 0) + Number(sale?.pointDiscount || 0);
const saleQty = sale => (sale?.items || []).reduce((sum, item) => sum + Number(item?.qty || 0), 0);
const readJson = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const maskHead = value => {
  const chars = Array.from(String(value || "").trim());
  if (!chars.length) return "";
  const visible = chars.length >= 5 ? 4 : chars.length;
  return chars.slice(0, visible).join("") + "*".repeat(Math.max(0, chars.length - visible));
};
const maskTail = value => {
  const chars = Array.from(String(value || "").trim());
  if (!chars.length) return "";
  const visible = Math.min(3, chars.length);
  return "*".repeat(Math.max(0, chars.length - visible)) + chars.slice(-visible).join("");
};
const maskReceiptCustomerName = name => {
  const parts = String(name || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return maskHead(parts[0]);
  return `${maskHead(parts[0])} ${maskTail(parts.slice(1).join(""))}`;
};
const maskReceiptPhone = phone => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length < 10) return digits.length <= 2 ? digits : `${digits.slice(0, Math.min(3, digits.length))}-xxx`;
  return `${digits.slice(0, 3)}-xxx-xx${digits.slice(-2)}`;
};
const loyaltyForSale = sale => {
  if (sale?.loyalty) return sale.loyalty;
  const rows = readJson(LEDGER_KEY, []);
  const id = String(sale?.id || "");
  const number = String(sale?.saleNumber || "");
  const entry = Array.isArray(rows) ? rows.find(row => (id && String(row?.saleId || "") === id) || (number && String(row?.saleNumber || "") === number)) : null;
  return entry ? {
    pointsBefore: entry.pointsBefore ?? entry.balanceBefore,
    pointsUsed: entry.pointsUsed,
    pointsEarned: entry.pointsEarned,
    pointsAfter: entry.pointsAfter ?? entry.balanceAfter,
  } : null;
};

export function PosSalesPage() {
  const authState = useAuth();
  const tenantState = useTenant();
  const { profile, user: authUser } = authState;
  const { tenant } = tenantState;
  const { t, formatNumber, formatDate } = useI18n();
  const stylesReady = useParityPage({
    title: t("pos_sales.meta.title"),
    attributes: { "data-module": "retail-pos-sales" },
    disabledGlobalStyles: ["app.css", "icons.css", "shared-responsive.css"],
    styles: [
      "app-version-badge-runtime.css",
      "pos-locale-switcher-placement.css",
      "retail-pos.css",
      "retail-sales.css",
      "retail-sales-mobile.css",
      "retail-pos-navigation.css",
      "sweet-dialog.css",
      "retail-sales-react-parity.css",
    ],
  });
  const dialogRef = useRef(null);
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [receiptSettings, setReceiptSettings] = useState({});
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [initialDataReady, setInitialDataReady] = useState(false);
  const [loadError, setLoadError] = useState("");

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
  const posPermissions = useMemo(() => getPosPermissions(posAccessProfile), [posAccessProfile]);
  const hasSalesAccess = posPermissions.has("pos.sales");
  const posRedirectTarget = useMemo(() => {
    if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady) return "";
    const requested = `${location.pathname}${location.search}`;
    if (!profile) return `/pos/login/?next=${encodeURIComponent(requested)}`;
    if (!canUseRetailPos(posAccessProfile) || tenantState.status === "error" || !tenant) return "/";
    if (!hasSalesAccess) {
      const firstAllowed = firstAllowedPosPage(posAccessProfile);
      if (firstAllowed === "/pos/forbidden") {
        return `/pos/forbidden/?permission=pos.sales&next=${encodeURIComponent(requested)}`;
      }
      return `${firstAllowed}?from=permission`;
    }
    return "";
  }, [
    authState.status,
    tenantState.status,
    tenant?.id,
    profile,
    posAccessProfile,
    hasSalesAccess,
    stylesReady,
  ]);

  useEffect(() => {
    if (posRedirectTarget) location.replace(posRedirectTarget);
  }, [posRedirectTarget]);

  useEffect(() => {
    if (!tenant?.id || !profile || !canUseRetailPos(posAccessProfile) || !hasSalesAccess) return undefined;
    let alive = true;
    let stopSalesWatch = () => {};
    setInitialDataReady(false);
    setLoadError("");
    Promise.all([
      listPosSales(tenant.id),
      listPosCustomers(tenant.id).catch(() => []),
      loadPosReceiptSettings(tenant.id).catch(() => ({})),
    ]).then(([rows, nextCustomers, settings]) => {
      if (!alive) return;
      setSales(rows);
      setCustomers(nextCustomers);
      setReceiptSettings(settings);
      try { localStorage.setItem(SALES_KEY, JSON.stringify(rows)); } catch {}
      stopSalesWatch = watchPosSales(tenant.id, nextRows => {
        if (!alive) return;
        setSales(nextRows);
        try { localStorage.setItem(SALES_KEY, JSON.stringify(nextRows)); } catch {}
        document.documentElement.dataset.salesSource = "firestore";
      });
    }).catch(error => {
      console.error("POS_SALES_LOAD_FAILED", error);
      if (alive) setLoadError(String(error?.message || "POS_SALES_LOAD_FAILED"));
    }).finally(() => {
      if (alive) setInitialDataReady(true);
    });
    return () => {
      alive = false;
      stopSalesWatch();
    };
  }, [tenant?.id, profile, posAccessProfile, hasSalesAccess]);

  const money = value => formatNumber(round2(value), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const numberText = value => formatNumber(Number(value || 0));
  const paymentName = method => method === "cash"
    ? t("pos_sales_runtime.runtime.cash")
    : t("pos_sales_runtime.runtime.transfer");
  const vatModeName = sale => !isVatSale(sale)
    ? "-"
    : String(sale?.vatMode || "").toLowerCase() === "exclude"
      ? t("pos_sales_runtime.runtime.vat_exclude")
      : t("pos_sales_runtime.runtime.vat_include");
  const dateTimeText = value => formatDate(asDate(value), { dateStyle: "medium", timeStyle: "short" });
  const shortDateText = value => formatDate(inputDate(value), { year: "numeric", month: "2-digit", day: "2-digit" });

  const filteredSales = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return sales.filter(sale => {
      if (dateFrom && localDateKey(sale.createdAt) < dateFrom) return false;
      if (dateTo && localDateKey(sale.createdAt) > dateTo) return false;
      if (paymentFilter !== "all" && paymentMethod(sale) !== paymentFilter) return false;
      if (!keyword) return true;
      const itemText = (sale.items || []).map(item =>
        `${item?.name || ""} ${item?.id || ""} ${item?.barcode || ""}`
      ).join(" ");
      return `${saleDisplayNumber(sale)} ${sale?.id || ""} ${itemText}`.toLowerCase().includes(keyword);
    });
  }, [sales, search, dateFrom, dateTo, paymentFilter]);

  const stats = useMemo(() => {
    const saleTotal = filteredSales.reduce((sum, sale) => sum + saleTotalAmount(sale), 0);
    const cashTotal = filteredSales.reduce((sum, sale) =>
      sum + (paymentMethod(sale) === "cash" ? saleTotalAmount(sale) : 0), 0);
    const transferTotal = saleTotal - cashTotal;
    const beforeVatTotal = filteredSales.reduce((sum, sale) => sum + beforeVatOf(sale), 0);
    const vatTotal = filteredSales.reduce((sum, sale) => sum + Number(sale?.vatAmount || 0), 0);
    const vatBillCount = filteredSales.filter(isVatSale).length;
    const discountTotal = filteredSales.reduce((sum, sale) => sum + saleDiscount(sale), 0);
    const itemQtyTotal = filteredSales.reduce((sum, sale) => sum + saleQty(sale), 0);
    const highestSale = filteredSales.reduce((max, sale) => Math.max(max, saleTotalAmount(sale)), 0);
    const averageSale = filteredSales.length ? saleTotal / filteredSales.length : 0;
    const cashPercent = saleTotal > 0 ? (cashTotal / saleTotal) * 100 : 0;
    const transferPercent = saleTotal > 0 ? (transferTotal / saleTotal) * 100 : 0;
    return {
      saleTotal, cashTotal, transferTotal, beforeVatTotal, vatTotal, vatBillCount,
      discountTotal, itemQtyTotal, highestSale, averageSale, cashPercent, transferPercent,
    };
  }, [filteredSales]);

  const ranking = useMemo(() => {
    const map = new Map();
    filteredSales.forEach(sale => (sale.items || []).forEach(item => {
      const key = String(item?.id || item?.barcode || item?.name || t("pos_sales_runtime.runtime.unknown_product"));
      const qty = Number(item?.qty || 0);
      const current = map.get(key) || {
        id: key,
        name: item?.name || item?.productName || t("pos_sales_runtime.runtime.unknown_product"),
        qty: 0,
        revenue: 0,
      };
      current.qty += qty;
      current.revenue += Number(item?.lineTotal ?? (Number(item?.price || 0) * qty));
      map.set(key, current);
    }));
    return [...map.values()].sort((a, b) =>
      b.qty - a.qty || b.revenue - a.revenue || String(a.name).localeCompare(String(b.name), "th")
    ).slice(0, 10);
  }, [filteredSales, t]);

  const reportPeriodText = useMemo(() => {
    if (!dateFrom && !dateTo) return t("pos_sales_runtime.runtime.period_all");
    if (dateFrom && dateTo) {
      if (dateFrom === dateTo) {
        return t("pos_sales_runtime.runtime.period_date", { date: shortDateText(dateFrom) });
      }
      return t("pos_sales_runtime.runtime.period_range", {
        from: shortDateText(dateFrom),
        to: shortDateText(dateTo),
      });
    }
    return dateFrom
      ? t("pos_sales_runtime.runtime.period_from", { from: shortDateText(dateFrom) })
      : t("pos_sales_runtime.runtime.period_to", { to: shortDateText(dateTo) });
  }, [dateFrom, dateTo, t, formatDate]);

  const selectedSale = useMemo(
    () => sales.find(item => String(item?.id || "") === String(selectedSaleId || "")) || null,
    [sales, selectedSaleId],
  );
  const selectedCustomer = useMemo(() => {
    if (!selectedSale) return null;
    const customerId = String(selectedSale.customerId || selectedSale.memberId || "");
    const customerCode = String(selectedSale.customerCode || selectedSale.memberCode || "");
    const phone = String(selectedSale.customerPhone || "").replace(/\D/g, "");
    return customers.find(customer =>
      (customerId && String(customer?.id || customer?._documentId || "") === customerId)
      || (customerCode && String(customer?.customerCode || customer?.code || "") === customerCode)
      || (phone && String(customer?.phone || "").replace(/\D/g, "") === phone)
    ) || null;
  }, [selectedSale, customers]);
  const selectedLoyalty = selectedSale ? loyaltyForSale(selectedSale) : null;
  const selectedMethod = selectedSale ? paymentMethod(selectedSale) : "cash";
  const receiptCustomerName = selectedSale?.customerName || selectedCustomer?.name || "";
  const receiptCustomerCode = selectedSale?.customerCode || selectedCustomer?.customerCode || "";
  const receiptCustomerPhone = selectedSale?.customerPhone || selectedCustomer?.phone || "";
  const receiptShopName = receiptSettings.shopName || t("pos_sales_runtime.runtime.default_shop");
  const receiptBranch = receiptSettings.taxBranch || t("pos.receipt.head_office");

  const setToday = () => {
    const today = localDateKey(new Date());
    setDateFrom(today);
    setDateTo(today);
  };
  const setThisMonth = () => {
    const now = new Date();
    setDateFrom(localDateKey(new Date(now.getFullYear(), now.getMonth(), 1)));
    setDateTo(localDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  };
  const clearFilters = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setPaymentFilter("all");
  };
  const openSale = sale => {
    setSelectedSaleId(String(sale?.id || ""));
    requestAnimationFrame(() => dialogRef.current?.showModal?.());
  };
  const closeSale = () => dialogRef.current?.close?.();
  const printReceipt = () => {
    if (!selectedSale) return window.print();
    const id = String(selectedSale.id || saleDisplayNumber(selectedSale));
    window.open(
      `/pos/receipt/?saleId=${encodeURIComponent(id)}&auto=1`,
      `pos_receipt_${id.replace(/[^a-zA-Z0-9]/g, "_")}`,
      "popup=yes,width=520,height=760,noopener,noreferrer",
    );
  };
  const csvCell = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const exportCsv = async () => {
    if (!filteredSales.length) {
      await sweetConfirm(t("pos_sales.sales.empty"), {
        title: t("pos_sales.sales.export_csv"),
        cancelText: t("shared.actions.cancel"),
        confirmText: t("shared.actions.ok"),
        cancelIcon: "x-circle",
        confirmIcon: "check-circle",
        type: "warning",
      });
      return;
    }
    const lines = [[
      "เลขที่บิล", "วันและเวลา", "ช่องทางชำระ", "จำนวนสินค้า", "โหมด VAT",
      "รวมสินค้า", "ส่วนลด", "ส่วนลดแต้ม", "ยอดก่อน VAT", "VAT", "ยอดสุทธิ",
      "รับเงิน", "เงินทอน", "พนักงาน", "เครื่อง POS",
    ]];
    filteredSales.forEach(sale => {
      lines.push([
        saleDisplayNumber(sale),
        dateTimeText(sale.createdAt),
        paymentName(paymentMethod(sale)),
        saleQty(sale),
        vatModeName(sale),
        Number(sale.subtotal || 0).toFixed(2),
        Number(sale.discount || 0).toFixed(2),
        Number(sale.pointDiscount || 0).toFixed(2),
        Number(beforeVatOf(sale) || 0).toFixed(2),
        Number(sale.vatAmount || 0).toFixed(2),
        Number(saleTotalAmount(sale) || 0).toFixed(2),
        Number(sale.payment?.received ?? sale.receivedAmount ?? 0).toFixed(2),
        Number(sale.payment?.change ?? sale.changeAmount ?? 0).toFixed(2),
        sale.cashierName || "",
        sale.terminalCode || "",
      ]);
    });
    const csv = `\uFEFF${lines.map(row => row.map(csvCell).join(",")).join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `retail-sales-vat-${dateFrom || "all"}-${dateTo || "all"}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const needsReadyOverlay = authState.status === "loading"
    || tenantState.status === "loading"
    || !stylesReady
    || Boolean(posRedirectTarget)
    || (tenantState.status === "ready"
      && tenant?.id
      && profile
      && canUseRetailPos(posAccessProfile)
      && hasSalesAccess
      && !initialDataReady);

  if (needsReadyOverlay) {
    return <PageReadyOverlay title={t("shared.state.loading")} message={t("shared.state.please_wait")} />;
  }
  if (loadError) {
    return (
      <PageReadyOverlay
        error
        title={t("pos_sales.meta.title")}
        message={loadError}
        onRetry={() => location.reload()}
      />
    );
  }

  return (
    <>
      <header className="pos-header no-print" data-pos-management-header>
        <div className="app-title">
          <div>
            <strong>{t("pos_sales.header.title")}</strong>
            <small>{t("pos_sales.header.subtitle")}</small>
          </div>
        </div>
        <div className="header-actions">
          <LocaleSwitcher style={{ marginLeft: 0, marginRight: 0 }} />
          <PosNavigation profile={posAccessProfile} currentKey="pos.sales" />
        </div>
      </header>

      <main data-pos-management className="sales-container no-print">
        <section className="panel report-filter-panel">
          <div className="sales-toolbar">
            <input
              id="saleSearch"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={t("pos_sales.filters.search_placeholder")}
            />
            <input id="dateFrom" type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} />
            <input id="dateTo" type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} />
            <select id="paymentFilter" value={paymentFilter} onChange={event => setPaymentFilter(event.target.value)}>
              <option value="all">{t("pos_sales.filters.all_payment")}</option>
              <option value="cash">{t("pos_sales.filters.cash")}</option>
              <option value="promptpay">{t("pos_sales.filters.transfer")}</option>
            </select>
            <button id="todayBtn" className="btn btn-secondary" type="button" onClick={setToday}>
              {t("pos_sales.filters.today")}
            </button>
            <button id="monthBtn" className="btn btn-secondary" type="button" onClick={setThisMonth}>
              {t("pos_sales.filters.month")}
            </button>
            <button id="clearFilterBtn" className="btn btn-secondary" type="button" onClick={clearFilters}>
              {t("pos_sales.filters.all")}
            </button>
          </div>
        </section>

        <section className="sales-stats">
          <article className="stat-card"><span>{t("pos_sales.stats.bills")}</span><strong id="saleCount">{numberText(filteredSales.length)}</strong></article>
          <article className="stat-card"><span>{t("pos_sales.stats.net_sales")}</span><strong id="saleTotal">{money(stats.saleTotal)}</strong></article>
          <article className="stat-card"><span>{t("pos_sales.stats.before_vat")}</span><strong id="beforeVatTotal">{money(stats.beforeVatTotal)}</strong></article>
          <article className="stat-card"><span>{t("pos_sales.stats.vat_total")}</span><strong id="vatTotal">{money(stats.vatTotal)}</strong></article>
          <article className="stat-card"><span>{t("pos_sales.stats.vat_bills")}</span><strong id="vatBillCount">{numberText(stats.vatBillCount)}</strong></article>
          <article className="stat-card"><span>{t("pos_sales.stats.cash_total")}</span><strong id="cashTotal">{money(stats.cashTotal)}</strong></article>
          <article className="stat-card"><span>{t("pos_sales.stats.transfer_total")}</span><strong id="transferTotal">{money(stats.transferTotal)}</strong></article>
          <article className="stat-card"><span>{t("pos_sales.stats.discount_total")}</span><strong id="discountTotal">{money(stats.discountTotal)}</strong></article>
          <article className="stat-card"><span>{t("pos_sales.stats.item_qty")}</span><strong id="itemQtyTotal">{numberText(stats.itemQtyTotal)}</strong></article>
          <article className="stat-card"><span>{t("pos_sales.stats.average")}</span><strong id="averageSale">{money(stats.averageSale)}</strong></article>
          <article className="stat-card"><span>{t("pos_sales.stats.highest")}</span><strong id="highestSale">{money(stats.highestSale)}</strong></article>
        </section>

        <section className="report-grid">
          <section className="panel ranking-panel">
            <div className="section-heading">
              <div>
                <h2>{t("pos_sales.ranking.title")}</h2>
                <p>{t("pos_sales.ranking.description")}</p>
              </div>
            </div>
            <div id="bestSellerList" className="ranking-list">
              {ranking.map((item, index) => (
                <article className="ranking-item" key={item.id}>
                  <div className="ranking-position">{index + 1}</div>
                  <div className="ranking-info"><strong>{item.name}</strong><span>{item.id}</span></div>
                  <div className="ranking-total">
                    <strong>{t("pos_sales_runtime.runtime.pieces", { count: numberText(item.qty) })}</strong>
                    <span>{t("pos_sales_runtime.runtime.amount", { amount: money(item.revenue) })}</span>
                  </div>
                </article>
              ))}
            </div>
            <div id="bestSellerEmpty" className="empty-state" hidden={ranking.length > 0}>
              {t("pos_sales.ranking.empty")}
            </div>
          </section>
          <section className="panel payment-panel">
            <div className="section-heading">
              <div>
                <h2>{t("pos_sales.payment.title")}</h2>
                <p>{t("pos_sales.payment.description")}</p>
              </div>
            </div>
            <div className="payment-summary-list">
              <div><span>{t("pos_sales.payment.cash")}</span><strong id="cashPercent">{stats.cashPercent.toFixed(1)}%</strong></div>
              <div className="payment-bar"><i id="cashBar" style={{ width: `${stats.cashPercent}%` }} /></div>
              <div><span>{t("pos_sales.payment.transfer")}</span><strong id="transferPercent">{stats.transferPercent.toFixed(1)}%</strong></div>
              <div className="payment-bar"><i id="transferBar" style={{ width: `${stats.transferPercent}%` }} /></div>
            </div>
          </section>
        </section>

        <section className="panel sales-panel">
          <div className="section-heading">
            <div>
              <h2>{t("pos_sales.sales.title")}</h2>
              <p id="reportPeriodText">{reportPeriodText}</p>
            </div>
            <button id="exportCsvBtn" className="btn btn-pay" type="button" onClick={exportCsv}>
              <i className="bi bi-download" aria-hidden="true"></i>
              <span>{t("pos_sales.sales.export_csv")}</span>
            </button>
          </div>
          <div className="table-wrap">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>{t("pos_sales.sales.bill")}</th>
                  <th>{t("pos_sales.sales.date_time")}</th>
                  <th className="number">{t("pos_sales.sales.net_qty")}</th>
                  <th>{t("pos_sales.sales.payment")}</th>
                  <th>{t("pos_sales.sales.vat")}</th>
                  <th className="number">{t("pos_sales.sales.before_vat")}</th>
                  <th className="number">{t("pos_sales.sales.vat")}</th>
                  <th className="number">{t("pos_sales.sales.discount")}</th>
                  <th className="number">{t("pos_sales.sales.net_sales")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="salesTableBody">
                {filteredSales.map(sale => {
                  const method = paymentMethod(sale);
                  return (
                    <tr key={sale.id}>
                      <td className="sale-id">{saleDisplayNumber(sale)}</td>
                      <td className="sale-date" data-label={t("pos.receipt.date")}>{dateTimeText(sale.createdAt)}</td>
                      <td className="number" data-label={t("pos_sales.sales.net_qty")}>{numberText(saleQty(sale))}</td>
                      <td data-label={t("pos_sales.sales.payment")}>
                        <span className={`payment-badge ${method}`}>{paymentName(method)}</span>
                      </td>
                      <td data-label={t("pos_sales.sales.vat")}>{vatModeName(sale)}</td>
                      <td className="number" data-label={t("pos_sales.sales.before_vat")}>{isVatSale(sale) ? money(beforeVatOf(sale)) : "-"}</td>
                      <td className="number" data-label={t("pos_sales.sales.vat")}>{isVatSale(sale) ? money(sale.vatAmount) : "-"}</td>
                      <td className="number" data-label={t("pos_sales.sales.discount")}>{money(saleDiscount(sale))}</td>
                      <td className="number" data-label={t("pos_sales.sales.net_sales")}><strong>{money(saleTotalAmount(sale))}</strong></td>
                      <td className="sale-actions">
                        <button type="button" className="view-sale" data-sale-id={sale.id} onClick={() => openSale(sale)}>
                          <i className="bi bi-receipt" aria-hidden="true"></i>
                          <span>{t("pos_sales_runtime.runtime.view_bill")}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div id="salesEmpty" className="empty-state sales-empty" hidden={filteredSales.length > 0}>
            {t("pos_sales.sales.empty")}
          </div>
        </section>
      </main>

      <dialog data-pos-management-dialog id="saleDialog" className="sale-dialog" ref={dialogRef}>
        <div className="sale-dialog-content">
          <div className="dialog-head no-print">
            <h2>{t("pos_sales_runtime.runtime.sale_details")}</h2>
            <button id="closeSaleDialog" className="icon-btn" type="button" onClick={closeSale} aria-label={t("sales_report.receipt.close")}>
              <i className="bi bi-x-lg" aria-hidden="true"></i>
            </button>
          </div>
          <section id="receiptArea" className="receipt">
            <div className="receipt-header">
              <h1 id="receiptShopName">{receiptShopName}</h1>
              <p>{selectedSale && isVatSale(selectedSale) ? t("pos.receipt.abbreviated_tax_title") : t("pos.receipt.title")}</p>
              <div className="receipt-shop-info">
                <span id="receiptShopAddress">{receiptSettings.shopAddress || ""}</span>
                <span id="receiptShopPhone">{receiptSettings.shopPhone ? t("pos.receipt.phone_value", { value: receiptSettings.shopPhone }) : ""}</span>
                <span id="receiptTaxId">{receiptSettings.taxId ? t("pos.receipt.tax_id_value", { value: receiptSettings.taxId }) : ""}</span>
                <span id="receiptTaxBranch">{receiptBranch}</span>
              </div>
            </div>
            <div className="receipt-meta">
              <div><span>{t("pos_sales.sales.bill")}</span><strong id="receiptSaleId">{selectedSale ? saleDisplayNumber(selectedSale) : "-"}</strong></div>
              <div><span>{t("pos.receipt.date")}</span><strong id="receiptDate">{selectedSale ? dateTimeText(selectedSale.createdAt) : "-"}</strong></div>
              <div><span>{t("pos.receipt.payment")}</span><strong id="receiptPayment">{selectedSale ? paymentName(selectedMethod) : "-"}</strong></div>
            </div>
            {(receiptCustomerName || receiptCustomerCode || receiptCustomerPhone) ? (
              <div className="receipt-extra-block" data-sales-receipt-block="true">
                {receiptCustomerName ? <div data-sales-receipt-extra="true"><span>{t("pos_sales_runtime.runtime.customer")}</span><strong>{maskReceiptCustomerName(receiptCustomerName)}</strong></div> : null}
                {receiptCustomerCode ? <div data-sales-receipt-extra="true"><span>{t("pos_sales_runtime.runtime.member")}</span><span>{receiptCustomerCode}</span></div> : null}
                {receiptCustomerPhone ? <div data-sales-receipt-extra="true"><span>{t("pos_sales_runtime.runtime.customer_phone")}</span><span>{maskReceiptPhone(receiptCustomerPhone)}</span></div> : null}
              </div>
            ) : null}
            <table className="receipt-table receipt-table-history">
              <thead>
                <tr>
                  <th>{t("pos.receipt.item")}</th>
                  <th className="number">{t("pos.receipt.price")}</th>
                  <th className="number">{t("pos.receipt.total")}</th>
                </tr>
              </thead>
              <tbody id="receiptItems">
                {(selectedSale?.items || []).map((item, index) => {
                  const qty = Number(item?.qty || 0);
                  return (
                    <tr key={`${item?.id || item?.barcode || index}-${index}`}>
                      <td>
                        {item?.name || item?.productName || "-"} x {numberText(qty)}
                        <div className="product-sub">{item?.id || item?.barcode || ""}</div>
                      </td>
                      <td className="number">{money(item?.price)}</td>
                      <td className="number">{money(item?.lineTotal || Number(item?.price || 0) * qty)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="receipt-summary">
              <div><span>{t("pos.receipt.subtotal")}</span><strong id="receiptSubtotal">{money(selectedSale?.subtotal)}</strong></div>
              <div><span>{t("pos.receipt.discount")}</span><strong id="receiptDiscount">{money(selectedSale ? saleDiscount(selectedSale) : 0)}</strong></div>
              {selectedSale && isVatSale(selectedSale) ? (
                <>
                  {Number(selectedSale.pointDiscount || 0) ? (
                    <div data-sales-receipt-extra="true">
                      <span>{t("pos_sales_runtime.runtime.point_discount")}</span>
                      <span>{money(selectedSale.pointDiscount)}</span>
                    </div>
                  ) : null}
                  <div data-sales-receipt-extra="true">
                    <span>{t("pos_sales_runtime.runtime.before_vat")}</span>
                    <span>{money(beforeVatOf(selectedSale))}</span>
                  </div>
                  <div data-sales-receipt-extra="true">
                    <span>{t("pos_sales_runtime.runtime.vat_rate", { rate: numberText(selectedSale.vatRate ?? receiptSettings.vatRate ?? 7) })}</span>
                    <span>{money(selectedSale.vatAmount)}</span>
                  </div>
                  <div data-sales-receipt-extra="true">
                    <span>{t("pos_sales_runtime.runtime.vat_mode")}</span>
                    <span>{vatModeName(selectedSale)}</span>
                  </div>
                </>
              ) : null}
              <div className="receipt-grand">
                <span>{t("pos_sales_runtime.runtime.original_total")}</span>
                <strong id="receiptTotal">{money(selectedSale ? saleTotalAmount(selectedSale) : 0)}</strong>
              </div>
              <div id="receiptReceivedRow" hidden={selectedMethod !== "cash"}>
                <span>{t("pos.receipt.received")}</span>
                <strong id="receiptReceived">{money(selectedSale?.payment?.received ?? selectedSale?.receivedAmount)}</strong>
              </div>
              <div id="receiptChangeRow" hidden={selectedMethod !== "cash"}>
                <span>{t("pos.receipt.change")}</span>
                <strong id="receiptChange">{money(selectedSale?.payment?.change ?? selectedSale?.changeAmount)}</strong>
              </div>
            </div>
            {selectedLoyalty ? (
              <div className="receipt-extra-block" data-sales-receipt-block="true">
                <div data-sales-receipt-extra="true"><span>{t("pos_sales_runtime.runtime.points_before")}</span><span>{numberText(selectedLoyalty.pointsBefore)}</span></div>
                <div data-sales-receipt-extra="true"><span>{t("pos_sales_runtime.runtime.points_used")}</span><span>{numberText(selectedLoyalty.pointsUsed)}</span></div>
                <div data-sales-receipt-extra="true"><span>{t("pos_sales_runtime.runtime.points_earned")}</span><span>{numberText(selectedLoyalty.pointsEarned)}</span></div>
                <div data-sales-receipt-extra="true"><span>{t("pos_sales_runtime.runtime.points_after")}</span><strong>{numberText(selectedLoyalty.pointsAfter)}</strong></div>
              </div>
            ) : null}
            <p id="receiptThanks" className="receipt-thanks">{receiptSettings.receiptThanks || t("pos_sales_runtime.runtime.thanks")}</p>
            <p id="receiptFooter" className="receipt-footer">{receiptSettings.receiptFooter || ""}</p>
          </section>
          <div className="dialog-actions no-print">
            <button id="closeSaleBtn" className="btn btn-secondary" type="button" onClick={closeSale}>
              <i className="bi bi-x-lg" aria-hidden="true"></i>
              <span>{t("sales_report.receipt.close")}</span>
            </button>
            <button id="printReceiptBtn" className="btn btn-pay" type="button" onClick={printReceipt}>
              <i className="bi bi-printer" aria-hidden="true"></i>
              <span>{t("pos.complete.print_receipt")}</span>
            </button>
          </div>
        </div>
      </dialog>
      <AppDeveloperPanel />
    </>
  );
}
