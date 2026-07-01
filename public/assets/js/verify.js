import { db, doc, getDoc } from "./firebase-config.js?v=20260630-073";
import { setActiveTenant } from "./tenant-context.js";

const params = new URLSearchParams(location.search);
const tenantSlug = (params.get("tenant") || "").trim().toLowerCase();
const orderId = params.get("order") || "";
const orderIds = (params.get("orders") || "").split(",").map(value => value.trim()).filter(Boolean);
const root = document.querySelector("#verifyResult");

if (tenantSlug) {
  const slugSnapshot = await getDoc(doc(db, "tenantSlugs", tenantSlug));
  if (!slugSnapshot.exists() || slugSnapshot.data().active === false) {
    throw new Error("ร้านนี้ไม่พร้อมให้บริการหรือไม่พบข้อมูลร้าน");
  }
  const tenant = slugSnapshot.data();
  setActiveTenant({ id: tenant.tenantId, slug: tenant.slug || tenantSlug, name: tenant.name || tenantSlug });
}

const [{ dataService }, { money, formatTime, statusLabel }] = await Promise.all([
  import("./data-service.js"),
  import("./ui.js?v=20260701-001")
]);

function paymentText(order) {
  if (order.paymentStatus === "paid" || order.status === "paid") return "ชำระเงินแล้ว";
  if (order.paymentMethod === "cod") return "เก็บเงินปลายทาง";
  if (order.paymentStatus === "pending_verification") return "รอตรวจสอบการชำระเงิน";
  return "ยังไม่ชำระเงิน";
}

function activeItems(order) {
  return (order.items || []).filter(item => !item.cancelled);
}

function currentSubtotal(order) {
  return activeItems(order).reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0), 0);
}

function currentTotal(order) {
  return currentSubtotal(order) + Number(order.deliveryFee || 0);
}

try {
  const settings = await dataService.getStoreSettings();

  if (orderIds.length) {
    const orders = (await Promise.all(orderIds.map(id => dataService.getOrder(id)))).filter(Boolean)
      .sort((a, b) => Number(a.roundNumber || 0) - Number(b.roundNumber || 0));
    if (!orders.length) throw new Error("ไม่พบรายการนี้ในระบบ");

    const first = orders[0];
    const total = orders.filter(order => order.status !== "cancelled").reduce((sum, order) => sum + currentTotal(order), 0);
    const paid = orders.every(order => order.paymentStatus === "paid" || order.status === "paid" || order.status === "cancelled");

    root.innerHTML = `
      <div class="section-title"><h2>${settings.shopName || "Food Order/Delivery With QR"}</h2><span class="badge">ข้อมูลล่าสุดจากระบบ</span></div>
      <p>${settings.shopAddress || ""}${settings.shopPhone ? `<br>โทร ${settings.shopPhone}` : ""}</p>
      <div class="grid grid-2">
        <div><strong>ประเภท</strong><br>รวมบิลโต๊ะ ${first.tableCode || "-"}</div>
        <div><strong>จำนวนรอบ</strong><br>${orders.length} รอบ</div>
        <div><strong>วันที่</strong><br>${formatTime(first.createdAt)}</div>
        <div><strong>การชำระเงิน</strong><br>${paid ? "ชำระเงินแล้ว" : "ยังไม่ชำระเงิน"}</div>
        <div><strong>ยอดสุทธิล่าสุด</strong><br>${money(total)} บาท</div>
      </div>
      <hr class="receipt-rule">
      ${orders.map(order => `
        <div class="card" style="margin-bottom:10px;${order.status === "cancelled" ? "opacity:.6" : ""}">
          <strong>รอบที่ ${order.roundNumber || 1}${order.status === "cancelled" ? " • ยกเลิกแล้ว" : ""}</strong>
          <ul class="order-items">${activeItems(order).map(item => `<li>${item.qty} × ${item.name}<strong style="float:right">${money(Number(item.qty) * Number(item.price))}</strong></li>`).join("") || '<li>ไม่มีรายการที่เรียกเก็บ</li>'}</ul>
        </div>
      `).join("")}
    `;
  } else {
    if (!orderId) throw new Error("ไม่พบเลขที่รายการ");
    const order = await dataService.getOrder(orderId);
    if (!order) throw new Error("ไม่พบรายการนี้ในระบบ");

    const isDelivery = order.orderType === "delivery";
    const subtotal = order.status === "cancelled" ? 0 : currentSubtotal(order);
    const deliveryFee = order.status === "cancelled" ? 0 : Number(order.deliveryFee || 0);
    const total = subtotal + deliveryFee;

    root.innerHTML = `
      <div class="section-title"><h2>${settings.shopName || "Food Order/Delivery With QR"}</h2><span class="badge">ข้อมูลล่าสุดจากระบบ</span></div>
      <p>${settings.shopAddress || ""}${settings.shopPhone ? `<br>โทร ${settings.shopPhone}` : ""}</p>
      <div class="grid grid-2">
        <div><strong>เลขที่รายการ</strong><br>${orderId.slice(0, 12).toUpperCase()}</div>
        <div><strong>วันที่</strong><br>${formatTime(order.createdAt)}</div>
        <div><strong>ประเภท</strong><br>${isDelivery ? "Delivery" : `โต๊ะ ${order.tableCode || "-"}`}</div>
        <div><strong>สถานะล่าสุด</strong><br>${statusLabel(order.status)}</div>
        <div><strong>การชำระเงิน</strong><br>${paymentText(order)}</div>
        <div><strong>ยอดสุทธิล่าสุด</strong><br>${money(total)} บาท</div>
      </div>
      ${isDelivery ? `<hr class="receipt-rule"><p><strong>ผู้รับ:</strong> ${order.recipientName || "-"}<br><strong>โทร:</strong> ${order.recipientPhone || "-"}<br><strong>ที่อยู่:</strong> ${order.deliveryAddress || "-"}<br><strong>ค่าจัดส่ง:</strong> ${money(deliveryFee)} บาท</p>` : ""}
      <hr class="receipt-rule">
      <ul class="order-items">${activeItems(order).map(item => `<li>${item.qty} × ${item.name}<strong style="float:right">${money(Number(item.qty) * Number(item.price))}</strong></li>`).join("") || '<li>ไม่มีรายการที่เรียกเก็บ</li>'}</ul>
      ${(order.items || []).some(item => item.cancelled) ? '<p class="menu-category">มีบางรายการถูกยกเลิกโดยร้านค้า ยอดด้านบนคำนวณใหม่แล้ว</p>' : ""}
    `;
  }
} catch (error) {
  console.error(error);
  root.innerHTML = `<div class="empty">${error.message}</div>`;
}
