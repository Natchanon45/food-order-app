import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { ParityFooter } from "@/components/ParityFooter";
import { UserMenu } from "@/components/UserMenu";
import { HybridReviewDecisionPanel } from "@/components/HybridReviewDecisionPanel";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { isHybridDemoMode } from "@/firebase/client";
import {
  listHybridTenants, listHybridInvoices, listHybridPaymentAttempts,
  listHybridPaymentReviewEvents,
  listHybridAdjustments, listHybridAdjustmentReviewEvents,
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
  const [reviewEvents, setReviewEvents] = useState([]);
  const [eventCursor, setEventCursor] = useState(null);
  const [moreEvents, setMoreEvents] = useState(false);
  const [adjustments, setAdjustments] = useState([]);
  const [adjustmentCursor, setAdjustmentCursor] = useState(null);
  const [moreAdjustments, setMoreAdjustments] = useState(false);
  const [adjustmentEvents, setAdjustmentEvents] = useState([]);
  const [adjustmentEventCursor, setAdjustmentEventCursor] = useState(null);
  const [moreAdjustmentEvents, setMoreAdjustmentEvents] = useState(false);
  const [invoiceCursor, setInvoiceCursor] = useState(null);
  const [attemptCursor, setAttemptCursor] = useState(null);
  const [moreInvoices, setMoreInvoices] = useState(false);
  const [moreAttempts, setMoreAttempts] = useState(false);
  const [busy, setBusy] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [loadedDetailScope, setLoadedDetailScope] = useState("");
  const [pageBusyScope, setPageBusyScope] = useState("");
  const detailScope = selectedId + ":" + revision;
  const detailScopeRef = useRef(detailScope);
  const pageInFlightRef = useRef("");
  detailScopeRef.current = detailScope;
  // Never display a prior tenant or refresh generation's finance records.
  const detailsReady = Boolean(selectedId) && loadedDetailScope === detailScope;
  const visibleInvoices = detailsReady ? invoices : [];
  const visibleAttempts = detailsReady ? attempts : [];
  const visibleReviewEvents = detailsReady ? reviewEvents : [];
  const visibleAdjustments = detailsReady ? adjustments : [];
  const visibleAdjustmentEvents = detailsReady ? adjustmentEvents : [];
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
      setLoadedDetailScope("");
      setInvoices([]);
      setAttempts([]);
      setReviewEvents([]);
      setEventCursor(null);
      setMoreEvents(false);
      setAdjustments([]);
      setAdjustmentCursor(null);
      setMoreAdjustments(false);
      setAdjustmentEvents([]);
      setAdjustmentEventCursor(null);
      setMoreAdjustmentEvents(false);
      return;
    }
    let cancelled = false;
    setLoadedDetailScope("");
    setLoadingDetails(true);
    setError("");
    // Do not display a previous shop's financial data while changing tenants.
    setInvoices([]);
    setAttempts([]);
    setReviewEvents([]);
    setAdjustments([]);
    setAdjustmentEvents([]);
    Promise.all([
      listHybridInvoices(selectedId),
      listHybridPaymentAttempts(selectedId),
      listHybridPaymentReviewEvents(selectedId),
      listHybridAdjustments(selectedId),
      listHybridAdjustmentReviewEvents(selectedId),
    ]).then(([invoicePage, attemptPage, eventPage,
      adjustmentPage, adjustmentEventPage]) => {
        if (cancelled) return;
        setInvoices(invoicePage.items);
        setAttempts(attemptPage.items);
        setReviewEvents(eventPage.items);
        setEventCursor(eventPage.cursor);
        setMoreEvents(eventPage.hasMore);
        setAdjustments(adjustmentPage.items);
        setAdjustmentCursor(adjustmentPage.cursor);
        setMoreAdjustments(adjustmentPage.hasMore);
        setAdjustmentEvents(adjustmentEventPage.items);
        setAdjustmentEventCursor(adjustmentEventPage.cursor);
        setMoreAdjustmentEvents(adjustmentEventPage.hasMore);
        setInvoiceCursor(invoicePage.cursor);
        setAttemptCursor(attemptPage.cursor);
        setMoreInvoices(invoicePage.hasMore);
        setMoreAttempts(attemptPage.hasMore);
        setLoadedDetailScope(detailScope);
      })
      .catch(err => { if (!cancelled) setError(err.message || "BILLING_LIST_FAILED"); })
      .finally(() => { if (!cancelled) setLoadingDetails(false); });
    return () => { cancelled = true; };
  }, [selectedId, auth.profile?.role, revision]);

  function loadMoreDetails(kind, cursor, getPage, setRows, setCursor, setMore) {
    if (!detailsReady || !cursor || loadingDetails
      || pageBusyScope || pageInFlightRef.current) return;
    const expectedScope = detailScope;
    const requestScope = expectedScope + ":" + kind;
    // Synchronous ref prevents two clicks in the same React render.
    pageInFlightRef.current = requestScope;
    setPageBusyScope(requestScope);
    getPage(selectedId, { cursor }).then(next => {
      if (detailScopeRef.current !== expectedScope) return;
      setRows(previous => {
        const seen = new Set(previous.map(item => item.id));
        return [...previous, ...next.items.filter(item => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        })];
      });
      setCursor(next.cursor);
      setMore(next.hasMore);
    }).catch(error => {
      if (detailScopeRef.current === expectedScope)
        setError(error.message || "BILLING_PAGE_FAILED");
    }).finally(() => {
      if (pageInFlightRef.current === requestScope) pageInFlightRef.current = "";
      setPageBusyScope(current => current === requestScope ? "" : current);
    });
  }

  if (!stylesReady || auth.status === "loading" || (auth.profile?.role === "super_admin" && busy)) return <PageReadyOverlay />;
  if (!auth.profile) return <Navigate to="/login?next=%2Fplatform%2Fhybrid-invoices" replace />;
  if (auth.profile.role !== "super_admin") return <Navigate to="/" replace />;

  const title = label("ตรวจสอบบิล Hybrid", "Hybrid Invoice Review", thai);
  const selected = tenants.find(tenant => tenant.id === selectedId);
  const unreviewed = visibleAttempts.filter(attempt => attempt.status === "pending_review").length;
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
        {isHybridDemoMode ? <p role="status" className="hybrid-demo-banner">
          {label("นี่คือระบบทดสอบ Emulator • ผลยืนยันธนาคารและสถานะ Paid เป็นข้อมูลจำลองเท่านั้น",
            "Local Emulator only • Bank confirmations and PAID states are synthetic test records.", thai)}
        </p> : null}
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
              [label("จำนวนบิลที่โหลด", "Invoices loaded", thai), visibleInvoices.length],
              [label("สลิปรอตรวจที่โหลด", "Pending slips loaded", thai), unreviewed],
              [label("ชำระแล้วในรายการที่โหลด", "Paid in loaded invoices", thai),
                money(visibleInvoices.filter(row => row.status === "paid").reduce((sum, row) => sum + Number(row.amount || 0), 0), intlLocale)],
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
                  <tbody>{visibleInvoices.length ? visibleInvoices.map(row => (
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
              {moreInvoices && detailsReady ? <button type="button" className="btn btn-sm"
                disabled={loadingDetails || Boolean(pageBusyScope)}
                onClick={() => loadMoreDetails("invoices", invoiceCursor,
                  listHybridInvoices, setInvoices, setInvoiceCursor, setMoreInvoices)}>
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
                    <th>{label("ผลการตรวจ", "Review action", thai)}</th>
                  </tr></thead>
                  <tbody>{visibleAttempts.length ? visibleAttempts.map(row => (
                    <tr key={row.id}>
                      <td className="hybrid-review-id">{row.invoiceId}</td>
                      <td>{recordDate(row.submittedAt, intlLocale)}</td>
                      <td>{money(row.amount, intlLocale)}</td>
                      <td>{row.bankVerified
                        ? (isHybridDemoMode ? label("จำลอง", "Simulated", thai) : label("ใช่", "Yes", thai))
                        : label("ยังไม่ยืนยัน", "Unverified", thai)}</td>
                      <td><span className={"hybrid-review-status " + row.status}>
                        {statusLabel(row.status, thai)}</span></td>
                      <td><HybridReviewDecisionPanel key={row.id + ":" + selectedId}
                        tenantId={selectedId} payment={row} thai={thai}
                        onReviewed={() => setRevision(value => value + 1)} /></td>
                    </tr>
                  )) : <tr><td colSpan={6}>{label("ยังไม่มีสลิปที่ส่ง", "No submitted slips", thai)}</td></tr>}</tbody>
                </table>
              </div>
              {moreAttempts && detailsReady ? <button type="button" className="btn btn-sm"
                disabled={loadingDetails || Boolean(pageBusyScope)}
                onClick={() => loadMoreDetails("attempts", attemptCursor,
                  listHybridPaymentAttempts, setAttempts, setAttemptCursor, setMoreAttempts)}>
                {label("โหลดสลิปเพิ่มเติม", "Load more slips", thai)}
              </button> : null}
              <p className="hybrid-report-notice">
                {label("แบบฟอร์มอนุมัติถูกล็อกไว้ จนกว่าจะทดสอบ Callable และอนุมัติเปิดใช้งานระบบการเงินจริง",
                  "Review controls remain locked until callable UAT and explicit financial release approval.", thai)}
              </p>
            </section>
            <section className="card hybrid-report-details hybrid-review-audit" aria-label={
              label("ประวัติการตรวจสอบการเงิน", "Finance review audit trail", thai)
            }>
              <h2>{label("ประวัติการตรวจสอบการเงิน", "Finance review audit trail", thai)}</h2>
              <p className="hybrid-report-notice">{label(
                "รายการนี้มาจาก Audit Event ที่ Server บันทึกไว้แบบแก้ไขไม่ได้ ไม่มีข้อมูลบัญชีหรือสลิปดิบ",
                "Immutable server-written audit events; raw slips and bank account data are not displayed.",
                thai
              )}</p>
              <div className="hybrid-report-table-scroll">
                <table>
                  <thead><tr>
                    <th>{label("รหัสบิล", "Invoice", thai)}</th>
                    <th>{label("วันที่ตรวจ", "Reviewed at", thai)}</th>
                    <th>{label("ผล", "Decision", thai)}</th>
                    <th>{label("ผู้ตรวจ", "Reviewer", thai)}</th>
                    <th>{label("วิธียืนยัน", "Confirmation", thai)}</th>
                    <th>{label("หมายเหตุ", "Audit note", thai)}</th>
                  </tr></thead>
                  <tbody>{visibleReviewEvents.length ? visibleReviewEvents.map(event => (
                    <tr key={event.id}>
                      <td className="hybrid-review-id">{event.invoiceId}</td>
                      <td>{recordDate(event.reviewedAt, intlLocale)}</td>
                      <td><span className={"hybrid-review-status " + event.resultStatus}>
                        {statusLabel(event.resultStatus, thai)}</span></td>
                      <td className="hybrid-review-id">{event.reviewerId || "-"}</td>
                      <td>{event.bankVerified
                        ? (isHybridDemoMode ? label("จำลอง", "Simulated", thai)
                          : label("ธนาคารยืนยัน", "Bank verified", thai))
                        : event.verifiedExternally
                          ? label("ตรวจอิสระ", "Independent confirmation", thai)
                          : label("ไม่ได้ยืนยัน", "Not verified", thai)}</td>
                      <td className="hybrid-review-audit-note">{event.notePreview || "-"}</td>
                    </tr>
                  )) : <tr><td colSpan={6}>{label(
                    "ยังไม่มีประวัติการตรวจสอบ", "No finance review events", thai
                  )}</td></tr>}</tbody>
                </table>
              </div>
              {moreEvents && detailsReady ? <button type="button" className="btn btn-sm"
                disabled={loadingDetails || Boolean(pageBusyScope)}
                onClick={() => loadMoreDetails("events", eventCursor,
                  listHybridPaymentReviewEvents, setReviewEvents, setEventCursor, setMoreEvents)}>
                {label("โหลดประวัติเพิ่มเติม", "Load more audit events", thai)}
              </button> : null}
            </section>

            <section className="card hybrid-report-details hybrid-review-audit hybrid-adjustment-history" aria-label={
              label("คำขอปรับยอดการเงิน", "Financial adjustment proposals", thai)
            }>
              <h2>{label("คำขอปรับยอดการเงิน", "Financial adjustment proposals", thai)}</h2>
              <p className="hybrid-report-notice">{label(
                "อ่านอย่างเดียว • ผ่านอนุมัติภายในไม่ได้หมายถึงคืนเงินหรือหักหนี้สำเร็จ ยอดบิลและ Wallet ไม่เปลี่ยน",
                "Read-only • Internal approval does NOT mean refund sent, debt cleared, or wallet credited.",
                thai
              )}</p>
              <div className="hybrid-report-table-scroll">
                <table>
                  <thead><tr>
                    <th>{label("รหัสบิล", "Invoice", thai)}</th>
                    <th>{label("ประเภท", "Type", thai)}</th>
                    <th>{label("วันที่ยื่น", "Proposed", thai)}</th>
                    <th>{label("จำนวนเงิน", "Amount", thai)}</th>
                    <th>{label("ผู้ยื่น", "Requested by", thai)}</th>
                    <th>{label("สถานะภายใน", "Internal status", thai)}</th>
                    <th>{label("การคืนเงินจริง", "Actual payout", thai)}</th>
                    <th>{label("เหตุผล", "Reason", thai)}</th>
                  </tr></thead>
                  <tbody>{visibleAdjustments.length ? visibleAdjustments.map(item => (
                    <tr key={item.id}>
                      <td className="hybrid-review-id">{item.invoiceId}</td>
                      <td>{({
                        credit_note: label("ใบลดหนี้ (รอดำเนินการ)", "Credit note (not applied)", thai),
                        refund_request: label("คำขอคืนเงิน", "Refund request", thai),
                        chargeback_review: label("ตรวจสอบรายการเรียกเงินคืน", "Chargeback review", thai),
                      })[item.kind] || "-"}</td>
                      <td>{recordDate(item.proposedAt, intlLocale)}</td>
                      <td>{money(item.amount, intlLocale)}</td>
                      <td className="hybrid-review-id">{item.proposedBy || "-"}</td>
                      <td><span className={"hybrid-review-status " + item.status}>
                        {({
                          proposed: label("รอตรวจภายใน", "Awaiting internal review", thai),
                          approved: label("อนุมัติภายในเท่านั้น", "Internally approved only", thai),
                          rejected: label("ปฏิเสธ", "Rejected", thai),
                        })[item.status] || "-"}</span></td>
                      <td className="hybrid-adjustment-unsettled">{label(
                        "ยังไม่มีหลักฐานคืนเงินจริง", "No confirmed payout", thai
                      )}</td>
                      <td className="hybrid-review-audit-note">{item.reasonPreview || "-"}</td>
                    </tr>
                  )) : <tr><td colSpan={8}>{label(
                    "ยังไม่มีคำขอปรับยอด", "No adjustment proposals", thai
                  )}</td></tr>}</tbody>
                </table>
              </div>
              {moreAdjustments && detailsReady ? <button type="button" className="btn btn-sm"
                disabled={loadingDetails || Boolean(pageBusyScope)}
                onClick={() => loadMoreDetails("adjustments", adjustmentCursor,
                  listHybridAdjustments, setAdjustments, setAdjustmentCursor, setMoreAdjustments)}>
                {label("โหลดคำขอเพิ่มเติม", "Load more proposals", thai)}
              </button> : null}
            </section>
            <section className="card hybrid-report-details hybrid-review-audit hybrid-adjustment-history" aria-label={
              label("ประวัติการอนุมัติปรับยอด", "Adjustment review history", thai)
            }>
              <h2>{label("ประวัติการอนุมัติปรับยอด", "Adjustment review history", thai)}</h2>
              <p className="hybrid-report-notice">{label(
                "แสดงเฉพาะผู้ตรวจและผลตัดสินใจ ไม่แสดงข้อมูลบัญชีธนาคารหรือเลขอ้างอิงการโอน",
                "Immutable decisions only; no bank account, raw evidence or transfer references.",
                thai
              )}</p>
              <div className="hybrid-report-table-scroll">
                <table>
                  <thead><tr>
                    <th>{label("คำขอ", "Adjustment", thai)}</th>
                    <th>{label("วันที่ตรวจ", "Reviewed", thai)}</th>
                    <th>{label("ผู้ตรวจ", "Reviewer", thai)}</th>
                    <th>{label("ผลภายใน", "Internal decision", thai)}</th>
                    <th>{label("หลักฐานคืนเงินจริง", "External settlement", thai)}</th>
                    <th>{label("หมายเหตุ", "Audit note", thai)}</th>
                  </tr></thead>
                  <tbody>{visibleAdjustmentEvents.length ? visibleAdjustmentEvents.map(event => (
                    <tr key={event.id}>
                      <td className="hybrid-review-id">{event.adjustmentId}</td>
                      <td>{recordDate(event.reviewedAt, intlLocale)}</td>
                      <td className="hybrid-review-id">{event.reviewerId || "-"}</td>
                      <td><span className={"hybrid-review-status " + event.resultStatus}>
                        {event.action === "approve"
                          ? label("อนุมัติภายใน", "Internally approved", thai)
                          : event.action === "reject" ? label("ปฏิเสธ", "Rejected", thai) : "-"}</span></td>
                      <td className="hybrid-adjustment-unsettled">{label(
                        "ยังไม่ยืนยันการคืนเงินจริง", "Payout not confirmed", thai
                      )}</td>
                      <td className="hybrid-review-audit-note">{event.notePreview || "-"}</td>
                    </tr>
                  )) : <tr><td colSpan={6}>{label(
                    "ยังไม่มีประวัติการตัดสินใจ", "No adjustment decisions", thai
                  )}</td></tr>}</tbody>
                </table>
              </div>
              {moreAdjustmentEvents && detailsReady ? <button type="button" className="btn btn-sm"
                disabled={loadingDetails || Boolean(pageBusyScope)}
                onClick={() => loadMoreDetails("adjustment-events", adjustmentEventCursor,
                  listHybridAdjustmentReviewEvents, setAdjustmentEvents,
                  setAdjustmentEventCursor, setMoreAdjustmentEvents)}>
                {label("โหลดประวัติเพิ่มเติม", "Load more decisions", thai)}
              </button> : null}
            </section>
          </>
        ) : null}
      </main>
      <ParityFooter />
    </>
  );
}
