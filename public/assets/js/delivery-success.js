import "./public-page-static-i18n.js?v=20260930-001";

import { publicStorefrontService as dataService } from './public-storefront-service.js?v=20261005-131';
import { money, formatTime, toast } from "./ui.js?v=20260930-001";
import { t } from "./i18n.js?v=20260930-001";
import { effectiveDeliveryAmounts, enrichDeliveryGiftItems } from "./delivery-order-display.js?v=20260903-243";

const orderId = new URLSearchParams(location.search).get("order") || "";
const receipt = document.querySelector("#customerReceipt");
const saveButton = document.querySelector("#saveImageButton");
const orderAgainLink = document.querySelector("#orderAgainLink");
const trackingMessage = document.querySelector("#deliveryTrackingMessage");
const trackingBadge = document.querySelector("#deliveryTrackingBadge");
const trackingUpdated = document.querySelector("#deliveryTrackingUpdated");
const trackingSteps = [...document.querySelectorAll("[data-tracking-step]")];
const customerTrackLink = document.querySelector("#customerLalamoveTrackLink");
const saveButtonLabel = saveButton?.querySelector("[data-action-label]");
let trackingTimer = null;

document.title = t("delivery.success.meta_title");

function setSaveButtonLabel(key) {
  if (saveButtonLabel) saveButtonLabel.textContent = t(key);
  else saveButton.textContent = t(key);
}

function paymentText(order) {
  if (order.paymentStatus === "paid") return t("delivery.success.payment.paid");
  if (order.paymentMethod === "cod") return t("delivery.success.payment.cod");
  if (order.paymentStatus === "pending_verification") return t("delivery.success.payment.pending_verification");
  return t("delivery.success.payment.unpaid");
}

function trackingState(order = {}) {
  const local = String(order.status || "pending").toLowerCase();
  const lala = String(order.lalamoveOrderStatus || "").toUpperCase();
  if (local === "cancelled") {
    return { key: "canceled", progress: Math.max(0, ["pending", "accepted", "cooking", "ready", "served"].indexOf(local)), terminal: true };
  }
  if (["CANCELED", "CANCELLED", "REJECTED", "EXPIRED"].includes(lala)) {
    return { key: "dispatch_retry", progress: 3, terminal: false };
  }
  if (lala === "COMPLETED") return { key: "completed", progress: 5, terminal: true };
  if (lala === "PICKED_UP") return { key: "picked_up", progress: 4, terminal: false };
  if (lala === "ON_GOING") return { key: "on_going", progress: 3, terminal: false };
  if (lala === "ASSIGNING_DRIVER") return { key: "assigning_driver", progress: 3, terminal: false };
  const map = {
    pending: ["pending", 0], accepted: ["accepted", 1], cooking: ["cooking", 2],
    ready: ["ready", 3], served: ["served", 4], paid: ["paid", 5],
  };
  const state = map[local] || ["unknown", 0];
  return { key: state[0], progress: state[1], terminal: local === "paid" };
}

function renderTracking(order = {}) {
  const state = trackingState(order);
  const text = t(`delivery.success.tracking.statuses.${state.key}`);
  trackingMessage.textContent = text;
  trackingBadge.textContent = text;
  trackingSteps.forEach((step, index) => {
    step.classList.toggle("is-done", index < state.progress || (state.terminal && state.progress === 5));
    step.classList.toggle("is-current", index === state.progress && !(state.terminal && state.progress === 5));
  });
  const shareLink = String(order.lalamoveShareLink || "").trim();
  customerTrackLink.hidden = !shareLink || ["canceled", "dispatch_retry", "completed"].includes(state.key);
  if (shareLink) customerTrackLink.href = shareLink;
  trackingUpdated.textContent = t("delivery.success.tracking.updated", {
    time: formatTime(order.updatedAt || new Date().toISOString()),
  });
  document.querySelector("#receiptPayment").textContent = paymentText(order);
  return state;
}

async function refreshTracking() {
  try {
    const order = await dataService.getOrder(orderId);
    if (!order) return;
    const state = renderTracking(order);
    if (state.terminal && trackingTimer) {
      clearInterval(trackingTimer);
      trackingTimer = null;
    }
  } catch (error) {
    console.warn("[delivery-tracking] refresh failed", error);
  }
}

function startTrackingPolling(initialOrder) {
  const state = renderTracking(initialOrder);
  if (state.terminal || trackingTimer) return;
  trackingTimer = setInterval(refreshTracking, 15000);
}

function receiptItemName(item) {
  const displayName = item.isGift === true ? `${item.name} ${t("delivery.success.receipt.gift_suffix")}` : item.name;
  return `<div class="receipt-item-line"><span class="receipt-item-text" title="${displayName}">${displayName}</span><span class="receipt-item-qty">x ${item.qty}</span></div>${item.note ? `<div class="receipt-item-note">${item.note}</div>` : ""}`;
}

