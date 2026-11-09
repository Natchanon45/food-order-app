import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/client";
import { tenantCalendarLabel } from "@/data/tenantActivationCalendar.mjs";
import { tenantAccessReasonLabel, SIGNED_TENANT_ACCESS_REASONS } from "@/data/tenantAccessReason.mjs";

const THAI_DATE = "th-TH";
const BILL_KINDS = {
  monthly: "ค่าสมาชิกรายเดือน",
  yearly: "ค่าสมาชิกรายปี",
  delivery_daily: "ส่วนแบ่ง Delivery รายวัน",
};
const INVOICE_STATE = {
  issued: "รอชำระ", rejected: "สลิปไม่ผ่าน",
  pending_review: "รอตรวจสลิป", pending_manual_review: "รอ Super Admin ตรวจ",
  paid: "ชำระแล้ว", settled_credit: "ชำระด้วย Service Credit",
  waived: "ยกเว้นค่าบริการ", voided: "ยกเลิก Invoice",
};
const money = (cents, locale = THAI_DATE) =>
  Number.isSafeInteger(cents) && cents >= 0
    ? new Intl.NumberFormat(locale, { minimumFractionDigits: 2,
        maximumFractionDigits: 2 }).format(cents / 100)
    : "—";
const date = (value, locale = THAI_DATE) =>
  value ? tenantCalendarLabel(value, locale) : "ไม่มีข้อมูล";
const contactEmail = value => {
  const text = String(value || "").trim();
  return !text || /@(?:example\.com|localhost\.invalid)$/i.test(text)
    ? "ยังไม่มีอีเมลติดต่อที่ใช้งานได้" : text;
};

// M7's Go/SQL finance certification has no Firebase equivalent yet.
// Do not substitute a Revenue Share summary for certified bank receipts,
// claims, issued invoices or Service Credit. No synthetic zero balances.
function useCertifiedLedger(tenantId, enabled) {
  const refresh = useCallback(() => {}, []);
  return { status: enabled && tenantId ? "unverified" : "idle", data: null,
    canRefresh: false, refresh };
}
function useLegacyOperationalSnapshot(tenantId, enabled) {
  return { tenantId, status: enabled ? "unavailable" : "idle", data: null };
}
function mask(value) {
  const digits = String(value || "").replace(/[^0-9]/g, "");
  return digits.length >= 4 ? "•••• " + digits.slice(-4) : "";
}
function useSavedStoreAccount(tenantId, enabled) {
  const [state, setState] = useState({ tenantId: "", status: "idle", account: null });
  useEffect(() => {
    if (!enabled || !tenantId) return undefined;
    let cancelled = false;
    setState({ tenantId, status: "loading", account: null });
    getDoc(doc(db, "tenants", tenantId, "settings", "store")).then(snapshot => {
      if (cancelled) return;
      const saved = snapshot.exists() ? snapshot.data() : {};
      setState({ tenantId, status: "ready", account: {
        bankName: String(saved.bankName || ""),
        bankAccountName: String(saved.bankAccountName || ""),
        bankAccountMasked: mask(saved.bankAccountNumber),
        promptPayMasked: mask(saved.promptPayId),
        promptPayName: String(saved.promptPayName || saved.promptPayAccountName || ""),
        bankConfigured: Boolean(saved.bankName && saved.bankAccountNumber),
        promptPayConfigured: Boolean(saved.promptPayId),
        deliveryPromptPayEnabled: saved.deliveryPromptPayEnabled !== false,
      }});
    }).catch(() => {
      if (!cancelled) setState({ tenantId, status: "error", account: null });
    });
    return () => { cancelled = true; };
  }, [tenantId, enabled]);
  return state.tenantId === tenantId ? state :
    { tenantId, status: "idle", account: null };
}

