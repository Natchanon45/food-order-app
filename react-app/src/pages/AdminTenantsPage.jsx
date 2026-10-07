import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { useAuth } from "@/auth/AuthProvider";
import { storage } from "@/firebase/client";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { ParityFooter } from "@/components/ParityFooter";
import { UserMenu } from "@/components/UserMenu";
import { sweetConfirm, sweetPrompt } from "@/components/sweetDialog";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { EMPTY_PLATFORM_ADMIN_NOTIFICATIONS, loadPlatformAdminNotificationSummary } from "@/data/platformAdminNotifications";
import {
  backfillTenantSubscriptions,
  createTenant,
  deleteTenant,
  getPlatformRevenueShareSummary,
  getTenantLalamoveWallet,
  listPlatformRevenueSharePayments,
  listTenants,
  reconcileRevenueShare,
  reviewRevenueSharePayment,
  reviewTenantLalamoveWalletTopup,
  unlockTenantRevenueShare,
  updateTenant,
  updateTenantLalamoveApproval,
  updateTenantRevenueShare,
  updateTenantSubscription,
} from "@/data/platformTenantService";

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const monthKey = () => todayKey().slice(0, 7);

function dateFromKey(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function displayDateKey(value, intlLocale) {
  const date = dateFromKey(value);
  return date
    ? new Intl.DateTimeFormat(intlLocale, { year: "numeric", month: "short", day: "numeric" }).format(date)
    : (String(value || "").trim() || "-");
}

function displayMonthKey(value, intlLocale) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return String(value || "").trim() || "-";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return new Intl.DateTimeFormat(intlLocale, { year: "numeric", month: "long" }).format(date);
}

function localizedPeriodLabel(type, values, t, intlLocale) {
  if (type === "monthly") {
    return t("admin_tenants.report.labels.monthly", { month: displayMonthKey(values.month, intlLocale) });
  }
  if (type === "yearly") {
    return t("admin_tenants.report.labels.yearly", { year: String(values.year || "").trim() || "-" });
  }
  if (type === "custom") {
    return t("admin_tenants.report.labels.custom", {
      start: displayDateKey(values.startDate, intlLocale),
      end: displayDateKey(values.endDate, intlLocale),
    });
  }
  return t("admin_tenants.report.labels.daily", { date: displayDateKey(values.date, intlLocale) });
}

const sanitizeSlug = value => String(value || "").toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-+/g, "");
const normalizeSlug = value => sanitizeSlug(value).replace(/-+$/g, "");

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

function syncTenantModalBody() {
  const hasOpenDialog = Boolean(document.querySelector("dialog.tenant-dialog[open]"));
  document.body.classList.toggle("tenant-modal-open", hasOpenDialog);
}

function showTenantDialog(dialog) {
  if (!dialog) return;
  if (!dialog.open && typeof dialog.showModal === "function") dialog.showModal();
  else if (!dialog.open) dialog.setAttribute("open", "");
  document.body.classList.add("tenant-modal-open");
}

