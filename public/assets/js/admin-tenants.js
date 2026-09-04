import "./sweet-dialog.js?v=20260726-034";
import { toast } from "./ui.js?v=20260805-081";
import { formatDate, formatNumber, t } from "./i18n.js?v=20260812-099";
import {
  createTenant,
  deleteTenant,
  listTenants,
  listTenantSalesSummary,
  updateTenant,
  updateTenantRevenueShare,
  unlockTenantRevenueShare,
} from "./platform-tenant-service.js?v=20260804-010";

const els = {
  tenantList: document.querySelector("#tenantList"),
  tenantCount: document.querySelector("#tenantCount"),
  storeFilter: document.querySelector("#tenantStoreFilter"),
  openCreate: document.querySelector("#openTenantCreateButton"),
  dialog: document.querySelector("#tenantDialog"),
  form: document.querySelector("#tenantForm"),
  title: document.querySelector("#tenantDialogTitle"),
  eyebrow: document.querySelector("#tenantDialogEyebrow"),
  description: document.querySelector("#tenantDialogDescription"),
  name: document.querySelector("#tenantName"),
  slug: document.querySelector("#tenantSlug"),
  phone: document.querySelector("#tenantPhone"),
  address: document.querySelector("#tenantAddress"),
  submit: document.querySelector("#createTenantButton"),
  error: document.querySelector("#tenantError"),
  refreshSales: document.querySelector("#refreshTenantSalesButton"),
  reportDate: document.querySelector("#tenantReportDate"),
  reportMonth: document.querySelector("#tenantReportMonth"),
  reportYear: document.querySelector("#tenantReportYear"),
  startDate: document.querySelector("#tenantReportStartDate"),
  endDate: document.querySelector("#tenantReportEndDate"),
  periodLabel: document.querySelector("#tenantPeriodLabel"),
  platformOrderSales: document.querySelector("#platformOrderSales"),
  platformOrderCount: document.querySelector("#platformOrderCount"),
  platformPosSales: document.querySelector("#platformPosSales"),
  platformPosCount: document.querySelector("#platformPosCount"),
  platformCombinedSales: document.querySelector("#platformCombinedSales"),
  platformRevenueShare: document.querySelector("#platformRevenueShare"),
  shareDialog: document.querySelector("#revenueShareDialog"),
  shareForm: document.querySelector("#revenueShareForm"),
  shareTenantName: document.querySelector("#revenueShareTenantName"),
  shareEnabled: document.querySelector("#revenueShareEnabled"),
  shareRate: document.querySelector("#revenueShareRate"),
  shareBillingCycle: document.querySelector("#revenueShareBillingCycle"),
  shareRecipientName: document.querySelector("#revenueShareRecipientName"),
  shareSalesPreview: document.querySelector("#revenueShareSalesPreview"),
  shareAmountPreview: document.querySelector("#revenueShareAmountPreview"),
  shareError: document.querySelector("#revenueShareError"),
  shareSubmit: document.querySelector("#saveRevenueShareButton"),
};

const state = {
  tenants: [],
  summaries: {},
  totals: {},
  period: "daily",
  tenantId: "",
  editingTenantId: "",
  shareTenantId: "",
  loadingSales: false,
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]);
}

