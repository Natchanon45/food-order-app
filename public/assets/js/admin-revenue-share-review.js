import "./sweet-dialog.js?v=20260726-034";
import { functions, storage, ref, getDownloadURL, httpsCallable } from "./firebase-config.js?v=20260630-073";
import { formatDate, formatNumber, t } from "./i18n.js?v=20260812-099";
import { toast } from "./ui.js?v=20260805-081";

const listPayments = httpsCallable(functions, "listPlatformRevenueSharePayments");
const reviewPayment = httpsCallable(functions, "reviewRevenueSharePayment");
const reconcileRevenueShare = httpsCallable(functions, "reconcileRevenueShare");

const els = {
  list: document.querySelector("#revenueShareReviewList"),
  refresh: document.querySelector("#refreshRevenueShareReview"),
  storeFilter: document.querySelector("#tenantStoreFilter"),
  dialog: document.querySelector("#revenueShareReviewDialog"),
  form: document.querySelector("#revenueShareReviewForm"),
  tenant: document.querySelector("#revenueShareReviewTenantName"),
  summary: document.querySelector("#revenueShareReviewSummary"),
  note: document.querySelector("#revenueShareReviewNote"),
  error: document.querySelector("#revenueShareReviewError"),
  reject: document.querySelector("#rejectRevenueSharePayment"),
  slipDialog: document.querySelector("#revenueShareSlipDialog"),
  slipImage: document.querySelector("#revenueShareSlipImage"),
  slipFrame: document.querySelector("#revenueShareSlipFrame"),
  slipTenant: document.querySelector("#revenueShareSlipTenantName"),
};

