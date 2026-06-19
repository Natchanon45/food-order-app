import { dataService, usingDemoMode } from "./data-service.js";
import { money, statusLabel, formatTime, toast } from "./ui.js";

if (usingDemoMode) document.querySelector("#demoBanner").innerHTML = '<div class="demo-banner">โหมดตัวอย่าง</div>';

const grid = document.querySelector("#orderGrid");
const activeStatuses = ["pending", "accepted", "cooking", "ready", "served"];

function nextActions(status, orderType) {
  if (status === "pending") return [["accepted", "รับออเดอร์", "btn-primary"]];
  if (status === "accepted") return [["cooking", "เริ่มทำ", "btn-warning"]];
  if (status === "cooking") return [["ready", orderType === "delivery" ? "พร้อมจัดส่ง" : "พร้อมเสิร์ฟ", "btn-primary"]];
  if (status === "ready") return [["served", orderType === "delivery" ? "ส่งให้ไรเดอร์แล้ว" : "เสิร์ฟแล้ว", "btn-dark"]];
  return [];
}

function render(orders) {
  const active = orders.filter(x => activeStatuses.includes(x.status));
  grid.innerHTML = active.length ? active.map(order => {
    const title = order.orderType === "delivery" ? `Delivery: ${order.recipientName || "ไม่ระบุชื่อ"}` : `โต๊ะ ${order.tableCode}`;
    return `<article class="card order-card"><div class="order-head"><div><h2 style="margin:0">${title}</h2><small>${formatTime(order.createdAt)}</small></div><span class="badge">${statusLabel(order.status)}</span></div>${order.orderType === "delivery" ? `<p><strong>โทร:</strong> ${order.recipientPhone || "-"}<br><strong>ที่อยู่:</strong> ${order.deliveryAddress || "-"}</p>` : ""}<ul class="order-items">${(order.items || []).map(item => `<li><strong>${item.qty} × ${item.name}</strong>${item.note ? `<br><small>หมายเหตุ: ${item.note}</small>` : ""}</li>`).join("")}</ul>${order.note ? `<p><strong>หมายเหตุรวม:</strong> ${order.note}</p>` : ""}<div class="order-head"><strong>รวม ${money(order.totalAmount)} บาท</strong></div><div class="order-actions" style="margin-top:12px">${nextActions(order.status, order.orderType).map(([status,label,cls]) => `<button class="btn ${cls}" data-id="${order.id}" data-status="${status}">${label}</button>`).join("")}</div></article>`;
  }).join("") : '<div class="card empty">ยังไม่มีออเดอร์ที่รอดำเนินการ</div>';
}

grid.addEventListener("click", async event => {
  const { id, status } = event.target.dataset;
  if (!id || !status) return;
  await dataService.updateOrder(id, { status });
  toast(`เปลี่ยนสถานะเป็น ${statusLabel(status)} แล้ว`);
});

dataService.subscribeOrders(render);
