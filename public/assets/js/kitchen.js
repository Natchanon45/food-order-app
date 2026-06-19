import { dataService, usingDemoMode } from "./data-service.js";
import { money, statusLabel, formatTime, toast } from "./ui.js";

if (usingDemoMode) document.querySelector("#demoBanner").innerHTML = '<div class="demo-banner">โหมดตัวอย่าง</div>';

const grid = document.querySelector("#orderGrid");
const activeStatuses = ["pending", "accepted", "cooking", "ready", "served"];
let currentOrders = [];

function nextActions(status, orderType) {
  if (status === "pending") return [["accepted", "รับออเดอร์", "btn-primary"]];
  if (status === "accepted") return [["cooking", "เริ่มทำ", "btn-warning"]];
  if (status === "cooking") return [["ready", orderType === "delivery" ? "พร้อมจัดส่ง" : "พร้อมเสิร์ฟ", "btn-primary"]];
  if (status === "ready") return [["served", orderType === "delivery" ? "ส่งให้ไรเดอร์แล้ว" : "เสิร์ฟแล้ว", "btn-dark"]];
  return [];
}

function render(orders) {
  currentOrders = orders;
  const active = orders.filter(x => activeStatuses.includes(x.status));
  grid.innerHTML = active.length ? active.map(order => {
    const roundText = order.orderType === "delivery" ? "" : ` • รอบที่ ${order.roundNumber || 1}`;
    const title = order.orderType === "delivery" ? `Delivery: ${order.recipientName || "ไม่ระบุชื่อ"}` : `โต๊ะ ${order.tableCode}${roundText}`;
    const itemRows = (order.items || []).map((item, index) => `
      <li style="${item.cancelled ? "opacity:.48;text-decoration:line-through" : ""}">
        <strong>${item.qty} × ${item.name}</strong>${item.note ? `<br><small>หมายเหตุ: ${item.note}</small>` : ""}
        ${item.cancelled ? '<br><small>ยกเลิกแล้ว</small>' : `<button class="btn btn-danger btn-sm" style="float:right" data-cancel-item="${order.id}" data-item-index="${index}">ของหมด/ยกเลิกรายการ</button>`}
      </li>
    `).join("");

    return `<article class="card order-card">
      <div class="order-head"><div><h2 style="margin:0">${title}</h2><small>${formatTime(order.createdAt)}</small></div><span class="badge">${statusLabel(order.status)}</span></div>
      ${order.orderType === "delivery" ? `<p><strong>โทร:</strong> ${order.recipientPhone || "-"}<br><strong>ที่อยู่:</strong> ${order.deliveryAddress || "-"}</p>` : ""}
      <ul class="order-items">${itemRows}</ul>
      ${order.note ? `<p><strong>หมายเหตุรวม:</strong> ${order.note}</p>` : ""}
      <div class="order-head"><strong>รวม ${money(order.totalAmount)} บาท</strong></div>
      <div class="order-actions" style="margin-top:12px">
        ${nextActions(order.status, order.orderType).map(([status,label,cls]) => `<button class="btn ${cls}" data-id="${order.id}" data-status="${status}">${label}</button>`).join("")}
        <button class="btn btn-danger" data-cancel-order="${order.id}">ยกเลิกทั้งออเดอร์</button>
      </div>
    </article>`;
  }).join("") : '<div class="card empty">ยังไม่มีออเดอร์ที่รอดำเนินการ</div>';
}

grid.addEventListener("click", async event => {
  const cancelItemButton = event.target.closest("[data-cancel-item]");
  if (cancelItemButton) {
    const order = currentOrders.find(item => item.id === cancelItemButton.dataset.cancelItem);
    const itemIndex = Number(cancelItemButton.dataset.itemIndex);
    if (!order || !Number.isInteger(itemIndex)) return;
    const selectedItem = order.items?.[itemIndex];
    if (!selectedItem || selectedItem.cancelled) return;
    if (!confirm(`ยกเลิกเฉพาะรายการ ${selectedItem.name} ใช่หรือไม่?`)) return;

    const items = order.items.map((item, index) => index === itemIndex ? { ...item, cancelled: true, cancelledReason: "out_of_stock", cancelledAt: new Date().toISOString() } : item);
    const totalAmount = items.filter(item => !item.cancelled).reduce((sum, item) => sum + Number(item.qty) * Number(item.price), 0);
    const patch = { items, totalAmount };
    if (totalAmount <= 0) patch.status = "cancelled";
    await dataService.updateOrder(order.id, patch);
    toast(totalAmount <= 0 ? "ยกเลิกทั้งออเดอร์แล้ว เพราะไม่มีรายการเหลือ" : "ยกเลิกรายการและคำนวณยอดใหม่แล้ว");
    return;
  }

  const cancelOrderButton = event.target.closest("[data-cancel-order]");
  if (cancelOrderButton) {
    if (!confirm("ยืนยันยกเลิกทุกรายการในออเดอร์นี้?")) return;
    await dataService.updateOrder(cancelOrderButton.dataset.cancelOrder, { status: "cancelled", totalAmount: 0, cancelledAt: new Date().toISOString() });
    toast("ยกเลิกทั้งออเดอร์แล้ว");
    return;
  }

  const button = event.target.closest("[data-id][data-status]");
  if (!button) return;
  const { id, status } = button.dataset;
  await dataService.updateOrder(id, { status });
  toast(`เปลี่ยนสถานะเป็น ${statusLabel(status)} แล้ว`);
});

dataService.subscribeOrders(render);