function money(value) {
  return formatNumber(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function displayInputDate(value) {
  if (!value) return "-";
  return formatDate(`${value}T00:00:00`, { year: "numeric", month: "short", day: "numeric" }) || value;
}

function displayInputMonth(value) {
  if (!value) return "-";
  return formatDate(`${value}-01T00:00:00`, { year: "numeric", month: "long" }) || value;
}

function currentPeriodLabel() {
  if (state.period === "daily") {
    return t("admin_tenants.report.labels.daily", { date: displayInputDate(els.reportDate.value) });
  }
  if (state.period === "monthly") {
    return t("admin_tenants.report.labels.monthly", { month: displayInputMonth(els.reportMonth.value) });
  }
  if (state.period === "yearly") {
    return t("admin_tenants.report.labels.yearly", { year: els.reportYear.value || "-" });
  }
  return t("admin_tenants.report.labels.custom", {
    start: displayInputDate(els.startDate.value),
    end: displayInputDate(els.endDate.value),
  });
}

function sanitizeSlugTyping(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-+/g, "");
}

function normalizeSlug(value = "") {
  return sanitizeSlugTyping(value).replace(/-+$/g, "");
}

function setDialogError(message = "") {
  els.error.textContent = message;
  els.error.hidden = !message;
}

function setShareError(message = "") {
  els.shareError.textContent = message;
  els.shareError.hidden = !message;
}

function showDialog(dialog) {
  if (typeof dialog?.showModal === "function") dialog.showModal();
  else dialog?.setAttribute("open", "");
  document.body.classList.add("tenant-modal-open");
}

function closeDialog(dialog) {
  if (dialog?.open && typeof dialog.close === "function") dialog.close();
  else dialog?.removeAttribute("open");
  if (!els.dialog?.open && !els.shareDialog?.open) document.body.classList.remove("tenant-modal-open");
}

function setTenantSubmitState(saving = false) {
  els.submit.disabled = saving;
  els.submit.innerHTML = saving
    ? `<span class="tenant-button-spinner" aria-hidden="true"></span><span>${t("admin_tenants.tenant.saving")}</span>`
    : `<i class="bi bi-floppy" aria-hidden="true"></i><span>${state.editingTenantId ? t("admin_tenants.tenant.save_edit") : t("admin_tenants.tenant.create")}</span>`;
}

function openCreateDialog() {
  state.editingTenantId = "";
  els.form.reset();
  els.slug.dataset.edited = "false";
  els.eyebrow.textContent = t("admin_tenants.tenant.new_eyebrow");
  els.title.textContent = t("admin_tenants.tenant.create_title");
  els.description.textContent = t("admin_tenants.tenant.create_description");
  setDialogError("");
  setTenantSubmitState(false);
  showDialog(els.dialog);
  setTimeout(() => els.name.focus(), 60);
}

function openEditDialog(tenant) {
  state.editingTenantId = tenant.id;
  els.name.value = tenant.name || "";
  els.slug.value = tenant.slug || "";
  els.phone.value = tenant.shopPhone || tenant.phone || "";
  els.address.value = tenant.shopAddress || tenant.address || "";
  els.slug.dataset.edited = "true";
  els.eyebrow.textContent = t("admin_tenants.tenant.edit_eyebrow");
  els.title.textContent = t("admin_tenants.tenant.edit_title");
  els.description.textContent = tenant.name || tenant.slug || tenant.id;
  setDialogError("");
  setTenantSubmitState(false);
  showDialog(els.dialog);
  setTimeout(() => els.name.focus(), 60);
}

function periodParams() {
  const params = new URLSearchParams({ period: state.period });
  if (state.tenantId) params.set("tenantId", state.tenantId);
  if (state.period === "daily") params.set("date", els.reportDate.value);
  if (state.period === "monthly") params.set("month", els.reportMonth.value);
  if (state.period === "yearly") params.set("year", els.reportYear.value);
  if (state.period === "custom") {
    params.set("startDate", els.startDate.value);
    params.set("endDate", els.endDate.value);
  }
  return params;
}

function setPeriod(period) {
  state.period = period;
  document.querySelectorAll("[data-tenant-period]").forEach(button => {
    const selected = button.dataset.tenantPeriod === period;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", selected ? "true" : "false");
  });
  document.querySelectorAll("[data-tenant-control]").forEach(control => {
    control.hidden = control.dataset.tenantControl !== period;
  });
  loadSalesSummary();
}

function renderGlobalTotals() {
  const totals = state.totals || {};
  els.platformOrderSales.textContent = money(totals.orderSales);
  els.platformOrderCount.textContent = t("admin_tenants.common.orders", { count: formatNumber(totals.orderCount) });
  els.platformPosSales.textContent = money(totals.posSales);
  els.platformPosCount.textContent = t("admin_tenants.common.receipts", { count: formatNumber(totals.posCount) });
  els.platformCombinedSales.textContent = money(totals.combinedSales);
  els.platformRevenueShare.textContent = money(totals.revenueShare);
}

function subscriptionText(tenant) {
  const status = tenant.subscriptionStatus || (tenant.active === false ? "inactive" : "active");
  return t(`admin_tenants.subscription.member_statuses.${status}`);
}

function patchTenantStatus(tenant) {
  if (!tenant?.id) return;
  const index = state.tenants.findIndex(item => String(item.id) === String(tenant.id));
  if (index >= 0) state.tenants[index] = { ...state.tenants[index], ...tenant };
  const card = [...els.tenantList.querySelectorAll(".tenant-store-card")]
    .find(node => String(node.dataset.tenantCard) === String(tenant.id));
  if (!card) return;
  const badge = card.querySelector(".tenant-status-pill");
  if (!badge) return;
  const active = tenant.active !== false;
  badge.classList.toggle("active", active);
  badge.classList.toggle("inactive", !active);
  badge.textContent = active ? t("admin_tenants.tenant.active") : t("admin_tenants.tenant.inactive");
}

function renderTenantCard(tenant) {
  const summary = state.summaries[tenant.id] || {};
  const ownerLabel = tenant.ownerUid
    ? escapeHtml(tenant.ownerDisplayName || tenant.ownerEmail || t("admin_tenants.tenant.owner_exists"))
    : escapeHtml(t("admin_tenants.tenant.owner_missing"));
  const active = tenant.active !== false;
  const shareEnabled = tenant.billingMode === "revenue_share" || summary.revenueShareEnabled === true;
  const expiry = tenant.subscriptionExpiresAt
    ? formatDate(new Date(tenant.subscriptionExpiresAt), { year: "numeric", month: "short", day: "numeric" }) || "-"
    : "-";
  const shareLabel = shareEnabled
    ? t("admin_tenants.sales.share_rate", { rate: `${money(summary.revenueShareRate)}%` })
    : t("admin_tenants.sales.share_disabled");
  const billingCycle = summary.revenueShareBillingCycle === "daily" ? "daily" : "monthly";
  const billingMeta = shareEnabled
    ? `<span class="tenant-billing-mode revenue-share"><i class="bi bi-percent" aria-hidden="true"></i>${escapeHtml(t("admin_tenants.tenant.revenue_share_mode", { cycle: t(`admin_tenants.share.billing_cycles.${billingCycle}`) }))}</span>`
    : `<span><i class="bi bi-calendar-check" aria-hidden="true"></i>${escapeHtml(subscriptionText(tenant))} · ${escapeHtml(t("admin_tenants.tenant.expires", { date: expiry }))}</span>`;
  const statusLabel = shareEnabled && tenant.accessStatus === "revenue_share_suspended"
    ? t("admin_tenants.tenant.revenue_share_suspended")
    : (active ? t("admin_tenants.tenant.active") : t("admin_tenants.tenant.inactive"));

  return `<article class="tenant-store-card" data-tenant-card="${escapeHtml(tenant.id)}" data-billing-mode="${shareEnabled ? "revenue_share" : "subscription"}">
    <header class="tenant-store-head">
      <div class="tenant-store-title">
        <span class="tenant-store-mark">${escapeHtml((tenant.name || t("admin_tenants.tenant.fallback_mark")).trim().slice(0, 1).toUpperCase())}</span>
        <div><h3>${escapeHtml(tenant.name || t("admin_tenants.tenant.fallback_name"))}</h3><a href="/s/${encodeURIComponent(tenant.slug || "")}/delivery" target="_blank" rel="noopener noreferrer">/${escapeHtml(tenant.slug || "-")}</a></div>
      </div>
      <span class="tenant-status-pill ${active ? "active" : "inactive"}">${escapeHtml(statusLabel)}</span>
    </header>

    <div class="tenant-meta-row">
      <span><i class="bi bi-person-badge" aria-hidden="true"></i>${ownerLabel}</span>
      ${billingMeta}
    </div>

    <div class="tenant-sales-grid">
      <article><span>${t("admin_tenants.sales.order")}</span><strong>${money(summary.orderSales)}</strong><small>${t("admin_tenants.common.items", { count: formatNumber(summary.orderCount) })}</small></article>
      <article><span>${t("admin_tenants.sales.pos")}</span><strong>${money(summary.posSales)}</strong><small>${t("admin_tenants.common.receipts", { count: formatNumber(summary.posCount) })}</small></article>
      <article class="total"><span>${t("admin_tenants.sales.combined")}</span><strong>${money(summary.combinedSales)}</strong><small>${t("admin_tenants.common.baht")}</small></article>
      <article class="share"><span>${shareLabel}</span><strong>${money(summary.revenueShare)}</strong><small>${t("admin_tenants.common.baht")}</small></article>
    </div>

    <div class="tenant-store-details">
      <span title="${escapeHtml(tenant.id)}"><strong>${t("admin_tenants.tenant.id")}</strong>${escapeHtml(tenant.id)}</span>
      ${tenant.shopPhone ? `<span><strong>${t("admin_tenants.tenant.phone")}</strong>${escapeHtml(tenant.shopPhone)}</span>` : ""}
      ${tenant.shopAddress ? `<span><strong>${t("admin_tenants.tenant.address")}</strong>${escapeHtml(tenant.shopAddress)}</span>` : ""}
    </div>

    <div class="tenant-card-actions">
      <a class="btn btn-dark btn-sm" href="/s/${encodeURIComponent(tenant.slug || "")}/delivery" target="_blank" rel="noopener noreferrer"><i class="bi bi-box-arrow-up-right" aria-hidden="true"></i><span>${t("admin_tenants.tenant.open_store")}</span></a>
      <button class="btn btn-sm" type="button" data-edit-tenant="${escapeHtml(tenant.id)}"><i class="bi bi-pencil-square" aria-hidden="true"></i><span>${t("admin_tenants.tenant.edit")}</span></button>
      <button class="btn btn-sm tenant-share-button" type="button" data-share-tenant="${escapeHtml(tenant.id)}"><i class="bi bi-percent" aria-hidden="true"></i><span>${t("admin_tenants.tenant.share")}</span></button>
      ${shareEnabled && tenant.accessStatus === "revenue_share_suspended" ? `<button class="btn btn-sm tenant-share-unlock-button" type="button" data-unlock-revenue-share="${escapeHtml(tenant.id)}"><i class="bi bi-unlock" aria-hidden="true"></i><span>${t("admin_tenants.tenant.unlock_revenue_share")}</span></button>` : ""}
      <button class="btn btn-danger btn-sm" type="button" data-delete-tenant="${escapeHtml(tenant.id)}"><i class="bi bi-trash3" aria-hidden="true"></i><span>${t("admin_tenants.tenant.delete")}</span></button>
    </div>
  </article>`;
}

function visibleTenants() {
  if (!state.tenantId) return state.tenants;
  return state.tenants.filter(tenant => String(tenant.id) === String(state.tenantId));
}

function populateStoreFilter() {
  if (!els.storeFilter) return;
  const selected = state.tenantId;
  const options = [
    `<option value="">${escapeHtml(t("admin_tenants.filter.all"))}</option>`,
    ...state.tenants.map(tenant => `<option value="${escapeHtml(tenant.id)}">${escapeHtml(tenant.name || tenant.slug || tenant.id)}</option>`),
  ];
  els.storeFilter.innerHTML = options.join("");
  if (selected && state.tenants.some(tenant => String(tenant.id) === String(selected))) {
    els.storeFilter.value = selected;
  } else {
    state.tenantId = "";
    els.storeFilter.value = "";
  }
  els.storeFilter.disabled = false;
}

function renderTenants() {
  const tenants = visibleTenants();
  els.tenantCount.textContent = t("admin_tenants.list.count", { count: formatNumber(tenants.length) });
  if (!tenants.length) {
    els.tenantList.innerHTML = `<div class="tenant-list-empty"><i class="bi bi-shop" aria-hidden="true"></i><strong>${t("admin_tenants.list.empty_title")}</strong><span>${t("admin_tenants.list.empty_help")}</span></div>`;
    return;
  }
  els.tenantList.innerHTML = tenants.map(renderTenantCard).join("");
}

async function loadTenants() {
  els.tenantList.innerHTML = `<div class="tenant-list-loading"><span class="tenant-button-spinner"></span>${t("admin_tenants.list.loading")}</div>`;
  try {
    const result = await listTenants();
    state.tenants = result.data?.tenants || [];
    populateStoreFilter();
    renderTenants();
  } catch (error) {
    console.error(error);
    els.tenantList.innerHTML = `<div class="upload-error">${t("admin_tenants.list.load_failed")}</div>`;
  }
}

async function loadSalesSummary() {
  if (state.loadingSales) return;
  state.loadingSales = true;
  els.refreshSales.disabled = true;
  els.refreshSales.innerHTML = `<span class="tenant-button-spinner"></span><span>${t("admin_tenants.report.loading")}</span>`;
  try {
    const result = await listTenantSalesSummary(periodParams());
    state.summaries = result.data?.tenants || {};
    state.totals = result.data?.totals || {};
    els.periodLabel.textContent = currentPeriodLabel();
    renderGlobalTotals();
    renderTenants();
  } catch (error) {
    console.error(error);
    toast(t("admin_tenants.report.load_failed"), "error");
  } finally {
    state.loadingSales = false;
    els.refreshSales.disabled = false;
    els.refreshSales.innerHTML = `<i class="bi bi-arrow-clockwise" aria-hidden="true"></i><span>${t("admin_tenants.report.refresh")}</span>`;
  }
}

function openShareDialog(tenant) {
  const summary = state.summaries[tenant.id] || {};
  state.shareTenantId = tenant.id;
  els.shareTenantName.textContent = tenant.name || tenant.slug || tenant.id;
  els.shareEnabled.checked = summary.revenueShareEnabled === true;
  els.shareRate.value = Number(summary.revenueShareRate || 0).toFixed(2);
  els.shareBillingCycle.value = summary.revenueShareBillingCycle === "daily" ? "daily" : "monthly";
  els.shareRecipientName.value = String(tenant.revenueShareRecipientName || "");
  els.shareRecipientName.required = els.shareEnabled.checked;
  els.shareSalesPreview.textContent = `${money(summary.combinedSales)} ${t("admin_tenants.common.baht")}`;
  setShareError("");
  updateSharePreview();
  showDialog(els.shareDialog);
  setTimeout(() => els.shareRate.focus(), 60);
}

function updateSharePreview() {
  const tenant = state.summaries[state.shareTenantId] || {};
  const rate = Math.max(0, Math.min(100, Number(els.shareRate.value || 0)));
  const amount = els.shareEnabled.checked ? Number(tenant.combinedSales || 0) * rate / 100 : 0;
  els.shareAmountPreview.textContent = `${money(amount)} ${t("admin_tenants.common.baht")}`;
}

async function unlockRevenueShareTenant(tenant) {
  const periodStart = tenant.revenueShareSuspendedPeriodStart || "-";
  const periodEnd = tenant.revenueShareSuspendedPeriodEnd || periodStart;
  const period = periodStart === periodEnd ? periodStart : `${periodStart} – ${periodEnd}`;
  const message = t("admin_tenants.tenant.unlock_revenue_share_confirm", {
    name: tenant.name || tenant.id,
    period,
  });
  const ok = typeof window.sweetConfirm === "function"
    ? await window.sweetConfirm(message, {
        title: t("admin_tenants.tenant.unlock_revenue_share_title"),
        confirmText: t("admin_tenants.tenant.unlock_revenue_share"),
        cancelText: t("admin_tenants.common.cancel"),
        type: "warning",
      })
    : confirm(message);
  if (!ok) return;

  try {
    await unlockTenantRevenueShare({ tenantId: tenant.id });
    toast(t("admin_tenants.tenant.unlock_revenue_share_success"));
    await Promise.all([loadTenants(), loadSalesSummary()]);
  } catch (error) {
    console.error(error);
    toast(t("admin_tenants.tenant.unlock_revenue_share_failed"), "error");
  }
}

async function confirmDelete(tenant) {
  const message = t("admin_tenants.tenant.delete_confirm", { name: tenant.name || tenant.id });
  const ok = typeof window.sweetConfirm === "function"
    ? await window.sweetConfirm(message, {
        title: t("admin_tenants.tenant.delete_title"),
        confirmText: t("admin_tenants.tenant.delete_confirm_button"),
        cancelText: t("admin_tenants.common.cancel"),
        type: "warning",
      })
    : confirm(message);
  if (!ok) return;
  try {
    await deleteTenant({ tenantId: tenant.id });
    toast(t("admin_tenants.tenant.deleted"));
    await Promise.all([loadTenants(), loadSalesSummary()]);
  } catch (error) {
    console.error(error);
    toast(error.code === "functions/failed-precondition" ? t("admin_tenants.tenant.delete_has_data") : t("admin_tenants.tenant.delete_failed"), "error");
  }
}

els.storeFilter?.addEventListener("change", async () => {
  state.tenantId = els.storeFilter.value || "";
  renderTenants();
  document.dispatchEvent(new CustomEvent("tenant-store-filter-changed", { detail: { tenantId: state.tenantId } }));
  await loadSalesSummary();
});

els.openCreate.addEventListener("click", openCreateDialog);
document.querySelectorAll("[data-close-tenant-dialog]").forEach(button => button.addEventListener("click", () => closeDialog(els.dialog)));
document.querySelectorAll("[data-close-share-dialog]").forEach(button => button.addEventListener("click", () => closeDialog(els.shareDialog)));
els.dialog.addEventListener("click", event => { if (event.target === els.dialog) closeDialog(els.dialog); });
els.shareDialog.addEventListener("click", event => { if (event.target === els.shareDialog) closeDialog(els.shareDialog); });

els.name.addEventListener("input", () => {
  if (els.slug.dataset.edited !== "true") els.slug.value = normalizeSlug(els.name.value);
});
els.slug.addEventListener("input", () => {
  els.slug.dataset.edited = "true";
  els.slug.value = sanitizeSlugTyping(els.slug.value);
});
els.slug.addEventListener("blur", () => { els.slug.value = normalizeSlug(els.slug.value); });

els.form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!els.form.reportValidity()) return;
  setDialogError("");
  setTenantSubmitState(true);
  try {
    const payload = {
      name: els.name.value.trim(),
      slug: normalizeSlug(els.slug.value),
      phone: els.phone.value.trim(),
      address: els.address.value.trim(),
    };
    if (state.editingTenantId) {
      await updateTenant({ tenantId: state.editingTenantId, ...payload });
      toast(t("admin_tenants.tenant.updated"));
    } else {
      await createTenant(payload);
      toast(t("admin_tenants.tenant.created"));
    }
    closeDialog(els.dialog);
    await Promise.all([loadTenants(), loadSalesSummary()]);
  } catch (error) {
    console.error(error);
    let message = state.editingTenantId ? t("admin_tenants.tenant.update_failed") : t("admin_tenants.tenant.create_failed");
    if (error.code === "functions/already-exists") message = t("admin_tenants.tenant.slug_exists");
    if (error.code === "functions/invalid-argument") message = error.message || t("admin_tenants.tenant.invalid");
    setDialogError(message);
    toast(message, "error");
  } finally {
    setTenantSubmitState(false);
  }
});

