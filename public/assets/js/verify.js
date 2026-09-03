import "./public-page-static-i18n.js?v=20260903-243";

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

async function resolveTenantContext() {
  const snapshot = await getDoc(doc(db, "tenantSlugs", tenantSlug));
  if (!snapshot.exists() || snapshot.data().active === false) throw new Error(t("verify.errors.storefront_not_found"));
  const tenant = snapshot.data();
  setActiveTenant({ id: tenant.tenantId, slug: tenant.slug || tenantSlug, name: tenant.name || tenant.shopName || tenantSlug });
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
      <div class="section-title"><h2>${settings.shopName || t("verify.shop_fallback")}</h2><span class="badge">${t("verify.latest_badge")}</span></div>
      <p>${settings.shopAddress || ""}${settings.shopPhone ? `<br>${t("verify.fields.phone")} ${settings.shopPhone}` : ""}</p>
      <div class="grid grid-2">
        <div><strong>${t("verify.fields.type")}</strong><br>${t("verify.summary.merged_table", { table: first.tableCode || "-" })}</div>
        <div><strong>${t("verify.fields.rounds")}</strong><br>${t("verify.summary.round_count", { count: orders.length })}</div>
        <div><strong>${t("verify.fields.date")}</strong><br>${formatTime(first.createdAt)}</div>
        <div><strong>${t("verify.fields.payment")}</strong><br>${paid ? t("verify.payment.paid") : t("verify.payment.unpaid")}</div>
        <div><strong>${t("verify.fields.net_total")}</strong><br>${money(total)} ${t("verify.units.baht")}</div>
      </div>
      <hr class="receipt-rule">
      ${orders
        .map(
          (order) => `
        <div class="card" style="margin-bottom:10px;${order.status === "cancelled" ? "opacity:.6" : ""}">
          <strong>${t("verify.round.title", { round: order.roundNumber || 1 })}${order.status === "cancelled" ? t("verify.round.cancelled_suffix") : ""}</strong>
          <ul class="order-items">${activeItems(order)
            .map(
              (item) =>
                `<li>${item.qty} × ${verifyItemName(item)}<strong style="float:right">${money(Number(item.qty) * Number(item.price))}</strong></li>`,
            )
            .join("") || `<li>${t("verify.no_billable_items")}</li>`}</ul>
        </div>
      `,
        )
        .join("")}
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
      <div class="section-title"><h2>${settings.shopName || t("verify.shop_fallback")}</h2><span class="badge">${t("verify.latest_badge")}</span></div>
      <p>${settings.shopAddress || ""}${settings.shopPhone ? `<br>${t("verify.fields.phone")} ${settings.shopPhone}` : ""}</p>
      <div class="grid grid-2">
        <div><strong>${t("verify.fields.order_number")}</strong><br>${orderId.slice(0, 12).toUpperCase()}</div>
        <div><strong>${t("verify.fields.date")}</strong><br>${formatTime(order.createdAt)}</div>
        <div><strong>${t("verify.fields.type")}</strong><br>${orderTypeText(order)}</div>
        <div><strong>${t("verify.fields.latest_status")}</strong><br>${statusLabel(order.status)}</div>
        <div><strong>${t("verify.fields.payment")}</strong><br>${paymentText(order)}</div>
        <div><strong>${t("verify.fields.net_total")}</strong><br>${money(total)} ${t("verify.units.baht")}</div>
      </div>
      ${
        isDelivery
          ? `<hr class="receipt-rule"><p><strong>${t("verify.fields.recipient")}:</strong> ${order.recipientName || "-"}<br><strong>${t("verify.fields.phone")}:</strong> ${order.recipientPhone || "-"}<br><strong>${t("verify.fields.address")}:</strong> ${order.deliveryAddress || "-"}<br><strong>${t("verify.fields.delivery_fee")}:</strong> ${money(deliveryFee)} ${t("verify.units.baht")}</p>`
          : ""
      }
      <hr class="receipt-rule">
      <ul class="order-items">${
        activeItems(order)
          .map(
            (item) =>
              `<li>${item.qty} × ${verifyItemName(item)}<strong style="float:right">${money(Number(item.qty) * Number(item.price))}</strong></li>`,
          )
          .join("") || `<li>${t("verify.no_billable_items")}</li>`
      }</ul>
      ${(order.items || []).some((item) => item.cancelled) ? `<p class="menu-category">${t("verify.cancelled_items_note")}</p>` : ""}
    `;
  }
} catch (error) {
  console.error(error);
  root.innerHTML = `<div class="empty">${verificationError(error)}</div>`;
}
