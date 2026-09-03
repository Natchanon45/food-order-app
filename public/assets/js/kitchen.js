import "./sweet-dialog.js?v=20260726-034";
import "./kitchen-item-serve.js?v=20260720-015";
import { dataService, usingDemoMode } from "./data-service.js?v=20260720-022";
import { money, statusLabel, formatTime, toast } from "./ui.js?v=20260805-081";
import translations from "./kitchen-translations.js?v=20260903-220";
import { configureI18n, applyTranslations, t } from "./i18n.js?v=20260903-202";

configureI18n(translations);
applyTranslations();
document.title = t("kitchen.meta_title");
import { observeDeliveryOrders } from "./delivery-notifier.js?v=20260903-242";
import { iconMarkup } from "./bootstrap-icons.js?v=20260701-001";
import { effectiveDeliveryAmounts, enrichDeliveryGiftItems } from "./delivery-order-display.js?v=20260903-242";

if (!document.querySelector('link[href*="sweet-dialog.css"]')) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/assets/css/sweet-dialog.css?v=20260726-034";
  document.head.appendChild(link);
}
if (usingDemoMode) document.querySelector("#demoBanner").innerHTML = `<div class="demo-banner">${t("kitchen.demo_mode")}</div>`;

const grid = document.querySelector("#orderGrid");
const activeStatuses = ["pending", "accepted", "cooking", "ready", "served"];
let currentOrders = [];
let availableMenus = [];