function clearDeliveryDraft(tenantSlug = "") {
  if (!tenantSlug) return;
  sessionStorage.removeItem(`delivery_checkout_draft:${tenantSlug}`);
}

function renderVerificationQr(order) {
  const tenant = dataService.getActiveShop();
  const tenantSlug = tenant.slug || "";
  const verifyUrl = `${location.origin}/verify/?tenant=${encodeURIComponent(tenantSlug)}&order=${encodeURIComponent(order.id || orderId)}`;
  const target = document.querySelector("#verifyQr");
  target.innerHTML = "";
  new QRCode(target, {
    text: verifyUrl,
    width: 120,
    height: 120,
    correctLevel: QRCode.CorrectLevel.H
  });
  document.querySelector("#verifyLatestLink").href = verifyUrl;
  orderAgainLink.href = `/s/${encodeURIComponent(tenantSlug)}/delivery`;
  clearDeliveryDraft(tenantSlug);
}

async function load() {
  if (!orderId) throw new Error(t("delivery.success.errors.missing_order_number"));
  const [rawOrder, settings, menus] = await Promise.all([dataService.getOrder(orderId), dataService.getStoreSettings(), dataService.listMenus()]);
  if (!rawOrder) throw new Error(t("delivery.success.errors.order_not_found"));
  const order = enrichDeliveryGiftItems(rawOrder, menus);

  document.querySelector("#shopName").textContent = dataService.getOrderDeliveryShopName(settings) || t("delivery.success.receipt.shop_fallback");
  document.querySelector("#shopAddress").textContent = settings.shopAddress || "";
  document.querySelector("#shopPhone").textContent = settings.shopPhone ? t("delivery.success.shop_phone", { phone: settings.shopPhone }) : "";
  document.querySelector("#receiptNumber").textContent = orderId.slice(0, 12).toUpperCase();
  document.querySelector("#receiptDate").textContent = formatTime(order.createdAt);
  document.querySelector("#receiptPayment").textContent = paymentText(order);
  document.querySelector("#receiptRecipient").textContent = order.recipientName || "-";
  document.querySelector("#receiptPhone").textContent = order.recipientPhone || "-";
  document.querySelector("#receiptAddress").textContent = order.deliveryAddress || "-";
  document.querySelector("#receiptDeliveryZone").textContent = order.deliveryZoneLabel || "-";
  const amounts = effectiveDeliveryAmounts(order);
  document.querySelector("#receiptSubtotal").textContent = money(amounts.subtotal);
  document.querySelector("#receiptDeliveryFee").textContent = money(amounts.deliveryFee);
  document.querySelector("#receiptTotal").textContent = money(amounts.total);
  document.querySelector("#receiptItems").innerHTML = (order.items || []).filter(item => !item.cancelled).map(item => `
    <tr>
      <td class="receipt-item-name">${receiptItemName(item)}</td>
      <td class="num receipt-unit">${money(Number(item.price))}</td>
      <td class="num receipt-line-total">${money(Number(item.qty) * Number(item.price))}</td>
    </tr>
  `).join("");

  if (order.note) {
    document.querySelector("#receiptNoteWrap").hidden = false;
    document.querySelector("#receiptNote").textContent = order.note;
  }

  renderVerificationQr(order);
  return order;
}

async function waitForReceiptReady() {
  if (document.fonts?.ready) await document.fonts.ready;
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

async function createReceiptBlob() {
  await waitForReceiptReady();
  const canvas = await html2canvas(receipt, {
    scale: Math.min(3, Math.max(2, window.devicePixelRatio || 1)),
    backgroundColor: "#ffffff",
    useCORS: true,
    allowTaint: false,
    logging: false
  });
  return await new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("RECEIPT_IMAGE_FAILED")), "image/png", 1);
  });
}

async function downloadReceipt() {
  const blob = await createReceiptBlob();
  const fileName = `delivery-order-${orderId.slice(0, 12).toUpperCase()}.png`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

saveButton.addEventListener("click", async () => {
  saveButton.disabled = true;
  setSaveButtonLabel("delivery.success.actions.creating_image");
  try {
    await downloadReceipt();
    toast(t("delivery.success.actions.downloaded"));
  } catch (error) {
    console.error(error);
    toast(t("delivery.success.actions.download_failed"), "error");
  } finally {
    saveButton.disabled = false;
    setSaveButtonLabel("delivery.success.actions.download");
  }
});

try {
  const initialOrder = await load();
  startTrackingPolling(initialOrder);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshTracking();
  });
} catch (error) {
  console.error(error);
  receipt.innerHTML = `<div class="empty">${error.message}</div>`;
  saveButton.disabled = true;
}
