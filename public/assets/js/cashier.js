import { dataService, usingDemoMode } from "./data-service.js";
import { money, statusLabel, formatTime, toast } from "./ui.js";

if (usingDemoMode) {
  document.querySelector("#demoBanner").innerHTML = '<div class="demo-banner">โหมดตัวอย่าง: ข้อมูลอยู่ในเบราว์เซอร์นี้</div>';
}

const grid = document.querySelector("#orderGrid");
let currentOrders = [];

function paymentLabel(order) {
  if (order.paymentStatus === "paid" && order.status === "served") return "ชำระแล้ว รอระบบปิดออเดอร์";
  if (order.paymentStatus === "paid") return "ตรวจสอบและรับชำระแล้ว";
  if (order.paymentStatus === "pending_verification") return "มีสลิป รอตรวจสอบ";
  if (order.paymentMethod === "cod") return "เก็บเงินปลายทาง";
  return "รอชำระเงิน";
}

function render(orders) {
  currentOrders = orders;
  const active = orders.filter(order => !["paid", "cancelled"].includes(order.status));

  grid.innerHTML = active.length ? active.map(order => {
    const isDelivery = order.orderType === "delivery";
    const title = isDelivery ? `Delivery: ${order.recipientName || "ไม่ระบุชื่อ"}` : `โต๊ะ ${order.tableCode} • รอบที่ ${order.roundNumber || 1}`;
    const paymentAction = isDelivery && order.paymentStatus !== "paid"
      ? `<button class="btn btn-primary" data-payment-id="${order.id}">ตรวจสอบแล้ว/รับชำระแล้ว</button>`
      : "";
    const slipAction = order.paymentSlipUrl
      ? `<a class="btn btn-warning" href="${order.paymentSlipUrl}" target="_blank" rel="noopener">ดูสลิป</a>`
      : "";
    const itemRows = (order.items || []).map(item => `
      <li style="${item.cancelled ? "opacity:.5;text-decoration:line-through" : ""}">
        ${item.qty} × ${item.name}
        <strong style="float:right">${item.cancelled ? "ยกเลิก" : money(item.qty * item.price)}</strong>
      </li>
    `).join("");

    return `<article class="card order-card">
      <div class="order-head"><div><h2 style="margin:0">${title}</h2><small>${formatTime(order.createdAt)}</small></div><span class="badge">${statusLabel(order.status)}</span></div>
      ${isDelivery ? `<p><span class="badge ${order.paymentStatus === "paid" ? "" : "warning"}">${paymentLabel(order)}</span><br><strong>โทร:</strong> ${order.recipientPhone || "-"}<br><strong>ที่อยู่:</strong> ${order.deliveryAddress || "-"}</p>` : ""}
      <ul class="order-items">${itemRows}</ul>
      <div class="order-head"><strong>ยอดสุทธิ</strong><strong class="price">${money(order.totalAmount)} บาท</strong></div>
      <div class="order-actions" style="margin-top:12px">
        <a class="btn btn-dark" href="/cashier/receipt/?order=${encodeURIComponent(order.id)}" target="_blank" rel="noopener">พิมพ์ใบเสร็จ</a>
        ${slipAction}${paymentAction}
        ${isDelivery ? "" : `<button class="btn btn-primary" data-id="${order.id}" data-status="paid">รับชำระแล้ว</button>`}
        <button class="btn btn-danger" data-id="${order.id}" data-status="cancelled">ยกเลิก</button>
      </div>
    </article>`;
  }).join("") : '<div class="card empty">ไม่มีบิลที่รอดำเนินการ</div>';
}

grid.addEventListener("click", async event => {
  const paymentButton = event.target.closest("[data-payment-id]");
  if (paymentButton) {
    if (!confirm("ตรวจสอบสลิปหรือรับเงินเรียบร้อยแล้วใช่หรือไม่?")) return;
    paymentButton.disabled = true;
    const order = currentOrders.find(item => item.id === paymentButton.dataset.paymentId);

    try {
      const now = new Date().toISOString();
      const patch = {
        paymentStatus: "paid",
        paidAt: now
      };

      if (order?.orderType === "delivery" && order.status === "served") {
        patch.status = "paid";
        patch.completedAt = now;
      }

      await dataService.updateOrder(paymentButton.dataset.paymentId, patch);
      toast(patch.status === "paid"
        ? "ชำระเงินและปิดออเดอร์ Delivery แล้ว"
        : "บันทึกการชำระเงินแล้ว รอครัวส่งให้ไรเดอร์");
    } catch (error) {
      console.error(error);
      toast("บันทึกการชำระเงินไม่สำเร็จ", "error");
      paymentButton.disabled = false;
    }
    return;
  }

  const button = event.target.closest("[data-id][data-status]");
  if (!button) return;
  const { id, status } = button.dataset;
  const order = currentOrders.find(item => item.id === id);
  button.disabled = true;

  try {
    await dataService.updateOrder(id, { status });

    if ((status === "paid" || status === "cancelled") && order?.orderType !== "delivery" && order?.tableCode) {
      const hasOtherActiveRounds = currentOrders.some(item => item.id !== id && item.tableToken === order.tableToken && !["paid", "cancelled"].includes(item.status));
      if (!hasOtherActiveRounds) {
        const table = await dataService.getTable(order.tableCode);
        if (table && (!order.tableToken || table.orderToken === order.tableToken)) {
          await dataService.updateTable(table.id, { status: "available", orderToken: "", sessionStartedAt: null, currentRound: 0 });
        }
      }
    }

    toast(status === "paid" ? "บันทึกการชำระเงินรอบนี้แล้ว" : "ยกเลิกรายการแล้ว");
  } catch (error) {
    console.error(error);
    toast("อัปเดตสถานะไม่สำเร็จ", "error");
    button.disabled = false;
  }
});

dataService.subscribeOrders(render);
