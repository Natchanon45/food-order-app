import "./sweet-dialog.js?v=20260726-034";
import "./cashier-table-move.js?v=20260812-117";
import { dataService, usingDemoMode } from "./data-service.js?v=20260903-221";
import { storage, ref, getDownloadURL } from "./firebase-config.js?v=20260630-073";
import { money, statusLabel, formatTime, toast } from "./ui.js?v=20260805-081";
import { observeDeliveryOrders } from "./delivery-notifier.js?v=20260903-242";
import { iconMarkup } from "./bootstrap-icons.js?v=20260701-001";
import { t } from "./i18n.js?v=20260812-099";
import { enrichDeliveryGiftItems } from "./delivery-order-display.js?v=20260903-242";

if (!document.querySelector('link[href*="sweet-dialog.css"]')) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/assets/css/sweet-dialog.css?v=20260726-034";
  document.head.appendChild(link);
}
if (usingDemoMode)
  document.querySelector("#demoBanner").innerHTML =
    `<div class="demo-banner">${t("cashier.demo")}</div>`;

const grid = document.querySelector("#orderGrid");
const orderCount = document.querySelector("#cashierOrderCount");
let currentOrders = [];
let availableMenus = [];
let slipUrls = new Map();
async function askConfirm(message, options = {}) {
  if (typeof window.sweetConfirm === "function")
    return await window.sweetConfirm(message, options);
  return confirm(message);
}
function icon(name) {
  return iconMarkup(name);
}
function decorateConfirmAction() {
  queueMicrotask(() => {
    const confirmButton = document.querySelector("#sweetDialogConfirm");
    if (!confirmButton) return;
    confirmButton.innerHTML = `${icon("check-circle")}<span>${t("cashier.common.confirm")}</span>`;
    confirmButton.style.display = "inline-flex";
    confirmButton.style.alignItems = "center";
    confirmButton.style.justifyContent = "center";
    confirmButton.style.gap = "8px";
  });
}
function cashierItemDisplayName(item = {}) {
  const name = String(item?.name || "");

  return item?.isGift === true
    ? `${name} ${t("cashier.items.gift_suffix")}`
    : name;
}