els.tenantList.addEventListener("click", event => {
  const edit = event.target.closest("[data-edit-tenant]");
  if (edit) {
    const tenant = state.tenants.find(item => item.id === edit.dataset.editTenant);
    if (tenant) openEditDialog(tenant);
    return;
  }
  const share = event.target.closest("[data-share-tenant]");
  if (share) {
    const tenant = state.tenants.find(item => item.id === share.dataset.shareTenant);
    if (tenant) openShareDialog(tenant);
    return;
  }
  const unlock = event.target.closest("[data-unlock-revenue-share]");
  if (unlock) {
    const tenant = state.tenants.find(item => item.id === unlock.dataset.unlockRevenueShare);
    if (tenant) unlockRevenueShareTenant(tenant);
    return;
  }
  const remove = event.target.closest("[data-delete-tenant]");
  if (remove) {
    const tenant = state.tenants.find(item => item.id === remove.dataset.deleteTenant);
    if (tenant) confirmDelete(tenant);
  }
});

els.shareEnabled.addEventListener("change", () => {
  els.shareRecipientName.required = els.shareEnabled.checked;
  if (!els.shareEnabled.checked) els.shareRecipientName.setCustomValidity("");
  updateSharePreview();
});
els.shareRate.addEventListener("input", updateSharePreview);
els.shareRecipientName.addEventListener("input", () => els.shareRecipientName.setCustomValidity(""));
els.shareForm.addEventListener("submit", async event => {
  event.preventDefault();
  els.shareRecipientName.required = els.shareEnabled.checked;
  if (els.shareEnabled.checked && els.shareRecipientName.value.trim().length < 2) {
    els.shareRecipientName.setCustomValidity(t("admin_tenants.share.recipient_name_required"));
  } else {
    els.shareRecipientName.setCustomValidity("");
  }
  if (!els.shareForm.reportValidity() || !state.shareTenantId) return;
  setShareError("");
  els.shareSubmit.disabled = true;
  els.shareSubmit.innerHTML = `<span class="tenant-button-spinner"></span><span>${t("admin_tenants.share.saving")}</span>`;
  try {
    await updateTenantRevenueShare({
      tenantId: state.shareTenantId,
      enabled: els.shareEnabled.checked,
      rate: Number(els.shareRate.value || 0),
      billingCycle: els.shareBillingCycle.value,
      recipientName: els.shareRecipientName.value.trim(),
    });
    toast(t("admin_tenants.share.saved"));
    closeDialog(els.shareDialog);
    await loadTenants();
    await loadSalesSummary();
    document.dispatchEvent(new CustomEvent("tenant-billing-mode-changed"));
  } catch (error) {
    console.error(error);
    const message = error.status === 503 ? t("admin_tenants.share.table_missing") : t("admin_tenants.share.save_failed");
    setShareError(message);
    toast(message, "error");
  } finally {
    els.shareSubmit.disabled = false;
    els.shareSubmit.innerHTML = `<i class="bi bi-floppy" aria-hidden="true"></i><span>${t("admin_tenants.share.save")}</span>`;
  }
});

document.querySelectorAll("[data-tenant-period]").forEach(button => button.addEventListener("click", () => setPeriod(button.dataset.tenantPeriod)));
[els.reportDate, els.reportMonth, els.reportYear, els.startDate, els.endDate].forEach(control => control.addEventListener("change", loadSalesSummary));
els.refreshSales.addEventListener("click", loadSalesSummary);
document.addEventListener("tenant-revenue-share-reviewed", () => Promise.all([loadTenants(), loadSalesSummary()]));
document.addEventListener("tenant-subscription-updated", event => patchTenantStatus(event.detail?.tenant));

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  if (els.shareDialog.open) closeDialog(els.shareDialog);
  else if (els.dialog.open) closeDialog(els.dialog);
});

const now = new Date();
els.reportDate.value = localDateKey(now);
els.reportMonth.value = monthKey(now);
els.startDate.value = localDateKey(now);
els.endDate.value = localDateKey(now);
for (let year = now.getFullYear(); year >= now.getFullYear() - 7; year -= 1) {
  const option = document.createElement("option");
  option.value = String(year);
  option.textContent = String(year);
  els.reportYear.appendChild(option);
}

await Promise.all([loadTenants(), loadSalesSummary()]);