function Stat({ label, value, note, icon, accent = "", field }) {
  return <div className={"tenant-control-stat " + accent} data-tenant-summary={field}>
    <div className="tenant-control-stat-label">
      <i className={"bi bi-" + icon} aria-hidden="true"></i><span>{label}</span>
    </div>
    <strong>{value}</strong>
    {note ? <small>{note}</small> : null}
  </div>;
}
function Data({ label, value }) {
  return <div className="tenant-control-field"><dt>{label}</dt><dd>{value || "ไม่มีข้อมูล"}</dd></div>;
}
function Section({ title, subtitle, icon, id, children }) {
  return <section className="tenant-control-section" data-tenant-control-section={id}>
    <div className="tenant-control-section-head">
      <span className="tenant-control-section-icon"><i className={"bi bi-" + icon} aria-hidden="true"></i></span>
      <div><h4>{title}</h4>{subtitle ? <p>{subtitle}</p> : null}</div>
    </div>
    {children}
  </section>;
}
function LedgerNotice({ state, refresh, operational }) {
  if (state.status === "ready") return null;
  const message = operational?.status === "ready"
    ? "ข้อมูลร้านเดิมจาก SQL Backfill: ยอด Delivery จากรายการที่บันทึก paidAt " + operational.data.recordedPaidOrders + " รายการ; รายการ paid ที่ยังตรวจวันรับเงินไม่ได้ " + operational.data.unreconciledPaidOrders + " รายการ • เพดานใช้ค่าที่ตั้งปัจจุบัน ไม่ใช่หลักฐานรับเงินหรือราคาเดิม ห้ามใช้ยอดนี้ออก Invoice"
    : state.status === "idle" ? "เปิดรายละเอียดร้านเพื่ออ่านยอดจากทะเบียนจริง"
    : state.status === "loading" ? "กำลังอ่านรายการบัญชีจริง…"
      : state.status === "unverified"
        ? "หลักฐานการสมัคร/ราคาเดิมหรือทะเบียนการเงิน M7 ยังไม่ผ่านการรับรอง ไม่ใช่หลักฐานว่ามี Invoice ค้างชำระ จึงยังไม่แสดงยอดสมมุติ"
        : "ไม่สามารถอ่านทะเบียนการเงิน M7 ได้ โปรดตรวจสอบข้อมูลต้นฉบับ โดยไม่ถือว่ายอดที่หายไปเป็น 0 บาท";
  return <div className="tenant-control-ledger-notice" role="status">
    <i className="bi bi-info-circle" aria-hidden="true"></i>{message}
    {state.status === "error" && state.canRefresh === true ?
      <button type="button" className="btn btn-sm" onClick={refresh}>ลองอ่านข้อมูลใหม่</button> : null}
  </div>;
}
function ledgerTotals(data) {
  const kinds = data?.kinds || [];
  const delivery = kinds.find(kind => kind.kind === "delivery_daily");
  return {
    invoiceUnpaidCents: kinds.reduce((sum, kind) => sum + kind.unpaidCents, 0),
    deliveryUnpaidCents: delivery?.unpaidCents ?? 0,
    invoiceCount: kinds.reduce((sum, kind) => sum + kind.invoiceCount, 0),
    pendingReviews: kinds.reduce((sum, kind) => sum + kind.pendingReviewCount, 0),
    paidByCreditCents: kinds.reduce((sum, kind) => sum + kind.appliedCreditCents, 0),
    overage: data ? Math.max(0, data.deliveryCyclePaidCents - data.deliveryThresholdCents) : 0,
  };
}
function creditLabel(data, locale) {
  if (!data) return "—";
  if (data.creditLedgerStatus === "verified") return money(data.creditBalanceCents, locale);
  // A certified, empty ledger has no spendable credit, even before an
  // account is initialized. This is a UI representation only: never create
  // an account or claim bank-verified credit from an absent record.
  return data.creditLedgerStatus === "not_initialized" && data.creditEventCount === 0
    ? money(0, locale) : "รอตรวจหลักฐาน";
}
function creditAvailableLabel(data, locale) {
  const value = creditLabel(data, locale);
  return data && ["verified", "not_initialized"].includes(data.creditLedgerStatus)
    && value !== "รอตรวจหลักฐาน"
    ? "เครดิตพร้อมใช้ " + value + " บาท" : value;
}
function effectiveStatus(tenant) {
  if (tenant.m7AdminTestOverrideMode === "allow" &&
      tenant.m7FinanceAccessReason === "superadmin_test_open")
    return "ปลดระงับชั่วคราว (ทดสอบ)";
  if (tenant.m7AdminTestOverrideMode === "suspend" &&
      tenant.m7FinanceAccessReason === "superadmin_test_suspension")
    return "ระงับโดย Super Admin (ทดสอบ)";
  if (tenant.m7FinanceAccessStatus === "suspended" && tenant.m7FinanceAccessReason === "m7_overdue_invoice")
    return "ระงับจาก Invoice ค้างชำระ";
  if (tenant.m7FinanceAccessStatus === "review_required")
    return "ต้องตรวจสอบสถานะการเงิน";
  if (tenant.m7FinanceAccessStatus === "suspended" &&
      SIGNED_TENANT_ACCESS_REASONS.has(tenant.m7FinanceAccessReason) &&
      tenant.m7FinanceAccessReason !== "none")
    return tenantAccessReasonLabel(tenant.m7FinanceAccessReason);
  if (tenant.m7FinanceAccessStatus === "suspended" ||
      tenant.accessStatus === "revenue_share_suspended" || tenant.active === false)
    return "ระงับการใช้งาน";
  return "ใช้งานตามสิทธิ์";
}

