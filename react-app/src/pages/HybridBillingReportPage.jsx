import { useEffect, useMemo, useState } from "react";
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
import { HybridBillingFinancePanel } from "@/components/HybridBillingFinancePanel";

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
  const stylesReady = useParityPage({
    title: t("hybrid_report.title"),
    bodyClass: "revenue-share-report-page hybrid-report-page",
    styles: ["app.css", "icons.css", "revenue-share-report.css", "hybrid-billing-report.css"],
  });
  const reload = () => {
    setLoading(true);
    setError("");
    getHybridBillingPreview(onDate)
      .then(setData)
      .catch(err => {
        console.error("HYBRID_BILLING_PREVIEW_FAILED", err);
        setData(null);
        setError(t("hybrid_report.error"));
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    if (tenant?.billingPolicyVersion === "hybrid_v1"
      && ["owner", "admin"].includes(auth.profile?.role)) reload();
  }, [tenant?.id, tenant?.billingPolicyVersion, auth.profile?.role, onDate]);

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
        <HybridBillingFinancePanel tenantId={tenant.id} mode="owner"
          language={intlLocale?.startsWith("th") ? "th" : "en"} />
        <section className="card hybrid-report-toolbar">
          <label htmlFor="hybridReportDate">{t("hybrid_report.cycle")}</label>
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
            <p className="hybrid-report-notice">
              {t("hybrid_report.cycle_range", {
                start: date(data.cycleStart), end: date(data.cycleLastDate),
                reset: date(data.cycleEnd),
              })}
            </p>
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
      </main>
      <ParityFooter />
    </>
  );
}