function closeTenantDialog(dialog) {
  if (!dialog) return;
  if (dialog.open && typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
  syncTenantModalBody();
}

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
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
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

function TenantSubscription({ tenant, t, intlLocale, onAction }) {
  const [expiresAt, setExpiresAt] = useState(() => dateInputValue(tenant.subscriptionExpiresAt));
  const [gracePeriodDays, setGracePeriodDays] = useState(() => String(tenant.gracePeriodDays ?? 3));
  const [planCode, setPlanCode] = useState(() => tenant.planCode === "yearly" ? "yearly" : "monthly");
  const [busyAction, setBusyAction] = useState("");

  useEffect(() => {
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
    const token = `${action}:${days}`;
    setBusyAction(token);
    try {
      await onAction(tenant, {
        tenantId: tenant.id,
        action,
        days,
        expiresAt,
        gracePeriodDays: Number(gracePeriodDays || 3),
        planCode,
      });
    } finally {
      setBusyAction("");
    }
  };

  return (
    <details className="tenant-subscription" data-subscription-tenant={tenant.id}>
      <summary>
        <span><i className="bi bi-credit-card-2-front" aria-hidden="true"></i><strong>{t("admin_tenants.subscription.title")}</strong></span>
        <span className="tenant-subscription-summary">{statusLabel} · {subscriptionDisplayDate(tenant.subscriptionExpiresAt, intlLocale, t("admin_tenants.subscription.not_set"))}<i className="bi bi-chevron-down" aria-hidden="true"></i></span>
      </summary>
      <div className="tenant-subscription-body">
        <div className="tenant-subscription-info">
          <article><span>{t("admin_tenants.subscription.package")}</span><strong>{planLabel}</strong></article>
          <article><span>{t("admin_tenants.subscription.status")}</span><strong>{statusLabel}</strong></article>
          <article><span>{t("admin_tenants.subscription.remaining")}</span><strong>{remainingLabel}</strong></article>
        </div>
        <div className="tenant-subscription-fields">
          <label>{t("admin_tenants.subscription.expiry")}<input className="input" type="date" data-expiry-date value={expiresAt} onChange={event => setExpiresAt(event.target.value)} /></label>
          <label>{t("admin_tenants.subscription.grace_days")}<input className="input" type="number" min="0" max="30" data-grace-days value={gracePeriodDays} onChange={event => setGracePeriodDays(event.target.value)} /></label>
          <label>{t("admin_tenants.subscription.plan")}<select className="input" data-plan-code value={planCode} onChange={event => setPlanCode(event.target.value)}><option value="monthly">{t("admin_tenants.subscription.plans.monthly")}</option><option value="yearly">{t("admin_tenants.subscription.plans.yearly")}</option></select></label>
        </div>
        <div className="tenant-subscription-actions">
          <button className="btn btn-primary btn-sm" type="button" data-subscription-action="extend" data-days="30" disabled={busyAction === "extend:30"} onClick={() => run("extend", 30)}><i className="bi bi-calendar-plus" aria-hidden="true"></i><span>{t("admin_tenants.subscription.extend_30")}</span></button>
          <button className="btn btn-primary btn-sm" type="button" data-subscription-action="extend" data-days="365" disabled={busyAction === "extend:365"} onClick={() => run("extend", 365)}><i className="bi bi-calendar2-plus" aria-hidden="true"></i><span>{t("admin_tenants.subscription.extend_year")}</span></button>
          <button className="btn btn-sm" type="button" data-subscription-action="set-expiry" disabled={busyAction === "set-expiry:0"} onClick={() => run("set-expiry")}><i className="bi bi-floppy" aria-hidden="true"></i><span>{t("admin_tenants.subscription.save_expiry")}</span></button>
          {status === "suspended"
            ? <button className="btn btn-primary btn-sm" type="button" data-subscription-action="activate" disabled={busyAction === "activate:0"} onClick={() => run("activate")}><i className="bi bi-check-circle" aria-hidden="true"></i><span>{t("admin_tenants.subscription.activate")}</span></button>
            : <button className="btn btn-danger btn-sm" type="button" data-subscription-action="suspend" disabled={busyAction === "suspend:0"} onClick={() => run("suspend")}><i className="bi bi-pause-circle" aria-hidden="true"></i><span>{t("admin_tenants.subscription.suspend")}</span></button>}
        </div>
      </div>
    </details>
  );
}

function TenantCard({ tenant, summary = {}, notifications = {}, t, formatNumber, intlLocale, onEdit, onShare, onRevenueNotice, onUnlock, onLalamoveApproval, lalamoveApprovalBusy = false, onWallet, onDelete, onSubscriptionAction }) {
  const active = tenant.active !== false;
  const shareEnabled = tenant.billingMode === "revenue_share" || summary.revenueShareEnabled === true;
  const ownerLabel = tenant.ownerUid
    ? (tenant.ownerDisplayName || tenant.ownerEmail || t("admin_tenants.tenant.owner_exists"))
    : t("admin_tenants.tenant.owner_missing");
  const statusLabel = shareEnabled && tenant.accessStatus === "revenue_share_suspended"
    ? t("admin_tenants.tenant.revenue_share_suspended")
    : (active ? t("admin_tenants.tenant.active") : t("admin_tenants.tenant.inactive"));
  const money = value => formatNumber(Number(value || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const walletNotificationCount = Number(notifications.wallet || 0);
  const revenueNotificationCount = Number(notifications.revenueShare || 0);
  const notificationTotal = walletNotificationCount + revenueNotificationCount;

  return (
    <article className="tenant-store-card" data-tenant-card={tenant.id} data-billing-mode={shareEnabled ? "revenue_share" : "subscription"}>
      <header className="tenant-store-head">
        <div className="tenant-store-title">
          <span className="tenant-store-mark">{String(tenant.name || t("admin_tenants.tenant.fallback_mark")).trim().slice(0, 1).toUpperCase()}</span>
          <div>
            <h3>{tenant.name || t("admin_tenants.tenant.fallback_name")}</h3>
            <a href={`/s/${encodeURIComponent(tenant.slug || "")}/delivery`} target="_blank" rel="noopener noreferrer">/{tenant.slug || "-"}</a>
          </div>
        </div>
        <span className={`tenant-status-pill ${active ? "active" : "inactive"}`}>{statusLabel}</span>
      </header>

      {notificationTotal > 0 ? (
        <div className="tenant-card-notifications" aria-label={t("admin_tenants.notifications.tenant_aria", { count: formatNumber(notificationTotal) })}>
          {revenueNotificationCount > 0 ? (
            <button className="tenant-notification-chip revenue" type="button" data-tenant-revenue-notification={tenant.id} onClick={() => onRevenueNotice(tenant)}>
              <i className="bi bi-receipt-cutoff" aria-hidden="true"></i><span>{t("admin_tenants.notifications.revenue_share", { count: formatNumber(revenueNotificationCount) })}</span><b>{formatNumber(revenueNotificationCount)}</b>
            </button>
          ) : null}
          {walletNotificationCount > 0 ? (
            <button className="tenant-notification-chip wallet" type="button" data-tenant-wallet-notification={tenant.id} onClick={() => onWallet(tenant)}>
              <i className="bi bi-wallet2" aria-hidden="true"></i><span>{t("admin_tenants.notifications.wallet", { count: formatNumber(walletNotificationCount) })}</span><b>{formatNumber(walletNotificationCount)}</b>
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="tenant-meta-row">
        <span><i className="bi bi-person-badge" aria-hidden="true"></i>{ownerLabel}</span>
        {shareEnabled
          ? <span className="tenant-billing-mode revenue-share"><i className="bi bi-percent" aria-hidden="true"></i>{t("admin_tenants.tenant.revenue_share_mode", { cycle: t(`admin_tenants.share.billing_cycles.${summary.revenueShareBillingCycle === "daily" ? "daily" : "monthly"}`) })}</span>
          : <span><i className="bi bi-calendar-check" aria-hidden="true"></i>{subscriptionStatusText(tenant, t, "member_statuses")} · {t("admin_tenants.tenant.expires", { date: subscriptionDisplayDate(tenant.subscriptionExpiresAt, intlLocale, "-") })}</span>}
      </div>

      <div className="tenant-sales-grid">
        <article><span>{t("admin_tenants.sales.order")}</span><strong>{money(summary.orderSales)}</strong><small>{t("admin_tenants.common.items", { count: formatNumber(summary.orderCount || 0) })}</small></article>
        <article><span>{t("admin_tenants.sales.pos")}</span><strong>{money(summary.posSales)}</strong><small>{t("admin_tenants.common.receipts", { count: formatNumber(summary.posCount || 0) })}</small></article>
        <article className="total"><span>{t("admin_tenants.sales.combined")}</span><strong>{money(summary.combinedSales)}</strong><small>{t("admin_tenants.common.baht")}</small></article>
        <article className="share"><span>{shareEnabled ? t("admin_tenants.sales.share_rate", { rate: `${money(summary.revenueShareRate)}%` }) : t("admin_tenants.sales.share_disabled")}</span><strong>{money(summary.revenueShare)}</strong><small>{t("admin_tenants.common.baht")}</small></article>
        <article className="delivery-customer"><span>{t("admin_tenants.sales.customer_delivery_fees")}</span><strong>{money(summary.customerDeliveryFees)}</strong><small>{t("admin_tenants.common.baht")}</small></article>
        <article className="delivery-cost"><span>{t("admin_tenants.sales.lalamove_delivery_cost")}</span><strong>{money(summary.lalamoveDeliveryCost)}</strong><small>{t("admin_tenants.common.baht")}</small></article>
        <article className="subsidy"><span>{t("admin_tenants.sales.delivery_subsidy")}</span><strong>{money(summary.deliverySubsidy)}</strong><small>{t("admin_tenants.common.baht")}</small></article>
        <article className="amount-due"><span>{t("admin_tenants.sales.platform_amount_due")}</span><strong>{money(summary.platformAmountDue)}</strong><small>{t("admin_tenants.common.baht")}</small></article>
      </div>

      <div className="tenant-store-details">
        <span title={tenant.id}><strong>{t("admin_tenants.tenant.id")}</strong>{tenant.id}</span>
        {tenant.shopPhone ? <span><strong>{t("admin_tenants.tenant.phone")}</strong>{tenant.shopPhone}</span> : null}
        {tenant.shopAddress ? <span><strong>{t("admin_tenants.tenant.address")}</strong>{tenant.shopAddress}</span> : null}
        <span>
          <strong>{t("admin_tenants.tenant.lalamove_account")}</strong>
          {t(`admin_tenants.tenant.lalamove_modes.${tenant.lalamove?.accountMode || "disabled"}`)}
          {tenant.lalamove?.accountMode === "fod_central"
            ? ` · ${t(tenant.lalamove?.fodCentralApproved ? "admin_tenants.tenant.lalamove_approved" : "admin_tenants.tenant.lalamove_waiting")}`
            : ""}
        </span>
        <span><strong>{t("admin_tenants.wallet.label")}</strong>{money(tenant.lalamoveWallet?.balance || 0)} {t("admin_tenants.wallet.credit_unit")}</span>
      </div>

      <div className="tenant-card-actions">
        <a className="btn btn-dark btn-sm" href={`/s/${encodeURIComponent(tenant.slug || "")}/delivery`} target="_blank" rel="noopener noreferrer">
          <i className="bi bi-box-arrow-up-right" aria-hidden="true"></i><span>{t("admin_tenants.tenant.open_store")}</span>
        </a>
        <button className="btn btn-sm" type="button" onClick={() => onEdit(tenant)}>
          <i className="bi bi-pencil-square" aria-hidden="true"></i><span>{t("admin_tenants.tenant.edit")}</span>
        </button>
        <button className="btn btn-sm tenant-share-button" type="button" data-share-tenant={tenant.id} onClick={() => onShare(tenant)}>
          <i className="bi bi-percent" aria-hidden="true"></i><span>{t("admin_tenants.tenant.share")}</span>
        </button>
        {shareEnabled && tenant.accessStatus === "revenue_share_suspended" ? (
          <button className="btn btn-sm tenant-share-unlock-button" type="button" data-unlock-revenue-share={tenant.id} onClick={() => onUnlock(tenant)}>
            <i className="bi bi-unlock" aria-hidden="true"></i><span>{t("admin_tenants.tenant.unlock_revenue_share")}</span>
          </button>
        ) : null}
        {tenant.lalamove?.accountMode === "fod_central" ? (
          <button
            className="btn btn-sm"
            type="button"
            data-lalamove-approval={tenant.id}
            disabled={lalamoveApprovalBusy}
            aria-busy={lalamoveApprovalBusy ? "true" : "false"}
            onClick={() => onLalamoveApproval(tenant)}
          >
            {lalamoveApprovalBusy
              ? <span className="tenant-button-spinner" aria-hidden="true"></span>
              : <i className={`bi ${tenant.lalamove?.fodCentralApproved ? "bi-shield-x" : "bi-shield-check"}`} aria-hidden="true"></i>}
            <span>{t(tenant.lalamove?.fodCentralApproved ? "admin_tenants.tenant.lalamove_revoke" : "admin_tenants.tenant.lalamove_approve")}</span>
          </button>
        ) : null}
        <button className="btn btn-sm" type="button" data-lalamove-wallet={tenant.id} onClick={() => onWallet(tenant)}>
          <i className="bi bi-wallet2" aria-hidden="true"></i><span>{t("admin_tenants.wallet.view")}</span>
        </button>
        <button className="btn btn-danger btn-sm" type="button" onClick={() => onDelete(tenant)}>
          <i className="bi bi-trash3" aria-hidden="true"></i><span>{t("admin_tenants.tenant.delete")}</span>
        </button>
      </div>
      {!shareEnabled ? <TenantSubscription tenant={tenant} t={t} intlLocale={intlLocale} onAction={onSubscriptionAction} /> : null}
    </article>
  );
}

function ReviewSystemResult({ ocr, t, money }) {
  if (!ocr || typeof ocr !== "object") return null;
  const status = String(ocr.status || "");
  const provider = String(ocr.provider || "");
  const reason = String(ocr.reason || "");
  const detected = Number(ocr.detectedAmount);
  let key = "admin_tenants.review.system_manual_review";
  let variant = "manual";
  const params = {};
  if (provider.includes("slip2go") && status === "matched") {
    key = "admin_tenants.review.system_slip2go_matched";
    variant = "matched";
    params.amount = Number.isFinite(detected) ? money(detected) : money(ocr.expectedAmount);
  } else if (status === "receiver_mismatch") {
    key = "admin_tenants.review.system_receiver_mismatch";
    variant = "mismatch";
  } else if (status === "duplicate") {
    key = "admin_tenants.review.system_duplicate_slip";
    variant = "mismatch";
  } else if (status === "invalid") {
    key = "admin_tenants.review.system_invalid_slip";
    variant = "mismatch";
  } else if (reason === "slip2go_fallback_vision") {
    key = "admin_tenants.review.system_fallback_review";
  } else if (status === "matched" && Number.isFinite(detected)) {
    key = "admin_tenants.review.system_amount_matched";
    variant = "matched";
    params.amount = money(detected);
  } else if (status === "mismatch" && Number.isFinite(detected)) {
    key = "admin_tenants.review.system_amount_mismatch";
    variant = "mismatch";
    params.amount = money(detected);
  } else if (status === "unreadable") {
    key = "admin_tenants.review.system_unreadable";
    variant = "unreadable";
  }
  return <div className={`tenant-review-system ${variant}`}><i className="bi bi-shield-check" aria-hidden="true"></i><span>{t(key, params)}</span></div>;
}

function ReviewItem({ item, t, money, intlLocale, onSlip, onApprove, onReject }) {
  const tenant = item.tenant || {};
  const status = ["pending", "approved", "rejected"].includes(item.status) ? item.status : "pending";
  const periodType = item.period?.type || "daily";
  const periodStart = item.period?.startDate || "";
  const periodEnd = item.period?.endDate || periodStart;
  const localizedReviewPeriod = periodStart
    ? localizedPeriodLabel(periodType, {
        date: periodStart,
        month: periodStart.slice(0, 7),
        year: periodStart.slice(0, 4),
        startDate: periodStart,
        endDate: periodEnd,
      }, t, intlLocale)
    : (item.period?.label || "-");
  const submitted = item.submittedAt
    ? new Intl.DateTimeFormat(intlLocale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(item.submittedAt))
    : "-";
  const platformDue = Number(item.platformAmountDue ?? item.revenueShareAmount ?? 0);
  const deliveryCost = Number(item.lalamoveOutstandingCost ?? item.lalamoveDeliveryCost ?? 0);
  return (
    <article className="tenant-review-item" data-payment-id={item.id}>
      <div className="tenant-review-main">
        <div className="tenant-review-store">
          <span className="tenant-review-mark">{String(tenant.name || "S").slice(0, 1).toUpperCase()}</span>
          <div><strong>{tenant.name || tenant.id || "-"}</strong><small>{tenant.slug ? `/${tenant.slug}` : tenant.id || "-"}</small></div>
        </div>
        <span className={`tenant-review-status ${status}`}>{t(`admin_tenants.review.statuses.${status}`)}</span>
      </div>
      <div className="tenant-review-period">
        <span>{t("admin_tenants.review.period")}</span>
        <strong>{localizedReviewPeriod}</strong>
        <small>{displayDateKey(periodStart, intlLocale)} – {displayDateKey(periodEnd, intlLocale)}</small>
      </div>
      <div className="tenant-review-amount">
        <span>{t("admin_tenants.review.amount")}</span>
        <strong>{money(platformDue)} {t("admin_tenants.common.baht")}</strong>
        <small>{t("admin_tenants.review.amount_breakdown", { share: money(item.revenueShareAmount), delivery: money(deliveryCost) })}</small>
        <small>{t("admin_tenants.review.rate", { rate: money(item.revenueShareRate) })}</small>
      </div>
      <div className="tenant-review-submitted"><span>{t("admin_tenants.review.submitted")}</span><strong>{submitted}</strong>{item.reviewNote ? <small>{item.reviewNote}</small> : null}</div>
      <div className="tenant-review-actions">
        <button className="btn btn-sm" type="button" data-review-view-slip={item.id} onClick={() => onSlip(item)}><i className="bi bi-receipt" aria-hidden="true"></i><span>{t("admin_tenants.review.view_slip")}</span></button>
        {status === "pending" ? <>
          <button className="btn btn-primary btn-sm" type="button" data-review-approve={item.id} onClick={() => onApprove(item)}><i className="bi bi-check-circle" aria-hidden="true"></i><span>{t("admin_tenants.review.approve")}</span></button>
          <button className="btn btn-danger btn-sm" type="button" data-review-reject={item.id} onClick={() => onReject(item)}><i className="bi bi-x-octagon" aria-hidden="true"></i><span>{t("admin_tenants.review.reject")}</span></button>
        </> : null}
      </div>
      <ReviewSystemResult ocr={item.ocr} t={t} money={money} />
    </article>
  );
}

export function AdminTenantsPage() {
  const authState = useAuth();
  const { profile } = authState;
  const { t, formatNumber, intlLocale } = useI18n();
  const stylesReady = useParityPage({
    title: t("admin_tenants.meta.title"),
    styles: [
      "tenant-admin.css",
      "tenant-card-independent-height.css",
      "tenant-admin-clarity.css",
      "tenant-admin-compact.css",
      "revenue-share-slip-dialog.css",
      "super-admin-header.css",
    ],
    attributes: { "data-roles": "super_admin" },
  });
  const dialogRef = useRef(null);
  const shareDialogRef = useRef(null);
  const reviewDialogRef = useRef(null);
  const slipDialogRef = useRef(null);
  const walletDialogRef = useRef(null);
  const walletSlipDialogRef = useRef(null);
  const [tenants, setTenants] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [totals, setTotals] = useState({});
  const [periodInfo, setPeriodInfo] = useState(null);
  const [period, setPeriod] = useState("daily");
  const [tenantId, setTenantId] = useState("");
  const [date, setDate] = useState(todayKey);
  const [month, setMonth] = useState(monthKey);
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [startDate, setStartDate] = useState(todayKey);
  const [endDate, setEndDate] = useState(todayKey);
  const [loading, setLoading] = useState(true);
  const [initialTenantsReady, setInitialTenantsReady] = useState(false);
  const [loadingSales, setLoadingSales] = useState(false);
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", slug: "", phone: "", address: "" });
  const [slugEdited, setSlugEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewStatus, setReviewStatus] = useState("pending");
  const [reviewCounts, setReviewCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [reviewItems, setReviewItems] = useState([]);
  const [shareTenant, setShareTenant] = useState(null);
  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareRate, setShareRate] = useState("0.00");
  const [shareBillingCycle, setShareBillingCycle] = useState("monthly");
  const [shareSaving, setShareSaving] = useState(false);
  const [shareError, setShareError] = useState("");
  const [rejectItem, setRejectItem] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [slipItem, setSlipItem] = useState(null);
  const [slipUrl, setSlipUrl] = useState("");
  const [walletTenant, setWalletTenant] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletReviewBusy, setWalletReviewBusy] = useState("");
  const [lalamoveApprovalBusy, setLalamoveApprovalBusy] = useState("");
  const [walletSlipItem, setWalletSlipItem] = useState(null);
  const [walletSlipUrl, setWalletSlipUrl] = useState("");
  const [adminNotifications, setAdminNotifications] = useState(EMPTY_PLATFORM_ADMIN_NOTIFICATIONS);
  const [adminNotificationsLoading, setAdminNotificationsLoading] = useState(true);

  const periodPayload = useCallback(() => {
    const payload = { period, ...(tenantId ? { tenantId } : {}) };
    if (period === "daily") payload.date = date;
    if (period === "monthly") payload.month = month;
    if (period === "yearly") payload.year = year;
    if (period === "custom") Object.assign(payload, { startDate, endDate });
    return payload;
  }, [period, tenantId, date, month, year, startDate, endDate]);

  const loadTenantList = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      setTenants(await listTenants());
    } catch (error) {
      console.error("TENANT_LIST_LOAD_FAILED", error);
      setStatus(t("admin_tenants.list.load_failed"));
    } finally {
      if (!silent) setLoading(false);
      setInitialTenantsReady(true);
    }
  }, [t]);

  const loadSales = useCallback(async () => {
    setLoadingSales(true);
    try {
      const data = await getPlatformRevenueShareSummary(periodPayload());
      setSummaries(data.tenants || {});
      setTotals(data.totals || {});
      setPeriodInfo(data.period || null);
    } catch (error) {
      console.error("TENANT_SALES_LOAD_FAILED", error);
      setStatus(t("admin_tenants.report.load_failed"));
    } finally {
      setLoadingSales(false);
    }
  }, [periodPayload, t]);

  const loadReviews = useCallback(async () => {
    try {
      const data = await listPlatformRevenueSharePayments({
        status: reviewStatus,
        ...(tenantId ? { tenantId } : {}),
      });
      setReviewCounts(data.counts || { pending: 0, approved: 0, rejected: 0 });
      setReviewItems(data.items || []);
    } catch (error) {
      console.error("REVENUE_SHARE_REVIEW_LOAD_FAILED", error);
      setReviewItems([]);
    }
  }, [reviewStatus, tenantId]);

  useEffect(() => {
    if (profile?.role !== "super_admin") return undefined;
    let cancelled = false;

    // Critical page data starts immediately. Do not serialize the tenant list
    // behind the one-time subscription backfill.
    loadTenantList();

    // Backfill is maintenance work. Keep it off the critical render path and
    // refresh silently only when it actually changed tenant subscription data.
    (async () => {
      try {
        const result = await backfillTenantSubscriptions({});
        if (cancelled || Number(result?.updated || 0) <= 0) return;
        showToast(t("admin_tenants.subscription.backfilled", { count: formatNumber(result.updated) }));
        await loadTenantList({ silent: true });
      } catch (error) {
        console.error("SUBSCRIPTION_BACKFILL_FAILED", error);
      }
    })();

    return () => { cancelled = true; };
  }, [profile?.role, loadTenantList, t, formatNumber]);

  useEffect(() => {
    if (profile?.role !== "super_admin") return;
    loadSales();
  }, [profile?.role, loadSales]);

  useEffect(() => {
    if (profile?.role !== "super_admin") return;
    loadReviews();
  }, [profile?.role, loadReviews]);

  const refreshAdminNotifications = useCallback(async ({ force = true } = {}) => {
    if (profile?.role !== "super_admin" || !initialTenantsReady) return;
    try {
      const summary = await loadPlatformAdminNotificationSummary({ force, tenants });
      setAdminNotifications(summary);
    } catch (error) {
      console.error("ADMIN_TENANT_NOTIFICATIONS_LOAD_FAILED", error);
    } finally {
      setAdminNotificationsLoading(false);
    }
  }, [profile?.role, initialTenantsReady, tenants]);

  useEffect(() => {
    if (profile?.role !== "super_admin" || !initialTenantsReady) return undefined;
    setAdminNotificationsLoading(true);
    refreshAdminNotifications({ force: true });
    const timer = window.setInterval(() => refreshAdminNotifications({ force: true }), 60_000);
    return () => window.clearInterval(timer);
  }, [profile?.role, initialTenantsReady, refreshAdminNotifications]);

  const visibleTenants = useMemo(
    () => tenantId ? tenants.filter(item => String(item.id) === String(tenantId)) : tenants,
    [tenants, tenantId],
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", slug: "", phone: "", address: "" });
    setSlugEdited(false);
    setStatus("");
    dialogRef.current?.showModal?.();
  };
  const openEdit = tenant => {
    setEditing(tenant);
    setForm({
      name: tenant.name || "",
      slug: tenant.slug || "",
      phone: tenant.shopPhone || "",
      address: tenant.shopAddress || "",
    });
    setSlugEdited(true);
    setStatus("");
    dialogRef.current?.showModal?.();
  };

  const openShare = tenant => {
    const summary = summaries[tenant.id] || {};
    setShareTenant(tenant);
    setShareEnabled(summary.revenueShareEnabled === true || tenant.billingMode === "revenue_share");
    setShareRate(Number(summary.revenueShareRate || tenant.revenueShareRate || 0).toFixed(2));
    setShareBillingCycle(summary.revenueShareBillingCycle === "daily" ? "daily" : "monthly");
    setShareError("");
    shareDialogRef.current?.showModal?.();
  };

  const openRevenueNotice = tenant => {
    setTenantId(String(tenant?.id || ""));
    setReviewStatus("all");
    window.setTimeout(() => document.getElementById("tenantShareReviewTitle")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const saveShare = async event => {
    event.preventDefault();
    if (!shareTenant?.id) return;
    const rate = Math.max(0, Math.min(100, Number(shareRate || 0)));
    setShareSaving(true);
    setShareError("");
    try {
      await updateTenantRevenueShare({
        tenantId: shareTenant.id,
        enabled: shareEnabled,
        rate,
        billingCycle: shareBillingCycle,
      });
      showToast(t("admin_tenants.share.saved"));
      shareDialogRef.current?.close?.();
      setShareTenant(null);
      await Promise.all([loadTenantList(), loadSales(), loadReviews()]);
    } catch (error) {
      console.error("REVENUE_SHARE_SAVE_FAILED", error);
      const message = t("admin_tenants.share.save_failed");
      setShareError(message);
      showToast(message, "error");
    } finally {
      setShareSaving(false);
    }
  };

  const unlockShare = async tenant => {
    const start = tenant.revenueShareSuspendedPeriodStart || "-";
    const end = tenant.revenueShareSuspendedPeriodEnd || start;
    const periodText = start === end ? start : `${start} – ${end}`;
    const confirmed = await sweetConfirm(
      t("admin_tenants.tenant.unlock_revenue_share_confirm", { name: tenant.name || tenant.id, period: periodText }),
      {
        title: t("admin_tenants.tenant.unlock_revenue_share_title"),
        confirmText: t("admin_tenants.tenant.unlock_revenue_share"),
        cancelText: t("admin_tenants.common.cancel"),
        type: "warning",
      },
    );
    if (!confirmed) return;
    try {
      await unlockTenantRevenueShare({ tenantId: tenant.id });
      showToast(t("admin_tenants.tenant.unlock_revenue_share_success"));
      await Promise.all([loadTenantList(), loadSales(), loadReviews()]);
    } catch (error) {
      console.error("REVENUE_SHARE_UNLOCK_FAILED", error);
      const message = t("admin_tenants.tenant.unlock_revenue_share_failed");
      setStatus(message);
      showToast(message, "error");
    }
  };

  const submitTenant = async event => {
    event.preventDefault();
    const payload = {
      ...(editing ? { tenantId: editing.id } : {}),
      name: form.name.trim(),
      slug: normalizeSlug(form.slug),
      phone: form.phone.trim(),
      address: form.address.trim(),
    };
    if (!payload.name || !payload.slug) return;
    setSaving(true);
    setStatus("");
    try {
      if (editing) await updateTenant(payload);
      else await createTenant(payload);
      showToast(t(editing ? "admin_tenants.tenant.updated" : "admin_tenants.tenant.created"));
      dialogRef.current?.close?.();
      await Promise.all([loadTenantList(), loadSales()]);
    } catch (error) {
      console.error("TENANT_SAVE_FAILED", error);
      let message = t(editing ? "admin_tenants.tenant.update_failed" : "admin_tenants.tenant.create_failed");
      if (error?.code === "functions/already-exists") message = t("admin_tenants.tenant.slug_exists");
      if (error?.code === "functions/invalid-argument") message = error?.message || t("admin_tenants.tenant.invalid");
      setStatus(message);
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const removeTenant = async tenant => {
    const confirmed = await sweetConfirm(
      t("admin_tenants.tenant.delete_confirm", { name: tenant.name || tenant.id }),
      {
        title: t("admin_tenants.tenant.delete_title"),
        confirmText: t("admin_tenants.tenant.delete_confirm_button"),
        cancelText: t("admin_tenants.common.cancel"),
        type: "warning",
      },
    );
    if (!confirmed) return;
    try {
      await deleteTenant({ tenantId: tenant.id });
      showToast(t("admin_tenants.tenant.deleted"));
      await Promise.all([loadTenantList(), loadSales()]);
    } catch (error) {
      console.error("TENANT_DELETE_FAILED", error);
      const message = error?.code === "functions/failed-precondition"
        ? t("admin_tenants.tenant.delete_has_data")
        : t("admin_tenants.tenant.delete_failed");
      setStatus(message);
      showToast(message, "error");
    }
  };

  const refreshReviews = async () => {
    try {
      await reconcileRevenueShare(tenantId ? { tenantId } : {});
    } catch (error) {
      console.warn("REVENUE_SHARE_RECONCILE_SKIPPED", error);
    }
    await Promise.all([loadReviews(), loadTenantList(), loadSales()]);
  };

  const approvePayment = async item => {
    const store = item.tenant?.name || item.tenant?.id || "-";
    const confirmed = await sweetConfirm(
      t("admin_tenants.review.approve_confirm", {
        store,
        amount: money(item.platformAmountDue),
      }),
      {
        title: t("admin_tenants.review.approve_title"),
        confirmText: t("admin_tenants.review.approve"),
        cancelText: t("admin_tenants.common.cancel"),
        type: "success",
      },
    );
    if (!confirmed) return;
    try {
      await reviewRevenueSharePayment({ tenantId: item.tenant.id, paymentId: item.id, action: "approve" });
      showToast(t("admin_tenants.review.approved"));
      await Promise.all([loadReviews(), loadTenantList(), loadSales(), refreshAdminNotifications({ force: true })]);
    } catch (error) {
      console.error("REVENUE_SHARE_APPROVE_FAILED", error);
      const message = t("admin_tenants.review.review_failed");
      setStatus(message);
      showToast(message, "error");
    }
  };

  const openReject = item => {
    setRejectItem(item);
    setReviewNote("");
    setReviewError("");
    reviewDialogRef.current?.showModal?.();
  };

  const rejectPayment = async event => {
    event.preventDefault();
    if (!rejectItem?.tenant?.id || !reviewNote.trim()) return;
    setReviewSaving(true);
    setReviewError("");
    try {
      await reviewRevenueSharePayment({
        tenantId: rejectItem.tenant.id,
        paymentId: rejectItem.id,
        action: "reject",
        note: reviewNote.trim(),
      });
      showToast(t("admin_tenants.review.rejected"));
      reviewDialogRef.current?.close?.();
      setRejectItem(null);
      setReviewNote("");
      await Promise.all([loadReviews(), loadTenantList(), loadSales(), refreshAdminNotifications({ force: true })]);
    } catch (error) {
      console.error("REVENUE_SHARE_REJECT_FAILED", error);
      const message = t("admin_tenants.review.review_failed");
      setReviewError(message);
      showToast(message, "error");
    } finally {
      setReviewSaving(false);
    }
  };

  const openSlip = async item => {
    if (!item?.slip?.path) return;
    try {
      const url = await getDownloadURL(storageRef(storage, item.slip.path));
      setSlipItem(item);
      setSlipUrl(url);
      slipDialogRef.current?.showModal?.();
    } catch (error) {
      console.error("REVENUE_SHARE_SLIP_FAILED", error);
      setStatus(t("admin_tenants.review.review_failed"));
    }
  };

  const closeSlip = () => {
    slipDialogRef.current?.close?.();
    setSlipItem(null);
    setSlipUrl("");
  };

  const updateSubscription = async (tenant, payload) => {
    if (payload.action === "suspend") {
      const confirmed = await sweetConfirm(
        t("admin_tenants.subscription.suspend_confirm"),
        {
          title: t("admin_tenants.subscription.suspend_title"),
          confirmText: t("admin_tenants.subscription.suspend"),
          cancelText: t("admin_tenants.common.cancel"),
          type: "warning",
        },
      );
      if (!confirmed) return null;
    }

    try {
      const result = await updateTenantSubscription(payload);
      setTenants(current => current.map(item => item.id === tenant.id ? {
        ...item,
        active: result.active !== false,
        subscriptionStatus: result.status || item.subscriptionStatus || "active",
        subscriptionExpiresAt: result.expiresAt || item.subscriptionExpiresAt,
        gracePeriodDays: Number(result.gracePeriodDays ?? payload.gracePeriodDays),
        planCode: payload.planCode || item.planCode || "monthly",
        suspendedAt: result.status === "suspended" ? new Date().toISOString() : null,
      } : item));
      showToast(t("admin_tenants.subscription.updated"));
      return result;
    } catch (error) {
      console.error("TENANT_SUBSCRIPTION_UPDATE_FAILED", error);
      showToast(error?.message || t("admin_tenants.subscription.update_failed"), "error");
      throw error;
    }
  };

  const toggleLalamoveApproval = async tenant => {
    const approved = tenant.lalamove?.fodCentralApproved === true;
    const key = approved ? "admin_tenants.tenant.lalamove_revoke_confirm" : "admin_tenants.tenant.lalamove_approve_confirm";
    const actionKey = approved ? "admin_tenants.tenant.lalamove_revoke" : "admin_tenants.tenant.lalamove_approve";
    const confirmed = await sweetConfirm(
      t(key, { name: tenant.name || tenant.id }),
      {
        title: t(actionKey),
        confirmText: t(actionKey),
        cancelText: t("admin_tenants.common.cancel"),
        type: "warning",
      },
    );
    if (!confirmed || lalamoveApprovalBusy) return;
    const nextApproved = !approved;
    setLalamoveApprovalBusy(tenant.id);
    try {
      const result = await updateTenantLalamoveApproval({ tenantId: tenant.id, approved: nextApproved });
      const serverState = result?.item && typeof result.item === "object" ? result.item : {};
      setTenants(current => current.map(item => item.id === tenant.id ? {
        ...item,
        lalamove: {
          ...(item.lalamove || {}),
          ...serverState,
          accountMode: "fod_central",
          fodCentralApproved: serverState.fodCentralApproved === true || nextApproved,
        },
      } : item));
      const message = t(approved ? "admin_tenants.tenant.lalamove_revoke_success" : "admin_tenants.tenant.lalamove_approve_success");
      setStatus(message);
      showToast(message);
    } catch (error) {
      console.error("TENANT_LALAMOVE_APPROVAL_FAILED", error);
      const message = t("admin_tenants.tenant.lalamove_approval_failed");
      setStatus(message);
      showToast(message, "error");
    } finally {
      setLalamoveApprovalBusy("");
    }
  };

  const refreshWallet = async tenant => {
    if (!tenant?.id) return;
    setWalletLoading(true);
    try {
      const data = await getTenantLalamoveWallet({ tenantId: tenant.id });
      setWallet(data.item || {});
    } catch (error) {
      console.error("TENANT_LALAMOVE_WALLET_LOAD_FAILED", error);
      setWallet({ error: true, transactions: [], topups: [] });
    } finally {
      setWalletLoading(false);
    }
  };

  const openWallet = async tenant => {
    setWalletTenant(tenant);
    setWallet({
      balance: Number(tenant.lalamoveWallet?.balance || 0),
      transactions: [],
      topups: [],
    });
    walletDialogRef.current?.showModal?.();
    await refreshWallet(tenant);
  };

  const closeWallet = () => {
    walletDialogRef.current?.close?.();
    setWalletTenant(null);
    setWallet(null);
  };

  const openWalletSlip = async item => {
    const path = String(item?.slip?.path || "");
    const directUrl = String(item?.slip?.url || "");
    if (!path && !directUrl) return;
    try {
      const url = path ? await getDownloadURL(storageRef(storage, path)) : directUrl;
      setWalletSlipItem(item);
      setWalletSlipUrl(url);
      walletSlipDialogRef.current?.showModal?.();
    } catch (error) {
      console.error("TENANT_LALAMOVE_WALLET_SLIP_FAILED", error);
      setStatus(t("admin_tenants.wallet.load_failed"));
    }
  };

  const closeWalletSlip = () => {
    walletSlipDialogRef.current?.close?.();
    setWalletSlipItem(null);
    setWalletSlipUrl("");
  };

  const reviewWalletTopup = async (item, action) => {
    if (!walletTenant?.id || !item?.id || walletReviewBusy) return;
    let note = "";
    if (action === "approve") {
      const confirmed = await sweetConfirm(
        t("admin_tenants.wallet.approve_confirm", {
          amount: money(item.amount),
          name: walletTenant.name || walletTenant.id,
        }),
        {
          title: t("admin_tenants.wallet.approve_title"),
          confirmText: t("admin_tenants.wallet.approve"),
          cancelText: t("admin_tenants.common.cancel"),
          type: "warning",
          portalTarget: walletDialogRef.current,
        },
      );
      if (!confirmed) return;
    } else {
      note = await sweetPrompt(
        t("admin_tenants.wallet.reject_prompt"),
        "",
        {
          title: t("admin_tenants.wallet.reject_title"),
          confirmText: t("admin_tenants.wallet.reject"),
          cancelText: t("admin_tenants.common.cancel"),
          type: "warning",
          portalTarget: walletDialogRef.current,
        },
      );
      if (note === null) return;
      note = String(note || "").trim();
      if (!note) return;
    }

    setWalletReviewBusy(item.id);
    try {
      const data = await reviewTenantLalamoveWalletTopup({
        tenantId: walletTenant.id,
        topupId: item.id,
        action,
        note,
      });
      setWallet(data.item || {});
      const message = t(action === "approve" ? "admin_tenants.wallet.approve_success" : "admin_tenants.wallet.reject_success");
      setStatus(message);
      showToast(message);
      await Promise.all([loadTenantList(), refreshAdminNotifications({ force: true })]);
    } catch (error) {
      console.error("TENANT_LALAMOVE_WALLET_REVIEW_FAILED", error);
      const message = t("admin_tenants.wallet.review_failed");
      setStatus(message);
      showToast(message, "error");
    } finally {
      setWalletReviewBusy("");
    }
  };

  if (authState.status === "loading" || !stylesReady || (profile?.role === "super_admin" && !initialTenantsReady)) {
    return <PageReadyOverlay context="PENGUIN" title={t("shared.state.loading")} message={t("shared.state.please_wait")} progress={74} />;
  }
  if (!profile) return <Navigate to="/login?next=%2Fadmin%2Ftenants" replace />;
  if (profile.role !== "super_admin") return <Navigate to="/" replace />;

  const money = value => formatNumber(Number(value || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const shareSummary = shareTenant ? (summaries[shareTenant.id] || {}) : {};
  const shareEstimate = shareEnabled
    ? Number(shareSummary.combinedSales || 0) * Math.max(0, Math.min(100, Number(shareRate || 0))) / 100
    : 0;
  const currentPeriodLabel = localizedPeriodLabel(period, {
    date,
    month,
    year,
    startDate,
    endDate,
  }, t, intlLocale);
  const notificationTotal = Number(adminNotifications?.total || 0);
  const walletNotificationCount = Number(adminNotifications?.wallet?.total || 0);
  const revenueNotificationCount = Number(adminNotifications?.revenueShare?.total || 0);

  return (
    <>
      <header className="app-header super-admin-header">
        <div className="super-admin-header-leading">
          <div className="brand"><span className="brand-mark">PG</span><span>{t("admin_tenants.header.title")}</span></div>
          <Link className="btn btn-sm super-admin-header-back" to="/platform"><i className="bi bi-arrow-left" aria-hidden="true"></i><span>{t("admin_tenants.header.back")}</span></Link>
        </div>
        <div className="app-header-actions" data-header-actions>
          <LocaleSwitcher style={{ marginLeft: 0, marginRight: 0 }} />
          <UserMenu profile={profile} />
        </div>
      </header>

      <main className="container tenant-admin-page">
        <section className="hero tenant-admin-hero">
          <div>
            <span className="tenant-admin-eyebrow"><i className="bi bi-shield-check" aria-hidden="true"></i> {t("admin_tenants.hero.eyebrow")}</span>
            <h1>{t("admin_tenants.hero.title")}</h1>
            <p>{t("admin_tenants.hero.description")}</p>
          </div>
          <button id="openTenantCreateButton" className="btn btn-primary tenant-create-trigger" type="button" onClick={openCreate}>
            <i className="bi bi-plus-lg" aria-hidden="true"></i><span>{t("admin_tenants.hero.create")}</span>
          </button>
        </section>

        {!adminNotificationsLoading && notificationTotal > 0 ? (
          <section className="card tenant-admin-notification-panel" aria-labelledby="tenantAdminNotificationTitle" data-admin-notification-total={notificationTotal}>
            <div className="tenant-admin-notification-copy">
              <span className="tenant-admin-notification-icon"><i className="bi bi-bell-fill" aria-hidden="true"></i><b>{formatNumber(notificationTotal)}</b></span>
              <div>
                <strong id="tenantAdminNotificationTitle">{t("admin_tenants.notifications.title")}</strong>
                <span>{t("admin_tenants.notifications.description")}</span>
                <small>{t("admin_tenants.notifications.scope")}</small>
              </div>
            </div>
            <div className="tenant-admin-notification-summary">
              {revenueNotificationCount > 0 ? (
                <article className="revenue">
                  <span><i className="bi bi-receipt-cutoff" aria-hidden="true"></i>{t("admin_tenants.notifications.revenue_share_label")}</span>
                  <strong>{formatNumber(revenueNotificationCount)}</strong>
                  <small>{t("admin_tenants.notifications.breakdown", { pending: formatNumber(adminNotifications.revenueShare?.pending || 0), auto: formatNumber(adminNotifications.revenueShare?.autoApprovedToday || 0) })}</small>
                </article>
              ) : null}
              {walletNotificationCount > 0 ? (
                <article className="wallet">
                  <span><i className="bi bi-wallet2" aria-hidden="true"></i>{t("admin_tenants.notifications.wallet_label")}</span>
                  <strong>{formatNumber(walletNotificationCount)}</strong>
                  <small>{t("admin_tenants.notifications.breakdown", { pending: formatNumber(adminNotifications.wallet?.pending || 0), auto: formatNumber(adminNotifications.wallet?.autoApprovedToday || 0) })}</small>
                </article>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="card tenant-global-filter" aria-labelledby="tenantGlobalFilterLabel">
          <div className="tenant-global-filter-copy">
            <span className="tenant-global-filter-icon"><i className="bi bi-funnel" aria-hidden="true"></i></span>
            <div><strong id="tenantGlobalFilterLabel">{t("admin_tenants.filter.label")}</strong><span>{t("admin_tenants.filter.help")}</span></div>
          </div>
          <label className="tenant-global-filter-control" htmlFor="tenantStoreFilter">
            <span className="sr-only">{t("admin_tenants.filter.aria")}</span>
            <select className="input" id="tenantStoreFilter" value={tenantId} onChange={e => setTenantId(e.target.value)} disabled={loading}>
              <option value="">{t("admin_tenants.filter.all")}</option>
              {tenants.map(tenant => <option value={tenant.id} key={tenant.id}>{tenant.name || tenant.slug || tenant.id}</option>)}
            </select>
          </label>
        </section>

        <section className="card tenant-report-card" aria-labelledby="tenantReportTitle">
          <div className="section-title tenant-report-heading">
            <div>
              <h2 id="tenantReportTitle"><i className="bi bi-graph-up-arrow" aria-hidden="true"></i><span>{t("admin_tenants.report.title")}</span></h2>
              <p>{t("admin_tenants.report.description")}</p>
            </div>
            <button id="refreshTenantSalesButton" className="btn btn-sm" type="button" onClick={loadSales} disabled={loadingSales}>
              <i className="bi bi-arrow-clockwise" aria-hidden="true"></i><span>{loadingSales ? t("admin_tenants.report.loading") : t("admin_tenants.report.refresh")}</span>
            </button>
          </div>

          <div className="tenant-report-filters">
            <div className="tenant-period-tabs" role="tablist" aria-label={t("admin_tenants.report.period_aria")}>
              {[
                ["daily", "bi bi-calendar-day"],
                ["monthly", "bi bi-calendar-month"],
                ["yearly", "bi bi-calendar3"],
                ["custom", "bi bi-calendar-range"],
              ].map(([key, icon]) => (
                <button type="button" className={period === key ? "active" : ""} data-tenant-period={key} key={key} onClick={() => setPeriod(key)}>
                  <i className={icon} aria-hidden="true"></i><span>{t(`admin_tenants.report.periods.${key}`)}</span>
                </button>
              ))}
            </div>
            <div className="tenant-period-controls">
              {period === "daily" ? <label data-tenant-control="daily"><span>{t("admin_tenants.report.controls.date")}</span><input className="input" id="tenantReportDate" type="date" value={date} onChange={e => setDate(e.target.value)} /></label> : null}
              {period === "monthly" ? <label data-tenant-control="monthly"><span>{t("admin_tenants.report.controls.month")}</span><input className="input" id="tenantReportMonth" type="month" value={month} onChange={e => setMonth(e.target.value)} /></label> : null}
              {period === "yearly" ? <label data-tenant-control="yearly"><span>{t("admin_tenants.report.controls.year")}</span><select className="input" id="tenantReportYear" value={year} onChange={e => setYear(e.target.value)}>{Array.from({ length: 8 }, (_, index) => String(new Date().getFullYear() - 5 + index)).map(item => <option key={item}>{item}</option>)}</select></label> : null}
              {period === "custom" ? <div className="tenant-custom-period" data-tenant-control="custom">
                <label><span>{t("admin_tenants.report.controls.start_date")}</span><input className="input" id="tenantReportStartDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
                <label><span>{t("admin_tenants.report.controls.end_date")}</span><input className="input" id="tenantReportEndDate" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></label>
              </div> : null}
              <div className="tenant-period-label" id="tenantPeriodLabel">{currentPeriodLabel}</div>
            </div>
          </div>

          <div className="tenant-platform-summary">
            <article><span>{t("admin_tenants.report.summary.order_sales")}</span><strong id="platformOrderSales">{money(totals.orderSales)}</strong><small id="platformOrderCount">{t("admin_tenants.common.orders", { count: formatNumber(totals.orderCount || 0) })}</small></article>
            <article><span>{t("admin_tenants.report.summary.pos_sales")}</span><strong id="platformPosSales">{money(totals.posSales)}</strong><small id="platformPosCount">{t("admin_tenants.common.receipts", { count: formatNumber(totals.posCount || 0) })}</small></article>
            <article className="primary"><span>{t("admin_tenants.report.summary.combined_sales")}</span><strong id="platformCombinedSales">{money(totals.combinedSales)}</strong><small>{t("admin_tenants.common.baht")}</small></article>
            <article className="share"><span>{t("admin_tenants.report.summary.revenue_share")}</span><strong id="platformRevenueShare">{money(totals.revenueShare)}</strong><small>{t("admin_tenants.common.baht")}</small></article>
            <article className="delivery-customer"><span>{t("admin_tenants.report.summary.customer_delivery_fees")}</span><strong id="platformCustomerDeliveryFees">{money(totals.customerDeliveryFees)}</strong><small>{t("admin_tenants.common.baht")}</small></article>
            <article className="delivery-cost"><span>{t("admin_tenants.report.summary.lalamove_delivery_cost")}</span><strong id="platformLalamoveDeliveryCost">{money(totals.lalamoveDeliveryCost)}</strong><small>{t("admin_tenants.common.baht")}</small></article>
            <article className="subsidy"><span>{t("admin_tenants.report.summary.delivery_subsidy")}</span><strong id="platformDeliverySubsidy">{money(totals.deliverySubsidy)}</strong><small>{t("admin_tenants.common.baht")}</small></article>
            <article className="amount-due"><span>{t("admin_tenants.report.summary.platform_amount_due")}</span><strong id="platformAmountDue">{money(totals.platformAmountDue)}</strong><small>{t("admin_tenants.common.baht")}</small></article>
          </div>
        </section>

        <section className="card tenant-share-review-card" aria-labelledby="tenantShareReviewTitle">
          <div className="section-title tenant-share-review-heading">
            <div><h2 id="tenantShareReviewTitle"><i className="bi bi-receipt-cutoff" aria-hidden="true"></i><span>{t("admin_tenants.review.title")}</span></h2><p>{t("admin_tenants.review.description")}</p></div>
            <button id="refreshRevenueShareReview" className="btn btn-sm" type="button" onClick={refreshReviews}><i className="bi bi-arrow-clockwise" aria-hidden="true"></i><span>{t("admin_tenants.review.refresh")}</span></button>
          </div>
          <div className="tenant-review-tabs" role="tablist" aria-label={t("admin_tenants.review.filter_aria")}>
            {["pending", "approved", "rejected", "all"].map(key => (
              <button className={reviewStatus === key ? "active" : ""} type="button" data-review-status={key} key={key} onClick={() => setReviewStatus(key)}>
                <span>{t(`admin_tenants.review.statuses.${key}`)}</span>
                {key !== "all" ? <b data-review-count={key}>{reviewCounts[key] || 0}</b> : null}
              </button>
            ))}
          </div>
          <div id="revenueShareReviewList" className="tenant-review-list">
            {reviewItems.length
              ? reviewItems.map(item => (
                  <ReviewItem
                    key={`${item.tenant?.id || "tenant"}-${item.id}`}
                    item={item}
                    t={t}
                    money={money}
                    intlLocale={intlLocale}
                    onSlip={openSlip}
                    onApprove={approvePayment}
                    onReject={openReject}
                  />
                ))
              : <div className="tenant-review-empty"><i className="bi bi-inbox" aria-hidden="true"></i><strong>{t("admin_tenants.review.empty_title")}</strong><span>{t("admin_tenants.review.empty_help")}</span></div>}
          </div>
        </section>

        <section className="card tenant-list-card">
          <div className="section-title tenant-list-heading">
            <div><h2><i className="bi bi-shop" aria-hidden="true"></i><span>{t("admin_tenants.list.title")}</span></h2><p>{t("admin_tenants.list.description")}</p></div>
            <span className="badge" id="tenantCount">{t("admin_tenants.list.count", { count: formatNumber(visibleTenants.length) })}</span>
          </div>
          <div id="tenantList" className="tenant-card-grid">
            {loading
              ? <div className="tenant-list-loading">{t("admin_tenants.list.loading")}</div>
              : visibleTenants.length
                ? visibleTenants.map(tenant => (
                    <TenantCard
                      key={tenant.id}
                      tenant={tenant}
                      summary={summaries[tenant.id] || {}}
                      notifications={adminNotifications?.byTenant?.[tenant.id] || {}}
                      t={t}
                      formatNumber={formatNumber}
                      intlLocale={intlLocale}
                      onEdit={openEdit}
                      onShare={openShare}
                      onRevenueNotice={openRevenueNotice}
                      onUnlock={unlockShare}
                      onLalamoveApproval={toggleLalamoveApproval}
                      lalamoveApprovalBusy={lalamoveApprovalBusy === tenant.id}
                      onWallet={openWallet}
                      onDelete={removeTenant}
                      onSubscriptionAction={updateSubscription}
                    />
                  ))
                : <div className="tenant-list-empty"><i className="bi bi-shop" aria-hidden="true"></i><strong>{t("admin_tenants.list.empty_title")}</strong><span>{t("admin_tenants.list.empty_help")}</span></div>}
          </div>
        </section>

        {status ? <div className="upload-error" role="alert">{status}</div> : null}
      </main>

      <dialog id="tenantDialog" className="tenant-dialog" ref={dialogRef}>
        <form id="tenantForm" className="tenant-dialog-card" onSubmit={submitTenant}>
          <div className="tenant-dialog-head">
            <div className="tenant-dialog-title">
              <span className="tenant-dialog-icon"><i className="bi bi-shop-window" aria-hidden="true"></i></span>
              <div>
                <span className="tenant-dialog-eyebrow" id="tenantDialogEyebrow">{t(editing ? "admin_tenants.tenant.edit_eyebrow" : "admin_tenants.tenant.new_eyebrow")}</span>
                <h2 id="tenantDialogTitle">{t(editing ? "admin_tenants.tenant.edit_title" : "admin_tenants.tenant.create_title")}</h2>
                <p id="tenantDialogDescription">{editing ? (editing.name || editing.slug || editing.id) : t("admin_tenants.tenant.create_description")}</p>
              </div>
            </div>
            <button type="button" className="tenant-dialog-close" aria-label={t("admin_tenants.common.close")} onClick={() => dialogRef.current?.close?.()}>
              <i className="bi bi-x-lg" aria-hidden="true"></i>
            </button>
          </div>
          <div className="tenant-dialog-body">
            <div className="grid grid-2">
              <div className="field">
                <label htmlFor="tenantName">{t("admin_tenants.tenant.fields.name")}</label>
                <input className="input" id="tenantName" maxLength="120" required value={form.name} onChange={e => {
                  const name = e.target.value;
                  setForm(current => ({ ...current, name, ...(!slugEdited ? { slug: normalizeSlug(name) } : {}) }));
                }} placeholder={t("admin_tenants.tenant.fields.name_placeholder")} />
              </div>
              <div className="field">
                <label htmlFor="tenantSlug">{t("admin_tenants.tenant.fields.slug")}</label>
                <input className="input" id="tenantSlug" maxLength="50" required value={form.slug} onChange={e => {
                  setSlugEdited(true);
                  setForm(current => ({ ...current, slug: sanitizeSlug(e.target.value) }));
                }} onBlur={() => setForm(current => ({ ...current, slug: normalizeSlug(current.slug) }))} placeholder={t("admin_tenants.tenant.fields.slug_placeholder")} />
                <small>{t("admin_tenants.tenant.fields.slug_help")}</small>
              </div>
            </div>
            <div className="grid grid-2">
              <div className="field">
                <label htmlFor="tenantPhone">{t("admin_tenants.tenant.fields.phone")}</label>
                <input className="input" id="tenantPhone" type="tel" maxLength="30" value={form.phone} onChange={e => setForm(current => ({ ...current, phone: e.target.value }))} placeholder={t("admin_tenants.tenant.fields.phone_placeholder")} />
              </div>
              <div className="field">
                <label htmlFor="tenantAddress">{t("admin_tenants.tenant.fields.address")}</label>
                <input className="input" id="tenantAddress" maxLength="300" value={form.address} onChange={e => setForm(current => ({ ...current, address: e.target.value }))} placeholder={t("admin_tenants.tenant.fields.address_placeholder")} />
              </div>
            </div>
            {status ? <div className="upload-error" id="tenantError">{status}</div> : <div className="upload-error" id="tenantError" hidden></div>}
          </div>
          <div className="tenant-dialog-actions">
            <button type="button" className="btn" onClick={() => dialogRef.current?.close?.()}>
              <i className="bi bi-x-circle" aria-hidden="true"></i><span>{t("admin_tenants.common.cancel")}</span>
            </button>
            <button className="btn btn-primary" id="createTenantButton" type="submit" disabled={saving}>
              <i className="bi bi-floppy" aria-hidden="true"></i><span>{saving ? t("admin_tenants.tenant.saving") : t(editing ? "admin_tenants.tenant.save_edit" : "admin_tenants.tenant.create")}</span>
            </button>
          </div>
        </form>
      </dialog>

      <dialog id="revenueShareDialog" className="tenant-dialog revenue-share-dialog" ref={shareDialogRef}>
        <form id="revenueShareForm" className="tenant-dialog-card" onSubmit={saveShare}>
          <div className="tenant-dialog-head">
            <div className="tenant-dialog-title">
              <span className="tenant-dialog-icon share"><i className="bi bi-percent" aria-hidden="true"></i></span>
              <div><span className="tenant-dialog-eyebrow">{t("admin_tenants.share.eyebrow")}</span><h2>{t("admin_tenants.share.title")}</h2><p id="revenueShareTenantName">{shareTenant?.name || shareTenant?.slug || shareTenant?.id || "-"}</p></div>
            </div>
            <button type="button" className="tenant-dialog-close" data-close-share-dialog aria-label={t("admin_tenants.common.close")} onClick={() => shareDialogRef.current?.close?.()}><i className="bi bi-x-lg" aria-hidden="true"></i></button>
          </div>
          <div className="tenant-dialog-body">
            <label className="tenant-share-switch">
              <input id="revenueShareEnabled" type="checkbox" checked={shareEnabled} onChange={e => setShareEnabled(e.target.checked)} />
              <span><strong>{t("admin_tenants.share.enabled")}</strong><small>{t("admin_tenants.share.help")}</small></span>
            </label>
            <div className="field">
              <label htmlFor="revenueShareRate">{t("admin_tenants.share.rate")}</label>
              <div className="tenant-share-input"><input className="input" id="revenueShareRate" type="number" min="0" max="100" step="0.01" value={shareRate} required onChange={e => setShareRate(e.target.value)} /><span>%</span></div>
            </div>
            <div className="field">
              <label htmlFor="revenueShareBillingCycle">{t("admin_tenants.share.billing_cycle")}</label>
              <select className="input" id="revenueShareBillingCycle" required value={shareBillingCycle} onChange={e => setShareBillingCycle(e.target.value)}>
                <option value="daily">{t("admin_tenants.share.billing_cycles.daily")}</option>
                <option value="monthly">{t("admin_tenants.share.billing_cycles.monthly")}</option>
              </select>
              <small>{t("admin_tenants.share.billing_cycle_help")}</small>
            </div>
            <div className="tenant-share-preview">
              <span>{t("admin_tenants.share.current_sales")}</span><strong id="revenueShareSalesPreview">{money(shareSummary.combinedSales)} {t("admin_tenants.common.baht")}</strong>
              <span>{t("admin_tenants.share.estimated")}</span><strong id="revenueShareAmountPreview">{money(shareEstimate)} {t("admin_tenants.common.baht")}</strong>
            </div>
            {shareError ? <div className="upload-error" id="revenueShareError">{shareError}</div> : <div className="upload-error" id="revenueShareError" hidden></div>}
          </div>
          <div className="tenant-dialog-actions">
            <button type="button" className="btn" data-close-share-dialog onClick={() => shareDialogRef.current?.close?.()}><i className="bi bi-x-circle" aria-hidden="true"></i><span>{t("admin_tenants.common.cancel")}</span></button>
            <button type="submit" className="btn btn-primary" id="saveRevenueShareButton" disabled={shareSaving}><i className="bi bi-floppy" aria-hidden="true"></i><span>{shareSaving ? t("admin_tenants.share.saving") : t("admin_tenants.share.save")}</span></button>
          </div>
        </form>
      </dialog>

      <dialog id="revenueShareReviewDialog" className="tenant-dialog tenant-review-dialog" ref={reviewDialogRef}>
        <form id="revenueShareReviewForm" className="tenant-dialog-card" onSubmit={rejectPayment}>
          <div className="tenant-dialog-head">
            <div className="tenant-dialog-title">
              <span className="tenant-dialog-icon review"><i className="bi bi-clipboard-check" aria-hidden="true"></i></span>
              <div><span className="tenant-dialog-eyebrow">{t("admin_tenants.review.dialog_eyebrow")}</span><h2 id="revenueShareReviewDialogTitle">{t("admin_tenants.review.reject_title")}</h2><p id="revenueShareReviewTenantName">{rejectItem?.tenant?.name || rejectItem?.tenant?.id || "-"}</p></div>
            </div>
            <button type="button" className="tenant-dialog-close" data-close-review-dialog aria-label={t("admin_tenants.common.close")} onClick={() => reviewDialogRef.current?.close?.()}><i className="bi bi-x-lg" aria-hidden="true"></i></button>
          </div>
          <div className="tenant-dialog-body">
            <div className="tenant-review-dialog-summary" id="revenueShareReviewSummary">
              <span>{rejectItem?.period?.label || "-"}</span>
              <strong>{money(rejectItem?.platformAmountDue ?? rejectItem?.revenueShareAmount)} {t("admin_tenants.common.baht")}</strong>
              <small>{t("admin_tenants.review.amount_breakdown", { share: money(rejectItem?.revenueShareAmount), delivery: money(rejectItem?.lalamoveOutstandingCost ?? rejectItem?.lalamoveDeliveryCost) })}</small>
            </div>
            <div className="field">
              <label htmlFor="revenueShareReviewNote">{t("admin_tenants.review.note")}</label>
              <textarea className="input" id="revenueShareReviewNote" rows="4" maxLength="1000" required value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder={t("admin_tenants.review.note_placeholder")}></textarea>
              <small>{t("admin_tenants.review.note_help")}</small>
            </div>
            {reviewError ? <div className="upload-error" id="revenueShareReviewError">{reviewError}</div> : <div className="upload-error" id="revenueShareReviewError" hidden></div>}
          </div>
          <div className="tenant-dialog-actions">
            <button type="button" className="btn" data-close-review-dialog onClick={() => reviewDialogRef.current?.close?.()}><i className="bi bi-x-circle" aria-hidden="true"></i><span>{t("admin_tenants.common.cancel")}</span></button>
            <button type="submit" className="btn btn-danger" id="rejectRevenueSharePayment" disabled={reviewSaving}><i className="bi bi-x-octagon" aria-hidden="true"></i><span>{t("admin_tenants.review.reject")}</span></button>
          </div>
        </form>
      </dialog>

      <dialog id="lalamoveWalletDialog" className="tenant-dialog lalamove-wallet-dialog" aria-labelledby="lalamoveWalletDialogTitle" ref={walletDialogRef}>
        <div className="tenant-dialog-card">
          <div className="tenant-dialog-head">
            <div className="tenant-dialog-title">
              <span className="tenant-dialog-icon"><i className="bi bi-wallet2" aria-hidden="true"></i></span>
              <div><span className="tenant-dialog-eyebrow">{t("admin_tenants.wallet.label")}</span><h2 id="lalamoveWalletDialogTitle">{t("admin_tenants.wallet.title")}</h2><p id="lalamoveWalletTenantName">{walletTenant?.name || walletTenant?.slug || walletTenant?.id || "-"}</p></div>
            </div>
            <button type="button" className="tenant-dialog-close" data-close-wallet-dialog aria-label={t("admin_tenants.common.close")} onClick={closeWallet}><i className="bi bi-x-lg" aria-hidden="true"></i></button>
          </div>
          <div className="tenant-dialog-body">
            <div className="tenant-wallet-summary">
              <span>{t("admin_tenants.wallet.balance")}</span>
              <strong id="lalamoveWalletBalance">{money(wallet?.balance || 0)}</strong>
              <small>{t("admin_tenants.wallet.credit_unit")}</small>
            </div>
            <div className="tenant-wallet-phase-note">{t("admin_tenants.wallet.credit_note")}</div>
            <div className="tenant-wallet-history-head"><strong>{t("admin_tenants.wallet.topups")}</strong></div>
            <div id="lalamoveWalletTopups" className="tenant-wallet-history">
              {walletLoading ? (
                <div className="tenant-list-loading">{t("admin_tenants.wallet.loading")}</div>
              ) : wallet?.error ? (
                <div className="upload-error">{t("admin_tenants.wallet.load_failed")}</div>
              ) : Array.isArray(wallet?.topups) && wallet.topups.length ? wallet.topups.map(item => {
                const pending = String(item.status || "") === "pending";
                const statusKey = `admin_tenants.wallet.statuses.${String(item.status || "pending")}`;
                const submitted = item.submittedAt
                  ? new Intl.DateTimeFormat(intlLocale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(item.submittedAt))
                  : "-";
                return (
                  <div className={`tenant-wallet-row tenant-wallet-topup-row ${item.status || "pending"}`} key={item.id}>
                    <div className="tenant-wallet-topup-copy">
                      <strong>{money(item.amount)} {t("admin_tenants.wallet.credit_unit")} · {t(statusKey)}</strong>
                      <small>{submitted}{item.verificationStatus ? ` · ${item.verificationStatus}` : ""}{item.reviewNote ? ` · ${item.reviewNote}` : ""}</small>
                    </div>
                    <div className="tenant-wallet-topup-actions">
                      <button className="btn btn-sm" type="button" data-wallet-topup-slip={item.id} onClick={() => openWalletSlip(item)} disabled={!item.slip?.path && !item.slip?.url}>
                        <i className="bi bi-eye" aria-hidden="true"></i><span>{t("admin_tenants.wallet.view_slip")}</span>
                      </button>
                      {pending ? <>
                        <button className="btn btn-primary btn-sm" type="button" data-wallet-topup-approve={item.id} disabled={walletReviewBusy === item.id} onClick={() => reviewWalletTopup(item, "approve")}>
                          <i className="bi bi-check-lg" aria-hidden="true"></i><span>{t("admin_tenants.wallet.approve")}</span>
                        </button>
                        <button className="btn btn-danger btn-sm" type="button" data-wallet-topup-reject={item.id} disabled={walletReviewBusy === item.id} onClick={() => reviewWalletTopup(item, "reject")}>
                          <i className="bi bi-x-lg" aria-hidden="true"></i><span>{t("admin_tenants.wallet.reject")}</span>
                        </button>
                      </> : null}
                    </div>
                  </div>
                );
              }) : (
                <div className="tenant-wallet-empty">{t("admin_tenants.wallet.topup_empty")}</div>
              )}
            </div>

            <div className="tenant-wallet-history-head tenant-wallet-ledger-head"><strong>{t("admin_tenants.wallet.history")}</strong></div>
            <div id="lalamoveWalletHistory" className="tenant-wallet-history">
              {walletLoading ? (
                <div className="tenant-list-loading">{t("admin_tenants.wallet.loading")}</div>
              ) : wallet?.error ? (
                <div className="upload-error">{t("admin_tenants.wallet.load_failed")}</div>
              ) : Array.isArray(wallet?.transactions) && wallet.transactions.length ? wallet.transactions.map(row => {
                const credit = row.direction === "credit";
                const typeKey = `admin_tenants.wallet.types.${String(row.type || "adjustment")}`;
                const created = row.createdAt
                  ? new Intl.DateTimeFormat(intlLocale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(row.createdAt))
                  : "-";
                const reference = row.orderId || row.reference || row.lalamoveOrderId || "";
                return (
                  <div className={`tenant-wallet-row ${credit ? "credit" : "debit"}`} key={row.id}>
                    <div><strong>{t(typeKey)}</strong><small>{created}{reference ? ` · ${reference}` : ""}</small></div>
                    <span>{credit ? "+" : "−"}{money(row.amount)} {t("admin_tenants.wallet.credit_unit")}</span>
                  </div>
                );
              }) : (
                <div className="tenant-wallet-empty">{t("admin_tenants.wallet.empty")}</div>
              )}
            </div>
          </div>
          <div className="tenant-dialog-actions">
            <button type="button" className="btn btn-danger" data-close-wallet-dialog onClick={closeWallet}><i className="bi bi-x-circle" aria-hidden="true"></i><span>{t("admin_tenants.common.close")}</span></button>
          </div>
        </div>
      </dialog>

      <dialog id="lalamoveWalletTopupSlipDialog" className="tenant-dialog revenue-share-slip-dialog" aria-labelledby="lalamoveWalletTopupSlipDialogTitle" ref={walletSlipDialogRef} onCancel={event => event.preventDefault()}>
        <div className="tenant-dialog-card">
          <div className="tenant-dialog-head">
            <div className="tenant-dialog-title">
              <span className="tenant-dialog-icon"><i className="bi bi-receipt" aria-hidden="true"></i></span>
              <div><span className="tenant-dialog-eyebrow">{t("admin_tenants.wallet.label")}</span><h2 id="lalamoveWalletTopupSlipDialogTitle">{t("admin_tenants.wallet.view_slip")}</h2><p id="lalamoveWalletTopupSlipTenantName">{walletTenant?.name || walletTenant?.slug || walletTenant?.id || "-"}</p></div>
            </div>
            <button type="button" className="tenant-dialog-close" data-close-wallet-slip-dialog aria-label={t("admin_tenants.common.close")} onClick={closeWalletSlip}><i className="bi bi-x-lg" aria-hidden="true"></i></button>
          </div>
          <div className="tenant-dialog-body">
            <div className="revenue-share-slip-preview">
              {walletSlipUrl && String(walletSlipItem?.slip?.mime || "").startsWith("image/")
                ? <img id="lalamoveWalletTopupSlipImage" src={walletSlipUrl} alt={t("admin_tenants.wallet.view_slip")} />
                : <iframe id="lalamoveWalletTopupSlipFrame" title={t("admin_tenants.wallet.view_slip")} src={walletSlipUrl || "about:blank"} loading="eager"></iframe>}
            </div>
          </div>
          <div className="tenant-dialog-actions revenue-share-slip-actions">
            <button type="button" className="btn btn-danger" data-close-wallet-slip-dialog onClick={closeWalletSlip}><i className="bi bi-x-circle" aria-hidden="true"></i><span>{t("admin_tenants.common.close")}</span></button>
          </div>
        </div>
      </dialog>

      <dialog id="revenueShareSlipDialog" className="tenant-dialog revenue-share-slip-dialog" aria-labelledby="revenueShareSlipDialogTitle" ref={slipDialogRef} onCancel={e => e.preventDefault()}>
        <div className="tenant-dialog-card">
          <div className="tenant-dialog-head">
            <div className="tenant-dialog-title">
              <span className="tenant-dialog-icon"><i className="bi bi-receipt" aria-hidden="true"></i></span>
              <div><span className="tenant-dialog-eyebrow">{t("admin_tenants.review.dialog_eyebrow")}</span><h2 id="revenueShareSlipDialogTitle">{t("admin_tenants.review.slip_title")}</h2><p id="revenueShareSlipTenantName">{slipItem?.tenant?.name || slipItem?.tenant?.id || "-"}</p></div>
            </div>
            <button type="button" className="tenant-dialog-close" data-close-slip-dialog aria-label={t("admin_tenants.common.close")} onClick={closeSlip}><i className="bi bi-x-lg" aria-hidden="true"></i></button>
          </div>
          <div className="tenant-dialog-body">
            <div className="revenue-share-slip-preview">
              {slipUrl && String(slipItem?.slip?.mime || "").startsWith("image/")
                ? <img id="revenueShareSlipImage" src={slipUrl} alt={t("admin_tenants.review.slip_title")} />
                : <iframe id="revenueShareSlipFrame" title={t("admin_tenants.review.slip_title")} src={slipUrl || "about:blank"} loading="eager"></iframe>}
            </div>
          </div>
          <div className="tenant-dialog-actions revenue-share-slip-actions">
            <button type="button" className="btn btn-danger" data-close-slip-dialog onClick={closeSlip}><i className="bi bi-x-circle" aria-hidden="true"></i><span>{t("admin_tenants.common.close")}</span></button>
          </div>
        </div>
      </dialog>

      <ParityFooter />
    </>
  );
}
