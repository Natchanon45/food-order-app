import { dataService, usingDemoMode } from "./data-service.js?v=20260718-021";
import { money, formatTime } from "./ui.js?v=20260805-081";
import { autoPrintReceipt } from "./receipt-auto-print.js?v=20260702-001";
import { qrDataUrl } from "./local-qr.js?v=20260722-037";
import { t } from "./i18n.js?v=20260812-099";
import { effectiveDeliveryAmounts, enrichDeliveryGiftItems } from "./delivery-order-display.js?v=20260903-243";

if (usingDemoMode)
  document.querySelector("#demoBanner").innerHTML =
    `<div class="demo-banner no-print">${t("cashier_documents.receipt.demo")}</div>`;

const orderId = new URLSearchParams(location.search).get("order") || "";
const receipt = document.querySelector("#receipt");
const paperSize = document.querySelector("#paperSize");

function setPaperSize(value) {
  receipt.classList.remove("size-58", "size-a4");
  if (value === "58") receipt.classList.add("size-58");
  if (value === "a4") receipt.classList.add("size-a4");
  localStorage.setItem("receipt_paper_size", value);
}

function receiptItemName(item) {
  const details = [];
  if (item.note) details.push(item.note);
  if (
    item.originalQty &&
    (Number(item.originalQty) !== Number(item.qty) ||
      item.originalName ||
      item.replacedFromName)
  ) {
    details.push(
      `${t("cashier_documents.receipt.original_order_label")} ${item.originalName || item.replacedFromName || item.name} x ${item.originalQty}`,
    );
  }
  const displayName = item.isGift === true ? `${item.name} ${t("cashier.items.gift_suffix")}` : item.name;
  return `<div class="receipt-item-line"><span class="receipt-item-text" title="${displayName}">${displayName}</span><span class="receipt-item-qty">x ${item.qty}</span></div>${details.map((text) => `<div class="receipt-item-note">${text}</div>`).join("")}`;
}

paperSize.value = localStorage.getItem("receipt_paper_size") || "80";
setPaperSize(paperSize.value);
paperSize.addEventListener("change", () => setPaperSize(paperSize.value));
document
  .querySelector("#printButton")
  .addEventListener("click", () => window.print());

function paymentText(order) {
  if (order.paymentStatus === "paid") return t("cashier_documents.receipt.paid");
  if (order.paymentMethod === "cod") return t("cashier.payment.cod");
  return t("cashier_documents.receipt.unpaid");
}

async function render(order) {
  const settings = await dataService.getStoreSettings();
  const isDelivery = order.orderType === "delivery";
  const isTakeaway = order.orderType === "takeaway";
  const tenantSlug = dataService.getActiveShop()?.slug || "";
  const verifyParams = new URLSearchParams({ order: order.id || orderId });
  if (tenantSlug) verifyParams.set("tenant", tenantSlug);
  const verifyUrl = `${location.origin}/verify/?${verifyParams.toString()}`;

  document.querySelector("#shopName").textContent =
    settings.shopName || "Food Order QR";
  document.querySelector("#shopAddress").textContent =
    settings.shopAddress || "";
  document.querySelector("#shopPhone").textContent = settings.shopPhone
    ? t("cashier_documents.receipt.shop_phone", { phone: settings.shopPhone })
    : "";
  document.querySelector("#receiptTitle").textContent = t("cashier_documents.receipt.title");
  document.querySelector("#receiptTypeLabel").textContent =
    isDelivery || isTakeaway
      ? t("cashier_documents.receipt.type")
      : t("cashier_documents.receipt.table");
  document.querySelector("#receiptTable").textContent = isDelivery
    ? t("cashier_documents.receipt.type_delivery")
    : isTakeaway
      ? `${t("cashier_documents.receipt.type_takeaway")} ${order.queueNo || ""}`.trim()
      : order.tableCode || "-";
  document.querySelector("#receiptNumber").textContent = (order.id || orderId)
    .slice(0, 12)
    .toUpperCase();
  document.querySelector("#receiptDate").textContent = formatTime(
    order.createdAt,
  );
  document.querySelector("#receiptPayment").textContent = paymentText(order);
  document.querySelector("#receiptTotal").textContent = money(
    order.totalAmount,
  );

  if (isDelivery) {
    document.querySelector("#deliveryInfo").hidden = false;
    document.querySelector("#receiptRecipient").textContent =
      order.recipientName || "-";
    document.querySelector("#receiptPhone").textContent =
      order.recipientPhone || "-";
    document.querySelector("#receiptAddress").textContent =
      order.deliveryAddress || "-";
    document.querySelector("#receiptDeliveryZone").textContent =
      order.deliveryZoneLabel || "-";
    document.querySelector("#receiptDeliverySummary").hidden = false;
    const amounts = effectiveDeliveryAmounts(order);
    document.querySelector("#receiptSubtotal").textContent = money(amounts.subtotal);
    document.querySelector("#receiptDeliveryFee").textContent = money(amounts.deliveryFee);
  }

  document.querySelector("#receiptItems").innerHTML = (order.items || [])
    .map(
      (item) => `
    <tr>
      <td class="receipt-item-name">${receiptItemName(item)}</td>
      <td class="num receipt-unit">${money(Number(item.price))}</td>
      <td class="num receipt-line-total">${money(Number(item.qty) * Number(item.price))}</td>
    </tr>
  `,
    )
    .join("");

  if (order.note) {
    document.querySelector("#receiptNoteWrap").hidden = false;
    document.querySelector("#receiptNote").textContent = order.note;
  }

  document.querySelector("#verifyQr").src = qrDataUrl(verifyUrl, {
    size: 180,
    margin: 4,
  });
  document.querySelector("#verifyCode").textContent = t("cashier_documents.receipt.verify_single", {
    code: (order.id || orderId).slice(0, 12).toUpperCase(),
  });
}

async function loadReceipt() {
  if (!orderId)
    return void (receipt.innerHTML =
      `<div class="empty">${t("cashier_documents.receipt.missing_order")}</div>`);
  try {
    let order = await dataService.getOrder(orderId);
    if (!order)
      return void (receipt.innerHTML =
        `<div class="empty">${t("cashier_documents.receipt.order_not_found")}</div>`);
    const menus = await dataService.listMenus().catch(() => []);
    order = enrichDeliveryGiftItems(order, menus);
    await render(order);
  } catch (error) {
    console.error(error);
    receipt.innerHTML = `<div class="empty">${t("cashier_documents.receipt.load_failed")}</div>`;
  }
}

await loadReceipt();
await autoPrintReceipt();
