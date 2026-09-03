import "./public-page-static-i18n.js?v=20260903-243";

import { publicStorefrontService as dataService } from './public-storefront-service.js?v=20260903-231';
import { money, formatTime, toast } from "./ui.js?v=20260805-081";
import { t } from "./i18n.js?v=20260903-202";
import { effectiveDeliveryAmounts, enrichDeliveryGiftItems } from "./delivery-order-display.js?v=20260903-243";

const orderId = new URLSearchParams(location.search).get("order") || "";
const receipt = document.querySelector("#customerReceipt");
const saveButton = document.querySelector("#saveImageButton");
const orderAgainLink = document.querySelector("#orderAgainLink");

function paymentText(order) {
  if (order.paymentStatus === "paid") return t("delivery.success.payment.paid");
  if (order.paymentMethod === "cod") return t("delivery.success.payment.cod");
  if (order.paymentStatus === "pending_verification") return t("delivery.success.payment.pending_verification");
  return t("delivery.success.payment.unpaid");
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

  document.querySelector("#shopName").textContent = settings.shopName || t("delivery.success.receipt.shop_fallback");
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
  saveButton.textContent = t("delivery.success.actions.creating_image");
  try {
    await downloadReceipt();
    toast(t("delivery.success.actions.downloaded"));
  } catch (error) {
    console.error(error);
    toast(t("delivery.success.actions.download_failed"), "error");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = t("delivery.success.actions.download");
  }
});

try {
  await load();
} catch (error) {
  console.error(error);
  receipt.innerHTML = `<div class="empty">${error.message}</div>`;
  saveButton.disabled = true;
}