function SummaryCards({ tenant, ledger, operational, locale, suspended }) {
  const ready = ledger.status === "ready" && ledger.data;
  const data = ready ? ledger.data : null;
  const source = !data && operational?.status === "ready" ? operational.data : null;
  const sum = ledgerTotals(data);
  const credit = creditAvailableLabel(data, locale);
  const recordedOverage = source ? Math.max(0,
    source.recordedPaidDeliveryGoodsCents - source.currentConfiguredThresholdCents) : 0;
  return <section className="tenant-control-overview" data-tenant-control-section="summary"
    aria-label="สรุปยอดรอบบิลและสถานะร้าน">
    <div className="tenant-control-overview-head">
      <h4>สรุปรอบบิลและการเงิน</h4>
      <small>ข้อมูลจากทะเบียนที่ตรวจสอบแล้ว • ยอดเงินหน่วยบาท / โควตาหน่วยครั้ง</small>
    </div>
    <div className="tenant-control-preview" data-tenant-summary-cards="true">
      <Stat field="delivery-cycle" label="ยอด Delivery สะสม" icon="bicycle"
        value={data ? money(data.deliveryCyclePaidCents, locale) : source ? money(source.recordedPaidDeliveryGoodsCents, locale) : "—"}
        note={source ? "ตามสถานะ paidAt ที่บันทึก · ไม่ใช่หลักฐานธนาคาร" : "ยอดที่ชำระแล้วในรอบบิล"}/>
      <Stat field="delivery-threshold" label="เพดาน Delivery" icon="speedometer2"
        value={data ? money(data.deliveryThresholdCents, locale) : source ? money(source.currentConfiguredThresholdCents, locale) : "—"}
        note={source ? "เพดานตั้งค่าปัจจุบัน · ยังไม่รับรองราคาเดิม" : "เพดานสำหรับรอบบิลนี้"}/>
      <Stat field="delivery-overage" label="ยอดเกินเพดาน" icon="graph-up-arrow"
        value={data ? money(sum.overage, locale) : source ? money(recordedOverage, locale) : "—"}
        note={source ? "ข้อมูลประกอบการตรวจ · ห้ามใช้ออก Invoice" : "ฐานสำหรับคิดส่วนแบ่ง"} accent="tenant-control-stat-highlight"/>
      <Stat field="delivery-invoice-due" label="ส่วนแบ่งที่ต้องชำระ" icon="percent"
        value={data ? money(sum.deliveryUnpaidCents, locale) : "—"}
        note="ยอดค้างจาก Invoice Delivery ที่ออกแล้ว"/>
      <Stat field="service-credit" label="Service Credit" icon="wallet2"
        value={source && source.creditLedgerEventCount === 0 ? "—" : credit}
        note={source ? "ยังไม่มีเครดิตที่ผ่านการรับรอง · ไม่ใช่ 0 บาท" : data?.creditLedgerStatus === "not_initialized"
          ? "ยังไม่เคยมีรายการรับหรือแปลงเครดิตที่ตรวจรับ"
          : "เครดิตที่ตรวจรับในบัญชีจริง"}/>
      <Stat field="invoice-unpaid" label="Invoice ค้างชำระ" icon="receipt"
        value={data ? money(sum.invoiceUnpaidCents, locale) : source && source.invoiceJournalCount === 0 ? "ไม่มี Invoice ในทะเบียน" : "—"}
        note={source ? "ยังไม่รับรองภาระหนี้หรือใบแจ้งหนี้ย้อนหลัง" : "รวมทุกประเภท Invoice"} accent={data && sum.invoiceUnpaidCents ? "tenant-control-stat-warning" : ""}/>
      <Stat field="slip2go-quota" label="โควตาตรวจสลิป Slip2Go" icon="shield-check"
        value={data?.slipQuota
          ? (data.slipQuota.unlimited ? "ใช้งานได้ไม่จำกัด"
            : data.slipQuota.uniqueCheckedBills + "/" + data.slipQuota.freeBills)
          : source ? source.providerChecksInCycle + " / " + source.currentConfiguredFreeChecks : "—"}
        note={source ? "ประวัติตรวจสลิปในฐานข้อมูล · ไม่ใช่ยอดโควตาผู้ให้บริการ" : data?.slipQuota
          ? "นับบิลที่ตรวจจริง • รีเซ็ต " + date(data.slipQuota.cycleResetDate, locale)
          : "รอข้อมูลโควตาจากทะเบียน Slip2Go"}
        accent={data?.slipQuota?.unlimited ? "tenant-control-stat-highlight" : ""}/>
      <Stat field="access-status" label="สถานะการระงับ" icon="shield-lock"
        value={suspended ? "ระงับ" : "ไม่ถูกระงับ"}
        note={effectiveStatus(tenant)} accent={suspended ? "tenant-control-stat-warning" : ""}/>
    </div>
    <LedgerNotice state={ledger} refresh={ledger.refresh} operational={operational}/>
  </section>;
}