async function askConfirm(message, options = {}) { if (typeof window.sweetConfirm === "function") return await window.sweetConfirm(message, options); return confirm(message); }
function icon(name) { return iconMarkup(name); }
function currency(value) { return `${money(value)} ${t("kitchen.units.currency")}`; }
function kitchenItemDisplayName(item = {}) {
  const name = String(item?.name || "");

  return item?.isGift === true
    ? `${name} ${t("kitchen.order.gift_suffix")}`
    : name;
}
function decorateConfirmAction() {
  queueMicrotask(() => {
    const confirmButton = document.querySelector("#sweetDialogConfirm");
    if (!confirmButton) return;
    confirmButton.innerHTML = `${icon("check-circle")}<span>${t("kitchen.confirm.ok")}</span>`;
    confirmButton.style.display = "inline-flex";
    confirmButton.style.alignItems = "center";
    confirmButton.style.justifyContent = "center";
    confirmButton.style.gap = "8px";
  });
}
function isDelivery(order) { return order?.orderType === "delivery"; }
function isTakeaway(order) { return order?.orderType === "takeaway"; }
function displayTime(order) { return order.createdAt || order.createdAtText || order.updatedAt; }
function valueToDate(value) { if (!value) return null; if (typeof value.toDate === "function") return value.toDate(); if (value.seconds) return new Date(value.seconds * 1000); const date = value instanceof Date ? value : new Date(value); return Number.isNaN(date.getTime()) ? null : date; }
function orderAgeMinutes(order) { const date = valueToDate(displayTime(order)); return date ? Math.floor((Date.now() - date.getTime()) / 60000) : 0; }
function isOverdue(order) { return ["pending", "accepted", "cooking"].includes(order?.status) && orderAgeMinutes(order) >= 15; }
function orderTitle(order) { if (isDelivery(order)) return t("kitchen.order.delivery_title", { name: order.recipientName || t("kitchen.order.unnamed") }); if (isTakeaway(order)) return t("kitchen.order.takeaway_title"); return t("kitchen.order.table_round_title", { table: order.tableCode, round: order.roundNumber || 1 }); }
function isTableOrder(order) { return !isDelivery(order) && !isTakeaway(order); }
function tableGroupKey(order) { return order.tableToken || `table:${order.tableCode}`; }
function queueSequence(order) { const explicit = Number(order?.queueSequence); if (Number.isFinite(explicit) && explicit > 0) return explicit; const parsed = Number(String(order?.queueNo || "").replace(/\D/g, "")); return Number.isFinite(parsed) ? parsed : 0; }
function queueBadge(order) { return `<span class="order-queue-badge"><small>${t("kitchen.order.queue")}</small><strong>${order?.queueNo || "-"}</strong></span>`; }
function nextActions(status, orderType) {
  if (status === "pending") return [["accepted", t("kitchen.actions.accept"), "btn-primary", "check", "kitchen-accept-action"]];
  if (status === "accepted") return [["cooking", t("kitchen.actions.start"), "btn-warning", "hourglass-split", "kitchen-start-action"]];
  if (status === "cooking") return [["ready", orderType === "delivery" ? t("kitchen.actions.ready_delivery") : t("kitchen.actions.ready_serve"), "btn-primary", "check-circle", "kitchen-ready-action"]];
  if (status === "ready") return [["served", orderType === "delivery" ? t("kitchen.actions.rider_handoff") : t("kitchen.actions.served"), "btn-dark", "check-circle", "kitchen-served-action"]];
  return [];
}
function isKitchenLocked(order) { return ["served", "paid", "cancelled"].includes(order?.status); }
function lockedItemLabel(order) { if (isDelivery(order) && order?.status === "served") return t("kitchen.actions.rider_handoff"); if (order?.status === "served") return t("kitchen.actions.served"); if (order?.status === "paid") return t("kitchen.states.paid"); return t("kitchen.states.locked"); }
function recalculateOrder(order, items) { const subtotalAmount = items.filter(item => !item.cancelled && item.isGift !== true).reduce((sum, item) => sum + Number(item.qty) * Number(item.price), 0); const deliveryFee = isDelivery(order) && subtotalAmount > 0 ? effectiveDeliveryAmounts(order).deliveryFee : 0; return { subtotalAmount, deliveryFee, totalAmount: subtotalAmount + deliveryFee }; }
function orderInfo(order) { if (isDelivery(order)) return `<p><span class="badge ${order.paymentStatus === "paid" ? "" : "warning"}">${order.paymentStatus === "paid" ? t("kitchen.order.payment_paid") : t("kitchen.order.payment_unpaid")}</span><br><strong>${t("kitchen.order.phone")}</strong> ${order.recipientPhone || "-"}<br><strong>${t("kitchen.order.address")}</strong> ${order.deliveryAddress || "-"}</p>`; if (isTakeaway(order)) return `<p><span class="badge warning">${t("kitchen.order.takeaway_badge")}</span><br><strong>${t("kitchen.order.customer")}</strong> ${order.customerName || "-"}<br><strong>${t("kitchen.order.phone")}</strong> ${order.customerPhone || "-"}<br><strong>${t("kitchen.order.queue")}</strong> ${order.queueNo || "-"}</p>`; return ""; }
function orderSummary(order) { if (!isDelivery(order)) return ""; const amounts = effectiveDeliveryAmounts(order); return `<div class="card" style="margin-top:10px;padding:10px 12px;box-shadow:none;background:#f8fbf9"><div class="receipt-row"><span>${t("kitchen.order.delivery_zone")}</span><strong>${order.deliveryZoneLabel || "-"}</strong></div><div class="receipt-row"><span>${t("kitchen.order.food_subtotal")}</span><strong>${currency(amounts.subtotal)}</strong></div><div class="receipt-row"><span>${t("kitchen.order.delivery_fee")}</span><strong>${currency(amounts.deliveryFee)}</strong></div></div>`; }
function renderKitchenOrder(order, { nested = false } = {}) {
  const locked = isKitchenLocked(order);
  const overdue = isOverdue(order);
  const itemRows = (order.items || []).map((item, index) => `<li style="${item.cancelled ? "opacity:.48;text-decoration:line-through" : ""}"><strong>${item.qty} × ${kitchenItemDisplayName(item)}</strong>${item.note ? `<br><small>${t("kitchen.order.item_note")} ${item.note}</small>` : ""}${item.isGift === true ? "" : item.cancelled ? `<br><small>${t("kitchen.states.cancelled")}</small>` : locked ? `<div class="kitchen-item-actions"><span class="badge">${lockedItemLabel(order)}</span></div>` : `<div class="kitchen-item-actions"><button class="btn btn-sm" data-edit-item="${order.id}" data-item-index="${index}">${icon("pencil")}<span>${t("kitchen.actions.edit")}</span></button><button class="btn btn-danger btn-sm" data-cancel-item="${order.id}" data-item-index="${index}">${icon("x-circle")}<span>${t("kitchen.actions.cancel")}</span></button></div>`}</li>`).join("");
  const statusText = isTakeaway(order) && order.status === "ready" ? t("kitchen.states.ready_to_serve") : statusLabel(order.status);
  const overdueBadge = overdue ? `<span class="badge warning kitchen-overdue-badge">${t("kitchen.order.overdue", { count: orderAgeMinutes(order) })}</span>` : "";
  const actionButtons = nextActions(order.status, order.orderType).map(([status,label,cls,iconName,actionClass]) => `<button class="btn ${cls} kitchen-status-action ${actionClass || ""}" data-id="${order.id}" data-status="${status}" aria-label="${label}">${icon(iconName)}<span>${label}</span></button>`).join("");
  const heading = nested
    ? `<div><h3 style="margin:0">${t("kitchen.order.round_title", { round: order.roundNumber || 1 })}</h3><small>${formatTime(displayTime(order))}</small></div>`
    : `<div class="order-heading-with-queue">${queueBadge(order)}<div><h2 style="margin:0">${orderTitle(order)}</h2><small>${formatTime(displayTime(order))}</small></div></div>`;
  const tag = nested ? "section" : "article";
  return `<${tag} class="card order-card${nested ? " table-round-card" : ""}${isTakeaway(order) ? " takeaway-kitchen-card" : ""}${overdue ? " kitchen-order-overdue" : ""}"><div class="order-head">${heading}<span class="badge ${isTakeaway(order) ? "warning" : ""}">${statusText}</span></div>${overdueBadge}${orderInfo(order)}<ul class="order-items">${itemRows}</ul>${orderSummary(order)}${order.note ? `<p><strong>${t("kitchen.order.order_note")}</strong> ${order.note}</p>` : ""}<div class="order-head" style="margin-top:10px"><strong>${t("kitchen.order.net_total")}</strong><strong class="price">${currency(order.totalAmount)}</strong></div><div class="order-actions kitchen-order-actions" style="margin-top:12px">${actionButtons}${locked ? "" : `<button class="btn btn-danger" data-cancel-order="${order.id}">${t("kitchen.actions.cancel_order")}</button>`}</div></${tag}>`;
}
function renderTableKitchenGroup(group) {
  const sorted = [...group].sort((a, b) => Number(a.roundNumber || 0) - Number(b.roundNumber || 0));
  const first = sorted[0];
  return `<article class="card order-card table-kitchen-group"><div class="order-head"><div class="order-heading-with-queue">${queueBadge(first)}<div><h2 style="margin:0">${t("kitchen.order.table_title", { table: first.tableCode })}</h2><small>${t("kitchen.order.rounds_in_queue", { count: sorted.length })}</small></div></div><span class="badge">${t("kitchen.order.rounds_served", { served: sorted.filter(order => order.status === "served").length, total: sorted.length })}</span></div><div class="table-round-list">${sorted.map(order => renderKitchenOrder(order, { nested: true })).join("")}</div></article>`;
}
function render(orders) {
  currentOrders = orders;
  const active = orders.filter(order => activeStatuses.includes(order.status));
  const tableGroups = new Map();
  active.filter(isTableOrder).forEach(order => { const key = tableGroupKey(order); if (!tableGroups.has(key)) tableGroups.set(key, []); tableGroups.get(key).push(order); });
  const cards = [
    ...[...tableGroups.values()].map(group => ({ queueDate: group[0].queueDate || "", sequence: queueSequence(group[0]), createdAt: displayTime(group[0]), html: renderTableKitchenGroup(group) })),
    ...active.filter(order => !isTableOrder(order)).map(order => ({ queueDate: order.queueDate || "", sequence: queueSequence(order), createdAt: displayTime(order), html: renderKitchenOrder(order) }))
  ].sort((a, b) => String(b.queueDate).localeCompare(String(a.queueDate)) || b.sequence - a.sequence || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  grid.innerHTML = cards.length ? cards.map(card => card.html).join("") : `<div class="card empty">${t("kitchen.order.empty")}</div>`;
}
function closeEditor() { document.querySelector(".kitchen-item-editor-backdrop")?.remove(); }
function openEditor(order, itemIndex) {
  const item = order.items?.[itemIndex]; if (!item || item.cancelled || item.isGift === true || isKitchenLocked(order)) return;
  const maxQty = Math.max(1, Number(item.originalQty || item.qty || 1)); const activeMenus = availableMenus.filter(menu => menu.active !== false); const options = activeMenus.map(menu => `<option value="${menu.id}" ${menu.id === item.menuId ? "selected" : ""}>${menu.name} — ${currency(menu.price)}</option>`).join("");
  const backdrop = document.createElement("div"); backdrop.className = "kitchen-item-editor-backdrop"; backdrop.innerHTML = `<section class="kitchen-item-editor"><h2>${t("kitchen.editor.title")}</h2><div class="editor-grid"><div class="field"><label>${t("kitchen.editor.menu")}</label><select class="input" id="kitchenReplacementMenu">${options}</select></div><div class="field"><label>${t("kitchen.editor.quantity_available")}</label><input class="input" id="kitchenReplacementQty" type="number" min="1" max="${maxQty}" step="1" value="${Math.min(Number(item.qty || 1), maxQty)}"></div><div class="field"><label>${t("kitchen.editor.edit_note")}</label><input class="input" id="kitchenReplacementNote" value="${item.note || ""}" maxlength="200"></div></div><div class="editor-actions"><button type="button" class="btn" data-close-editor>${t("kitchen.actions.cancel")}</button><button type="button" class="btn btn-primary" data-save-editor>${t("kitchen.actions.save_edit")}</button></div></section>`;
  backdrop.addEventListener("click", async event => { if (event.target === backdrop || event.target.closest("[data-close-editor]")) { closeEditor(); return; } const saveButton = event.target.closest("[data-save-editor]"); if (!saveButton || isKitchenLocked(order)) return; const selectedMenu = activeMenus.find(menu => menu.id === backdrop.querySelector("#kitchenReplacementMenu").value); const nextQty = Number(backdrop.querySelector("#kitchenReplacementQty").value); const nextNote = backdrop.querySelector("#kitchenReplacementNote").value.trim(); if (!selectedMenu || !Number.isInteger(nextQty) || nextQty < 1 || nextQty > maxQty) { toast(t("kitchen.editor.invalid_menu_quantity"), "error"); return; } if ((nextQty !== Number(item.qty) || selectedMenu.id !== item.menuId) && !nextNote) { toast(t("kitchen.editor.note_required"), "error"); return; } const items = order.items.map((row, index) => index !== itemIndex ? row : { ...row, originalQty: row.originalQty || row.qty, originalName: row.originalName || row.name, menuId: selectedMenu.id, name: selectedMenu.name, price: Number(selectedMenu.price), qty: nextQty, note: nextNote, replacedFromName: selectedMenu.id !== row.menuId ? (row.replacedFromName || row.name) : row.replacedFromName || "", updatedByKitchenAt: new Date().toISOString() }); const totals = recalculateOrder(order, items); saveButton.disabled = true; try { await dataService.updateOrder(order.id, { items, ...totals, kitchenAdjustedAt: new Date().toISOString() }); closeEditor(); toast(t("kitchen.toast.item_updated")); } catch (error) { console.error(error); toast(t("kitchen.toast.item_update_failed"), "error"); saveButton.disabled = false; } });
  document.body.appendChild(backdrop);
}

grid.addEventListener("click", async event => {
  const editItemButton = event.target.closest("[data-edit-item]"); if (editItemButton) { const order = currentOrders.find(item => item.id === editItemButton.dataset.editItem); const itemIndex = Number(editItemButton.dataset.itemIndex); if (order && Number.isInteger(itemIndex) && !isKitchenLocked(order)) openEditor(order, itemIndex); return; }
  const cancelItemButton = event.target.closest("[data-cancel-item]"); if (cancelItemButton) { const order = currentOrders.find(item => item.id === cancelItemButton.dataset.cancelItem); const itemIndex = Number(cancelItemButton.dataset.itemIndex); if (!order || !Number.isInteger(itemIndex) || isKitchenLocked(order)) return; const selectedItem = order.items?.[itemIndex]; if (!selectedItem || selectedItem.cancelled) return; const ok = await askConfirm(t("kitchen.confirm.cancel_item_message", { item: selectedItem.name }), { title: t("kitchen.confirm.cancel_item_title"), confirmText: t("kitchen.confirm.ok"), cancelText: t("kitchen.confirm.cancel"), type: "warning" }); if (!ok) return; const items = order.items.map((item, index) => index === itemIndex ? { ...item, cancelled: true, cancelledAt: new Date().toISOString() } : item); const totals = recalculateOrder(order, items); const patch = { items, ...totals }; if (totals.subtotalAmount <= 0) patch.status = "cancelled"; await dataService.updateOrder(order.id, patch); toast(t(totals.subtotalAmount <= 0 ? "kitchen.toast.order_cancelled_no_items" : "kitchen.toast.item_cancelled")); return; }
  const cancelOrderButton = event.target.closest("[data-cancel-order]"); if (cancelOrderButton) { const order = currentOrders.find(item => item.id === cancelOrderButton.dataset.cancelOrder); if (isKitchenLocked(order)) return; const confirmation = askConfirm(t("kitchen.confirm.cancel_order_message"), { title: t("kitchen.confirm.cancel_order_title"), confirmText: t("kitchen.confirm.ok"), cancelText: t("kitchen.confirm.cancel"), type: "warning" }); decorateConfirmAction(); const ok = await confirmation; if (!ok) return; await dataService.updateOrder(cancelOrderButton.dataset.cancelOrder, { status: "cancelled", subtotalAmount: 0, deliveryFee: 0, totalAmount: 0, cancelledAt: new Date().toISOString() }); toast(t("kitchen.toast.order_cancelled")); return; }
  const button = event.target.closest("[data-id][data-status]"); if (!button) return; const { id, status } = button.dataset; const order = currentOrders.find(item => item.id === id); button.disabled = true;
  try { const patch = { status }; if (status === "served") patch.servedAt = new Date().toISOString(); if (isTakeaway(order) && status === "ready") patch.pickupStatus = "ready"; if (isTakeaway(order) && status === "served") patch.pickupStatus = "served"; if (isDelivery(order) && status === "served" && order.paymentStatus === "paid") { patch.status = "paid"; patch.completedAt = new Date().toISOString(); } const updated = await dataService.updateOrder(id, patch); currentOrders = currentOrders.map(row => row.id === id ? updated : row); render(currentOrders); toast(isTakeaway(order) && patch.status === "served" ? t("kitchen.toast.takeaway_served") : isTakeaway(order) && patch.status === "ready" ? t("kitchen.toast.takeaway_ready") : patch.status === "paid" ? t("kitchen.toast.delivery_completed") : t("kitchen.toast.status_changed", { status: statusLabel(patch.status) })); }
  catch (error) { console.error(error); toast(t("kitchen.toast.status_update_failed"), "error"); button.disabled = false; }
});

try { availableMenus = await dataService.listMenus(); } catch (error) { console.error("Unable to load menus for kitchen editor", error); }
dataService.subscribeOrders(orders => { const enriched = orders.map(order => enrichDeliveryGiftItems(order, availableMenus)); observeDeliveryOrders(enriched); render(enriched); });
