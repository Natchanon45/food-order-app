import { dataService } from "./data-service.js";
import { money, formatTime } from "./ui.js";

const params = new URLSearchParams(location.search);
const ids = (params.get("orders") || "").split(",").map(v => v.trim()).filter(Boolean);

function receiptItemName(item) {
  const details = [];
  if (item.note) details.push(item.note);
  if (item.originalQty && (Number(item.originalQty) !== Number(item.qty) || item.originalName || item.replacedFromName)) {
    details.push(`ลูกค้าสั่งเดิม: ${item.originalName || item.replacedFromName || item.name} x ${item.originalQty}`);
  }
  return `<div class="receipt-item-line"><span class="receipt-item-text" title="${item.name}">${item.name}</span><span class="receipt-item-qty">x ${item.qty}</span></div>${details.map(text => `<div class="receipt-item-note">${text}</div>`).join("")}`;
}

if (!ids.length) {
  await import("./receipt.js?v=20260622-10");
} else {
  const receipt = document.querySelector("#receipt");
  const paperSize = document.querySelector("#paperSize");
  const setPaperSize = value => {
    receipt.classList.remove("size-58", "size-a4");
    if (value === "58") receipt.classList.add("size-58");
    if (value === "a4") receipt.classList.add("size-a4");
    localStorage.setItem("receipt_paper_size", value);
  };

  paperSize.value = localStorage.getItem("receipt_paper_size") || "80";
  setPaperSize(paperSize.value);
  paperSize.addEventListener("change", () => setPaperSize(paperSize.value));
  document.querySelector("#printButton").addEventListener("click", () => window.print());

  try {
    const orders = (await Promise.all(ids.map(id => dataService.getOrder(id)))).filter(Boolean).sort((a, b) => Number(a.roundNumber || 0) - Number(b.roundNumber || 0));
    if (!orders.length) throw new Error("NOT_FOUND");

    const settings = await dataService.getStoreSettings();
    const first = orders[0];
    const total = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const verifyUrl = `${location.origin}/verify/?orders=${encodeURIComponent(ids.join(","))}`;

    document.querySelector("#shopName").textContent = settings.shopName || "Food Order QR";
    document.querySelector("#shopAddress").textContent = settings.shopAddress || "";
    document.querySelector("#shopPhone").textContent = settings.shopPhone ? `โทร ${settings.shopPhone}` : "";
    document.querySelector("#receiptTitle").textContent = "ใบเสร็จรับเงินรวม";
    document.querySelector("#receiptTable").textContent = first.tableCode || "-";
    document.querySelector("#receiptNumber").textContent = `TABLE-${first.tableCode || "-"}-${String(first.tableToken || first.id).slice(0, 8)}`.toUpperCase();
    document.querySelector("#receiptDate").textContent = formatTime(first.createdAt);
    document.querySelector("#receiptPayment").textContent = orders.every(o => o.status === "paid" || o.paymentStatus === "paid") ? "ชำระเงินแล้ว" : "ยังไม่ชำระเงิน";
    document.querySelector("#receiptTotal").textContent = money(total);

    document.querySelector("#receiptItems").innerHTML = orders.map(order => `
      <tr><td colspan="3"><strong>รอบที่ ${order.roundNumber || 1}</strong></td></tr>
      ${(order.items || []).filter(item => !item.cancelled).map(item => `
        <tr><td class="receipt-item-name">${receiptItemName(item)}</td><td class="num receipt-unit">${money(Number(item.price))}</td><td class="num receipt-line-total">${money(Number(item.qty) * Number(item.price))}</td></tr>
      `).join("")}
    `).join("");

    const notes = orders.map(order => order.note).filter(Boolean);
    if (notes.length) {
      document.querySelector("#receiptNoteWrap").hidden = false;
      document.querySelector("#receiptNote").textContent = notes.join(" / ");
    }

    const qr = document.querySelector("#verifyQr");
    qr.hidden = false;
    qr.src = `https://quickchart.io/qr?text=${encodeURIComponent(verifyUrl)}&size=180&margin=1`;
    document.querySelector("#verifyCode").textContent = `${orders.length} รอบ • รวมบิลโต๊ะ ${first.tableCode || "-"}`;
  } catch (error) {
    console.error(error);
    receipt.innerHTML = '<div class="empty">โหลดใบเสร็จรวมไม่สำเร็จ</div>';
  }
}