function FinanceDetails({ ledger, locale, onReload }) {
  const data = ledger.status === "ready" ? ledger.data : null;
  const sum = ledgerTotals(data);
  const latest = data?.invoices?.length
    ? [...data.invoices].sort((a, b) =>
      String(b.issuedAtUtc || b.dueBangkokDay).localeCompare(String(a.issuedAtUtc || a.dueBangkokDay)))[0]
    : null;
  const latestIssuedDay = latest?.issuedAtUtc ? latest.issuedAtUtc.slice(0, 10) : null;
  const refresh = () => {
    ledger.refresh();
    onReload?.();
  };
  return <Section id="billing" icon="receipt-cutoff" title="Billing & Financial Status"
    subtitle="รอบบิล, Invoice และ Service Credit จากรายการบัญชีที่ตรวจรับแล้ว">
    {data ? <>
      <div className="tenant-control-billing-triptych">
        <div className="tenant-control-billing-panel" data-tenant-billing-cycle>
          <h5><i className="bi bi-calendar-range" aria-hidden="true"></i> รอบบิลปัจจุบัน</h5>
          <Data label="ระยะเวลารอบ Delivery" value={date(data.deliveryCycleStartDay,locale) + " – " + date(data.deliveryCycleEndDay,locale)}/>
          <Data label="ยอดขาย Delivery สะสม" value={money(data.deliveryCyclePaidCents,locale) + " บาท"}/>
          <Data label="เพดาน Delivery" value={money(data.deliveryThresholdCents,locale) + " บาท"}/>
          <Data label="ยอดเกินเพดาน" value={money(sum.overage,locale) + " บาท"}/>
          <Data label="ส่วนแบ่งที่คำนวณจากยอดขาย" value={money(data.deliverySharePreviewCents,locale) + " บาท (ยังไม่ใช่ยอดเรียกเก็บ)"}/>
        </div>
        <div className="tenant-control-billing-panel" data-tenant-billing-latest-invoice>
          <h5><i className="bi bi-file-earmark-text" aria-hidden="true"></i> Invoice ล่าสุด</h5>
          {latest ? <>
            <Data label="ประเภท" value={BILL_KINDS[latest.kind] || latest.kind}/>
            <Data label="เลขอ้างอิง Invoice" value={latest.invoiceKey}/>
            {latestIssuedDay ? <Data label="วันที่ออก (UTC)" value={date(latestIssuedDay,locale)}/> : null}
            <Data label="ครบกำหนด" value={date(latest.dueBangkokDay,locale)}/>
            <Data label="ยอดค้าง" value={money(latest.unpaidCents,locale) + " บาท"}/>
            <Data label="สถานะ" value={INVOICE_STATE[latest.state] || "ตรวจสอบรายการ"}/>
          </> : <p className="tenant-control-empty">ยังไม่มี Invoice ที่ออกในทะเบียนจริง</p>}
        </div>
        <div className="tenant-control-billing-panel" data-tenant-billing-credit>
          <h5><i className="bi bi-wallet2" aria-hidden="true"></i> Service Credit</h5>
          <Data label="สถานะบัญชี" value={data.creditLedgerStatus === "verified"
            ? "มีบัญชีที่ตรวจรับ" : data.creditLedgerStatus === "not_initialized"
              ? "ยังไม่มีรายการ Service Credit ที่ตรวจรับ" : "ต้องตรวจสอบรายการบัญชี"}/>
          <Data label="เครดิตคงเหลือ" value={creditLabel(data,locale)}/>
          <Data label="เครดิตที่ใช้หักแล้ว" value={money(sum.paidByCreditCents,locale) + " บาท"}/>
          <Data label="รายการเครดิตในทะเบียน" value={String(data.creditEventCount) + " รายการ"}/>
          <Data label="Invoice ค้างรวม" value={money(sum.invoiceUnpaidCents,locale) + " บาท"}/>
        </div>
      </div>
      <div className="tenant-control-invoice-heading">
        <div><h5>รายการ Invoice และ Hold จริง</h5>
          <p>{sum.invoiceCount} รายการ • รอตรวจสลิป {sum.pendingReviews} รายการ</p></div>
        <button className="btn btn-sm" type="button" onClick={refresh} data-tenant-control-refresh>
          <i className="bi bi-arrow-clockwise" aria-hidden="true"></i> รีเฟรชข้อมูล
        </button>
      </div>
      <div className="tenant-control-table-wrap">
        <table className="tenant-control-invoice-table" data-tenant-control-invoices>
          <thead><tr><th>Invoice</th><th>ครบกำหนด</th><th>ยอดเต็ม</th><th>ยอดค้าง</th><th>การชำระ</th><th>Hold</th></tr></thead>
          <tbody>
            {data.invoices.length ? [...data.invoices].sort((a, b) =>
              String(b.issuedAtUtc || b.dueBangkokDay).localeCompare(String(a.issuedAtUtc || a.dueBangkokDay)))
              .map(inv => <tr key={inv.invoiceKey} data-tenant-invoice={inv.invoiceKey}>
                <td><strong>{BILL_KINDS[inv.kind] || inv.kind}</strong>
                  <small title={inv.invoiceKey}>{inv.invoiceKey.slice(0, 12)}…</small></td>
                <td>{date(inv.dueBangkokDay,locale)}</td>
                <td>{money(inv.grossCents,locale)}</td>
                <td><strong>{money(inv.unpaidCents,locale)}</strong></td>
                <td>{INVOICE_STATE[inv.state] || "ต้องตรวจสอบ"}</td>
                <td>{inv.holdState === "open" && inv.unpaidCents > 0
                  ? <span className={"tenant-control-tag " + (inv.suspendFromBangkokDay <= data.asOfBangkokDay ? "danger" : "neutral")}>
                      {inv.suspendFromBangkokDay <= data.asOfBangkokDay ? "ครบกำหนดระงับ" : "ยังไม่ครบกำหนด"}</span>
                  : inv.holdState ? <span className="tenant-control-tag neutral">
                      {inv.holdState === "resolved" ? "ปลดแล้ว" : inv.holdState === "waived" ? "ยกเว้น" : "ตรวจสอบ Hold"}</span>
                    : <span className="tenant-control-tag neutral">ไม่มี Hold</span>}</td>
              </tr>) : <tr><td colSpan="6" className="tenant-control-empty">ยังไม่มี Invoice ที่ออก</td></tr>}
          </tbody>
        </table>
      </div>
    </> : <LedgerNotice state={ledger} refresh={ledger.refresh}/>}
  </Section>;
}

