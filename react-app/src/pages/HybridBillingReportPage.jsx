import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { useTenant } from "@/tenant/TenantProvider";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { ParityFooter } from "@/components/ParityFooter";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { UserMenu } from "@/components/UserMenu";
import { useParityPage } from "@/hooks/useParityPage";
import { useI18n } from "@/i18n/I18nProvider";
import { getHybridBillingPreview } from "@/data/hybridBillingReport";
import { listHybridInvoices } from "@/data/hybridInvoiceReviewData";
import { HybridTenantProofPanel } from "@/components/HybridTenantProofPanel";
import { isEligibleHybridInvoice } from "@/data/hybridTenantPaymentDraft";
import { mergeHybridTenantInvoicePage } from "@/data/hybridTenantInvoicePaging";

const BANGKOK = "Asia/Bangkok";
function bangkokMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK, year: "numeric", month: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${map.year}-${map.month}`;
}

function tenantAnniversaryMonth(tenant) {
  for (const value of [
    tenant?.billingCycleAnchorAt, tenant?.revenueShareCycleAnchorAt,
    tenant?.hybridBillingActivatedAt, tenant?.trialStartsAt,
    tenant?.activatedAt, tenant?.createdAt,
  ]) {
    if (!value) continue;
    const date = typeof value.toDate === "function" ? value.toDate()
      : value instanceof Date ? value
      : typeof value.seconds === "number" ? new Date(value.seconds * 1000)
      : new Date(value);
    if (Number.isFinite(date.getTime())) return bangkokMonth(date);
  }
  return "";
}

export function HybridBillingReportPage() {
  const auth = useAuth();
  const tenantState = useTenant();
  const { t, intlLocale, formatNumber } = useI18n();
  const tenant = tenantState.tenant;
  const [month, setMonth] = useState(() => bangkokMonth());
  const [previewData, setPreviewData] = useState(null);
  const [previewDataScope, setPreviewDataScope] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(true);
  const previewRequestRef = useRef(0);
  const [invoicePage, setInvoicePage] = useState({
    scope: "", items: [], cursor: null, hasMore: false,
  });
  const [invoiceRefreshKey, setInvoiceRefreshKey] = useState(0);
  const [invoiceBusyScope, setInvoiceBusyScope] = useState("");
  const [invoiceErrorState, setInvoiceErrorState] = useState({ scope: "", message: "" });
  const [proofInvoiceId, setProofInvoiceId] = useState("");
  // Scope both asynchronous result sets to the currently selected tenant.
  // A late response from the previous shop/month/page must never reappear.
  const previewScope = tenant?.id ? `${tenant.id}:${month}` : "";
  const data = previewDataScope === previewScope ? previewData : null;
  const error = previewDataScope === previewScope ? previewError : "";
  const loading = previewLoading || previewDataScope !== previewScope;
  const invoiceScope = tenant?.id && ["owner", "admin"].includes(auth.profile?.role)
    ? `${tenant.id}:${auth.profile.role}:${invoiceRefreshKey}` : "";
  const visibleInvoicePage = invoicePage.scope === invoiceScope ? invoicePage : null;
  const issuedInvoices = visibleInvoicePage?.items || [];
  const invoiceCursor = visibleInvoicePage?.cursor || null;
  const moreInvoices = visibleInvoicePage?.hasMore === true;
  const invoiceError = invoiceErrorState.scope === invoiceScope ? invoiceErrorState.message : "";
  const invoiceLoading = Boolean(invoiceScope)
    && (invoiceBusyScope === invoiceScope || (!visibleInvoicePage && !invoiceError));
  const stylesReady = useParityPage({
    title: t("hybrid_report.title"),
    bodyClass: "revenue-share-report-page hybrid-report-page",
    styles: ["app.css", "icons.css", "revenue-share-report.css", "hybrid-billing-report.css", "hybrid-billing-review.css"],
  });
  const reload = () => {
    const token = ++previewRequestRef.current;
    const requestScope = previewScope;
    setPreviewLoading(true);
    setPreviewError("");
    setPreviewData(null);
    getHybridBillingPreview(month)
      .then(result => {
        if (token !== previewRequestRef.current) return;
        setPreviewData(result);
        setPreviewDataScope(requestScope);
      })
      .catch(err => {
        if (token !== previewRequestRef.current) return;
        console.error("HYBRID_BILLING_PREVIEW_FAILED", err);
        setPreviewData(null);
        setPreviewDataScope(requestScope);
        setPreviewError(t("hybrid_report.error"));
      })
      .finally(() => {
        if (token === previewRequestRef.current) setPreviewLoading(false);
      });
  };
  useEffect(() => {
    if (tenant?.id
      && ["owner", "admin"].includes(auth.profile?.role)) reload();
    return () => { previewRequestRef.current += 1; };
  }, [tenant?.id, auth.profile?.role, month]);

  useEffect(() => {
    if (!invoiceScope) return;
    let cancelled = false;
    setProofInvoiceId("");
    setInvoiceBusyScope(invoiceScope);
    setInvoiceErrorState({ scope: invoiceScope, message: "" });
    listHybridInvoices(tenant.id).then(page => {
      if (cancelled) return;
      setInvoicePage({ scope: invoiceScope, ...page });
    }).catch(err => {
      if (!cancelled) setInvoiceErrorState({
        scope: invoiceScope, message: String(err.message || "INVOICE_LIST_FAILED"),
      });
    }).finally(() => {
      if (!cancelled) setInvoiceBusyScope(current => current === invoiceScope ? "" : current);
    });
    return () => { cancelled = true; };
  }, [invoiceScope]);

  const loadMoreIssuedInvoices = () => {
    if (!invoiceScope || !moreInvoices || !invoiceCursor || invoiceLoading) return;
    const requestScope = invoiceScope;
    const requestCursor = invoiceCursor;
    setInvoiceBusyScope(requestScope);
    setInvoiceErrorState({ scope: requestScope, message: "" });
    listHybridInvoices(tenant.id, { cursor: requestCursor }).then(page => {
      setInvoicePage(current => mergeHybridTenantInvoicePage(
        current, requestScope, requestCursor, page
      ));
    }).catch(err => {
      setInvoiceErrorState({
        scope: requestScope, message: String(err.message || "INVOICE_LIST_FAILED"),
      });
    }).finally(() => {
      setInvoiceBusyScope(current => current === requestScope ? "" : current);
    });
  };

  const number = value => formatNumber(Number(value || 0), {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const currency = value => `${number(value)} ฿`;
  const date = value => {
    if (!value) return "-";
    const parsed = new Date(`${value}T00:00:00+07:00`);
    return new Intl.DateTimeFormat(intlLocale, {
      timeZone: BANGKOK, year: "numeric", month: "short", day: "numeric",
    }).format(parsed);
  };
  const monthly = useMemo(() => data?.invoices || [], [data?.invoices]);
  const chosenInvoice = issuedInvoices.find(invoice =>
    invoice.id === proofInvoiceId && isEligibleHybridInvoice(invoice)) || null;

  if (!stylesReady || auth.status === "loading" || tenantState.status === "loading") {
    return <PageReadyOverlay />;
  }
  if (!auth.profile) return <Navigate to="/login?next=%2Freports%2Fhybrid-billing" replace />;
  if (!["owner", "admin"].includes(auth.profile.role)
    || !tenant?.id) return <Navigate to="/" replace />;

  return (
    <>
      <header className="app-header">
        <div className="revenue-share-header-leading">
          <div className="brand"><span className="brand-mark">PG</span><span>PENGUIN</span></div>
          <Link className="btn btn-sm revenue-share-header-back" to="/">
            <i className="bi bi-arrow-left app-icon" aria-hidden="true"></i><span>{t("hybrid_report.back")}</span>
          </Link>
        </div>
        <div className="app-header-actions"><LocaleSwitcher /><UserMenu profile={auth.profile} /></div>
      </header>
      <main className="revenue-share-page hybrid-report-shell">
        <section className="revenue-share-hero">
          <div>
            <h1>{t("hybrid_report.title")}</h1>
            <p>{t("hybrid_report.subtitle")}</p>
          </div>
        </section>
        <section className="card hybrid-report-toolbar">
          <label htmlFor="hybridReportMonth">{t("hybrid_report.month")}</label>
          <input id="hybridReportMonth" type="month" min={tenantAnniversaryMonth(tenant)}
            max={bangkokMonth()} value={month} onChange={event => setMonth(event.target.value)} />
          <button className="btn btn-sm" type="button" onClick={reload} disabled={loading}>
            <i className="bi bi-arrow-clockwise app-icon" aria-hidden="true"></i>
            <span>{t("hybrid_report.refresh")}</span>
          </button>
        </section>
        {loading ? <p role="status" className="card hybrid-report-status">{t("hybrid_report.loading")}</p> : null}
        {error ? <p role="alert" className="card hybrid-report-status error">{error}</p> : null}
        {data && !loading ? (
          <>
            <p className="hybrid-report-notice" role="status">{t("hybrid_report.preview_only")}</p>
            {data.cycleStartDate && data.cycleEndDate ? (
              <p className="hybrid-report-notice" id="hybridBillingAnniversaryRange">
                {intlLocale.startsWith("th") ? "รอบบิลวันครบรอบร้าน: " : "Store anniversary billing cycle: "}
                {date(data.cycleStartDate)} – {date(data.cycleEndDate)}
              </p>
            ) : null}
            <section className="hybrid-report-metrics" aria-label={t("hybrid_report.title")}>
              {[
                ["sales", currency(data.totalDeliverySales)],
                ["threshold", currency(data.config?.deliveryThreshold)],
                ["fee", currency(data.totalFee)],
                ["mode", t(`hybrid_report.modes.${data.mode}`)],
              ].map(([key, value]) => (
                <div key={key} className="card hybrid-report-metric">
                  <small>{t(`hybrid_report.${key}`)}</small><strong>{value}</strong>
                </div>
              ))}
            </section>
            <section className="card hybrid-report-details">
              <h2>{t("hybrid_report.breakdown")}</h2>
              <p>{data.triggerDate
                ? t("hybrid_report.trigger", { date: date(data.triggerDate) })
                : t("hybrid_report.not_triggered")}</p>
              <p>{t("hybrid_report.rate", { rate: number(data.config?.deliveryShareRate) })}</p>
              <p>{data.slipUnlimited
                ? t("hybrid_report.slip_unlimited")
                : t("hybrid_report.slip_limit", { quota: data.slipQuota })}</p>
              {!data.periodEnded && data.projectedFixedFee > 0 ? (
                <p>{t("hybrid_report.projected_fee", { amount: currency(data.projectedFixedFee) })}</p>
              ) : null}
              <div className="hybrid-report-table-scroll">
                <table>
                  <thead><tr>
                    <th>{t("hybrid_report.date")}</th>
                    <th>{t("hybrid_report.kind")}</th>
                    <th>{t("hybrid_report.base")}</th>
                    <th>{t("hybrid_report.amount")}</th>
                  </tr></thead>
                  <tbody>
                    {monthly.length ? monthly.map(invoice => (
                      <tr key={invoice.id}>
                        <td>{date(invoice.date)}</td>
                        <td>{t(`hybrid_report.kinds.${invoice.kind}`)}</td>
                        <td>{currency(invoice.calculationBase)}</td>
                        <td>{currency(invoice.amount)}</td>
                      </tr>
                    )) : <tr><td colSpan="4">{t("hybrid_report.no_rows")}</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="hybrid-report-notice">{t("hybrid_report.not_invoice")}</p>
            </section>
          </>
        ) : null}
        <section className="hybrid-review-inline" aria-label={intlLocale.startsWith("th") ? "บิลที่ออกจริง" : "Issued invoices"}>
          <div className="card hybrid-report-details">
            <div className="hybrid-review-list-heading">
              <h2>{intlLocale.startsWith("th") ? "รายการบิลจริงของร้าน" : "Your issued invoices"}</h2>
              <button type="button" className="btn btn-sm" disabled={invoiceLoading}
                onClick={() => setInvoiceRefreshKey(value => value + 1)}>
                <i className="bi bi-arrow-clockwise app-icon" aria-hidden="true"></i>
                <span>{intlLocale.startsWith("th") ? "รีเฟรชรายการบิล" : "Refresh invoices"}</span>
              </button>
            </div>
            <p className="hybrid-report-notice">
              {intlLocale.startsWith("th")
                ? "แสดงเฉพาะรายการที่ออกบิลแล้ว ไม่ใช่ยอดคาดการณ์ด้านบน ระบบรับชำระ Hybrid ยังไม่เปิดใช้งาน"
                : "Only previously issued ledger records are shown, separate from projections above. Hybrid payments remain disabled."}
            </p>
            {invoiceLoading ? <p role="status">{t("hybrid_report.loading")}</p> : null}
            {invoiceError ? <p role="alert" className="hybrid-report-status error">{invoiceError}</p> : null}
            <div className="hybrid-report-table-scroll">
              <table>
                <thead><tr>
                  <th>{intlLocale.startsWith("th") ? "รหัสบิล" : "Invoice ID"}</th>
                  <th>{t("hybrid_report.date")}</th>
                  <th>{t("hybrid_report.amount")}</th>
                  <th>{intlLocale.startsWith("th") ? "สถานะ" : "Status"}</th>
                  <th>{intlLocale.startsWith("th") ? "หลักฐาน" : "Evidence"}</th>
                </tr></thead>
                <tbody>{issuedInvoices.length ? issuedInvoices.map(invoice => (
                  <tr key={invoice.id}>
                    <td className="hybrid-review-id">{invoice.id}</td>
                    <td>{date(invoice.date)}</td>
                    <td>{currency(invoice.amount)}</td>
                    <td><span className={`hybrid-review-status ${invoice.status || "issued"}`}>
                      {({ issued: intlLocale.startsWith("th") ? "ออกบิลแล้ว" : "Issued",
                        pending_review: intlLocale.startsWith("th") ? "รอตรวจสลิป" : "Pending review",
                        paid: intlLocale.startsWith("th") ? "ชำระแล้ว" : "Paid",
                        rejected: intlLocale.startsWith("th") ? "ปฏิเสธ" : "Rejected" })[invoice.status] || invoice.status || "-"}
                    </span></td>
                    <td>{isEligibleHybridInvoice(invoice) ? (
                      <button type="button" className="btn btn-sm"
                        aria-expanded={proofInvoiceId === invoice.id}
                        onClick={() => setProofInvoiceId(value =>
                          value === invoice.id ? "" : invoice.id)}>
                        <i className="bi bi-file-earmark-arrow-up app-icon" aria-hidden="true"></i>
                        <span>{intlLocale.startsWith("th") ? "เตรียมสลิป" : "Prepare slip"}</span>
                      </button>
                    ) : <span aria-label={intlLocale.startsWith("th")
                      ? "ไม่รับหลักฐานเพิ่มเติม" : "No further evidence allowed"}>-</span>}</td>
                  </tr>
                )) : <tr><td colSpan={5}>{intlLocale.startsWith("th") ? "ยังไม่มีบิลจริง" : "No issued invoices yet"}</td></tr>}</tbody>
              </table>
            </div>
            {moreInvoices ? <button type="button" className="btn btn-sm" disabled={invoiceLoading}
              onClick={loadMoreIssuedInvoices}>
              {intlLocale.startsWith("th") ? "โหลดบิลเพิ่มเติม" : "Load more invoices"}
            </button> : null}
          </div>
          {chosenInvoice ? <HybridTenantProofPanel
            key={tenant.id + ":" + chosenInvoice.id + ":" + chosenInvoice.status + ":" + chosenInvoice.amount}
            tenantId={tenant.id} invoice={chosenInvoice}
            thai={intlLocale.startsWith("th")} money={currency}
            onClose={() => setProofInvoiceId("")} /> : null}
        </section>
      </main>
      <ParityFooter />
    </>
  );
}
