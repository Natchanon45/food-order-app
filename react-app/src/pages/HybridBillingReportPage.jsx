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
import {
  getHybridBillingPaymentDestination, getTenantHybridInvoices, submitTenantHybridPayment,
} from "@/data/hybridBillingLedger";

const BANGKOK = "Asia/Bangkok";
function bangkokDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function HybridBillingReportPage() {
  const auth = useAuth();
  const tenantState = useTenant();
  const { t, intlLocale, formatNumber } = useI18n();
  const tenant = tenantState.tenant;
  const [onDate, setOnDate] = useState(() => bangkokDate());
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [destination, setDestination] = useState(null);
  const [slips, setSlips] = useState({});
  const [submittingInvoice, setSubmittingInvoice] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const requestVersion = useRef(0);
  const stylesReady = useParityPage({
    title: t("hybrid_report.title"),
    bodyClass: "revenue-share-report-page hybrid-report-page",
    styles: ["app.css", "icons.css", "revenue-share-report.css", "hybrid-billing-report.css"],
  });
  const reload = () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    getHybridBillingPreview(onDate)
      .then(result => {
        if (version === requestVersion.current) setData(result);
      })
      .catch(err => {
        if (version !== requestVersion.current) return;
        console.error("HYBRID_BILLING_PREVIEW_FAILED", err);
        setData(null);
        setError(t("hybrid_report.error"));
      })
      .finally(() => {
        if (version === requestVersion.current) setLoading(false);
      });
  };
  useEffect(() => {
    if (tenant?.billingPolicyVersion === "hybrid_v1"
      && ["owner", "admin"].includes(auth.profile?.role)) reload();
    return () => { requestVersion.current += 1; };
  }, [tenant?.id, tenant?.billingPolicyVersion, auth.profile?.role, onDate]);

  const loadInvoices = () => Promise.all([
    getTenantHybridInvoices(), getHybridBillingPaymentDestination(),
  ]).then(([items, bank]) => {
    setInvoices(items); setDestination(bank);
  }).catch(err => {
    console.error("HYBRID_INVOICE_LOAD_FAILED", err);
    setPaymentMessage("ไม่สามารถโหลดรายการบิลหรือบัญชีรับชำระได้");
  });
  useEffect(() => {
    if (tenant?.billingPolicyVersion === "hybrid_v1" &&
      ["owner", "admin"].includes(auth.profile?.role)) {
      loadInvoices();
    }
  }, [tenant?.id, tenant?.billingPolicyVersion, auth.profile?.role]);
  const submitInvoiceSlip = async (event, invoice) => {
    event.preventDefault();
    const file = slips[invoice.id];
    if (!file || submittingInvoice || !(invoice.paymentDestination || destination)) return;
    setSubmittingInvoice(invoice.id);
    setPaymentMessage("");
    try {
      await submitTenantHybridPayment(tenant.id, invoice.id, file);
      setSlips(current => ({ ...current, [invoice.id]: null }));
      setPaymentMessage("ส่งหลักฐานแล้ว กรุณารอ Super Admin ตรวจสอบการชำระเงิน");
      await loadInvoices();
    } catch (err) {
      console.error("HYBRID_PAYMENT_SUBMIT_FAILED", err);
      setPaymentMessage("ส่งหลักฐานไม่สำเร็จ กรุณาตรวจสอบสถานะบิลและลองใหม่");
    } finally {
      setSubmittingInvoice("");
    }
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

  if (!stylesReady || auth.status === "loading" || tenantState.status === "loading") {
    return <PageReadyOverlay />;
  }
  if (!auth.profile) return <Navigate to="/login?next=%2Freports%2Fhybrid-billing" replace />;
  if (!["owner", "admin"].includes(auth.profile.role)
    || tenant?.billingPolicyVersion !== "hybrid_v1") return <Navigate to="/" replace />;

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
          <label htmlFor="hybridReportDate">{t("hybrid_report.date")}</label>
          <input id="hybridReportDate" type="date" min={tenant.hybridBillingStartDate || ""}
            max={bangkokDate()} value={onDate} onChange={event => setOnDate(event.target.value)} />
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
            <p className="hybrid-report-notice">{date(data.cycleStart)} – {date(data.cycleLastDate)}</p>
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
        <section className="card hybrid-report-details" aria-labelledby="hybridInvoicesHeading">
          <h2 id="hybridInvoicesHeading">ใบแจ้งค่าบริการจาก PENGUIN</h2>
          <p className="hybrid-report-notice">ยอดด้านบนเป็นเพียง Preview ส่วนรายการด้านล่างเป็นบิลที่ PENGUIN ออกจริงหลังตรวจสอบแล้วเท่านั้น</p>
          <p className="hybrid-report-notice">โปรดโอนเงินเข้าบัญชีที่ระบุไว้ในบิลแต่ละรายการ ซึ่งอาจต่างจากบัญชีรับเงินปัจจุบัน</p>
          {paymentMessage ? <p role="status">{paymentMessage}</p> : null}
          <button className="btn btn-sm" type="button" onClick={loadInvoices}>รีเฟรชสถานะบิล</button>
          <div className="hybrid-report-table-scroll">
            <table>
              <thead><tr><th>วันเรียกเก็บ</th><th>ยอดค่าบริการ</th><th>สถานะ</th><th>แจ้งชำระ</th></tr></thead>
              <tbody>
                {invoices.length ? invoices.map(invoice => (
                  <tr key={invoice.id}>
                    <td>{date(invoice.date)}</td>
                    <td>{currency(invoice.amount)}</td>
                    <td>{invoice.state === "paid" ? "ชำระแล้ว" :
                      invoice.state === "review" ? "รอตรวจสอบ" :
                      invoice.state === "void" ? "ยกเลิก" : "ค้างชำระ"}</td>
                    <td>{invoice.state === "outstanding" && (invoice.paymentDestination || destination) ? (
                      <form onSubmit={event => submitInvoiceSlip(event, invoice)}>
                        <small>โอนเข้าบัญชี: {(invoice.paymentDestination || destination).bankName} — {(invoice.paymentDestination || destination).accountName} — {(invoice.paymentDestination || destination).accountNumber}</small>
                        <label>
                          <span className="visually-hidden">หลักฐานชำระ {invoice.id}</span>
                          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
                            required disabled={Boolean(submittingInvoice)}
                            onChange={event => setSlips(current => ({
                              ...current, [invoice.id]: event.target.files?.[0] || null,
                            }))} />
                        </label>
                        <button className="btn btn-sm btn-primary" type="submit"
                          disabled={!slips[invoice.id] || Boolean(submittingInvoice)}>ส่งหลักฐาน</button>
                      </form>
                    ) : "—"}</td>
                  </tr>
                )) : <tr><td colSpan="4">ยังไม่มีใบแจ้งค่าบริการที่ออกแล้ว</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <ParityFooter />
    </>
  );
}
