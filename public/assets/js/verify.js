import { dataService } from "./data-service.js";
import { money, formatTime, statusLabel } from "./ui.js";

const orderId = new URLSearchParams(location.search).get("order") || "";
const root = document.querySelector("#verifyResult");

function paymentText(order) {
  if (order.paymentStatus === "paid") return "ชำระเงินแล้ว";
  if (order.paymentMethod === "cod") return "เก็บเงินปลายทาง";
  return "ยังไม่ชำระเงิน";
}

try {
  if (!orderId) throw new Error("ไม่พบเลขที่รายการ");
  const [order, settings] = await Promise.all([
    dataService.getOrder(orderId),
    dataService.getStoreSettings()
  ]);
  if (!order) throw new Error("ไม่พบรายการนี้ในระบบ");

  const isDelivery = order.orderType === "delivery";
  root.innerHTML = `
    <div class="section-title"><h2>${settings.shopName || "Food Order QR"}</h2><span class="badge">พบข้อมูลในระบบ</span></div>
    <p>${settings.shopAddress || ""}${settings.shopPhone ? `<br>โทร ${settings.shopPhone}` : ""}</p>
    <div class="grid grid-2">
      <div><strong>เลขที่รายการ</strong><br>${orderId.slice(0, 12).toUpperCase()}</div>
      <div><strong>วันที่</strong><br>${formatTime(order.createdAt)}</div>
      <div><strong>ประเภท</strong><br>${isDelivery ? "Delivery" : `โต๊ะ ${order.tableCode || "-"}`}</div>
      <div><strong>สถานะ</strong><br>${statusLabel(order.status)}</div>
      <div><strong>การชำระเงิน</strong><br>${paymentText(order)}</div>
      <div><strong>ยอดสุทธิ</strong><br>${money(order.totalAmount)} บาท</div>
    </div>
    ${isDelivery ? `<hr class="receipt-rule"><p><strong>ผู้รับ:</strong> ${order.recipientName || "-"}<br><strong>โทร:</strong> ${order.recipientPhone || "-"}<br><strong>ที่อยู่:</strong> ${order.deliveryAddress || "-"}</p>` : ""}
    <hr class="receipt-rule">
    <ul class="order-items">${(order.items || []).map(item => `<li>${item.qty} × ${item.name}<strong style="float:right">${money(Number(item.qty) * Number(item.price))}</strong></li>`).join("")}</ul>
  `;
} catch (error) {
  console.error(error);
  root.innerHTML = `<div class="empty">${error.message}</div>`;
}
