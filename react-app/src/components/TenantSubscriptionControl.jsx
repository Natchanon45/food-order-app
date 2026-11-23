import {useEffect,useState} from "react";
import {sourceSnapshot} from "@/data/tenantSubscriptionRecovery.mjs";
import "@/ui/tenant-subscription-control.css";

// Source TenantSubscription counterpart; Firebase state is never considered
// verified until server operation and canonical tenant both agree.
function tenantDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateInputValue(value) {
  const date = tenantDate(value);
  if (!date) return "";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit",
    day: "2-digit",
  }).formatToParts(date).filter(part => part.type !== "literal")
    .map(part => [part.type, part.value]));
  return [parts.year, parts.month, parts.day].join("-");
}

function subscriptionDisplayDate(value, intlLocale, fallback) {
  const date = tenantDate(value);
  return date
    ? new Intl.DateTimeFormat(intlLocale, { year: "numeric", month: "short", day: "numeric" }).format(date)
    : fallback;
}

function subscriptionStatusText(tenant, t, namespace = "statuses") {
  const status = tenant.subscriptionStatus || (tenant.active === false ? "inactive" : "active");
  const key = `admin_tenants.subscription.${namespace}.${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

export function TenantSubscriptionControl({
  tenant, t, intlLocale, onAction, writeUnconfirmed = false,
  checking = false, onCheck,
}) {
  const [expiresAt, setExpiresAt] = useState(() => dateInputValue(tenant.subscriptionExpiresAt));
  const [gracePeriodDays, setGracePeriodDays] = useState(() => String(tenant.gracePeriodDays ?? 3));
  const [planCode, setPlanCode] = useState(() => tenant.planCode === "yearly" ? "yearly" : "monthly");
  const [busyAction, setBusyAction] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    setValidationError("");
    setExpiresAt(dateInputValue(tenant.subscriptionExpiresAt));
    setGracePeriodDays(String(tenant.gracePeriodDays ?? 3));
    setPlanCode(tenant.planCode === "yearly" ? "yearly" : "monthly");
  }, [tenant.subscriptionExpiresAt, tenant.gracePeriodDays, tenant.planCode]);

  const expiry = tenantDate(tenant.subscriptionExpiresAt);
  const remaining = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86400000) : null;
  const status = tenant.subscriptionStatus || "active";
  const statusLabel = subscriptionStatusText(tenant, t);
  const planLabel = t(`admin_tenants.subscription.plans.${planCode}`);
  const remainingLabel = remaining === null
    ? "-"
    : remaining >= 0
      ? t("admin_tenants.subscription.days", { count: remaining })
      : t("admin_tenants.subscription.days_over", { count: Math.abs(remaining) });

  const run = async (action, days = 0) => {
    if (busyAction || writeUnconfirmed) return;
    setValidationError("");
    const grace = String(gracePeriodDays).trim();
    if (!/^(?:0|[1-9][0-9]?)$/.test(grace) || Number(grace) > 30) {
      setValidationError("จำนวนวันผ่อนผันต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึง 30");
      return;
    }
    if (action === "set-expiry") {
      const validDate = /^\d{4}-\d{2}-\d{2}$/.test(expiresAt) &&
        !Number.isNaN(Date.parse(expiresAt)) &&
        new Date(expiresAt).toISOString().slice(0, 10) === expiresAt;
      if (!validDate) {
        setValidationError("กรุณาเลือกวันที่หมดอายุที่ถูกต้องก่อนบันทึก");
        return;
      }
    }
    const token = action + ":" + days;
    setBusyAction(token);
    try {
      await onAction(tenant, {
        tenantId: tenant.id, action, days, expiresAt,
        planCode, gracePeriodDays: Number(grace),
        ...sourceSnapshot(tenant),
      });
    } catch {
      // The parent owns uncertain-write state and error toast.
    } finally {
      setBusyAction("");
    }
  };

  if (tenant.onboardingRequired === true || !tenant.ownerUid) {
    return <details className="tenant-subscription"
      data-subscription-tenant={tenant.id} data-subscription-onboarding-pending={tenant.id}>
      <summary><span><i className="bi bi-shield-lock" aria-hidden="true"></i>
        <strong>รอเปิดใช้งานร้าน</strong></span></summary>
      <div className="tenant-subscription-body" role="status">
        ร้านยังไม่มีข้อมูลเปิดใช้งานครั้งแรกและ Owner ครบถ้วน
        ไม่สามารถต่อสมาชิกหรือปลดระงับจากหน้านี้ได้
      </div>
    </details>;
  }

  return (
    <details className="tenant-subscription" data-subscription-tenant={tenant.id}>
      <summary>
        <span><i className="bi bi-credit-card-2-front" aria-hidden="true"></i><strong>{t("admin_tenants.subscription.title")}</strong></span>
        <span className="tenant-subscription-summary">{statusLabel} · {subscriptionDisplayDate(tenant.subscriptionExpiresAt, intlLocale, t("admin_tenants.subscription.not_set"))}<i className="bi bi-chevron-down" aria-hidden="true"></i></span>
      </summary>
      <div className="tenant-subscription-body">
        {writeUnconfirmed ? <div className="tenant-subscription-recovery" role="alert"
          data-subscription-pending={tenant.id}>
          <i className="bi bi-shield-exclamation" aria-hidden="true"></i>
          <span>ยังยืนยันผลการบันทึกครั้งก่อนจาก Firebase ไม่ได้ ห้ามทำรายการสมาชิกซ้ำ</span>
          <button type="button" className="btn btn-sm"
            data-reconcile-subscription={tenant.id}
            disabled={checking || Boolean(busyAction)} onClick={() => onCheck?.(tenant)}>
            <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>
            {checking ? "กำลังตรวจสอบ…" : "ตรวจสถานะคำสั่งเดิม"}
          </button>
        </div> : null}
        {validationError ? <p className="tenant-subscription-validation" role="alert"
          data-subscription-validation>{validationError}</p> : null}
        {!tenant.subscriptionExpiresAt ? <p role="status" data-subscription-no-expiry>
          ยังไม่มีวันหมดอายุสมาชิกที่ตรวจสอบได้ ไม่ใช้วันที่เปิดหน้าจอแทนวันเริ่มสมาชิกเดิม
        </p> : null}
        <div className="tenant-subscription-info">
          <article><span>{t("admin_tenants.subscription.package")}</span><strong>{planLabel}</strong></article>
          <article><span>{t("admin_tenants.subscription.status")}</span><strong>{statusLabel}</strong></article>
          <article><span>{t("admin_tenants.subscription.remaining")}</span><strong>{remainingLabel}</strong></article>
        </div>
        <div className="tenant-subscription-fields">
          <label>{t("admin_tenants.subscription.expiry")}<input className="input" type="date" data-expiry-date value={expiresAt}
            disabled={Boolean(busyAction) || writeUnconfirmed}
            onChange={event => { setExpiresAt(event.target.value); setValidationError(""); }} /></label>
          <label>{t("admin_tenants.subscription.grace_days")}<input className="input" type="number" min="0" max="30" data-grace-days
            value={gracePeriodDays} disabled={Boolean(busyAction) || writeUnconfirmed}
            onChange={event => { setGracePeriodDays(event.target.value); setValidationError(""); }} /></label>
          <label>{t("admin_tenants.subscription.plan")}<select className="input" data-plan-code value={planCode} disabled
            title="การเปลี่ยนแพ็กเกจต้องตรวจสอบ Billing และเงื่อนไขราคาต้นฉบับก่อน"
            onChange={event => setPlanCode(event.target.value)}><option value="monthly">{t("admin_tenants.subscription.plans.monthly")}</option><option value="yearly">{t("admin_tenants.subscription.plans.yearly")}</option></select></label>
        </div>
        <p className="tenant-subscription-policy-note" role="note">
          การเปลี่ยนแพ็กเกจหรือปลด Hold ทางการเงินต้องผ่านขั้นตอนตรวจสอบแยกต่างหาก
          คำสั่งนี้ปรับเฉพาะสมาชิก ไม่ออก Invoice หรือถือว่ายืนยันรับชำระเงิน
        </p>
        <div className="tenant-subscription-actions">
          <button className="btn btn-primary btn-sm" type="button" data-subscription-action="extend" data-days="30" disabled={Boolean(busyAction) || writeUnconfirmed} onClick={() => run("extend", 30)}><i className="bi bi-calendar-plus" aria-hidden="true"></i><span>{t("admin_tenants.subscription.extend_30")}</span></button>
          <button className="btn btn-primary btn-sm" type="button" data-subscription-action="extend" data-days="365" disabled={Boolean(busyAction) || writeUnconfirmed} onClick={() => run("extend", 365)}><i className="bi bi-calendar2-plus" aria-hidden="true"></i><span>{t("admin_tenants.subscription.extend_year")}</span></button>
          <button className="btn btn-sm" type="button" data-subscription-action="set-expiry" disabled={Boolean(busyAction) || writeUnconfirmed} onClick={() => run("set-expiry")}><i className="bi bi-floppy" aria-hidden="true"></i><span>{t("admin_tenants.subscription.save_expiry")}</span></button>
          {status === "suspended"
            ? <button className="btn btn-primary btn-sm" type="button" data-subscription-action="activate" disabled={Boolean(busyAction) || writeUnconfirmed} onClick={() => run("activate")}><i className="bi bi-check-circle" aria-hidden="true"></i><span>{t("admin_tenants.subscription.activate")}</span></button>
            : <button className="btn btn-danger btn-sm" type="button" data-subscription-action="suspend" disabled={Boolean(busyAction) || writeUnconfirmed} onClick={() => run("suspend")}><i className="bi bi-pause-circle" aria-hidden="true"></i><span>{t("admin_tenants.subscription.suspend")}</span></button>}
        </div>
      </div>
    </details>
  );
}