function itemDetails(item) {
  const parts = [];
  if (item.note)
    parts.push(`<small><strong>${t("cashier.items.note_label")}</strong> ${item.note}</small>`);
  if (item.replacedFromName)
    parts.push(
      `<small><strong>${t("cashier.items.changed_from_label")}</strong> ${item.replacedFromName}</small>`,
    );
  if (item.originalQty && Number(item.originalQty) !== Number(item.qty))
    parts.push(
      `<small><strong>${t("cashier.items.original_qty_label")}</strong> ${item.originalQty}</small>`,
    );
  return parts.length
    ? `<div class="menu-category" style="margin-top:3px;line-height:1.35">${parts.join("<br>")}</div>`
    : "";
}
function orderNote(order) {
  return order.note
    ? `<div class="card" style="margin-top:10px;padding:10px 12px;box-shadow:none;background:#fff8e8"><strong>${t("cashier.items.order_note_title")}</strong><div style="margin-top:4px">${order.note}</div></div>`
    : "";
}
function paymentLabel(order) {
  if (order.paymentStatus === "paid" && order.status === "served")
    return t("cashier.payment.paid_waiting_close");
  if (order.paymentStatus === "paid") return t("cashier.payment.confirmed");
  if (order.paymentStatus === "pending_verification") return t("cashier.payment.slip_pending");
  if (order.paymentMethod === "cod") return t("cashier.payment.cod");
  return t("cashier.payment.waiting");
}
function activeOrders(orders) {
  return orders.filter(
    (order) =>
      !["paid", "cancelled"].includes(order.status) &&
      !isWaitingQueuePlaceholder(order),
  );
}
function isWaitingQueuePlaceholder(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  return (
    Boolean(order?.waitingQueueId) &&
    Number(order?.roundNumber || 0) === 0 &&
    items.length === 0 &&
    Number(order?.totalAmount ?? order?.total ?? 0) === 0
  );
}
function tableGroupKey(order) {
  return order.tableToken || `table:${order.tableCode}`;
}
function isTableOrder(order) {
  return order?.orderType !== "delivery" && order?.orderType !== "takeaway";
}
function isServed(order) {
  return order?.status === "served";
}
function queueSequence(order) {
  const explicit = Number(order?.queueSequence);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const parsed = Number(String(order?.queueNo || "").replace(/\D/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
function queueBadge(order) {
  return `<span class="order-queue-badge"><small>${t("cashier.queue.number")}</small><strong>${order?.queueNo || "-"}</strong></span>`;
}
function tablePaymentPatch(order, paidAt) {
  const patch = { paymentStatus: "paid", paidAt };
  if (isServed(order)) {
    patch.status = "paid";
    patch.completedAt = paidAt;
  }
  return patch;
}
async function resolveSlipUrls(orders) {
  const targets = orders.filter(
    (order) =>
      order.orderType === "delivery" &&
      order.paymentSlipPath &&
      !order.paymentSlipUrl &&
      !slipUrls.has(order.id),
  );
  await Promise.all(
    targets.map(async (order) => {
      try {
        const path = String(order.paymentSlipPath || "").trim();
        if (!path) return;
        const url = /^(?:https?:|data:|blob:)/i.test(path)
          ? path
          : await getDownloadURL(ref(storage, path));
        if (url) slipUrls.set(order.id, url);
      } catch (error) {
        console.error("Unable to load payment slip", order.id, error);
      }
    }),
  );
}
function itemRows(order) {
  return (order.items || [])
    .map(
      (item) =>
        `<li style="${item.cancelled ? "opacity:.5;text-decoration:line-through" : ""}"><div>${item.qty} × ${cashierItemDisplayName(item)}<strong style="float:right">${item.cancelled ? t("cashier.items.cancelled") : money(item.qty * item.price)}</strong></div>${itemDetails(item)}</li>`,
    )
    .join("");
}
function renderDelivery(order) {
  const paymentAction =
    order.paymentStatus !== "paid"
      ? `<button class="btn btn-primary" data-payment-id="${order.id}">${icon("check-circle")}<span>${t("cashier.payment.receive")}</span></button>`
      : "";
  const slipUrl = order.paymentSlipUrl || slipUrls.get(order.id) || "";
  const slipAction = slipUrl
    ? `<a class="btn btn-warning" href="${slipUrl}" target="_blank" rel="noopener">${icon("view")}<span>${t("cashier.payment.view_slip")}</span></a>`
    : order.paymentSlipPath
      ? `<button class="btn btn-warning" disabled>${icon("view")}<span>${t("cashier.payment.loading_slip")}</span></button>`
      : "";
  return `<article class="card order-card"><div class="order-head"><div class="order-heading-with-queue">${queueBadge(order)}<div><h2 style="margin:0">Delivery: ${order.recipientName || t("cashier.delivery.recipient_fallback")}</h2><small>${formatTime(order.createdAt || order.createdAtText || order.updatedAt)}</small></div></div><span class="badge">${statusLabel(order.status)}</span></div><p><span class="badge ${order.paymentStatus === "paid" ? "" : "warning"}">${paymentLabel(order)}</span><br><strong>${t("cashier.delivery.phone")}</strong> ${order.recipientPhone || "-"}<br><strong>${t("cashier.delivery.address")}</strong> ${order.deliveryAddress || "-"}</p><ul class="order-items">${itemRows(order)}</ul>${orderNote(order)}<div class="order-head" style="margin-top:10px"><strong>${t("cashier.delivery.net_total")}</strong><strong class="price">${money(order.totalAmount)} ${t("cashier.common.baht")}</strong></div><div class="order-actions" style="margin-top:12px"><a class="btn btn-dark" href="/cashier/receipt/?order=${encodeURIComponent(order.id)}" target="_blank" rel="noopener">${icon("print")}<span>${t("cashier.common.print")}</span></a>${slipAction}${paymentAction}<button class="btn btn-danger" data-id="${order.id}" data-status="cancelled">${icon("times-circle")}<span>${t("cashier.actions.cancel_all")}</span></button></div></article>`;
}
function renderTakeaway(order) {
  const paid = order.paymentStatus === "paid";
  const ready = order.status === "ready" || order.pickupStatus === "called";
  const paymentAction = !paid
    ? `<button class="btn btn-primary" data-payment-id="${order.id}">${icon("check-circle")}<span>${t("cashier.payment.receive")}</span></button>`
    : "";
  const callAction =
    ready && order.pickupStatus !== "called"
      ? `<button class="btn btn-warning" data-pickup-call="${order.id}">${icon("receipt")}<span>${t("cashier.actions.call_pickup")}</span></button>`
      : "";
  const doneAction =
    ready || order.pickupStatus === "called"
      ? `<button class="btn cashier-pickup-done-action" data-pickup-done="${order.id}">${icon("check-circle")}<span>${t("cashier.actions.handed_over")}</span></button>`
      : "";
  return `<article class="card order-card"><div class="order-head"><div class="order-heading-with-queue">${queueBadge(order)}<div><h2 style="margin:0">Take Away</h2><small>${formatTime(order.createdAt || order.createdAtText || order.updatedAt)}</small></div></div><span class="badge ${order.pickupStatus === "called" ? "warning" : ""}">${order.pickupStatus === "called" ? t("cashier.takeaway.queue_called") : statusLabel(order.status)}</span></div><p><strong>${t("cashier.takeaway.customer")}</strong> ${order.customerName || "-"}<br><strong>${t("cashier.takeaway.phone")}</strong> ${order.customerPhone || "-"}<br><span class="badge ${paid ? "" : "warning"}">${paid ? t("cashier.payment.paid") : t("cashier.payment.waiting")}</span></p><ul class="order-items">${itemRows(order)}</ul>${orderNote(order)}<div class="order-head" style="margin-top:10px"><strong>${t("cashier.takeaway.net_total")}</strong><strong class="price">${money(order.totalAmount)} ${t("cashier.common.baht")}</strong></div><div class="order-actions" style="margin-top:12px"><a class="btn btn-dark" href="/cashier/receipt/?order=${encodeURIComponent(order.id)}" target="_blank" rel="noopener">${icon("print")}<span>${t("cashier.common.print")}</span></a>${paymentAction}${callAction}${doneAction}<button class="btn btn-danger" data-id="${order.id}" data-status="cancelled">${icon("times-circle")}<span>${t("cashier.actions.cancel_all")}</span></button></div></article>`;
}
function renderTableBill(group) {
  const sorted = [...group].sort(
    (a, b) => Number(a.roundNumber || 0) - Number(b.roundNumber || 0),
  );
  const first = sorted[0];
  const total = sorted.reduce(
    (sum, order) => sum + Number(order.totalAmount || 0),
    0,
  );
  const ids = sorted.map((order) => order.id).join(",");
  const key = tableGroupKey(first);
  const unpaidPaymentRounds = sorted.filter(
    (order) => order.paymentStatus !== "paid",
  );
  const servedCount = sorted.filter(isServed).length;
  const paymentBadge = unpaidPaymentRounds.length
    ? `<span class="badge warning">${t("cashier.table.waiting_payment")}</span>`
    : `<span class="badge">${t("cashier.table.paid_waiting_served")}</span>`;
  const rounds = sorted
    .map(
      (order) =>
        `<section class="card" style="padding:12px;margin-top:10px;box-shadow:none;background:#f8fbf9"><div class="order-head"><strong>${t("cashier.table.round", { round: order.roundNumber || 1 })}</strong><small>${formatTime(order.createdAt || order.createdAtText || order.updatedAt)}</small></div><div class="menu-category">${t("cashier.table.kitchen_status")} ${statusLabel(order.status)} • ${order.paymentStatus === "paid" ? t("cashier.payment.paid_short") : t("cashier.payment.unpaid")}</div><ul class="order-items">${itemRows(order)}</ul>${orderNote(order)}<div class="order-head" style="margin-top:8px"><span>${t("cashier.table.round_total")}</span><strong>${money(order.totalAmount)} ${t("cashier.common.baht")}</strong></div><div class="order-actions" style="margin-top:8px"><button class="btn btn-danger btn-sm" data-id="${order.id}" data-status="cancelled">${icon("times-circle")}<span>${t("cashier.actions.cancel_all")}</span></button></div></section>`,
    )
    .join("");
  const paymentAction = unpaidPaymentRounds.length
    ? `<button class="btn btn-primary" data-table-payment="${key}">${icon("check-circle")}<span>${t("cashier.payment.receive")}</span></button>`
    : `<button class="btn btn-primary" disabled>${icon("check-circle")}<span>${t("cashier.payment.paid_short")}</span></button>`;
  return `<article class="card order-card"><div class="order-head"><div class="order-heading-with-queue">${queueBadge(first)}<div><h2 style="margin:0">${t("cashier.table.title", { table: first.tableCode })}</h2><small>${t("cashier.table.open_rounds_summary", { rounds: sorted.length, served: servedCount })}</small></div></div>${paymentBadge}</div>${rounds}<div class="order-head" style="margin-top:14px;padding-top:12px;border-top:2px solid #dfe8e2"><strong>${t("cashier.table.total")}</strong><strong class="price">${money(total)} ${t("cashier.common.baht")}</strong></div><div class="order-actions" style="margin-top:12px"><a class="btn btn-dark" href="/cashier/receipt/?orders=${encodeURIComponent(ids)}" target="_blank" rel="noopener">${icon("print")}<span>${t("cashier.common.print")}</span></a>${paymentAction}</div></article>`;
}
function render(orders) {
  currentOrders = orders;
  const active = activeOrders(orders);
  const deliveries = active.filter((order) => order.orderType === "delivery");
  const takeaways = active.filter((order) => order.orderType === "takeaway");
  const tableOrders = active.filter(
    (order) => order.orderType !== "delivery" && order.orderType !== "takeaway",
  );
  const groups = new Map();
  tableOrders.forEach((order) => {
    const key = tableGroupKey(order);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(order);
  });
  const cards = [
    ...Array.from(groups.values()).map(group => ({ queueDate: group[0].queueDate || "", sequence: queueSequence(group[0]), createdAt: group[0].createdAt, html: renderTableBill(group) })),
    ...takeaways.map(order => ({ queueDate: order.queueDate || "", sequence: queueSequence(order), createdAt: order.createdAt, html: renderTakeaway(order) })),
    ...deliveries.map(order => ({ queueDate: order.queueDate || "", sequence: queueSequence(order), createdAt: order.createdAt, html: renderDelivery(order) })),
  ].sort((a, b) => {
    const time = value => {
      if (!value) return 0;
      if (typeof value.toDate === "function") return value.toDate().getTime();
      if (typeof value.seconds === "number") return value.seconds * 1000;
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    };
    return String(b.queueDate).localeCompare(String(a.queueDate)) || b.sequence - a.sequence || time(b.createdAt) - time(a.createdAt);
  });
  if (orderCount) orderCount.textContent = t("cashier.queue.count", { count: cards.length });
  grid.innerHTML = cards.length
    ? cards.map(card => card.html).join("")
    : `<div class="cashier-empty"><span class="cashier-empty-mark" aria-hidden="true"></span><strong>${t("cashier.queue.empty_title")}</strong><span>${t("cashier.queue.empty_help")}</span></div>`;
}
async function closeTableAfterPayment(orders) {
  const first = orders[0];
  if (!first?.tableCode || first?.orderType === "takeaway") return;
  const table = await dataService.getTable(first.tableCode);
  if (table && (!first.tableToken || table.orderToken === first.tableToken))
    await dataService.updateTable(table.id, {
      status: "available",
      orderToken: "",
      sessionStartedAt: null,
      currentRound: 0,
      orderIds: [],
    });
}

function openReceiptPrintWindow() {
  const printWindow = window.open("", "_blank");
  if (printWindow) printWindow.opener = null;
  return printWindow;
}

function printOrderReceipt(printWindow, orderId) {
  const url = `/cashier/receipt/?order=${encodeURIComponent(orderId)}&autoprint=1`;
  if (printWindow && !printWindow.closed) printWindow.location.replace(url);
  else location.assign(url);
}

function printTableReceipt(printWindow, orders) {
  const ids = orders.map((order) => order.id).filter(Boolean).join(",");
  const url = `/cashier/receipt/?orders=${encodeURIComponent(ids)}&autoprint=1`;
  if (printWindow && !printWindow.closed) printWindow.location.replace(url);
  else location.assign(url);
}

function closePrintWindow(printWindow) {
  if (printWindow && !printWindow.closed) printWindow.close();
}

grid.addEventListener("click", async (event) => {
  const tablePaymentButton = event.target.closest("[data-table-payment]");
  if (tablePaymentButton) {
    const key = tablePaymentButton.dataset.tablePayment;
    const rounds = activeOrders(currentOrders).filter(
      (order) => isTableOrder(order) && tableGroupKey(order) === key,
    );
    const payableRounds = rounds.filter(
      (order) => order.paymentStatus !== "paid",
    );
    if (!rounds.length || !payableRounds.length) return;
    const total = payableRounds.reduce(
      (sum, order) => sum + Number(order.totalAmount || 0),
      0,
    );
    const ok = await askConfirm(
      `${t("cashier.table.confirm_payment", { table: rounds[0].tableCode, amount: money(total) })}\n\n${t("cashier.table.payment_serving_help")}`,
      {
        title: t("cashier.table.payment_title"),
        confirmText: t("cashier.common.confirm"),
        cancelText: t("cashier.common.cancel"),
        type: "warning",
      },
    );
    if (!ok) return;
    const printWindow = openReceiptPrintWindow();
    tablePaymentButton.disabled = true;
    try {
      const now = new Date().toISOString();
      await Promise.all(
        payableRounds.map((order) =>
          dataService.updateOrder(order.id, tablePaymentPatch(order, now)),
        ),
      );
      const allWillBeClosed = rounds.every(
        (order) => order.status === "paid" || isServed(order),
      );
      if (allWillBeClosed) await closeTableAfterPayment(rounds);
      toast(
        allWillBeClosed
          ? t("cashier.toasts.table_paid_closed", { table: rounds[0].tableCode })
          : t("cashier.toasts.table_paid_waiting_kitchen", { table: rounds[0].tableCode }),
      );
      printTableReceipt(printWindow, rounds);
    } catch (error) {
      closePrintWindow(printWindow);
      console.error(error);
      toast(t("cashier.toasts.table_payment_failed"), "error");
      tablePaymentButton.disabled = false;
    }
    return;
  }
  const pickupCall = event.target.closest("[data-pickup-call]");
  if (pickupCall) {
    const now = new Date().toISOString();
    await dataService.updateOrder(pickupCall.dataset.pickupCall, {
      pickupStatus: "called",
      pickupCalledAt: now,
    });
    toast(t("cashier.toasts.pickup_called"));
    return;
  }
  const pickupDone = event.target.closest("[data-pickup-done]");
  if (pickupDone) {
    const now = new Date().toISOString();
    await dataService.updateOrder(pickupDone.dataset.pickupDone, {
      status: "paid",
      paymentStatus: "paid",
      paidAt: now,
      completedAt: now,
      pickupStatus: "picked_up",
      pickedUpAt: now,
    });
    toast(t("cashier.toasts.takeaway_handed_over"));
    return;
  }
  const paymentButton = event.target.closest("[data-payment-id]");
  if (paymentButton) {
    const confirmation = askConfirm(
      t("cashier.payment.confirm_message"),
      {
        title: t("cashier.payment.confirm_title"),
        confirmText: t("cashier.common.confirm"),
        cancelText: t("cashier.common.cancel"),
        type: "warning",
      },
    );
    decorateConfirmAction();
    const ok = await confirmation;
    if (!ok) return;
    const printWindow = openReceiptPrintWindow();
    paymentButton.disabled = true;
    const order = currentOrders.find(
      (item) => item.id === paymentButton.dataset.paymentId,
    );
    try {
      const now = new Date().toISOString();
      const patch = { paymentStatus: "paid", paidAt: now };
      if (order?.orderType === "delivery" && order.status === "served") {
        patch.status = "paid";
        patch.completedAt = now;
      }
      await dataService.updateOrder(paymentButton.dataset.paymentId, patch);
      toast(
        order?.orderType === "takeaway"
          ? t("cashier.toasts.takeaway_payment_saved")
          : patch.status === "paid"
            ? t("cashier.toasts.delivery_paid_closed")
            : t("cashier.toasts.payment_saved_waiting_rider"),
      );
      printOrderReceipt(printWindow, order?.id || paymentButton.dataset.paymentId);
    } catch (error) {
      closePrintWindow(printWindow);
      console.error(error);
      toast(t("cashier.toasts.payment_failed"), "error");
      paymentButton.disabled = false;
    }
    return;
  }
  const button = event.target.closest("[data-id][data-status]");
  if (!button) return;
  const { id, status } = button.dataset;
  const order = currentOrders.find((item) => item.id === id);
  if (status === "cancelled") {
    const targetLabel =
      order?.orderType === "delivery"
        ? t("cashier.cancel_order.delivery_target", { customer: order.recipientName || t("cashier.cancel_order.customer_fallback") })
        : order?.orderType === "takeaway"
          ? t("cashier.cancel_order.takeaway_target", { queue: order.queueNo || "" })
          : t("cashier.cancel_order.table_target", { table: order?.tableCode || "-", round: order?.roundNumber || 1 });
    const confirmation = askConfirm(
      `${t("cashier.cancel_order.message", { target: targetLabel })}\n\n${t("cashier.cancel_order.warning")}`,
      {
        title: t("cashier.cancel_order.title"),
        confirmText: t("cashier.common.confirm"),
        cancelText: t("cashier.common.cancel"),
        type: "warning",
      },
    );
    decorateConfirmAction();
    const ok = await confirmation;
    if (!ok) return;
  }
  button.disabled = true;
  try {
    await dataService.updateOrder(id, { status });
    if (
      status === "cancelled" &&
      order?.orderType !== "delivery" &&
      order?.orderType !== "takeaway" &&
      order?.tableCode
    ) {
      const hasOtherActiveRounds = currentOrders.some(
        (item) =>
          item.id !== id &&
          item.tableToken === order.tableToken &&
          !["paid", "cancelled"].includes(item.status),
      );
      if (!hasOtherActiveRounds) await closeTableAfterPayment([order]);
    }
    toast(t("cashier.toasts.order_cancelled"));
  } catch (error) {
    console.error(error);
    toast(t("cashier.toasts.status_update_failed"), "error");
    button.disabled = false;
  }
});

async function syncActiveTableOrderIds(orders) {
  const byToken = new Map();
  orders
    .filter(
      (order) =>
        isTableOrder(order) &&
        !["paid", "cancelled"].includes(order.status) &&
        order.tableToken,
    )
    .forEach((order) => {
      if (!byToken.has(order.tableToken)) byToken.set(order.tableToken, []);
      byToken.get(order.tableToken).push(order);
    });
  const tables = await dataService.listTables();
  await Promise.all(
    tables
      .filter((table) => table.status === "occupied" && table.orderToken)
      .map(async (table) => {
        const ids = (byToken.get(table.orderToken) || [])
          .map((order) => order.id)
          .filter(Boolean)
          .sort();
        const current = (table.orderIds || []).map(String).sort();
        if (ids.length && ids.join("|") !== current.join("|"))
          await dataService.updateTable(table.id, { orderIds: ids });
      }),
  );
}

try { availableMenus = await dataService.listMenus(); } catch (error) { console.error("Unable to load menus for cashier gift display", error); }

dataService.subscribeOrders(async (orders) => {
  orders = orders.map(order => enrichDeliveryGiftItems(order, availableMenus));
  observeDeliveryOrders(orders);
  currentOrders = orders.map((order) =>
    order.orderType === "takeaway" &&
    order.status === "served" &&
    order.pickupStatus !== "picked_up"
      ? {
          ...order,
          status: "ready",
          pickupStatus:
            order.pickupStatus === "served" ? "ready" : order.pickupStatus,
        }
      : order,
  );
  render(currentOrders);
  await resolveSlipUrls(currentOrders);
  render(currentOrders);
  syncActiveTableOrderIds(orders).catch((error) =>
    console.error("Unable to sync table order ids", error),
  );
});
