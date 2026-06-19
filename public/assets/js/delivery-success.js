import { dataService } from "./data-service.js";
import { money, formatTime, toast } from "./ui.js";

const orderId = new URLSearchParams(location.search).get("order") || "";
const receipt = document.querySelector("#customerReceipt");

function paymentText(order) {
  if (order.paymentStatus === "paid") return "ชำระเงินแล้ว";
  if (order.paymentMethod === "cod") return "เก็บเงินปลายทาง";
  return "ยังไม่ชำระเงิน";
}

async function load() {
  if (!orderId) throw new Error("ไม่พบเลขที่คำสั่งซื้อ");
  const [order, settings] = await Promise.all([
    dataService.getOrder(orderId),
    dataService.getStoreSettings()
  ]);
  if (!order) throw new Error("ไม่พบคำสั่งซื้อ");

  document.querySelector("#shopName").textContent = settings.shopName || "Food Order QR";
  document.querySelector("#shopAddress").textContent = settings.shopAddress || "";
  document.querySelector("#shopPhone").textContent = settings.shopPhone ? `โทร ${settings.shopPhone}` : "";
  document.querySelector("#receiptNumber").textContent = orderId.slice(0, 12).toUpperCase();
  document.querySelector("#receiptDate").textContent = formatTime(order.createdAt);
  document.querySelector("#receiptPayment").textContent = paymentText(order);
  document.querySelector("#receiptRecipient").textContent = order.recipientName || "-";
  document.querySelector("#receiptPhone").textContent = order.recipientPhone || "-";
  document.querySelector("#receiptAddress").textContent = order.deliveryAddress || "-";
  document.querySelector("#receiptDeliveryZone").textContent = order.deliveryZoneLabel || "-";
  document.querySelector("#receiptSubtotal").textContent = money(order.subtotalAmount ?? (Number(order.totalAmount || 0) - Number(order.deliveryFee || 0)));
  document.querySelector("#receiptDeliveryFee").textContent = money(order.deliveryFee || 0);
  document.querySelector("#receiptTotal").textContent = money(order.totalAmount);
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

  const verifyUrl = `${location.origin}/verify/?order=${encodeURIComponent(orderId)}`;
  document.querySelector("#verifyQr").src = `https://quickchart.io/qr?text=${encodeURIComponent(verifyUrl)}&size=180&margin=1`;
}

async function createReceiptFile() {
  const canvas = await html2canvas(receipt, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png", 1));
  return new File([blob], `delivery-${orderId.slice(0, 12)}.png`, { type: "image/png" });
}

document.querySelector("#saveImageButton").addEventListener("click", async event => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = "กำลังสร้างรูป...";
  try {
    const file = await createReceiptFile();
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: "คำสั่งซื้อ Delivery", text: `เลขที่ ${orderId.slice(0, 12).toUpperCase()}`, files: [file] });
    } else {
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("บันทึกรูปคำสั่งซื้อแล้ว");
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error(error);
      toast("บันทึกรูปไม่สำเร็จ", "error");
    }
  } finally {
    button.disabled = false;
    button.textContent = "บันทึก/แชร์เป็นรูป";
  }
});

try {
  await load();
} catch (error) {
  console.error(error);
  receipt.innerHTML = `<div class="empty">${error.message}</div>`;
}
