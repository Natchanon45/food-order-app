import "./public-page-static-i18n.js?v=20260920-001";

import { db, doc, getDoc } from "./firebase-config.js?v=20260630-073";
import { setActiveTenant } from "./tenant-context.js?v=20260903-201";
import { dataService } from "./data-service.js?v=20260903-230";
import { money, formatTime, statusLabel } from "./ui.js?v=20260805-081";
import { t } from "./i18n.js?v=20260903-202";
import { enrichDeliveryGiftItems } from "./delivery-order-display.js?v=20260903-243";

const params = new URLSearchParams(location.search);
const tenantSlug = (params.get("tenant") || "").trim().toLowerCase();
const orderId = params.get("order") || "";
const orderIds = (params.get("orders") || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const root = document.querySelector("#verifyResult");
let tenantContext = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function resolveTenantContext() {
  const snapshot = await getDoc(doc(db, "tenantSlugs", tenantSlug));
  if (!snapshot.exists() || snapshot.data().active === false) throw new Error(t("verify.errors.storefront_not_found"));
  const tenant = snapshot.data();
  tenantContext = {
    id: tenant.tenantId,
    slug: tenant.slug || tenantSlug,
    name: tenant.name || tenant.shopName || tenantSlug,
  };
  setActiveTenant(tenantContext);
  return tenantContext;
}

async function getOrder(id) { return dataService.getOrder(id); }

function paymentText(order) {
  if (order.paymentStatus === "paid" || order.status === "paid") return t("verify.payment.paid");
  if (order.paymentMethod === "cod") return t("verify.payment.cod");
  if (order.paymentStatus === "pending_verification") return t("verify.payment.pending_verification");
  return t("verify.payment.unpaid");
}

function activeItems(order) {
  return (order.items || []).filter((item) => !item.cancelled);
}

function verifyItemName(item = {}) {
  return item.isGift === true ? `${item.name} ${t("verify.gift_suffix")}` : item.name;
}

function currentSubtotal(order) {
  return activeItems(order).reduce(
    (sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0),
    0,
  );
}

function effectiveDeliveryFee(order, subtotal = currentSubtotal(order)) {
  if (order.status === "cancelled" || order.orderType !== "delivery") return 0;
  const storedFee = Math.max(0, Number(order.deliveryFee || 0) || 0);
  if (order.freeShippingApplied === true) return 0;
  const storedTotal = Number(order.totalAmount);
  if (Number.isFinite(storedTotal) && subtotal + storedFee > storedTotal + 0.009) {
    return Math.max(0, storedTotal - subtotal);
  }
  return storedFee;
}

function currentTotal(order) {
  if (order.status === "cancelled") return 0;
  const subtotal = currentSubtotal(order);
  if (order.orderType === "delivery") {
    const storedTotal = Number(order.totalAmount);
    if (Number.isFinite(storedTotal)) return Math.max(0, storedTotal);
    return subtotal + effectiveDeliveryFee(order, subtotal);
  }
  return subtotal;
}

function orderTypeText(order) {
  if (order.orderType === "delivery") return t("verify.order_type.delivery");
  if (order.orderType === "takeaway") {
    return t("verify.order_type.takeaway", { queue: order.queueNo || "" }).trim();
  }
  return t("verify.order_type.table", { table: order.tableCode || "-" });
}

function verificationError(error) {
  const code = String(error?.code || error?.message || "");
  if (code.includes("STOREFRONT_NOT_FOUND")) {
    return t("verify.errors.storefront_not_found");
  }
  return error?.message || t("verify.errors.generic");
}

function verifiedShopName(settings = {}) {
  return String(
    tenantContext?.name
    || settings?.orderDeliveryShopName
    || settings?.shopName
    || t("verify.shop_fallback"),
  ).trim();
}

function shopHeaderHtml(settings = {}) {
  const address = String(settings.shopAddress || "").trim();
  const phone = String(settings.shopPhone || "").trim();
  const meta = [
    address ? escapeHtml(address) : "",
    phone ? `${escapeHtml(t("verify.fields.phone"))} ${escapeHtml(phone)}` : "",
  ].filter(Boolean).join("<br>");
  return `
    <div class="verify-shop-head">
      <div class="verify-shop-identity">
        <span class="verify-shop-icon" aria-hidden="true"><i class="bi bi-shop"></i></span>
        <div class="verify-shop-copy">
          <h2>${escapeHtml(verifiedShopName(settings))}</h2>
          <p>${meta || "&nbsp;"}</p>
        </div>
      </div>
      <span class="verify-latest-badge"><i class="bi bi-patch-check"></i><span>${escapeHtml(t("verify.latest_badge"))}</span></span>
    </div>
  `;
}

function metricHtml(icon, label, value, { total = false } = {}) {
  return `
    <div class="verify-metric${total ? " verify-metric-total" : ""}">
      <div class="verify-metric-label"><i class="bi bi-${icon}"></i><span>${escapeHtml(label)}</span></div>
      <div class="verify-metric-value">${escapeHtml(value)}</div>
    </div>
  `;
}

function itemsHtml(order) {
  const rows = activeItems(order)
    .map((item) => `
      <li>
        <span>${escapeHtml(item.qty)} × ${escapeHtml(verifyItemName(item))}</span>
        <strong>${escapeHtml(money(Number(item.qty) * Number(item.price)))}</strong>
      </li>
    `)
    .join("") || `<li><span>${escapeHtml(t("verify.no_billable_items"))}</span><strong>—</strong></li>`;
  return `<ul class="order-items verify-items">${rows}</ul>`;
}

try {
  if (!tenantSlug) throw new Error(t("verify.errors.missing_tenant"));

  await resolveTenantContext();
  const [settings, menus] = await Promise.all([dataService.getStoreSettings(), dataService.listMenus()]);

  if (orderIds.length) {
    const orders = (await Promise.all(orderIds.map((id) => getOrder(id))))
      .filter(Boolean)
      .map(order => enrichDeliveryGiftItems(order, menus))
      .sort((a, b) => Number(a.roundNumber || 0) - Number(b.roundNumber || 0));
    if (!orders.length) throw new Error(t("verify.errors.order_not_found"));

    const first = orders[0];
    const total = orders.reduce((sum, order) => sum + currentTotal(order), 0);
    const paid = orders.every(
      (order) =>
        order.paymentStatus === "paid" ||
        order.status === "paid" ||
        order.status === "cancelled",
    );

    root.innerHTML = `
      ${shopHeaderHtml(settings)}
      <div class="verify-card-body">
        <div class="verify-summary-grid">
          ${metricHtml("diagram-3", t("verify.fields.type"), t("verify.summary.merged_table", { table: first.tableCode || "-" }))}
          ${metricHtml("layers", t("verify.fields.rounds"), t("verify.summary.round_count", { count: orders.length }))}
          ${metricHtml("calendar3", t("verify.fields.date"), formatTime(first.createdAt))}
          ${metricHtml("credit-card", t("verify.fields.payment"), paid ? t("verify.payment.paid") : t("verify.payment.unpaid"))}
          ${metricHtml("cash-stack", t("verify.fields.net_total"), `${money(total)} ${t("verify.units.baht")}`, { total: true })}
        </div>
        <div class="verify-rounds">
          ${orders.map((order) => `
            <section class="verify-round-card${order.status === "cancelled" ? " is-cancelled" : ""}">
              <div class="verify-round-title"><i class="bi bi-receipt"></i><span>${escapeHtml(t("verify.round.title", { round: order.roundNumber || 1 }))}${order.status === "cancelled" ? escapeHtml(t("verify.round.cancelled_suffix")) : ""}</span></div>
              ${itemsHtml(order)}
            </section>
          `).join("")}
        </div>
      </div>
    `;
  } else {
    if (!orderId) throw new Error(t("verify.errors.missing_order"));
    const rawOrder = await getOrder(orderId);
    if (!rawOrder) throw new Error(t("verify.errors.order_not_found"));
    const order = enrichDeliveryGiftItems(rawOrder, menus);

    const isDelivery = order.orderType === "delivery";
    const subtotal = order.status === "cancelled" ? 0 : currentSubtotal(order);
    const deliveryFee = effectiveDeliveryFee(order, subtotal);
    const total = currentTotal(order);

    root.innerHTML = `
      ${shopHeaderHtml(settings)}
      <div class="verify-card-body">
        <div class="verify-summary-grid">
          ${metricHtml("hash", t("verify.fields.order_number"), orderId.slice(0, 12).toUpperCase())}
          ${metricHtml("calendar3", t("verify.fields.date"), formatTime(order.createdAt))}
          ${metricHtml("bag-check", t("verify.fields.type"), orderTypeText(order))}
          ${metricHtml("activity", t("verify.fields.latest_status"), statusLabel(order.status))}
          ${metricHtml("credit-card", t("verify.fields.payment"), paymentText(order))}
          ${metricHtml("cash-stack", t("verify.fields.net_total"), `${money(total)} ${t("verify.units.baht")}`, { total: true })}
        </div>
        ${isDelivery ? `
          <section class="verify-detail-panel">
            <div class="verify-detail-title"><i class="bi bi-truck"></i><span>${escapeHtml(t("verify.order_type.delivery"))}</span></div>
            <p>
              <strong>${escapeHtml(t("verify.fields.recipient"))}:</strong> ${escapeHtml(order.recipientName || "-")}<br>
              <strong>${escapeHtml(t("verify.fields.phone"))}:</strong> ${escapeHtml(order.recipientPhone || "-")}<br>
              <strong>${escapeHtml(t("verify.fields.address"))}:</strong> ${escapeHtml(order.deliveryAddress || "-")}<br>
              <strong>${escapeHtml(t("verify.fields.delivery_fee"))}:</strong> ${escapeHtml(money(deliveryFee))} ${escapeHtml(t("verify.units.baht"))}
            </p>
          </section>
        ` : ""}
        <section class="verify-items-panel">
          ${itemsHtml(order)}
        </section>
        ${(order.items || []).some((item) => item.cancelled) ? `<p class="menu-category">${escapeHtml(t("verify.cancelled_items_note"))}</p>` : ""}
      </div>
    `;
  }
} catch (error) {
  console.error(error);
  root.innerHTML = `
    <div class="verify-error">
      <span class="verify-error-icon" aria-hidden="true"><i class="bi bi-exclamation-circle"></i></span>
      <strong>${escapeHtml(verificationError(error))}</strong>
    </div>
  `;
}
