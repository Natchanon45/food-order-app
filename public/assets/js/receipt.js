import { dataService, usingDemoMode } from "./data-service.js";
import { money, formatTime } from "./ui.js";

if (usingDemoMode) document.querySelector("#demoBanner").innerHTML = '<div class="demo-banner no-print">โหมดตัวอย่าง</div>';

const orderId = new URLSearchParams(location.search).get("order") || "";
const receipt = document.querySelector("#receipt");
const paperSize = document.querySelector("#paperSize");

function setPaperSize(value) {
  receipt.classList.remove("size-58", "size-a4");
  if (value === "58") receipt.classList.add("size-58");
  if (value === "a4") receipt.classList.add("size-a4");
  localStorage.setItem("receipt_paper_size", value);
}

paperSize.value = localStorage.getItem("receipt_paper_size") || "80";
setPaperSize(paperSize.value);
paperSize.addEventListener("change", () => setPaperSize(paperSize.value));
document.querySelector("#printButton").addEventListener("click", () => window.print());

function paymentText(order) {
  if (order.paymentStatus === "paid") return "ชำระเงินแล้ว";
  if (order.paymentMethod === "cod") return "เก็บเงินปลายทาง";
  return "ยังไม่ชำระเงิน";
}

async function render(order) {
  const settings = await dataService.getStoreSettings();
  const isDelivery = order.orderType === "delivery";
  const verifyUrl = `${location.origin}/verify/?order=${encodeURIComponent(order.id || orderId)}`;

  document.querySelector("#shopName").textContent = settings.shopName || "Food Order QR";
  document.querySelector("#shopAddress").textContent = settings.shopAddress || "";
  document.querySelector("#shopPhone").textContent = settings.shopPhone ? `โทร ${settings.shopPhone}` : "";
  document.querySelector("#receiptTitle").textContent = isDelivery ? "ใบสั่งซื้อ Delivery" : "ใบเสร็จรับเงิน";
  document.querySelector("#receiptTypeLabel").textContent = isDelivery ? "ประเภท" : "โต๊ะ";
  document.querySelector("#receiptTable").textContent = isDelivery ? "Delivery" : (order.tableCode || "-");
  document.querySelector("#receiptNumber").textContent = (order.id || orderId).slice(0, 12).toUpperCase();
  document.querySelector("#receiptDate").textContent = formatTime(order.createdAt);
  document.querySelector("#receiptPayment").textContent = paymentText(order);
  document.querySelector("#receiptTotal").textContent = money(order.totalAmount);

  if (isDelivery) {
    document.querySelector("#deliveryInfo").hidden = false;
    document.querySelector("#receiptRecipient").textContent = order.recipientName || "-";
    document.querySelector("#receiptPhone").textContent = order.recipientPhone || "-";
    document.querySelector("#receiptAddress").textContent = order.deliveryAddress || "-";
    document.querySelector("#receiptDeliveryZone").textContent = order.deliveryZoneLabel || "-";
    document.querySelector("#receiptDeliverySummary").hidden = false;
    document.querySelector("#receiptSubtotal").textContent = money(order.subtotalAmount ?? (Number(order.totalAmount || 0) - Number(order.deliveryFee || 0)));
    document.querySelector("#receiptDeliveryFee").textContent = money(order.deliveryFee || 0);
  }

  document.querySelector("#receiptItems").innerHTML = (order.items || []).map(item => `
    <tr>
      <td class="receipt-item-name">${item.name} x ${item.qty}${item.note ? `<div class="receipt-item-note">${item.note}</div>` : ""}</td>
      <td class="num receipt-unit">${money(Number(item.price))}</td>
      <td class="num receipt-line-total">${money(Number(item.qty) * Number(item.price))}</td>
    </tr>
  `).join("");

  if (order.note) {
    document.querySelector("#receiptNoteWrap").hidden = false;
    document.querySelector("#receiptNote").textContent = order.note;
  }

  document.querySelector("#verifyQr").src = `https://quickchart.io/qr?text=${encodeURIComponent(verifyUrl)}&size=180&margin=1`;
  document.querySelector("#verifyCode").textContent = `ตรวจสอบ: ${(order.id || orderId).slice(0, 12).toUpperCase()}`;
}

async function loadReceipt() {
  if (!orderId) return void (receipt.innerHTML = '<div class="empty">ไม่พบเลขที่ออเดอร์</div>');
  try {
    const order = await dataService.getOrder(orderId);
    if (!order) return void (receipt.innerHTML = '<div class="empty">ไม่พบข้อมูลใบเสร็จนี้</div>');
    await render(order);
  } catch (error) {
    console.error(error);
    receipt.innerHTML = '<div class="empty">โหลดใบเสร็จไม่สำเร็จ</div>';
  }
}

await loadReceipt();
