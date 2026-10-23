import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { ParityFooter } from "@/components/ParityFooter";
import { UserMenu } from "@/components/UserMenu";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import {
  listHybridTenants, listHybridInvoices, listHybridPaymentAttempts,
} from "@/data/hybridInvoiceReviewData";

const label = (th, en, isThai) => isThai ? th : en;
function recordDate(value, locale) {
  const date = typeof value?.toDate === "function" ? value.toDate()
    : value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat(locale, { timeZone: "Asia/Bangkok", dateStyle: "medium" }).format(date)
    : "-";
}
function statusLabel(status, isThai) {
  const map = {
    issued: ["ออกบิลแล้ว", "Issued"],
    pending_review: ["รอตรวจสลิป", "Pending review"],
    paid: ["ชำระแล้ว", "Paid"],
    rejected: ["ปฏิเสธ", "Rejected"],
  };
  const choice = map[status] || [status || "-", status || "-"];
  return choice[isThai ? 0 : 1];
}
function money(value, locale) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number(value || 0)) + " ฿";
}

export function HybridBillingReviewPage() {
  const auth = useAuth();
  const { intlLocale } = useI18n();
  const thai = intlLocale.startsWith("th");
  const [tenants, setTenants] = useState([]);
  const [tenantCursor, setTenantCursor] = useState(null);
  const [moreTenants, setMoreTenants] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [invoiceCursor, setInvoiceCursor] = useState(null);
  const [attemptCursor, setAttemptCursor] = useState(null);
  const [moreInvoices, setMoreInvoices] = useState(false);
  const [moreAttempts, setMoreAttempts] = useState(false);
  const [busy, setBusy] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const stylesReady = useParityPage({
    title: label("ตรวจสอบบิล Hybrid", "Hybrid Invoice Review", thai),
    bodyClass: "revenue-share-report-page hybrid-report-page",
    styles: ["app.css", "icons.css", "revenue-share-report.css",
      "hybrid-billing-report.css", "hybrid-billing-review.css"],
  });

  const loadMoreTenants = useCallback(async (cursor = null) => {
    const result = await listHybridTenants(cursor);
    setTenants(previous => cursor ? [...previous, ...result.items] : result.items);
    setTenantCursor(result.cursor);
    setMoreTenants(result.hasMore);
  }, []);
  useEffect(() => {
    if (auth.status !== "ready" || auth.profile?.role !== "super_admin") return;
    let cancelled = false;
    setBusy(true);
    listHybridTenants().then(result => {
      if (cancelled) return;
      setTenants(result.items);
      setTenantCursor(result.cursor);
      setMoreTenants(result.hasMore);
    }).catch(err => {
      if (!cancelled) setError(err.message || "TENANT_LOAD_FAILED");
    }).finally(() => {
      if (!cancelled) setBusy(false);
    });
    return () => { cancelled = true; };
  }, [auth.status, auth.profile?.role]);

  useEffect(() => {
    if (!selectedId || auth.profile?.role !== "super_admin") {
      setInvoices([]);
      setAttempts([]);
      return;
    }
    let cancelled = false;
    setLoadingDetails(true);
    setError("");
    Promise.all([listHybridInvoices(selectedId), listHybridPaymentAttempts(selectedId)])
      .then(([invoicePage, attemptPage]) => {
        if (cancelled) return;
        setInvoices(invoicePage.items);
        setAttempts(attemptPage.items);
        setInvoiceCursor(invoicePage.cursor);
        setAttemptCursor(attemptPage.cursor);
        setMoreInvoices(invoicePage.hasMore);
        setMoreAttempts(attemptPage.hasMore);
      })
      .catch(err => { if (!cancelled) setError(err.message || "BILLING_LIST_FAILED"); })
      .finally(() => { if (!cancelled) setLoadingDetails(false); });
    return () => { cancelled = true; };
  }, [selectedId, auth.profile?.role, revision]);

  if (!stylesReady || auth.status === "loading" || busy) return <PageReadyOverlay />;
  if (!auth.profile) return <Navigate to="/login?next=%2Fplatform%2Fhybrid-invoices" replace />;
  if (auth.profile.role !== "super_admin") return <Navigate to="/" replace />;

  const title = label("ตรวจสอบบิล Hybrid", "Hybrid Invoice Review", thai);
  const selected = tenants.find(tenant => tenant.id === selectedId);
  const unreviewed = attempts.filter(attempt => attempt.status === "pending_review").length;
  return (
    <>
      <header className="app-header super-admin-header">
        <div className="brand"><span className="brand-mark">PG</span><span>PENGUIN</span></div>
        <div className="app-header-actions"><LocaleSwitcher /><UserMenu profile={auth.profile} /></div>
      </header>
      <main className="revenue-share-page hybrid-review-shell">
        <section className="revenue-share-hero">
          <div>
            <Link className="btn btn-sm" to="/platform">
              <i className="bi bi-arrow-left app-icon" aria-hidden="true"></i>
              {label(" กลับหน้าระบบกลาง", " Back to Platform", thai)}
            </Link>
            <h1>{title}</h1>
            <p>{label("รายการบิลและสลิปที่บันทึกใน Ledger (ดูอย่างเดียว)",
              "Issued invoices and payment attempts (read-only)", thai)}</p>
          </div>
        </section>
        <p role="status" className="hybrid-report-notice">
          {label("ยังไม่เปิดออกบิลและอนุมัติชำระเงินจริงผ่านหน้านี้ โปรดอย่าใช้ยอดคาดการณ์เป็นยอดค้างชำระ",
            "Invoice issuance and approval are not enabled here. Projections are not payable balances.", thai)}
        </p>
        <section className="card hybrid-report-toolbar">
          <label htmlFor="hybridReviewTenant">{label("ร้านค้า", "Store", thai)}</label>
          <select id="hybridReviewTenant" value={selectedId}
            onChange={event => setSelectedId(event.target.value)}>
            <option value="">{label("เลือกร้านค้า", "Select store", thai)}</option>
            {tenants.map(store => (
              <option key={store.id} value={store.id}>
                {store.name || store.shopName || store.businessName || store.slug || store.id}
              </option>
            ))}
          </select>
          {moreTenants ? (
            <button type="button" className="btn btn-sm"
              onClick={() => loadMoreTenants(tenantCursor).catch(e => setError(e.message))}>
              {label("โหลดร้านเพิ่มเติม", "Load more stores", thai)}
            </button>
          ) : null}
          <button className="btn btn-sm" type="button"
            onClick={() => setRevision(value => value + 1)} disabled={!selectedId || loadingDetails}>
            <i className="bi bi-arrow-clockwise app-icon" aria-hidden="true"></i>
            {label(" รีเฟรช", " Refresh", thai)}
          </button>
        </section>
        {error ? <p role="alert" className="card hybrid-report-status error">{error}</p> : null}
        {selectedId && selected ? (
          <section className="hybrid-report-metrics" aria-label={title}>
            {[
              [label("ร้านค้า", "Store", thai),
                selected.name || selected.shopName || selected.slug || selectedId],
              [label("จำนวนบิลที่โหลด", "Invoices loaded", thai), invoices.length],
              [label("สลิปรอตรวจที่โหลด", "Pending slips loaded", thai), unreviewed],
              [label("ชำระแล้วในรายการที่โหลด", "Paid in loaded invoices", thai),
                money(invoices.filter(row => row.status === "paid").reduce((sum, row) => sum + Number(row.amount || 0), 0), intlLocale)],
            ].map(([key, value]) => (
              <div key={key} className="card hybrid-report-metric">
                <small>{key}</small><strong>{value}</strong>
              </div>
            ))}
          </section>
        ) : null}
        {selectedId ? (
          <>
            {loadingDetails ? <p role="status" className="card hybrid-report-status">
              {label("กำลังโหลดรายการ…", "Loading records…", thai)}
            </p> : null}
            <section className="card hybrid-report-details">
              <h2>{label("รายการบิลที่ออกแล้ว", "Issued invoices", thai)}</h2>
              <div className="hybrid-report-table-scroll">
                <table>
                  <thead><tr>
                    <th>{label("รหัสบิล", "Invoice ID", thai)}</th>
                    <th>{label("วันที่", "Date", thai)}</th>
                    <th>{label("ยอดเงิน", "Amount", thai)}</th>
                    <th>{label("สถานะ", "Status", thai)}</th>
                  </tr></thead>
                  <tbody>{invoices.length ? invoices.map(row => (
                    <tr key={row.id}>
                      <td className="hybrid-review-id">{row.id}</td>
                      <td>{row.date || "-"}</td>
                      <td>{money(row.amount, intlLocale)}</td>
                      <td><span className={"hybrid-review-status " + row.status}>
                        {statusLabel(row.status, thai)}</span></td>
                    </tr>
                  )) : <tr><td colSpan={4}>{label("ยังไม่มีบิลที่ออกจริง", "No issued invoices", thai)}</td></tr>}</tbody>
                </table>
              </div>
              {moreInvoices ? <button type="button" className="btn btn-sm" disabled={loadingDetails}
                onClick={() => listHybridInvoices(selectedId, { cursor: invoiceCursor })
                  .then(next => {
                    setInvoices(prev => [...prev, ...next.items]);
                    setInvoiceCursor(next.cursor); setMoreInvoices(next.hasMore);
                  }).catch(e => setError(e.message))}>
                {label("โหลดบิลเพิ่มเติม", "Load more invoices", thai)}
              </button> : null}
            </section>
            <section className="card hybrid-report-details">
              <h2>{label("รายการสลิปและผลตรวจสอบ", "Slip submission and review history", thai)}</h2>
              <div className="hybrid-report-table-scroll">
                <table>
                  <thead><tr>
                    <th>{label("รหัสบิล", "Invoice ID", thai)}</th>
                    <th>{label("วันที่ส่ง", "Submitted", thai)}</th>
                    <th>{label("ยอด", "Amount", thai)}</th>
                    <th>{label("ธนาคารยืนยัน", "Bank verified", thai)}</th>
                    <th>{label("สถานะ", "Status", thai)}</th>
                  </tr></thead>
                  <tbody>{attempts.length ? attempts.map(row => (
                    <tr key={row.id}>
                      <td className="hybrid-review-id">{row.invoiceId}</td>
                      <td>{recordDate(row.submittedAt, intlLocale)}</td>
                      <td>{money(row.amount, intlLocale)}</td>
                      <td>{row.bankVerified ? label("ใช่", "Yes", thai) : label("ยังไม่ยืนยัน", "Unverified", thai)}</td>
                      <td><span className={"hybrid-review-status " + row.status}>
                        {statusLabel(row.status, thai)}</span></td>
                    </tr>
                  )) : <tr><td colSpan={5}>{label("ยังไม่มีสลิปที่ส่ง", "No submitted slips", thai)}</td></tr>}</tbody>
                </table>
              </div>
              {moreAttempts ? <button type="button" className="btn btn-sm" disabled={loadingDetails}
                onClick={() => listHybridPaymentAttempts(selectedId, { cursor: attemptCursor })
                  .then(next => {
                    setAttempts(prev => [...prev, ...next.items]);
                    setAttemptCursor(next.cursor); setMoreAttempts(next.hasMore);
                  }).catch(e => setError(e.message))}>
                {label("โหลดสลิปเพิ่มเติม", "Load more slips", thai)}
              </button> : null}
              <p className="hybrid-report-notice">
                {label("การอนุมัติสลิปจะเปิดหลังทดสอบระบบชำระเงินจริงและสิทธิ์ Super Admin บน Emulator",
                  "Approval will be enabled after emulator payment and Super Admin authorization tests.", thai)}
              </p>
            </section>
          </>
        ) : null}
      </main>
      <ParityFooter />
    </>
  );
}
