import { dataService, usingDemoMode } from "./data-service.js";
import { money, statusLabel, formatTime, toast } from "./ui.js";

if (usingDemoMode) {
  document.querySelector("#demoBanner").innerHTML =
    '<div class="demo-banner">โหมดตัวอย่าง: ข้อมูลอยู่ในเบราว์เซอร์นี้</div>';
}

const grid = document.querySelector("#orderGrid");
let currentOrders = [];

function render(orders) {
  currentOrders = orders;
  const active = orders.filter(order => !["paid", "cancelled"].includes(order.status));

  grid.innerHTML = active.length
    ? active.map(order => `
      <article class="card order-card">
        <div class="order-head">
          <div>
            <h2 style="margin:0">โต๊ะ ${order.tableCode}</h2>
            <small>${formatTime(order.createdAt)}</small>
          </div>
          <span class="badge">${statusLabel(order.status)}</span>
        </div>

        <ul class="order-items">
          ${(order.items || []).map(item => `
            <li>
              ${item.qty} × ${item.name}
              <strong style="float:right">${money(item.qty * item.price)}</strong>
            </li>
          `).join("")}
        </ul>

        <div class="order-head">
          <strong>ยอดสุทธิ</strong>
          <strong class="price">${money(order.totalAmount)} บาท</strong>
        </div>

        <div class="order-actions" style="margin-top:12px">
          <a class="btn btn-dark" href="/cashier/receipt/?order=${encodeURIComponent(order.id)}" target="_blank" rel="noopener">
            พิมพ์ใบเสร็จ
          </a>
          <button class="btn btn-primary" data-id="${order.id}" data-status="paid">รับชำระแล้ว</button>
          <button class="btn btn-danger" data-id="${order.id}" data-status="cancelled">ยกเลิก</button>
        </div>
      </article>
    `).join("")
    : '<div class="card empty">ไม่มีบิลที่รอชำระ</div>';
}

grid.addEventListener("click", async event => {
  const button = event.target.closest("[data-id][data-status]");
  if (!button) return;

  const { id, status } = button.dataset;
  const order = currentOrders.find(item => item.id === id);
  button.disabled = true;

  try {
    await dataService.updateOrder(id, { status });

    if ((status === "paid" || status === "cancelled") && order?.tableCode) {
      const table = await dataService.getTable(order.tableCode);
      if (table && (!order.tableToken || table.orderToken === order.tableToken)) {
        await dataService.updateTable(table.id, {
          status: "available",
          orderToken: "",
          sessionStartedAt: null
        });
      }
    }

    toast(status === "paid" ? "ปิดบิลและคืนสถานะโต๊ะว่างแล้ว" : "ยกเลิกบิลและคืนสถานะโต๊ะว่างแล้ว");
  } catch (error) {
    console.error(error);
    toast("อัปเดตสถานะไม่สำเร็จ", "error");
    button.disabled = false;
  }
});

dataService.subscribeOrders(render);
