import { M7StripeTestShadowHistory } from "@/components/M7StripeTestShadowHistory";
import { M7OperationalFinanceReadiness } from "@/components/M7OperationalFinanceReadiness";
import { M7SourceMigrationPreflight } from "@/components/M7SourceMigrationPreflight";
import { M7FinanceEvidenceHistory } from "@/components/M7FinanceEvidenceHistory";
import { PlatformStripeWalletSandboxHistory } from "@/components/BankalertStripeHistory";
import { PlatformPaymentHistory } from "@/components/PlatformPaymentHistory";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { useAuth } from "@/auth/AuthProvider";
import { storage } from "@/firebase/client";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { TenantControlPanel } from "@/components/TenantControlPanel";
import { TenantSubscriptionControl } from "@/components/TenantSubscriptionControl";
import { TenantProvisionRecoveryNotice } from "@/components/TenantProvisionRecoveryNotice";
import { ParityFooter } from "@/components/ParityFooter";
import { UserMenu } from "@/components/UserMenu";
import { sweetConfirm, sweetPrompt } from "@/components/sweetDialog";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { loadAdminSubscriptionPricing } from "@/data/subscriptionPricing";
import {
  readPendingProvision, holdPendingProvision, releasePendingProvision,
  validateProvisionStatus, canonicalOwnerMatches, isProvisionUnknownError,
} from "@/data/tenantProvisionRecovery.mjs";
import {
  readPendingSubscription, holdPendingSubscription, releasePendingSubscription,
  validateSubscriptionWrite, validateSubscriptionOperation,
  canonicalSubscriptionMatches, subscriptionUnknownError,
} from "@/data/tenantSubscriptionRecovery.mjs";
import {
  readPendingMasterEdit, holdPendingMasterEdit, releasePendingMasterEdit,
  masterSnapshot, validateMasterEditWrite, validateMasterEditOperation,
  canonicalMasterMatches, masterUnknownError,
} from "@/data/tenantMasterEditRecovery.mjs";
import { TenantMasterEditRecoveryNotice } from "@/components/TenantMasterEditRecoveryNotice";
import { TenantDeletionRecoveryNotice } from "@/components/TenantDeletionRecoveryNotice";
import {
  readPendingDeletion, holdPendingDeletion, releasePendingDeletion,
  validateDeletionSafety, validateDeletionWrite, validateDeletionStatus,
  canonicalTenantAbsent, deletionReasonLabel,
} from "@/data/tenantSafeDeletionRecovery.mjs";
import { EMPTY_PLATFORM_ADMIN_NOTIFICATIONS, loadPlatformAdminNotificationSummary } from "@/data/platformAdminNotifications";
import {
  createActiveTenantWithOwner,
  getPlatformTenantProvisionStatus,
  createTenant,
  deleteTenant,
  getPlatformTenantDeletionSafety,
  getPlatformTenantDeletionStatus,
  getPlatformRevenueShareSummary,
  getTenantLalamoveWallet,
  listPlatformRevenueSharePayments,
  listTenants,
  reconcileRevenueShare,
  reviewRevenueSharePayment,
  reviewTenantLalamoveWalletTopup,
  unlockTenantRevenueShare,
  updateTenantMasterAtomic,
  getPlatformTenantMasterEditOperation,
  updateTenantLalamoveApproval,
  updateTenantSubscription,
  getPlatformTenantSubscriptionOperation,
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

// Source TenantControlPanel already owns the visible store identity, summary,
// status and primary actions. Only preserve PENGUIN-specific maintenance tools
// that are not present in its source JSX; never nest a second tenant card.
function TenantMaintenanceControls({
  tenant, summary = {}, t, intlLocale, onUnlock, onSubscriptionAction,
  subscriptionWriteUnconfirmed = false, subscriptionCheckBusy = false,
  onCheckSubscription,
}) {
  const shareEnabled = tenant.billingMode === "revenue_share" ||
    summary.revenueShareEnabled === true;
  return (
    <div className="tenant-control-maintenance" data-tenant-maintenance={tenant.id}>
      {tenant.onboardingRequired === true && !tenant.ownerUid ? (
        <Link to="/platform/owners" className="btn btn-primary btn-sm"
          data-tenant-owner-pending={tenant.id}>
          <i className="bi bi-person-plus" aria-hidden="true"></i>
          <span>สร้าง Owner เพื่อเปิดใช้งานร้าน</span>
        </Link>
      ) : null}
      {shareEnabled && tenant.accessStatus === "revenue_share_suspended" ? (
        <button className="btn btn-sm tenant-share-unlock-button" type="button"
          data-unlock-revenue-share={tenant.id} onClick={() => onUnlock(tenant)}>
          <i className="bi bi-unlock" aria-hidden="true"></i>
          <span>{t("admin_tenants.tenant.unlock_revenue_share")}</span>
        </button>
      ) : null}
      {!shareEnabled && tenant.billingPolicyVersion !== "hybrid_v1" ?
        <TenantSubscriptionControl tenant={tenant} t={t} intlLocale={intlLocale}
          onAction={onSubscriptionAction}
          writeUnconfirmed={subscriptionWriteUnconfirmed}
          checking={subscriptionCheckBusy}
          onCheck={onCheckSubscription} /> : null}
    </div>
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
      "new-tenant-setup-port.css",
      "tenant-control-panel-port.css",
      "revenue-share-slip-dialog.css",
      "super-admin-header.css",
    ],
    attributes: { "data-roles": "super_admin" },
  });
  const dialogRef = useRef(null);
  const createOperationIdRef = useRef("");
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
  const [form, setForm] = useState({ name: "", slug: "", phone: "", address: "", businessType: "both", ownerName: "", ownerEmail: "", ownerPassword: "", confirmPassword: "", planCode: "monthly" });
  const [uncertainTenantWrites, setUncertainTenantWrites] = useState({});
  const [uncertainSubscriptionWrites, setUncertainSubscriptionWrites] = useState({});
  const [subscriptionCheckBusy, setSubscriptionCheckBusy] = useState("");
  const [pendingProvisionId, setPendingProvisionId] = useState("");
  const [provisionChecking, setProvisionChecking] = useState(false);
  const [masterEditChecking, setMasterEditChecking] = useState("");
  const tenantDeleteBusyRef = useRef(false);
  const [deletionPending,setDeletionPending] = useState(null);
  const [deletionChecking,setDeletionChecking] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewStatus, setReviewStatus] = useState("pending");
  const [reviewCounts, setReviewCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [reviewItems, setReviewItems] = useState([]);
  const [paymentHistoryRevision, setPaymentHistoryRevision] = useState(0);
  const [shareTenant, setShareTenant] = useState(null);
  const [centralDeliveryPricing, setCentralDeliveryPricing] = useState(null);
  const [centralPricingLoading, setCentralPricingLoading] = useState(false);
  const [shareError, setShareError] = useState("");
  const centralShareRequestRef = useRef(0);
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

  useEffect(() => {
    if (profile?.role !== "super_admin" || !authState.user?.uid) return;
    const saved = readPendingProvision(authState.user.uid);
    setPendingProvisionId(saved || "");
    setUncertainTenantWrites(current => ({
      ...current, __create__: Boolean(saved),
    }));
    if (saved) createOperationIdRef.current = saved;
  }, [authState.user?.uid, profile?.role]);

  useEffect(()=>{
    setDeletionPending(readPendingDeletion(authState.user?.uid));
  },[authState.user?.uid]);

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
      setPaymentHistoryRevision(v => v + 1);
    } catch (error) {
      console.error("REVENUE_SHARE_REVIEW_LOAD_FAILED", error);
      setReviewItems([]);
    }
  }, [reviewStatus, tenantId]);

  useEffect(() => {
    if (profile?.role !== "super_admin") return;
    // Read only. Historical subscription backfills are never a side effect
    // of opening the tenant directory, to avoid new trials for old stores.
    loadTenantList();
  }, [profile?.role, loadTenantList]);

  useEffect(() => {
    if (profile?.role !== "super_admin" || !authState.user?.uid) return;
    const uid = authState.user.uid;
    setUncertainSubscriptionWrites(current => {
      const next = { ...current };
      let changed = false;
      for (const tenant of tenants) {
        const pending = Boolean(readPendingSubscription(uid,tenant.id));
        if (Boolean(next[tenant.id]) !== pending) {
          next[tenant.id] = pending;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [authState.user?.uid, profile?.role, tenants]);

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
    const recovered = readPendingProvision(authState.user?.uid);
    createOperationIdRef.current = recovered || crypto.randomUUID();
    setPendingProvisionId(recovered || "");
    setUncertainTenantWrites(current => ({
      ...current, __create__: Boolean(recovered),
    }));
    setForm({ name: "", slug: "", phone: "", address: "", businessType: "both", ownerName: "", ownerEmail: "", ownerPassword: "", confirmPassword: "", planCode: "monthly" });
    setSlugEdited(false);
    setStatus(recovered ? "มีคำขอสร้างร้านที่ยังตรวจสอบผลไม่ครบ กรุณาตรวจสถานะคำขอเดิมก่อน ไม่ส่งคำขอใหม่ซ้ำ" : "");
    dialogRef.current?.showModal?.();
  };

  const reconcileProvision = async () => {
    const uid = authState.user?.uid;
    const operationId = readPendingProvision(uid);
    if (!operationId || provisionChecking) return;
    setProvisionChecking(true);
    setStatus("");
    try {
      const checked = validateProvisionStatus(
        await getPlatformTenantProvisionStatus({ operationId }), operationId,
      );
      if (checked.status === "complete_verified") {
        // A server result is not sufficient by itself: independently re-read
        // the canonical tenant list from this Superadmin session.
        const canonical = await listTenants();
        if (!canonicalOwnerMatches(canonical, checked))
          throw new Error("TENANT_WRITE_UNCONFIRMED");
        setTenants(canonical);
        releasePendingProvision(uid, operationId);
        setPendingProvisionId("");
        setUncertainTenantWrites(current => ({ ...current, __create__: false }));
        createOperationIdRef.current = crypto.randomUUID();
        setStatus("ยืนยันแล้ว: ร้านและ Owner ถูกสร้างพร้อมสิทธิ์ครบ ตรวจพบข้อมูลตรงกันทั้งสองแหล่ง");
        showToast("ยืนยันการสร้างร้านและ Owner สำเร็จ");
        dialogRef.current?.close?.();
        void loadSales();
      } else if (checked.status === "failed_released") {
        // Only explicit terminal server rollback is safe to clear.
        releasePendingProvision(uid, operationId);
        setPendingProvisionId("");
        setUncertainTenantWrites(current => ({ ...current, __create__: false }));
        createOperationIdRef.current = crypto.randomUUID();
        setStatus("เซิร์ฟเวอร์ยืนยันว่าคำขอเดิมไม่สำเร็จและคืน Slug แล้ว สามารถกรอกข้อมูลใหม่และส่งคำขอใหม่ได้");
      } else if (checked.status === "not_found") {
        setStatus("ยังไม่พบทะเบียนคำขอนี้ อาจเป็นการเชื่อมต่อขาดหายก่อนเซิร์ฟเวอร์รับคำขอ ห้ามสร้างซ้ำทันที กรุณาตรวจสอบกับผู้ดูแลระบบ");
      } else if (checked.status === "pending_review") {
        setStatus("คำขอยังรอการตรวจสอบสถานะ Owner/Firestore ห้ามส่งคำขอซ้ำหรือใช้ Slug เดิมจนกว่าจะยืนยัน");
      } else {
        setStatus("หลักฐาน Auth/Owner/ร้าน ไม่ตรงกัน ต้องให้ผู้ดูแลตรวจสอบก่อนสร้างคำขออื่น");
      }
    } catch (error) {
      console.warn("TENANT_PROVISION_RECONCILIATION_FAILED", error?.code || error?.message);
      setStatus("ไม่สามารถรับรองสถานะคำขอจากเซิร์ฟเวอร์ได้ เก็บเลขคำขอเดิมไว้และห้ามส่งซ้ำ");
      showToast("ยังตรวจยืนยันคำขอเดิมไม่ได้", "error");
    } finally {
      setProvisionChecking(false);
    }
  };
  const openEdit = tenant => {
    setEditing(tenant);
    const saved=readPendingMasterEdit(authState.user?.uid,tenant.id);
    setUncertainTenantWrites(current=>({...current,[tenant.id]:Boolean(saved)}));
    setForm({
      name: tenant.name || "",
      slug: tenant.slug || "",
      phone: tenant.shopPhone || "",
      address: tenant.shopAddress || "",
      businessType: tenant.businessType || (tenant.businessUnits?.length === 1 ? (tenant.businessUnits[0] === "retail_pos" ? "retail" : "restaurant_cafe") : "both"),
    });
    setSlugEdited(true);
    setStatus(saved
      ? "มีคำสั่งแก้ไขร้านที่ยังยืนยันผลไม่ครบ ห้ามบันทึกซ้ำ กรุณาตรวจสถานะคำสั่งเดิม"
      : "");
    dialogRef.current?.showModal?.();
  };

  const closeShare = () => {
    centralShareRequestRef.current += 1;
    shareDialogRef.current?.close?.();
    setShareTenant(null);
    setCentralDeliveryPricing(null);
    setCentralPricingLoading(false);
    setShareError("");
  };

  const openShare = async tenant => {
    const requestId = ++centralShareRequestRef.current;
    setShareTenant(tenant);
    setCentralDeliveryPricing(null); // Never show a previous Tenant's or cached policy values.
    setCentralPricingLoading(true);
    setShareError("");
    if (!shareDialogRef.current?.open) shareDialogRef.current?.showModal?.();
    try {
      const result = await loadAdminSubscriptionPricing();
      if (centralShareRequestRef.current !== requestId) return;
      // A real Super Admin-configured policy must exist; don't silently substitute defaults.
      if (!result.exists) throw new Error("CENTRAL_DELIVERY_PRICING_MISSING");
      setCentralDeliveryPricing(result.config);
    } catch (error) {
      if (centralShareRequestRef.current !== requestId) return;
      console.error("CENTRAL_DELIVERY_PRICING_LOAD_FAILED", error);
      setShareError(intlLocale.startsWith("th")
        ? "ไม่สามารถโหลดเงื่อนไข Delivery จากส่วนกลางได้ กรุณาลองใหม่อีกครั้ง"
        : "Failed to load central Delivery settings. Please retry.");
    } finally {
      if (centralShareRequestRef.current === requestId) setCentralPricingLoading(false);
    }
  };

  const openRevenueNotice = tenant => {
    setTenantId(String(tenant?.id || ""));
    setReviewStatus("all");
    window.setTimeout(() => document.getElementById("tenantShareReviewTitle")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
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

  const reconcileMasterEdit = async tenant => {
    const uid=authState.user?.uid;
    const op=readPendingMasterEdit(uid,tenant.id);
    if(!op||masterEditChecking)return;
    setMasterEditChecking(tenant.id);
    try{
      const checked=validateMasterEditOperation(
        await getPlatformTenantMasterEditOperation({
          tenantId:tenant.id,operationId:op,
        }),tenant.id,op,
      );
      if(checked.status==="complete_current"){
        const canonical=await listTenants();
        if(!canonicalMasterMatches(canonical,checked.master))
          throw new Error("MASTER_EDIT_RECONCILE_CANONICAL_MISMATCH");
        setTenants(canonical);
        releasePendingMasterEdit(uid,tenant.id,op);
        setUncertainTenantWrites(current=>({...current,[tenant.id]:false}));
        setStatus("");
        showToast("ยืนยันแล้ว: ชื่อร้าน, Slug, ข้อมูลติดต่อ และข้อมูลพนักงานตรงกับ Firebase");
        dialogRef.current?.close?.();
        void loadSales();
      }else if(checked.status==="complete_superseded"){
        const canonical=await listTenants();
        if(!canonical.some(row=>row.id===tenant.id))
          throw new Error("MASTER_EDIT_RECONCILE_CANONICAL_MISMATCH");
        setTenants(canonical);
        releasePendingMasterEdit(uid,tenant.id,op);
        setUncertainTenantWrites(current=>({...current,[tenant.id]:false}));
        setStatus("");
        showToast("คำสั่งเดิมบันทึกแล้ว แต่มีการแก้ไขที่ใหม่กว่า กรุณาตรวจข้อมูลร้านล่าสุด");
        dialogRef.current?.close?.();
      }else{
        setStatus("ยังไม่สามารถยืนยันคำสั่งเดิมจากเซิร์ฟเวอร์ได้ กรุณาตรวจสอบกับผู้ดูแล ห้ามส่งคำสั่งใหม่");
      }
    }catch(error){
      console.warn("MASTER_EDIT_RECOVERY_UNVERIFIED",error?.code||error?.message);
      setStatus("ไม่สามารถยืนยันผลแก้ไขร้านจาก Firebase ได้ กรุณาตรวจสอบก่อนส่งคำสั่งซ้ำ");
      showToast("ยังตรวจยืนยันคำสั่งแก้ไขร้านเดิมไม่ได้","error");
    }finally{setMasterEditChecking("");}
  };

  const submitMasterEdit = async (tenant,fields) => {
    const uid=authState.user?.uid,tenantId=String(tenant.id||"");
    if(saving||uncertainTenantWrites[tenantId]||
       readPendingMasterEdit(uid,tenantId)){
      showToast("มีคำสั่งแก้ไขร้านที่ต้องตรวจผลก่อน ห้ามส่งรายการซ้ำ","error");
      return;
    }
    if(fields.slug!==tenant.slug){
      const confirmed=await sweetConfirm(
        "ยืนยันเปลี่ยน URL ร้านเป็น /"+fields.slug+"? ลิงก์เดิม /"+
         tenant.slug+" จะถูกยกเลิกหลังบันทึกสำเร็จ",
        {title:"ยืนยันการเปลี่ยน Slug ร้านค้า",
         confirmText:"เปลี่ยน Slug",cancelText:t("admin_tenants.common.cancel"),
         type:"warning"},
      );
      if(!confirmed)return;
    }
    const operationId=crypto.randomUUID();
    if(!holdPendingMasterEdit(uid,tenantId,operationId)){
      setStatus("เบราว์เซอร์ไม่สามารถเก็บรหัสคำสั่งได้ เพื่อป้องกันเปลี่ยน Slug ซ้ำจึงยังไม่บันทึก");
      return;
    }
    const payload={...fields,tenantId,operationId,...masterSnapshot(tenant)};
    setUncertainTenantWrites(current=>({...current,[tenantId]:true}));
    setSaving(true);
    setStatus("");
    try{
      const saved=validateMasterEditWrite(
        await updateTenantMasterAtomic(payload),payload,
      );
      const checked=validateMasterEditOperation(
        await getPlatformTenantMasterEditOperation({tenantId,operationId}),
        tenantId,operationId,
      );
      if(checked.status!=="complete_current"||
         JSON.stringify(checked.master)!==JSON.stringify(saved.master))
        throw new Error("MASTER_EDIT_WRITE_UNCONFIRMED");
      const canonical=await listTenants();
      if(!canonicalMasterMatches(canonical,saved.master))
        throw new Error("MASTER_EDIT_WRITE_UNCONFIRMED");
      setTenants(canonical);
      releasePendingMasterEdit(uid,tenantId,operationId);
      setUncertainTenantWrites(current=>({...current,[tenantId]:false}));
      showToast(t("admin_tenants.tenant.updated"));
      dialogRef.current?.close?.();
      void loadSales();
    }catch(error){
      console.warn("MASTER_EDIT_COMMIT_UNVERIFIED",error?.code||error?.message);
      const definite=error?.code==="functions/invalid-argument";
      if(definite){
        releasePendingMasterEdit(uid,tenantId,operationId);
        setUncertainTenantWrites(current=>({...current,[tenantId]:false}));
        setStatus("ข้อมูลร้านไม่ถูกต้อง กรุณาตรวจสอบชื่อ Slug ประเภทกิจการ และข้อมูลติดต่อ");
      }else{
        setUncertainTenantWrites(current=>({...current,[tenantId]:true}));
        setStatus(masterUnknownError(error)
          ?"ยังยืนยันผลการบันทึกจากเซิร์ฟเวอร์ไม่ได้ ให้ใช้ปุ่มตรวจคำสั่งเดิม ห้ามกดบันทึกซ้ำ"
          :"มีคำสั่งที่ต้องตรวจสอบจาก Firebase ก่อนแก้ไขร้านอีกครั้ง ห้ามส่งคำสั่งใหม่");
      }
      showToast("ยังไม่สามารถยืนยันการบันทึกข้อมูลร้านได้","error");
    }finally{setSaving(false);}
  };

  const submitTenant = async event => {
    event.preventDefault();
    const writeKey = editing ? String(editing.id) : "__create__";
    if (saving || uncertainTenantWrites[writeKey]) return;
    const payload = {
      ...(editing ? { tenantId: editing.id } : {}),
      name: form.name.trim(),
      slug: normalizeSlug(form.slug),
      phone: form.phone.trim(),
      address: form.address.trim(),
      businessType: form.businessType,
    };
    if (!payload.name || !payload.slug) return;
    if (editing) {
      await submitMasterEdit(editing,payload);
      return;
    }
    if (!editing && form.ownerPassword !== form.confirmPassword) {
      setStatus("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }
    if (!editing) {
      const operationId = createOperationIdRef.current;
      if (!holdPendingProvision(authState.user?.uid, operationId)) {
        setStatus("เบราว์เซอร์เก็บเลขคำขอชั่วคราวไม่ได้ จึงยังไม่ส่งการสร้างร้าน เพื่อป้องกันการสร้าง Owner ซ้ำ");
        return;
      }
      setPendingProvisionId(operationId);
      Object.assign(payload, {
        ownerName: form.ownerName.trim(), ownerEmail: form.ownerEmail.trim(),
        ownerPassword: form.ownerPassword, planCode: form.planCode,
        operationId,
      });
    }
    setSaving(true);
    setStatus("");
    try {
      {
        // The server reserves the tenant slug and creates Owner, membership
        // and the first free month as one confirmed logical operation.
        const created = await createActiveTenantWithOwner(payload);
        if (created?.ok !== true || created?.tenantActivated !== true ||
          created?.planCode !== form.planCode || !created.owner?.uid ||
          created.owner.role !== "owner" || !created.tenant?.id) {
          throw new Error("TENANT_WRITE_UNCONFIRMED");
        }
        // Independently inspect Auth + reserved slug + both Firestore
        // identities, then re-read the canonical tenant list. A successful
        // Callable response alone is not proof of a usable Owner account.
        const verified = validateProvisionStatus(
          await getPlatformTenantProvisionStatus({operationId: payload.operationId}),
          payload.operationId,
        );
        if (verified.status !== "complete_verified" ||
          verified.owner.uid !== created.owner.uid ||
          verified.tenant.id !== created.tenant.id)
          throw new Error("TENANT_WRITE_UNCONFIRMED");
        const canonical = await listTenants();
        const saved = canonical.find(row => row.id === created.tenant.id);
        if (!saved || saved.active !== true || saved.onboardingRequired === true ||
          saved.name !== payload.name || saved.slug !== payload.slug ||
          saved.planCode !== form.planCode || saved.ownerUid !== created.owner.uid ||
          saved.ownerEmail !== payload.ownerEmail.toLowerCase() ||
          saved.ownerDisplayName !== payload.ownerName) {
          throw new Error("TENANT_WRITE_UNCONFIRMED");
        }
        setTenants(canonical);
        releasePendingProvision(authState.user?.uid, payload.operationId);
        setPendingProvisionId("");
        setUncertainTenantWrites(current => ({ ...current, __create__: false }));
        createOperationIdRef.current = crypto.randomUUID();
      }
      showToast(t(editing ? "admin_tenants.tenant.updated" : "admin_tenants.tenant.created"));
      dialogRef.current?.close?.();
      await Promise.all([loadTenantList(), loadSales()]);
    } catch (error) {
      console.error("TENANT_SAVE_FAILED", error?.code || error?.message);
      let message = t(editing ? "admin_tenants.tenant.update_failed" : "admin_tenants.tenant.create_failed");
      let definitiveSafeToRetry = false;
      if (error?.message === "TENANT_WRITE_UNCONFIRMED" ||
        isProvisionUnknownError(error)) {
        setUncertainTenantWrites(current => ({ ...current, [writeKey]: true }));
        message = "ยังยืนยันผลการสร้างร้านและ Owner ไม่ได้ กรุณารีโหลดและตรวจสอบข้อมูลก่อนส่งคำสั่งซ้ำ";
      } else if (error?.code === "functions/already-exists") {
        // This is a definitive rejection, but must confirm the matching
        // operation was never reserved or was safely rolled back before
        // allowing a new UUID/slug/email. Never treat a stale reply as proof.
        message = "Slug หรืออีเมล Owner นี้ถูกใช้งานแล้ว กรุณาตรวจสถานะคำขอเดิมก่อนส่งซ้ำ";
        if (!editing) {
          try {
            const checked = validateProvisionStatus(
              await getPlatformTenantProvisionStatus({ operationId: payload.operationId }),
              payload.operationId,
            );
            if (checked.status === "not_found" || checked.status === "failed_released") {
              definitiveSafeToRetry = releasePendingProvision(
                authState.user?.uid, payload.operationId,
              );
              if (definitiveSafeToRetry) {
                setPendingProvisionId("");
                createOperationIdRef.current = crypto.randomUUID();
                message = "ระบบยืนยันว่าไม่สร้างร้านและ Owner จากคำขอนี้ กรุณาแก้ Slug หรืออีเมลก่อนส่งใหม่";
              }
            }
          } catch {
            // Read uncertainty must keep the write lock, even for an HTTP 409.
          }
        }
      } else if (error?.code === "functions/failed-precondition") {
        message = "ยังไม่พร้อมสร้างร้าน กรุณาตรวจสอบราคาแพ็กเกจจากส่วนกลางก่อน";
      } else if (error?.code === "functions/invalid-argument") {
        message = error.message || t("admin_tenants.tenant.invalid");
        // Server validation is performed before any reservation/Auth call.
        // A definite field-validation rejection may be corrected using
        // a FRESH UUID; never reuse the previous request identifier.
        if (!editing) {
          definitiveSafeToRetry = releasePendingProvision(
            authState.user?.uid, payload.operationId,
          );
          if (definitiveSafeToRetry) {
            setPendingProvisionId("");
            createOperationIdRef.current = crypto.randomUUID();
          }
        }
      }
      if (!editing) setUncertainTenantWrites(current => ({
        ...current, __create__: !definitiveSafeToRetry,
      }));
      setStatus(message);
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const reconcileDeletion = async () => {
    const uid=authState.user?.uid;
    const pending=readPendingDeletion(uid);
    if(!pending||deletionChecking)return;
    setDeletionChecking(true);
    try{
      const checked=validateDeletionStatus(
        await getPlatformTenantDeletionStatus(pending),pending,
      );
      if(checked.status!=="deleted_verified"){
        setStatus("คำสั่งลบเดิมยังไม่ยืนยันผลจาก Firebase กรุณาให้ผู้ดูแลตรวจสอบ ห้ามลบซ้ำ");
        return;
      }
      const canonical=await listTenants();
      if(!canonicalTenantAbsent(canonical,pending.tenantId))
        throw new Error("TENANT_DELETE_CANONICAL_STILL_PRESENT");
      if(!releasePendingDeletion(uid,pending))
        throw new Error("TENANT_DELETE_PENDING_RECEIPT_UNAVAILABLE");
      setDeletionPending(null);
      setTenants(canonical);
      setStatus("");
      showToast("ยืนยันแล้ว: ลบเฉพาะร้านทดสอบว่างและคืน Slug สำเร็จ");
      void loadSales();
    }catch(error){
      console.warn("TENANT_DELETE_RECOVERY_UNVERIFIED",error?.code||error?.message);
      setStatus("ยังไม่สามารถยืนยันผลการลบร้านจาก Firebase ได้ ต้องตรวจสอบก่อนทำรายการใหม่");
      showToast("ยังยืนยันการลบร้านไม่ได้","error");
    }finally{setDeletionChecking(false);}
  };

  const removeTenant = async tenant => {
    const uid=authState.user?.uid;
    const tenantId=String(tenant?.id||"");
    if(tenantDeleteBusyRef.current||readPendingDeletion(uid)||
      readPendingProvision(uid)||
      uncertainTenantWrites[tenantId]||
      readPendingMasterEdit(uid,tenantId)||
      readPendingSubscription(uid,tenantId)){
      showToast("มีคำสั่งร้านค้า/Owner/สมาชิกที่ต้องตรวจผลก่อน ห้ามลบหรือส่งคำสั่งซ้ำ","error");
      return;
    }
    tenantDeleteBusyRef.current=true;
    try{
      const preview=validateDeletionSafety(
        await getPlatformTenantDeletionSafety({tenantId}),tenantId,
      );
      if(!preview.ready){
        const detail=preview.reasonCodes.map(deletionReasonLabel).join(" • ");
        const message="ไม่สามารถลบร้านนี้ได้: "+(detail||"ต้องตรวจสอบข้อมูลร้าน");
        setStatus(message);
        showToast(message,"error");
        return;
      }
      const confirmed=await sweetConfirm(
        "ลบเฉพาะร้านทดสอบที่ยังไม่เคยเปิดใช้งานหรือมี Owner เท่านั้น: "+
          (tenant.name||tenantId)+" (/"+tenant.slug+
          ") — การลบนี้ถาวรและจะคืน Slug ไปใช้กับร้านอื่นได้",
        {title:"ยืนยันลบร้านทดสอบว่างเท่านั้น",
         confirmText:"ยืนยันลบถาวร",
         cancelText:t("admin_tenants.common.cancel"),
         type:"warning",danger:true},
      );
      if(!confirmed)return;
      const pending={tenantId,operationId:crypto.randomUUID()};
      if(!holdPendingDeletion(uid,pending)){
        setStatus("เบราว์เซอร์ไม่สามารถเก็บเลขคำสั่งได้ จึงไม่ส่งการลบ");
        return;
      }
      setDeletionPending(pending);
      const request={
        ...pending,expectedName:tenant.name,expectedSlug:tenant.slug,
        expectedRevision:tenant.masterEditRevision??0,
        intent:"delete_unowned_placeholder",
      };
      try{
        validateDeletionWrite(await deleteTenant(request),pending);
        const checked=validateDeletionStatus(
          await getPlatformTenantDeletionStatus(pending),pending,
        );
        if(checked.status!=="deleted_verified")
          throw new Error("TENANT_DELETE_WRITE_UNCONFIRMED");
        const canonical=await listTenants();
        if(!canonicalTenantAbsent(canonical,tenantId))
          throw new Error("TENANT_DELETE_WRITE_UNCONFIRMED");
        if(!releasePendingDeletion(uid,pending))
          throw new Error("TENANT_DELETE_WRITE_UNCONFIRMED");
        setDeletionPending(null);
        setTenants(canonical);
        setStatus("");
        showToast("ลบร้านทดสอบว่างสำเร็จ โดยไม่มีการลบ Owner หรือข้อมูลการเงิน");
        void loadSales();
      }catch(error){
        console.warn("TENANT_DELETE_UNCONFIRMED",error?.code||error?.message);
        if(error?.code==="functions/failed-precondition"||
           error?.code==="functions/invalid-argument"){
          // The server rejected before the mutation transaction committed.
          releasePendingDeletion(uid,pending);
          setDeletionPending(null);
          setStatus("สถานะร้านเปลี่ยนแล้ว หรือพบข้อมูลต้องเก็บรักษา กรุณารีเฟรชและตรวจสอบอีกครั้ง");
        }else{
          // Timeouts, "not found" on a delayed status read and uncertain
          // rejections can follow a COMMITTED delete: never re-submit.
          setStatus("ผลลบร้านยังไม่ยืนยัน ใช้ปุ่มตรวจสถานะคำสั่งเดิม ห้ามส่งคำสั่งใหม่");
        }
        showToast("ยังยืนยันผลการลบร้านไม่ได้","error");
      }
    }catch(error){
      console.warn("TENANT_DELETE_SAFETY_UNAVAILABLE",error?.code||error?.message);
      setStatus("ตรวจสอบสิทธิ์ลบร้านไม่ได้ จึงไม่ได้ส่งคำสั่งลบ");
      showToast("ยังตรวจสอบเงื่อนไขลบร้านไม่ได้","error");
    }finally{tenantDeleteBusyRef.current=false;}
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

  const reconcileSubscription = async tenant => {
    const uid = authState.user?.uid;
    const operationId = readPendingSubscription(uid, tenant.id);
    if (!operationId || subscriptionCheckBusy) return;
    setSubscriptionCheckBusy(tenant.id);
    try {
      const checked = validateSubscriptionOperation(
        await getPlatformTenantSubscriptionOperation({
          tenantId: tenant.id, operationId,
        }), tenant.id, operationId,
      );
      if (checked.status === "complete_current") {
        const canonical = await listTenants();
        const receipt = {
          tenantId: tenant.id,
          status: checked.tenant.subscriptionStatus,
          active: checked.tenant.active,
          planCode: checked.tenant.planCode,
          gracePeriodDays: checked.tenant.gracePeriodDays,
          expiresAt: checked.tenant.subscriptionExpiresAt,
          revision: checked.tenant.subscriptionAdminRevision,
        };
        if (!canonicalSubscriptionMatches(canonical, receipt))
          throw new Error("SUBSCRIPTION_WRITE_UNCONFIRMED");
        setTenants(canonical);
        releasePendingSubscription(uid, tenant.id, operationId);
        setUncertainSubscriptionWrites(current => ({ ...current, [tenant.id]: false }));
        showToast("ยืนยันผลการปรับสมาชิกจาก Firebase แล้ว");
      } else if (checked.status === "complete_superseded") {
        // This operation committed; a later canonical change superseded it.
        // Never replay the old command over another admin's newer data.
        const canonical = await listTenants();
        if (!canonical.some(row => row.id === tenant.id))
          throw new Error("SUBSCRIPTION_WRITE_UNCONFIRMED");
        setTenants(canonical);
        releasePendingSubscription(uid, tenant.id, operationId);
        setUncertainSubscriptionWrites(current => ({ ...current, [tenant.id]: false }));
        showToast("คำสั่งเดิมบันทึกแล้ว แต่มีข้อมูลใหม่กว่า โปรดตรวจรอบสมาชิกล่าสุด");
      } else {
        showToast("ยังยืนยันผลคำสั่งเดิมไม่ได้ กรุณาตรวจสอบกับผู้ดูแลก่อนส่งซ้ำ", "error");
      }
    } catch (error) {
      console.warn("SUBSCRIPTION_OPERATION_RECONCILIATION_FAILED",
        error?.code || error?.message);
      showToast("หลักฐานคำสั่งเดิมยังไม่ครบ ห้ามส่งรายการซ้ำ", "error");
    } finally {
      setSubscriptionCheckBusy("");
    }
  };

  const updateSubscription = async (tenant, command) => {
    const uid = authState.user?.uid;
    const tenantId = String(tenant.id || "");
    if (readPendingSubscription(uid, tenantId) ||
      uncertainSubscriptionWrites[tenantId]) {
      showToast("มีคำสั่งสมาชิกที่ต้องตรวจสอบก่อน ห้ามส่งซ้ำ", "error");
      return null;
    }
    if (command.action === "suspend" || command.action === "activate") {
      const confirmed = await sweetConfirm(
        command.action === "suspend"
          ? t("admin_tenants.subscription.suspend_confirm")
          : "ยืนยันการคืนสถานะสมาชิกจากการระงับด้วยตนเอง? ระบบจะไม่ปลด Hold การเงินหรือยอดค้างชำระ",
        {
          title: command.action === "suspend"
            ? t("admin_tenants.subscription.suspend_title") : "ยืนยันคืนสถานะสมาชิก",
          confirmText: command.action === "suspend"
            ? t("admin_tenants.subscription.suspend") : "ยืนยันคืนสถานะ",
          cancelText: t("admin_tenants.common.cancel"),
          type: "warning",
        },
      );
      if (!confirmed) return null;
    }
    const operationId = crypto.randomUUID();
    const payload = { ...command, tenantId, operationId };
    if (!holdPendingSubscription(uid, tenantId, operationId)) {
      showToast("ไม่สามารถเก็บรหัสคำสั่งในเบราว์เซอร์ได้ จึงไม่ส่งคำสั่งสมาชิก", "error");
      return null;
    }
    setUncertainSubscriptionWrites(current => ({ ...current, [tenantId]: true }));
    try {
      const response = validateSubscriptionWrite(
        await updateTenantSubscription(payload), payload,
      );
      const checked = validateSubscriptionOperation(
        await getPlatformTenantSubscriptionOperation({ tenantId, operationId }),
        tenantId, operationId,
      );
      if (checked.status !== "complete_current" ||
        checked.tenant.subscriptionAdminRevision !== response.revision)
        throw new Error("SUBSCRIPTION_WRITE_UNCONFIRMED");
      const canonical = await listTenants();
      if (!canonicalSubscriptionMatches(canonical, response))
        throw new Error("SUBSCRIPTION_WRITE_UNCONFIRMED");
      setTenants(canonical);
      releasePendingSubscription(uid, tenantId, operationId);
      setUncertainSubscriptionWrites(current => ({ ...current, [tenantId]: false }));
      showToast(t("admin_tenants.subscription.updated"));
      return response;
    } catch (error) {
      const code = String(error?.message || "");
      const definitive = error?.code === "functions/invalid-argument" ||
        (error?.code === "functions/failed-precondition" &&
        /^(SUBSCRIPTION_STALE_STATE|SUBSCRIPTION_.*(?:INVALID|REQUIRED|UNSUPPORTED|REVIEW|MISMATCH|HOLD)|SUBSCRIPTION_NOT_MANUALLY_SUSPENDED)$/.test(code));
      if (definitive) {
        releasePendingSubscription(uid, tenantId, operationId);
        setUncertainSubscriptionWrites(current => ({ ...current, [tenantId]: false }));
        showToast(code === "SUBSCRIPTION_STALE_STATE"
          ? "ข้อมูลสมาชิกร้านเปลี่ยนแล้ว กรุณาโหลดข้อมูลใหม่ก่อนบันทึก"
          : "ระบบปฏิเสธการเปลี่ยนสมาชิก กรุณาตรวจสอบสิทธิ์และรอบบัญชีเดิม", "error");
        await loadTenantList({ silent: true });
      } else {
        setUncertainSubscriptionWrites(current => ({ ...current, [tenantId]: true }));
        showToast(subscriptionUnknownError(error)
          ? "ไม่ยืนยันผลบันทึกได้ กรุณาใช้ปุ่มตรวจสถานะคำสั่งเดิมก่อนส่งซ้ำ"
          : "ยังตรวจผลคำสั่งสมาชิกจากเซิร์ฟเวอร์ไม่ได้ ห้ามส่งคำสั่งซ้ำ", "error");
      }
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
      const message = t("admin_tenants.wallet.slip_load_failed");
      setStatus(message);
      showToast(message, "error");
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
    return <PageReadyOverlay context="PENGUIN" title={t("shared.state.loading")} message={t("shared.state.please_wait")} />;
  }
  if (!profile) return <Navigate to="/login?next=%2Fadmin%2Ftenants" replace />;
  if (profile.role !== "super_admin") return <Navigate to="/" replace />;

  const money = value => formatNumber(Number(value || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const shareSummary = shareTenant ? (summaries[shareTenant.id] || {}) : {};
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

        {pendingProvisionId ? <TenantProvisionRecoveryNotice
          operationId={pendingProvisionId} checking={provisionChecking}
          busy={saving} onCheck={reconcileProvision} /> : null}

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

        <PlatformPaymentHistory tenantId={tenantId} refreshVersion={paymentHistoryRevision}/>
        <M7FinanceEvidenceHistory scope="platform" tenantId={tenantId} refreshVersion={paymentHistoryRevision}/>
        <M7OperationalFinanceReadiness tenantId={tenantId} refreshVersion={paymentHistoryRevision}/>
        <M7SourceMigrationPreflight tenantId={tenantId} refreshVersion={paymentHistoryRevision}/>
        <M7StripeTestShadowHistory tenantId={tenantId} refreshVersion={paymentHistoryRevision}/>

        <TenantDeletionRecoveryNotice pending={deletionPending}
          checking={deletionChecking} onCheck={reconcileDeletion}/>
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
                    <TenantControlPanel key={tenant.id}
                      tenant={tenant}
                      locale={intlLocale}
                      notifications={adminNotifications?.byTenant?.[tenant.id] || {}}
                      onReload={() => { void loadTenantList({ silent: true }); void loadSales(); }}
                      onEdit={openEdit}
                      onShare={openShare}
                      onWallet={openWallet}
                      onReview={openRevenueNotice}
                      onLalamoveApproval={toggleLalamoveApproval}
                      lalamoveApprovalBusy={lalamoveApprovalBusy === tenant.id}
                      onDelete={removeTenant}
                      t={t}
                    >
                      <TenantMaintenanceControls
                        tenant={tenant}
                        summary={summaries[tenant.id] || {}}
                        t={t}
                        intlLocale={intlLocale}
                        onUnlock={unlockShare}
                        onSubscriptionAction={updateSubscription}
                        subscriptionWriteUnconfirmed={Boolean(uncertainSubscriptionWrites[tenant.id])}
                        subscriptionCheckBusy={subscriptionCheckBusy === tenant.id}
                        onCheckSubscription={reconcileSubscription}
                      />
                    </TenantControlPanel>
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
                <p id="tenantDialogDescription">{editing ? (editing.name || editing.slug || editing.id)
                  : "สร้างร้านและ Owner พร้อมเปิดใช้งาน เริ่มทดลองใช้ฟรี 1 เดือนจากวันเปิดใช้งานจริง"}</p>
              </div>
            </div>
            <button type="button" className="tenant-dialog-close" aria-label={t("admin_tenants.common.close")} onClick={() => dialogRef.current?.close?.()}>
              <i className="bi bi-x-lg" aria-hidden="true"></i>
            </button>
          </div>
          <div className="tenant-dialog-body">
            {!editing && pendingProvisionId ? <TenantProvisionRecoveryNotice
              mode="modal" operationId={pendingProvisionId}
              checking={provisionChecking} busy={saving}
              onCheck={reconcileProvision} /> : null}
            {editing && readPendingMasterEdit(authState.user?.uid,editing.id) ?
              <TenantMasterEditRecoveryNotice tenantId={editing.id}
                checking={masterEditChecking===editing.id}
                onCheck={()=>reconcileMasterEdit(editing)}/> : null}
            {!editing ? <div className="tenant-new-step-title"><span>01</span><strong>ข้อมูลร้านค้า</strong><small>ข้อมูลสำหรับเปิดใช้งานร้านใหม่</small></div> : null}
            <div className="grid grid-2">
              <div className="field">
                <label htmlFor="tenantName">{t("admin_tenants.tenant.fields.name")}</label>
                <input className="input" id="tenantName" disabled={saving || Boolean(editing && (uncertainTenantWrites[editing.id] ||
                  readPendingMasterEdit(authState.user?.uid,editing.id)))} maxLength="120" required value={form.name} onChange={e => {
                  const name = e.target.value;
                  setForm(current => ({ ...current, name, ...(!slugEdited ? { slug: normalizeSlug(name) } : {}) }));
                }} placeholder={t("admin_tenants.tenant.fields.name_placeholder")} />
              </div>
              <div className="field">
                <label htmlFor="tenantSlug">{t("admin_tenants.tenant.fields.slug")}</label>
                <input className="input" id="tenantSlug" disabled={saving || Boolean(editing && (uncertainTenantWrites[editing.id] ||
                  readPendingMasterEdit(authState.user?.uid,editing.id)))} maxLength="50" required value={form.slug} onChange={e => {
                  setSlugEdited(true);
                  setForm(current => ({ ...current, slug: sanitizeSlug(e.target.value) }));
                }} onBlur={() => setForm(current => ({ ...current, slug: normalizeSlug(current.slug) }))} placeholder={t("admin_tenants.tenant.fields.slug_placeholder")} />
                <small>{t("admin_tenants.tenant.fields.slug_help")}</small>
              </div>
            </div>
            <div className="grid grid-2">
              <div className="field">
                <label htmlFor="tenantPhone">{t("admin_tenants.tenant.fields.phone")}</label>
                <input className="input" id="tenantPhone" disabled={saving || Boolean(editing && (uncertainTenantWrites[editing.id] ||
                  readPendingMasterEdit(authState.user?.uid,editing.id)))} type="tel" maxLength="30" value={form.phone} onChange={e => setForm(current => ({ ...current, phone: e.target.value }))} placeholder={t("admin_tenants.tenant.fields.phone_placeholder")} />
              </div>
              <div className="field">
                <label htmlFor="tenantAddress">{t("admin_tenants.tenant.fields.address")}</label>
                <input className="input" id="tenantAddress" disabled={saving || Boolean(editing && (uncertainTenantWrites[editing.id] ||
                  readPendingMasterEdit(authState.user?.uid,editing.id)))} maxLength="300" value={form.address} onChange={e => setForm(current => ({ ...current, address: e.target.value }))} placeholder={t("admin_tenants.tenant.fields.address_placeholder")} />
              </div>
            </div>
            {editing ? (
              <div className="field tenant-master-business-field">
                <label htmlFor="tenantMasterBusinessType"><i className="bi bi-diagram-3" aria-hidden="true"></i> {t("admin_tenants.signup_billing.business")} (Master)</label>
                <select className="input" id="tenantMasterBusinessType"
                  disabled={saving || Boolean(uncertainTenantWrites[editing.id] ||
                    readPendingMasterEdit(authState.user?.uid,editing.id))}
                  value={form.businessType} onChange={e => setForm(current => ({ ...current, businessType: e.target.value }))}>
                  {["restaurant_cafe", "retail", "both"].map(type => <option value={type} key={type}>{t(`admin_tenants.signup_billing.businesses.${type}`)}</option>)}
                </select>
                <small>{t("admin_tenants.signup_billing.title")} · {t("admin_tenants.signup_billing.business")}: {t(`admin_tenants.signup_billing.businesses.${editing.signupBilling?.businessType || editing.businessType || "both"}`)}</small>
              </div>
            ) : null}
            {!editing ? (
              <>
                <div className="tenant-new-step-title"><span>02</span><strong>บัญชีเจ้าของร้าน (Owner)</strong><small>ใช้เข้าสู่ระบบจัดการร้านค้า</small></div>
                <div className="grid grid-2" data-new-store-owner-fields>
                  <div className="field">
                    <label htmlFor="tenantOwnerName">ชื่อ Owner</label>
                    <input id="tenantOwnerName" className="input" required maxLength={120}
                      autoComplete="off" placeholder="ชื่อผู้ดูแลร้าน" value={form.ownerName}
                      onChange={e => setForm(current => ({ ...current, ownerName: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label htmlFor="tenantOwnerEmail">อีเมลสำหรับเข้าสู่ระบบ</label>
                    <input id="tenantOwnerEmail" className="input" required type="email" maxLength={160}
                      autoComplete="off" placeholder="owner@example.com" value={form.ownerEmail}
                      onChange={e => setForm(current => ({ ...current, ownerEmail: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label htmlFor="tenantOwnerPassword">รหัสผ่านเริ่มต้น</label>
                    <input id="tenantOwnerPassword" className="input" type="password" required
                      minLength={8} maxLength={72} autoComplete="new-password"
                      placeholder="อย่างน้อย 8 ตัวอักษร" value={form.ownerPassword}
                      onChange={e => setForm(current => ({ ...current, ownerPassword: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label htmlFor="tenantOwnerPasswordConfirm">ยืนยันรหัสผ่าน</label>
                    <input id="tenantOwnerPasswordConfirm" className="input" type="password" required
                      minLength={8} maxLength={72} autoComplete="new-password"
                      placeholder="กรอกรหัสผ่านอีกครั้ง" value={form.confirmPassword}
                      onChange={e => setForm(current => ({ ...current, confirmPassword: e.target.value }))} />
                  </div>
                </div>
                <div className="tenant-new-step-title"><span>03</span><strong>แพ็กเกจและวันเริ่มใช้งาน</strong><small>ยึดเงื่อนไข Billing ส่วนกลาง</small></div>
                <div className="tenant-new-billing" data-new-store-plan>
                  <div className="field">
                    <label htmlFor="tenantNewPlanCode">เลือกรอบสมาชิก</label>
                    <select id="tenantNewPlanCode" className="input" required value={form.planCode}
                      onChange={e => setForm(current => ({ ...current, planCode: e.target.value }))}>
                      <option value="monthly">รายเดือน</option><option value="yearly">รายปี</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="tenantNewBusinessType">ประเภทธุรกิจ</label>
                    <select id="tenantNewBusinessType" className="input" required value={form.businessType}
                      onChange={e => setForm(current => ({ ...current, businessType: e.target.value }))}>
                      {["restaurant_cafe", "retail", "both"].map(type =>
                        <option value={type} key={type}>{t(`admin_tenants.signup_billing.businesses.${type}`)}</option>)}
                    </select>
                  </div>
                  <p role="note"><i className="bi bi-check-circle" aria-hidden="true"></i>
                    สร้างร้านและ Owner พร้อมเปิดใช้งาน โดยเริ่มทดลองใช้ฟรีหนึ่งเดือนจากวันเปิดใช้งานจริง
                  </p>
                </div>
              </>
            ) : null}
            {status ? <div className="upload-error" id="tenantError">{status}</div> : <div className="upload-error" id="tenantError" hidden></div>}
          </div>
          <div className="tenant-dialog-actions">
            <button type="button" className="btn" onClick={() => dialogRef.current?.close?.()}>
              <i className="bi bi-x-circle" aria-hidden="true"></i><span>{t("admin_tenants.common.cancel")}</span>
            </button>
            <button className="btn btn-primary" id="createTenantButton" type="submit" disabled={saving || Boolean(uncertainTenantWrites[editing ? String(editing.id) : "__create__"]) ||
                Boolean(editing && readPendingMasterEdit(authState.user?.uid,editing.id))}>
              <i className="bi bi-floppy" aria-hidden="true"></i><span>{saving ? t("admin_tenants.tenant.saving") : editing ? t("admin_tenants.tenant.save_edit") : "สร้างร้านและเปิดใช้งาน"}</span>
            </button>
          </div>
        </form>
      </dialog>

      <dialog id="revenueShareDialog" className="tenant-dialog revenue-share-dialog" ref={shareDialogRef} onClose={closeShare}>
        <div id="revenueShareForm" className="tenant-dialog-card" data-central-delivery-settings="true">
          <div className="tenant-dialog-head">
            <div className="tenant-dialog-title">
              <span className="tenant-dialog-icon share"><i className="bi bi-percent" aria-hidden="true"></i></span>
              <div>
                <span className="tenant-dialog-eyebrow">{intlLocale.startsWith("th") ? "กำหนดจาก Super Admin ส่วนกลาง" : "Central Super Admin policy"}</span>
                <h2>{intlLocale.startsWith("th") ? "เงื่อนไขส่วนแบ่ง Delivery" : "Delivery commission settings"}</h2>
                <p id="revenueShareTenantName">{shareTenant?.name || shareTenant?.slug || shareTenant?.id || "-"}</p>
              </div>
            </div>
            <button type="button" className="tenant-dialog-close" data-close-share-dialog aria-label={t("admin_tenants.common.close")} onClick={closeShare}><i className="bi bi-x-lg" aria-hidden="true"></i></button>
          </div>
          <div className="tenant-dialog-body">
            <div className="tenant-central-share-note" role="note">
              <i className="bi bi-shield-check" aria-hidden="true"></i>
              <div>
                <strong>{intlLocale.startsWith("th") ? "ใช้ค่าเดียวกันทุกร้าน" : "One shared rate for all stores"}</strong>
                <span>{intlLocale.startsWith("th")
                  ? "อัตราส่วนแบ่งและเกณฑ์ยอดขาย Delivery ดึงจากหน้าตั้งราคา Premium ส่วนกลาง ไม่ได้บันทึกค่าแยกร้าน"
                  : "The Delivery rate and sales threshold come from central Premium pricing. No per-store overrides are saved."}</span>
              </div>
            </div>
            {centralPricingLoading ? (
              <p id="centralDeliverySettingsLoading" className="tenant-central-share-state" role="status">
                <i className="bi bi-arrow-repeat" aria-hidden="true"></i>
                <span>{intlLocale.startsWith("th") ? "กำลังโหลดค่าจากส่วนกลาง..." : "Loading central pricing..."}</span>
              </p>
            ) : centralDeliveryPricing ? (
              <>
                <div className="tenant-central-share-grid" id="centralDeliveryShareValues">
                  <div className="tenant-central-share-value">
                    <span><i className="bi bi-percent" aria-hidden="true"></i>{intlLocale.startsWith("th") ? "ส่วนแบ่ง Platform จาก Delivery" : "Platform Delivery commission"}</span>
                    <strong id="revenueShareRate">{money(centralDeliveryPricing.deliveryShareRate)}%</strong>
                  </div>
                  <div className="tenant-central-share-value">
                    <span><i className="bi bi-truck" aria-hidden="true"></i>{intlLocale.startsWith("th") ? "เกณฑ์ยอด Delivery สะสมต่อเดือน" : "Monthly Delivery threshold"}</span>
                    <strong id="revenueShareDeliveryThreshold">{money(centralDeliveryPricing.deliveryThreshold)} {t("admin_tenants.common.baht")}</strong>
                  </div>
                </div>
                <p className="tenant-central-share-description">
                  {intlLocale.startsWith("th")
                    ? "นับเฉพาะยอดสินค้าผ่าน Delivery ที่ชำระแล้ว ไม่รวมค่าส่ง เริ่มคิด % เมื่อยอดสะสมรายเดือนเกินเกณฑ์ และไม่คิดย้อนหลังวันก่อนหน้า"
                    : "Only paid Delivery merchandise counts, excluding shipping. Share begins after the monthly threshold is exceeded, without retroactive charges."}
                </p>
                <div className="tenant-share-preview">
                  <span>{intlLocale.startsWith("th") ? "ยอด Delivery ที่เข้าเกณฑ์" : "Eligible Delivery sales"}</span>
                  <strong id="revenueShareSalesPreview">{money(shareSummary.deliveryShareBase)} {t("admin_tenants.common.baht")}</strong>
                  <span>{intlLocale.startsWith("th") ? "ส่วนแบ่ง Delivery จากส่วนกลาง" : "Central Delivery commission"}</span>
                  <strong id="revenueShareAmountPreview">{money(shareSummary.deliveryShareAmount)} {t("admin_tenants.common.baht")}</strong>
                </div>
                {shareTenant?.billingMode === "revenue_share" ? (
                  <p className="tenant-central-share-description">
                    {intlLocale.startsWith("th")
                      ? "หมายเหตุ: ร้านเดิมที่เคยใช้ Revenue Share อาจมีรายการส่วนแบ่งย้อนหลังตามเงื่อนไขเดิม ยอดรายงานแสดงตามข้อมูลที่บันทึกอยู่"
                      : "Note: historical Revenue Share tenants may have older charge rules. Reports reflect recorded legacy data."}
                  </p>
                ) : null}
              </>
            ) : (
              <div id="revenueShareError" className="upload-error" role="alert">
                {shareError || (intlLocale.startsWith("th") ? "ไม่มีข้อมูลส่วนกลาง" : "No central settings available")}
              </div>
            )}
          </div>
          <div className="tenant-dialog-actions">
            <button type="button" className="btn" data-close-share-dialog onClick={closeShare}>
              <i className="bi bi-x-circle" aria-hidden="true"></i><span>{t("admin_tenants.common.close")}</span>
            </button>
            {shareError ? (
              <button type="button" className="btn btn-primary" id="retryCentralDeliverySettings" onClick={() => shareTenant && openShare(shareTenant)}>
                <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>
                <span>{intlLocale.startsWith("th") ? "ลองโหลดอีกครั้ง" : "Retry"}</span>
              </button>
            ) : (
              <Link className="btn btn-primary" id="openCentralDeliveryPricing" to="/platform/pricing" onClick={closeShare}>
                <i className="bi bi-gear" aria-hidden="true"></i>
                <span>{intlLocale.startsWith("th") ? "ตั้งค่าที่ส่วนกลาง" : "Edit central settings"}</span>
              </Link>
            )}
          </div>
        </div>
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
            {walletTenant?.id&&<PlatformStripeWalletSandboxHistory key={walletTenant.id} tenantId={walletTenant.id}/>}
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
