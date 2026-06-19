import { dataService, usingDemoMode } from "./data-service.js";
import { money, formatTime } from "./ui.js";

if (usingDemoMode) {
  document.querySelector("#demoBanner").innerHTML =
    '<div class="demo-banner no-print">โหมดตัวอย่าง: ใบเสร็จอ้างอิงข้อมูลจากเบราว์เซอร์นี้</div>';
}

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

function render(order) {
  document.querySelector("#receiptTable").textContent = order.tableCode || "-";
  document.querySelector("#receiptNumber").textContent = (order.id || orderId).slice(0, 12).toUpperCase();
  document.querySelector("#receiptDate").textContent = formatTime(order.createdAt);
  document.querySelector("#receiptTotal").textContent = money(order.totalAmount);

  document.querySelector("#receiptItems").innerHTML = (order.items || []).map(item => `
    <tr>
      <td>
        ${item.name}
        ${item.note ? `<div style="font-size:.85em">${item.note}</div>` : ""}
      </td>
      <td class="num">${item.qty}</td>
      <td class="num">${money(Number(item.qty) * Number(item.price))}</td>
    </tr>
  `).join("");

  if (order.note) {
    document.querySelector("#receiptNoteWrap").hidden = false;
    document.querySelector("#receiptNote").textContent = order.note;
  }
}

if (!orderId) {
  receipt.innerHTML = '<div class="empty">ไม่พบเลขที่ออเดอร์</div>';
} else {
  let found = false;
  dataService.subscribeOrders(orders => {
    const order = orders.find(item => item.id === orderId);
    if (order) {
      found = true;
      render(order);
    } else if (!found) {
      receipt.innerHTML = '<div class="empty">ไม่พบข้อมูลใบเสร็จนี้</div>';
    }
  });
}
