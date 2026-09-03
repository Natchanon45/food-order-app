import "./sweet-dialog.js?v=20260726-034";
import { toast } from "./ui.js?v=20260805-081";
import { formatDate, formatNumber, t } from "./i18n.js?v=20260812-099";
import {
  backfillTenantSubscriptions,
  listTenants,
  updateTenantSubscription,
} from "./platform-tenant-service.js?v=20260804-010";

const tenantList = document.querySelector("#tenantList");
let tenants = [];

async function askConfirm(message, options = {}) {
  if (typeof window.sweetConfirm === "function") return await window.sweetConfirm(message, options);
  return confirm(message);
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value.seconds) return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateInputValue(value) {
  const date = toDate(value);
  if (!date) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function daysRemaining(tenant) {
  const expiry = toDate(tenant.subscriptionExpiresAt);
  if (!expiry) return null;
  return Math.ceil((expiry.getTime() - Date.now()) / 86400000);
}

function statusInfo(tenant) {
  const status = tenant.subscriptionStatus || "active";
  const key = `admin_tenants.subscription.statuses.${status}`;
  const translated = t(key);
  return { status, label: translated === key ? status : translated };
}

function displaySubscriptionDate(value) {
  const date = toDate(value);
  if (!date) return t("admin_tenants.subscription.not_set");
  return formatDate(date, { year: "numeric", month: "short", day: "numeric" });
}

function subscriptionHtml(tenant) {
  const remaining = daysRemaining(tenant);
  const { status, label } = statusInfo(tenant);
  const planLabel = t(`admin_tenants.subscription.plans.${tenant.planCode === "yearly" ? "yearly" : "monthly"}`);
  const remainingLabel = remaining === null
    ? "-"
    : remaining >= 0
      ? t("admin_tenants.subscription.days", { count: formatNumber(remaining) })
      : t("admin_tenants.subscription.days_over", { count: formatNumber(Math.abs(remaining)) });

  return `<details class="tenant-subscription" data-subscription-tenant="${tenant.id}">
    <summary><span><i class="bi bi-credit-card-2-front" aria-hidden="true"></i><strong>${t("admin_tenants.subscription.title")}</strong></span><span class="tenant-subscription-summary">${label} · ${displaySubscriptionDate(tenant.subscriptionExpiresAt)}<i class="bi bi-chevron-down" aria-hidden="true"></i></span></summary>
    <div class="tenant-subscription-body">
      <div class="tenant-subscription-info">
        <article><span>${t("admin_tenants.subscription.package")}</span><strong>${planLabel}</strong></article>
        <article><span>${t("admin_tenants.subscription.status")}</span><strong>${label}</strong></article>
        <article><span>${t("admin_tenants.subscription.remaining")}</span><strong>${remainingLabel}</strong></article>
      </div>
      <div class="tenant-subscription-fields">
        <label>${t("admin_tenants.subscription.expiry")}<input class="input" type="date" data-expiry-date value="${dateInputValue(tenant.subscriptionExpiresAt)}"></label>
        <label>${t("admin_tenants.subscription.grace_days")}<input class="input" type="number" min="0" max="30" data-grace-days value="${Number(tenant.gracePeriodDays ?? 3)}"></label>
        <label>${t("admin_tenants.subscription.plan")}<select class="input" data-plan-code><option value="monthly" ${tenant.planCode !== "yearly" ? "selected" : ""}>${t("admin_tenants.subscription.plans.monthly")}</option><option value="yearly" ${tenant.planCode === "yearly" ? "selected" : ""}>${t("admin_tenants.subscription.plans.yearly")}</option></select></label>
      </div>
      <div class="tenant-subscription-actions">
        <button class="btn btn-primary btn-sm" type="button" data-subscription-action="extend" data-days="30"><i class="bi bi-calendar-plus" aria-hidden="true"></i><span>${t("admin_tenants.subscription.extend_30")}</span></button>
        <button class="btn btn-primary btn-sm" type="button" data-subscription-action="extend" data-days="365"><i class="bi bi-calendar2-plus" aria-hidden="true"></i><span>${t("admin_tenants.subscription.extend_year")}</span></button>
        <button class="btn btn-sm" type="button" data-subscription-action="set-expiry"><i class="bi bi-floppy" aria-hidden="true"></i><span>${t("admin_tenants.subscription.save_expiry")}</span></button>
        ${status === "suspended"
          ? `<button class="btn btn-primary btn-sm" type="button" data-subscription-action="activate"><i class="bi bi-check-circle" aria-hidden="true"></i><span>${t("admin_tenants.subscription.activate")}</span></button>`
          : `<button class="btn btn-danger btn-sm" type="button" data-subscription-action="suspend"><i class="bi bi-pause-circle" aria-hidden="true"></i><span>${t("admin_tenants.subscription.suspend")}</span></button>`}
      </div>
    </div>
  </details>`;
}

async function decorateTenantCards() {
  const cards = [...tenantList.querySelectorAll(":scope > article.tenant-store-card")];
  if (!cards.length) return;
  if (!tenants.length) {
    const result = await listTenants();
    tenants = result.data?.tenants || [];
  }
  cards.forEach(card => {
    const existing = card.querySelector("[data-subscription-tenant]");
    const tenant = tenants.find(item => String(item.id) === String(card.dataset.tenantCard));
    const revenueShareMode = card.dataset.billingMode === "revenue_share" || tenant?.billingMode === "revenue_share";
    if (revenueShareMode) {
      existing?.remove();
      return;
    }
    if (existing) return;
    if (tenant) card.insertAdjacentHTML("beforeend", subscriptionHtml(tenant));
  });
}

async function performAction(button) {
  const section = button.closest("[data-subscription-tenant]");
  const tenantId = section?.dataset.subscriptionTenant;
  if (!tenantId) return;
  const action = button.dataset.subscriptionAction;
  if (action === "suspend") {
    const ok = await askConfirm(t("admin_tenants.subscription.suspend_confirm"), {
      title: t("admin_tenants.subscription.suspend_title"),
      confirmText: t("admin_tenants.subscription.suspend"),
      cancelText: t("admin_tenants.common.cancel"),
      type: "warning",
    });
    if (!ok) return;
  }

  const payload = {
    tenantId,
    action,
    days: Number(button.dataset.days || 0),
    expiresAt: section.querySelector("[data-expiry-date]")?.value || "",
    gracePeriodDays: Number(section.querySelector("[data-grace-days]")?.value || 3),
    planCode: section.querySelector("[data-plan-code]")?.value || "monthly",
  };

  button.disabled = true;
  try {
    const result = await updateTenantSubscription(payload);
    toast(t("admin_tenants.subscription.updated"));
    const current = tenants.find(item => String(item.id) === String(tenantId)) || {};
    const tenant = {
      ...current,
      id: tenantId,
      active: result.data?.active !== false,
      subscriptionStatus: result.data?.status || current.subscriptionStatus || "active",
      subscriptionExpiresAt: result.data?.expiresAt || current.subscriptionExpiresAt || "",
      gracePeriodDays: Number(result.data?.gracePeriodDays ?? payload.gracePeriodDays),
      planCode: payload.planCode || current.planCode || "monthly",
    };
    const index = tenants.findIndex(item => String(item.id) === String(tenantId));
    if (index >= 0) tenants[index] = tenant;
    else tenants.push(tenant);
    const card = section.closest(".tenant-store-card");
    if (card) {
      section.remove();
      card.insertAdjacentHTML("beforeend", subscriptionHtml(tenant));
      card.querySelector("[data-subscription-tenant]")?.setAttribute("open", "");
    }
    document.dispatchEvent(new CustomEvent("tenant-subscription-updated", { detail: { tenant } }));
  } catch (error) {
    console.error(error);
    toast(error.message || t("admin_tenants.subscription.update_failed"), "error");
    button.disabled = false;
  }
}

tenantList.addEventListener("click", event => {
  const button = event.target.closest("[data-subscription-action]");
  if (button) performAction(button);
});

new MutationObserver(() => decorateTenantCards().catch(console.error)).observe(tenantList, { childList: true });
document.addEventListener("tenant-billing-mode-changed", () => {
  tenants = [];
  decorateTenantCards().catch(console.error);
});

try {
  const result = await backfillTenantSubscriptions({});
  if (result.data?.updated) toast(t("admin_tenants.subscription.backfilled", { count: formatNumber(result.data.updated) }));
} catch (error) {
  console.error("Subscription backfill failed", error);
}

await decorateTenantCards();