const state = { status: "pending", items: [], rejectingId: "", loading: false };

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function money(value) {
  return formatNumber(Number(value || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateTime(value) {
  if (!value) return "-";
  return formatDate(new Date(value), { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) || "-";
}

function periodDateText(value = "") {
  return String(value || "-").replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_, year, month, day) => `${day}/${month}/${year}`);
}

function setDialogError(message = "") {
  els.error.textContent = message;
  els.error.hidden = !message;
}

function statusLabel(status) {
  return t(`admin_tenants.review.statuses.${status}`);
}

function ocrMarkup(item = {}) {
  const ocr = item.ocr && typeof item.ocr === "object" ? item.ocr : null;
  if (!ocr) return "";
  const status = ["matched", "mismatch", "unreadable", "manual_review"].includes(ocr.status) ? ocr.status : "manual_review";
  const amountMissing = ocr.detectedAmount === null || ocr.detectedAmount === undefined;
  const key = ocr.status === "manual_review" && amountMissing
    ? "admin_tenants.review.ocr_manual"
    : amountMissing
      ? "admin_tenants.review.ocr_unreadable"
      : ocr.amountMatched === true
        ? "admin_tenants.review.ocr_matched"
        : "admin_tenants.review.ocr_mismatch";
  const amount = amountMissing ? "-" : money(ocr.detectedAmount);
  const recipient = String(ocr.expectedRecipientName || "").trim();
  const recipientKey = !recipient ? "admin_tenants.review.recipient_not_configured" : ocr.recipientMatched === true ? "admin_tenants.review.recipient_matched" : ocr.recipientMatched === false ? "admin_tenants.review.recipient_mismatch" : "admin_tenants.review.recipient_manual";
  const icon = status === "matched" ? "bi-check-circle" : status === "mismatch" ? "bi-exclamation-triangle" : "bi-eye";
  return `<small class="tenant-review-ocr ${status}"><i class="bi ${icon}" aria-hidden="true"></i><span class="tenant-review-ocr-copy"><span>${escapeHtml(t(key, { amount }))}</span><span>${escapeHtml(t(recipientKey, { recipient: recipient || "-" }))}</span></span></small>`;
}

function render(items = []) {
  state.items = items;
  if (!items.length) {
    els.list.innerHTML = `<div class="tenant-review-empty"><i class="bi bi-inbox" aria-hidden="true"></i><strong>${t("admin_tenants.review.empty_title")}</strong><span>${t("admin_tenants.review.empty_help")}</span></div>`;
    return;
  }

  els.list.innerHTML = items.map(item => {
    const tenant = item.tenant || {};
    const status = ["pending", "approved", "rejected"].includes(item.status) ? item.status : "pending";
    const actions = status === "pending"
      ? `<button class="btn btn-primary btn-sm" type="button" data-review-approve="${escapeHtml(item.id)}"><i class="bi bi-check-circle" aria-hidden="true"></i><span>${t("admin_tenants.review.approve")}</span></button><button class="btn btn-danger btn-sm" type="button" data-review-reject="${escapeHtml(item.id)}"><i class="bi bi-x-octagon" aria-hidden="true"></i><span>${t("admin_tenants.review.reject")}</span></button>`
      : "";
    return `<article class="tenant-review-item" data-payment-id="${escapeHtml(item.id)}">
      <div class="tenant-review-main"><div class="tenant-review-store"><span class="tenant-review-mark">${escapeHtml((tenant.name || "S").slice(0, 1).toUpperCase())}</span><div><strong>${escapeHtml(tenant.name || tenant.id || "-")}</strong><small>${escapeHtml(tenant.slug ? `/${tenant.slug}` : tenant.id || "-")}</small></div></div><span class="tenant-review-status ${status}">${escapeHtml(statusLabel(status))}</span></div>
      <div class="tenant-review-period"><span>${t("admin_tenants.review.period")}</span><strong>${escapeHtml(periodDateText(item.period?.label || "-"))}</strong><small>${escapeHtml(periodDateText(item.period?.startDate || "-"))} – ${escapeHtml(periodDateText(item.period?.endDate || "-"))}</small></div>
      <div class="tenant-review-amount"><span>${t("admin_tenants.review.amount")}</span><strong>${money(item.revenueShareAmount)} ${t("admin_tenants.common.baht")}</strong><small>${escapeHtml(t("admin_tenants.review.rate", { rate: money(item.revenueShareRate) }))}</small>${ocrMarkup(item)}</div>
      <div class="tenant-review-submitted"><span>${t("admin_tenants.review.submitted")}</span><strong>${escapeHtml(dateTime(item.submittedAt))}</strong>${item.reviewNote ? `<small>${escapeHtml(item.reviewNote)}</small>` : ""}</div>
      <div class="tenant-review-actions"><button class="btn btn-sm" type="button" data-review-view-slip="${escapeHtml(item.id)}"><i class="bi bi-receipt" aria-hidden="true"></i><span>${t("admin_tenants.review.view_slip")}</span></button>${actions}</div>
    </article>`;
  }).join("");
}

async function load({ reconcile = false } = {}) {
  if (state.loading) return;
  state.loading = true;
  els.refresh.disabled = true;
  els.refresh.innerHTML = `<span class="tenant-button-spinner" aria-hidden="true"></span><span>${t("admin_tenants.review.loading_short")}</span>`;
  try {
    const tenantId = els.storeFilter?.value || "";
    const params = new URLSearchParams({ status: state.status });
    if (tenantId) params.set("tenantId", tenantId);
    if (reconcile) {
      const reconcileParams = new URLSearchParams();
      if (tenantId) reconcileParams.set("tenantId", tenantId);
      await reconcileRevenueShare(tenantId ? { tenantId } : {});
    }
    const response = await listPayments({ status: state.status, tenantId });
    const data = response.data || {};
    ["pending", "approved", "rejected"].forEach(status => {
      const node = document.querySelector(`[data-review-count="${status}"]`);
      if (node) node.textContent = formatNumber(data.counts?.[status] || 0);
    });
    render(data.items || []);
  } catch (error) {
    console.error(error);
    els.list.innerHTML = `<div class="upload-error">${t("admin_tenants.review.load_failed")}</div>`;
  } finally {
    state.loading = false;
    els.refresh.disabled = false;
    els.refresh.innerHTML = `<i class="bi bi-arrow-clockwise" aria-hidden="true"></i><span>${t("admin_tenants.review.refresh")}</span>`;
  }
}

async function approve(item) {
  const ok = typeof window.sweetConfirm === "function"
    ? await window.sweetConfirm(t("admin_tenants.review.approve_confirm", { store: item.tenant?.name || item.tenant?.id || "-", amount: money(item.revenueShareAmount) }), {
        title: t("admin_tenants.review.approve_title"),
        confirmText: t("admin_tenants.review.approve"),
        cancelText: t("admin_tenants.common.cancel"),
        type: "success",
      })
    : confirm(t("admin_tenants.review.approve_confirm", { store: item.tenant?.name || item.tenant?.id || "-", amount: money(item.revenueShareAmount) }));
  if (!ok) return;

  try {
    await reviewPayment({ tenantId: item.tenant.id, paymentId: item.id, action: "approve" });
    toast(t("admin_tenants.review.approved"));
    document.dispatchEvent(new CustomEvent("tenant-revenue-share-reviewed"));
    await load();
  } catch (error) {
    console.error(error);
    toast(t("admin_tenants.review.review_failed"), "error");
  }
}

async function openSlip(item) {
  let url = "";
  try {
    if (item.slip?.path) url = await getDownloadURL(ref(storage, item.slip.path));
  } catch (error) {
    console.error(error);
    toast(t("admin_tenants.review.review_failed"), "error");
    return;
  }
  if (!url) return;
  const image = String(item.slip?.mime || "").startsWith("image/");
  els.slipTenant.textContent = item.tenant?.name || item.tenant?.id || "-";
  els.slipImage.hidden = !image;
  els.slipFrame.hidden = image;
  if (image) {
    els.slipImage.src = url;
    els.slipFrame.src = "about:blank";
  } else {
    els.slipImage.removeAttribute("src");
    els.slipFrame.src = url;
  }
  if (typeof els.slipDialog.showModal === "function") els.slipDialog.showModal();
  else els.slipDialog.setAttribute("open", "");
  document.body.classList.add("tenant-modal-open");
}

function closeSlip() {
  if (els.slipDialog.open && typeof els.slipDialog.close === "function") els.slipDialog.close();
  else els.slipDialog.removeAttribute("open");
  els.slipImage.removeAttribute("src");
  els.slipImage.hidden = true;
  els.slipFrame.src = "about:blank";
  els.slipFrame.hidden = true;
  document.body.classList.remove("tenant-modal-open");
}

function openReject(item) {
  state.rejectingId = item.id;
  els.tenant.textContent = item.tenant?.name || item.tenant?.id || "-";
  els.summary.innerHTML = `<span>${escapeHtml(periodDateText(item.period?.label || "-"))}</span><strong>${money(item.revenueShareAmount)} ${t("admin_tenants.common.baht")}</strong>`;
  els.note.value = "";
  setDialogError("");
  if (typeof els.dialog.showModal === "function") els.dialog.showModal();
  else els.dialog.setAttribute("open", "");
  document.body.classList.add("tenant-modal-open");
  setTimeout(() => els.note.focus(), 60);
}

function closeReject() {
  if (els.dialog.open && typeof els.dialog.close === "function") els.dialog.close();
  else els.dialog.removeAttribute("open");
  state.rejectingId = "";
  document.body.classList.remove("tenant-modal-open");
}

els.list.addEventListener("click", event => {
  const slipButton = event.target.closest("[data-review-view-slip]");
  if (slipButton) {
    const item = state.items.find(row => row.id === slipButton.dataset.reviewViewSlip);
    if (item) openSlip(item);
    return;
  }
  const approveButton = event.target.closest("[data-review-approve]");
  if (approveButton) {
    const item = state.items.find(row => row.id === approveButton.dataset.reviewApprove);
    if (item) approve(item);
    return;
  }
  const rejectButton = event.target.closest("[data-review-reject]");
  if (rejectButton) {
    const item = state.items.find(row => row.id === rejectButton.dataset.reviewReject);
    if (item) openReject(item);
  }
});

document.querySelectorAll("[data-review-status]").forEach(button => button.addEventListener("click", () => {
  state.status = button.dataset.reviewStatus;
  document.querySelectorAll("[data-review-status]").forEach(node => {
    const selected = node === button;
    node.classList.toggle("active", selected);
    node.setAttribute("aria-selected", selected ? "true" : "false");
  });
  load();
}));

document.querySelectorAll("[data-close-review-dialog]").forEach(button => button.addEventListener("click", closeReject));
els.dialog.addEventListener("click", event => { if (event.target === els.dialog) closeReject(); });
document.querySelectorAll("[data-close-slip-dialog]").forEach(button => button.addEventListener("click", closeSlip));
els.slipDialog.addEventListener("cancel", event => event.preventDefault());
els.form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!state.rejectingId || !els.form.reportValidity()) return;
  els.reject.disabled = true;
  setDialogError("");
  try {
    const item = state.items.find(row => row.id === state.rejectingId);
    if (!item?.tenant?.id) throw new Error("PAYMENT_TENANT_MISSING");
    await reviewPayment({ tenantId: item.tenant.id, paymentId: state.rejectingId, action: "reject", note: els.note.value.trim() });
    closeReject();
    toast(t("admin_tenants.review.rejected"));
    document.dispatchEvent(new CustomEvent("tenant-revenue-share-reviewed"));
    await load();
  } catch (error) {
    console.error(error);
    setDialogError(t("admin_tenants.review.review_failed"));
  } finally {
    els.reject.disabled = false;
  }
});

els.refresh.addEventListener("click", () => load({ reconcile: true }));
document.addEventListener("tenant-store-filter-changed", () => load({ reconcile: true }));
await load({ reconcile: true });