export function TenantControlPanel({
  tenant, locale = THAI_DATE, children, onReload,
  onEdit, onShare, onWallet, onReview,
  onLalamoveApproval, lalamoveApprovalBusy = false, onDelete, t,
  onTestAccessOverride, testOverrideBusy = false,
}) {
  // Every tenant starts collapsed. Financial summary loads independently when
  // its card enters (or approaches) the viewport, not when details are opened.
  const [expanded, setExpanded] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [overviewVisible, setOverviewVisible] = useState(false);
  const cardRef = useRef(null);
  useEffect(() => {
    if (overviewVisible) return undefined;
    const node = cardRef.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver !== "function") {
      setOverviewVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setOverviewVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "200px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [overviewVisible, tenant.id]);

  const ledger = useCertifiedLedger(tenant.id, overviewVisible || expanded);
  const operational = useLegacyOperationalSnapshot(tenant.id, (overviewVisible || expanded) && ledger.status !== "ready");
  const storeAccount = useSavedStoreAccount(tenant.id, expanded);
  const status = effectiveStatus(tenant);
  const suspended = status !== "ใช้งานตามสิทธิ์" &&
    status !== "ปลดระงับชั่วคราว (ทดสอบ)";
  const financeHold = tenant.m7FinanceAccessStatus === "suspended" &&
    tenant.m7FinanceAccessReason === "m7_overdue_invoice";
  const calendar = tenant.activationCalendar || {};
  const plan = tenant.planCode === "yearly" ? "รายปี"
    : tenant.planCode === "monthly" ? "รายเดือน" : "ไม่ระบุ";
  const owner = tenant.ownerDisplayName || contactEmail(tenant.ownerEmail);
  const businessType = tenant.businessType || tenant.signupBilling?.businessType;
  const registrationType = businessType === "both" ? "ร้านอาหาร / คาเฟ่ และร้านค้าปลีก"
    : businessType === "restaurant_cafe" ? "ร้านอาหาร / คาเฟ่"
      : businessType === "retail" ? "ร้านค้าปลีก" : "ยังไม่ได้ระบุในทะเบียน";
  const signupMode = tenant.billingMode === "revenue_share" ? "ส่วนแบ่งรายได้"
    : tenant.billingMode === "subscription" ? "แพ็กเกจสมาชิก"
      : "ยังไม่ได้ระบุในทะเบียน";
  const moduleAccess = useMemo(() => [
    ["Delivery", !suspended, "รับคำสั่งซื้อและบันทึกออร์เดอร์"],
    ["Takeaway", !suspended, "รับคำสั่งกลับบ้าน"],
    ["POS", !suspended, "ขายหน้าร้าน"],
    ["Kitchen", !suspended, "จัดการใบสั่งอาหาร"],
    ["Cashier", !suspended, "จัดการบิลและรับชำระ"],
    ["Reports / Invoice", true, "ยังคงเปิดให้ตรวจยอดค้างและแนบสลิปเมื่อถูกระงับ"],
  ], [suspended]);
  const refresh = useCallback(() => { ledger.refresh(); onReload?.(); }, [ledger.refresh, onReload]);

  return <article ref={cardRef} className="tenant-control-panel" data-tenant-control={tenant.id}
      data-tenant-finance-state={tenant.m7FinanceAccessStatus || "unknown"}>
    <header className="tenant-control-top">
      <div className="tenant-control-identity">
        <span className="tenant-control-avatar" aria-hidden="true"><i className="bi bi-shop-window"></i></span>
        <div><small className="tenant-control-eyebrow">รายละเอียดร้านค้า</small>
          <h3>{tenant.name || tenant.slug || "ร้านค้าไม่มีชื่อ"}</h3>
          <span className="tenant-control-slug">/{tenant.slug}</span></div>
      </div>
      <div className="tenant-control-head-actions">
        <span className={"tenant-control-state " + (suspended ? "suspended" : "active")}
          data-tenant-effective-status={tenant.id}>
          <i className={"bi bi-" + (suspended ? "shield-lock" : "check-circle")} aria-hidden="true"></i>{status}
        </span>
        <button type="button" className="tenant-control-expand-btn" aria-expanded={expanded}
          aria-controls={"tenant-details-" + tenant.id}
          onClick={() => setExpanded(value => !value)}>
          {expanded ? "ย่อรายละเอียด" : "ดูข้อมูลร้านทั้งหมด"}
          <i className={"bi bi-chevron-" + (expanded ? "up" : "down")} aria-hidden="true"></i>
        </button>
      </div>
    </header>
    <div className="tenant-control-top-metadata">
      <span><i className="bi bi-person" aria-hidden="true"></i>{owner}</span>
      <span><i className="bi bi-telephone" aria-hidden="true"></i>{tenant.shopPhone || "ไม่มีเบอร์โทร"}</span>
      <span><i className="bi bi-credit-card" aria-hidden="true"></i>{plan}</span>
    </div>
    {suspended ? <div className="tenant-control-alert" role="status"
      data-tenant-m7-invoice-hold={financeHold ? tenant.id : undefined}>
      <i className="bi bi-exclamation-triangle" aria-hidden="true"></i>
      <div><strong>{status}</strong><p>{financeHold
        ? "Invoice ครบกำหนด " + (Number(tenant.m7MaturedInvoiceHolds) || 0) +
          " รายการ ยอดค้างตามรายการที่ระงับ " + money(tenant.m7InvoiceUnpaidCents,locale) +
          " บาท • ระบบปลดระงับเมื่อรับชำระครบและตรวจสลิปผ่าน"
        : "ต้องตรวจสอบสถานะและสิทธิ์ของร้านจากระบบกลาง"}</p></div>
    </div> : null}
    <SummaryCards tenant={tenant} ledger={ledger} operational={operational} locale={locale} suspended={suspended}/>
    {expanded ? <div className="tenant-control-body" id={"tenant-details-" + tenant.id}>
      <FinanceDetails ledger={ledger} locale={locale} onReload={onReload}/>
      <Section id="m7-source" icon="shield-exclamation" title="M7 / หลักฐานแหล่งข้อมูลการเงิน"
        subtitle="Firebase ยังไม่มีทะเบียน SQL M7 ที่ตรวจรับรองพร้อมใช้ชำระเงินจริง">
        <p role="status" className="tenant-control-ledger-notice">
          ไม่แสดง Invoice, Service Credit หรือ COD Reconciliation จากข้อมูลที่ยังไม่ยืนยัน
          และไม่เปิดปุ่มอนุมัติการเงินจนกว่าจะมี Firebase Backend ที่ตรวจรับรองได้
        </p>
      </Section>
      <Section id="access" icon="shield-check" title="Module Access Status"
        subtitle="แสดงสิทธิ์ตามสถานะการระงับจากระบบกลาง ไม่ใช่ผลทดสอบหน้าเว็บรายโมดูล">
        <div className="tenant-control-modules">
          {moduleAccess.map(([module, allowed, note]) => <div className="tenant-control-module" key={module}>
            <div><strong>{module}</strong><small>{note}</small></div>
            <span className={"tenant-control-tag " + (allowed ? "success" : "danger")}>
              <i className={"bi bi-" + (allowed ? "check-circle" : "lock")} aria-hidden="true"></i>
              {allowed ? "เข้าถึงได้" : "ระงับ"}
            </span>
          </div>)}
        </div>
      </Section>
      <Section id="registration" icon="building" title="ข้อมูลร้านค้า / การสมัคร / บัญชีรับเงิน"
        subtitle="ข้อมูลของร้านจากทะเบียนสมาชิกและการตั้งค่าร้านเดิม โดยไม่เติมข้อมูลสมมุติ">
        <div className="tenant-control-profile-grid">
          <div className="tenant-control-profile-card" data-tenant-profile="store">
            <h5><i className="bi bi-shop" aria-hidden="true"></i> ข้อมูลร้านและเจ้าของ</h5>
            <dl>
              <Data label="ชื่อร้าน" value={tenant.name}/>
              <Data label="รหัส Tenant" value={tenant.id}/>
              <Data label="ชื่อเจ้าของ" value={owner}/>
              <Data label="เบอร์โทร" value={tenant.shopPhone}/>
              <Data label="อีเมล" value={contactEmail(tenant.ownerEmail)}/>
              <Data label="ที่อยู่" value={tenant.shopAddress}/>
              <Data label="ประเภทธุรกิจ" value={registrationType}/>
            </dl>
          </div>
          <div className="tenant-control-profile-card" data-tenant-profile="membership">
            <h5><i className="bi bi-calendar-check" aria-hidden="true"></i> สมาชิกและรอบบิล</h5>
            <dl>
              <Data label="แพ็กเกจ" value={plan}/>
              <Data label="รูปแบบการคิดค่าบริการ" value={signupMode}/>
              <Data label="สถานะสมาชิก" value={tenant.subscriptionStatus === "active" ? "ใช้งาน"
                : tenant.subscriptionStatus === "suspended" ? "ระงับสมาชิก"
                  : tenant.subscriptionStatus || "ไม่ระบุ"}/>
              <Data label="เริ่มใช้งาน" value={date(calendar.firstActivatedOn || tenant.firstActivatedOn,locale)}/>
              <Data label="รอบถัดไป" value={date(calendar.nextResetDay || tenant.nextResetDay,locale)}/>
              <Data label="สถานะการเงิน" value={status}/>
            </dl>
          </div>
          <div className="tenant-control-profile-card" data-tenant-profile="payment">
            <h5><i className="bi bi-bank" aria-hidden="true"></i> บัญชีรับชำระของร้าน</h5>
            {storeAccount.status === "loading" || storeAccount.status === "idle"
              ? <p className="tenant-control-account-note">กำลังอ่านข้อมูลบัญชีจากการตั้งค่าร้าน…</p>
              : storeAccount.status !== "ready"
                ? <p className="tenant-control-account-note" role="alert">
                    อ่านข้อมูลบัญชีจากระบบเดิมไม่สำเร็จ กรุณารีเฟรชข้อมูล</p>
                : <>
                  <dl>
                    <Data label="ธนาคาร" value={storeAccount.account.bankName || "ร้านยังไม่ได้ตั้งค่า"}/>
                    <Data label="ชื่อบัญชี" value={storeAccount.account.bankAccountName || "ร้านยังไม่ได้ตั้งค่า"}/>
                    <Data label="เลขบัญชี (ปกปิด)" value={storeAccount.account.bankAccountMasked || "ร้านยังไม่ได้ตั้งค่า"}/>
                    <Data label="พร้อมเพย์ (ปกปิด)" value={storeAccount.account.promptPayMasked || "ร้านยังไม่ได้ตั้งค่า"}/>
                    <Data label="ชื่อบัญชีพร้อมเพย์" value={storeAccount.account.promptPayName || "ร้านยังไม่ได้ตั้งค่า"}/>
                    <Data label="รับเงิน Delivery ผ่านพร้อมเพย์" value={storeAccount.account.deliveryPromptPayEnabled ? "เปิดใช้งาน" : "ไม่ได้เปิดใช้งาน"}/>
                  </dl>
                  <p className="tenant-control-account-note">
                    {storeAccount.account.bankConfigured || storeAccount.account.promptPayConfigured
                      ? "ข้อมูลที่ร้านบันทึกไว้ในตั้งค่าร้าน • ยังไม่ใช่การตรวจยืนยันเจ้าของบัญชี"
                      : "ร้านยังไม่ได้บันทึกบัญชีรับชำระในตั้งค่าร้าน"}
                  </p>
                </>}
            <div className="tenant-control-account-secondary">
              <Data label="Lalamove" value={tenant.lalamove?.accountMode === "fod_central" ? "บัญชีกลาง"
                : tenant.lalamove?.accountMode === "merchant" ? "บัญชีร้านค้า" : "ยังไม่ได้เชื่อมต่อ"}/>
              <Data label="Wallet Lalamove" value={tenant.lalamoveWallet?.storageReady
                ? new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(tenant.lalamoveWallet.balance) + " บาท"
                : "ยังไม่มีข้อมูล Wallet"}/>
            </div>
          </div>
        </div>
      </Section>
      <Section id="actions" icon="tools" title="Admin Actions"
        subtitle="การรีเฟรชไม่เปลี่ยนสิทธิ์ร้าน • Switch สำหรับ Super Admin บน Localhost ไม่เปลี่ยน Invoice หรือยอดหนี้">
        {tenant.m7AdminTestOverrideAvailable === true ? (
          <div className="tenant-admin-test-override" data-tenant-admin-test-access={tenant.id}>
            <div className="tenant-admin-test-override-top">
              <div>
                <h5><i className="bi bi-toggle-on" aria-hidden="true"></i>
                  สวิตช์ระงับ / ปลดระงับชั่วคราว</h5>
                <p>เฉพาะการทดสอบบน Localhost • เปิดสิทธิ์ข้ามเฉพาะ Invoice Hold
                  ไม่ข้ามการระงับด้านความปลอดภัยหรือสิทธิ์สมาชิก</p>
                <span className="tenant-admin-test-current" data-tenant-admin-test-mode={tenant.m7AdminTestOverrideMode || "auto"}>
                  {tenant.m7AdminTestOverrideMode === "allow" ? "กำลังปลดระงับชั่วคราว" :
                    tenant.m7AdminTestOverrideMode === "suspend" ? "กำลังระงับชั่วคราว" :
                    "ระบบตรวจสิทธิ์อัตโนมัติตามปกติ"}
                </span>
              </div>
              <div className="tenant-admin-test-override-controls">
                <span className={suspended ? "locked" : "unlocked"}>
                  {suspended ? "ระงับ" : "ปลดระงับ"}</span>
                <button type="button" role="switch" aria-checked={!suspended}
                  aria-label={"สลับการระงับร้าน " + tenant.name}
                  data-tenant-admin-switch={tenant.id}
                  className={"tenant-admin-test-switch" + (!suspended ? " checked" : "")}
                  disabled={testOverrideBusy}
                  onClick={() => onTestAccessOverride?.(suspended ? "allow" : "suspend")}>
                  <span aria-hidden="true"></span>
                </button>
                <button type="button" className="btn btn-sm tenant-admin-test-restore"
                  data-tenant-admin-restore={tenant.id}
                  disabled={testOverrideBusy || tenant.m7AdminTestOverrideMode === "auto"}
                  onClick={() => onTestAccessOverride?.("auto")}>
                  <i className="bi bi-arrow-counterclockwise" aria-hidden="true"></i>
                  คืนสู่การตรวจสิทธิ์ปกติ
                </button>
              </div>
            </div>
            {tenant.m7AdminTestOverrideMode !== "auto" ? (
              <p className="tenant-admin-test-expiry">
                {tenant.m7AdminTestOverrideExpiresAt
                  ? "สิทธิ์ทดสอบสิ้นสุดอัตโนมัติ: " +
                    new Intl.DateTimeFormat("th-TH",{dateStyle:"short",timeStyle:"short",
                      timeZone:"Asia/Bangkok"}).format(new Date(tenant.m7AdminTestOverrideExpiresAt))
                  : "กรุณารีเฟรชเพื่อตรวจสอบเวลาสิ้นสุด"}
                {" • บัญชีและสถานะ Invoice ไม่เปลี่ยน"}
              </p>) : null}
          </div>
        ) : null}
        <div className="tenant-control-primary-actions">
          <a className="btn btn-sm" href={"/s/" + encodeURIComponent(tenant.slug || "") + "/delivery"}
            target="_blank" rel="noopener noreferrer">
            <i className="bi bi-box-arrow-up-right" aria-hidden="true"></i> เปิดหน้าร้าน
          </a>
          <button className="btn btn-sm" type="button" onClick={() => onEdit?.(tenant)}>
            <i className="bi bi-pencil-square" aria-hidden="true"></i> แก้ไขร้าน
          </button>
          <button className="btn btn-sm" type="button" onClick={() => onReview?.(tenant)}>
            <i className="bi bi-file-earmark-check" aria-hidden="true"></i> ตรวจสลิป
          </button>
          <button className="btn btn-sm" type="button" onClick={refresh} data-tenant-admin-refresh>
            <i className="bi bi-arrow-clockwise" aria-hidden="true"></i> รีเฟรชข้อมูล
          </button>
          <button className="btn btn-sm" type="button" onClick={() => onWallet?.(tenant)}>
            <i className="bi bi-wallet2" aria-hidden="true"></i> Lalamove Wallet
          </button>
          <button className="btn btn-sm" type="button" onClick={() => onShare?.(tenant)}>
            <i className="bi bi-percent" aria-hidden="true"></i> ตั้งค่าส่วนแบ่ง
          </button>
          {tenant.lalamove?.accountMode === "fod_central" ? (
            <button className="btn btn-sm" type="button" data-lalamove-approval={tenant.id}
              disabled={lalamoveApprovalBusy} aria-busy={lalamoveApprovalBusy ? "true" : "false"}
              onClick={() => onLalamoveApproval?.(tenant)}>
              <i className={`bi ${tenant.lalamove?.fodCentralApproved ? "bi-shield-x" : "bi-shield-check"}`}
                aria-hidden="true"></i>
              <span>{t(tenant.lalamove?.fodCentralApproved
                ? "admin_tenants.tenant.lalamove_revoke" : "admin_tenants.tenant.lalamove_approve")}</span>
            </button>
          ) : null}
          <button className="btn btn-danger btn-sm" type="button" data-tenant-delete={tenant.id}
            onClick={() => onDelete?.(tenant)}>
            <i className="bi bi-trash3" aria-hidden="true"></i>
            <span>{t("admin_tenants.tenant.delete")}</span>
          </button>
        </div>
        {children ? <details className="tenant-control-tools" open={showTools}
          onToggle={event => setShowTools(event.currentTarget.open)}
          data-tenant-advanced-tools={tenant.id}>
          <summary><span><i className="bi bi-sliders" aria-hidden="true"></i>
            <strong>ต่ออายุ / จัดการสิทธิ์ / เครื่องมือขั้นสูง</strong>
            <small>ดำเนินการกับข้อมูลจริงเฉพาะเมื่อผู้ดูแลเลือกคำสั่ง</small></span>
            <i className="bi bi-chevron-down" aria-hidden="true"></i>
          </summary>
          {showTools ? <>
            <div className="tenant-control-advanced-body"
              data-tenant-advanced-actions={tenant.id}>
              {children}
            </div>
          </> : null}
        </details> : null}
      </Section>
    </div> : null}
  </article>;
}
