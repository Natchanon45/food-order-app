import { dataService } from "./data-service.js";
import { money, formatTime, toast } from "./ui.js";

const orderId = new URLSearchParams(location.search).get("order") || "";
const receipt = document.querySelector("#customerReceipt");
const saveButton = document.querySelector("#saveImageButton");

function paymentText(order) {
  if (order.paymentStatus === "paid") return "ชำระเงินแล้ว";
  if (order.paymentMethod === "cod") return "เก็บเงินปลายทาง";
  if (order.paymentStatus === "pending_verification") return "ส่งหลักฐานแล้ว รอร้านตรวจสอบ";
  return "ยังไม่ชำระเงิน";
}

function receiptItemName(item) {
  return `<div class="receipt-item-line"><span class="receipt-item-text" title="${item.name}">${item.name}</span><span class="receipt-item-qty">x ${item.qty}</span></div>${item.note ? `<div class="receipt-item-note">${item.note}</div>` : ""}`;
}

async function load() {
  if (!orderId) throw new Error("ไม่พบเลขที่คำสั่งซื้อ");
  const [order, settings] = await Promise.all([dataService.getOrder(orderId), dataService.getStoreSettings()]);
  if (!order) throw new Error("ไม่พบคำสั่งซื้อ");

  document.querySelector("#shopName").textContent = settings.shopName || "Food Order/Delivery With QR";
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
      <td class="receipt-item-name">${receiptItemName(item)}</td>
      <td class="num receipt-unit">${money(Number(item.price))}</td>
      <td class="num receipt-line-total">${money(Number(item.qty) * Number(item.price))}</td>
    </tr>
  `).join("");

  if (order.note) {
    document.querySelector("#receiptNoteWrap").hidden = false;
    document.querySelector("#receiptNote").textContent = order.note;
  }

  const verifyUrl = `${location.origin}/verify/?order=${encodeURIComponent(orderId)}`;
  const verifyQr = document.querySelector("#verifyQr");
  verifyQr.crossOrigin = "anonymous";
  verifyQr.src = `https://quickchart.io/qr?text=${encodeURIComponent(verifyUrl)}&size=180&margin=1`;
}

async function waitForReceiptReady() {
  if (document.fonts?.ready) await document.fonts.ready;
  const images = [...receipt.querySelectorAll("img")];
  await Promise.all(images.map(image => {
    if (image.complete) return Promise.resolve();
    return new Promise(resolve => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
      setTimeout(resolve, 3000);
    });
  }));
}

async function createReceiptBlob() {
  await waitForReceiptReady();
  const canvas = await html2canvas(receipt, {
    scale: Math.min(3, Math.max(2, window.devicePixelRatio || 1)),
    backgroundColor: "#ffffff",
    useCORS: true,
    allowTaint: false,
    logging: false,
    imageTimeout: 4000,
    ignoreElements: element => element.id === "verifyQr"
  });
  return await new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("RECEIPT_IMAGE_FAILED")), "image/png", 1);
  });
}

async function downloadReceipt() {
  const blob = await createReceiptBlob();
  const fileName = `delivery-order-${orderId.slice(0, 12).toUpperCase()}.png`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

saveButton.addEventListener("click", async () => {
  saveButton.disabled = true;
  saveButton.textContent = "กำลังสร้างรูปใบสั่งซื้อ...";
  try {
    await downloadReceipt();
    toast("ดาวน์โหลดใบสั่งซื้อแล้ว");
  } catch (error) {
    console.error(error);
    toast("ดาวน์โหลดใบสั่งซื้อไม่สำเร็จ กรุณาลองใหม่", "error");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "ดาวน์โหลดใบสั่งซื้อ";
  }
});

try {
  await load();
} catch (error) {
  console.error(error);
  receipt.innerHTML = `<div class="empty">${error.message}</div>`;
  saveButton.disabled = true;
}
